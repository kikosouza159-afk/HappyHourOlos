import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { topTwo, eligibleForRound } from './election.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venues = JSON.parse(fs.readFileSync(path.join(root, 'data/venues.json'), 'utf8'));
const venueMap = new Map(venues.map(item => [item.id, item]));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '24kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const port = Number(process.env.PORT || 4000);
const databaseUrl = process.env.DATABASE_URL?.trim();
const secret = process.env.VOTE_SECRET || 'development-only-not-for-production';
const accessCode = process.env.VOTE_ACCESS_CODE?.trim() || '';
const adminKey = process.env.VOTE_ADMIN_KEY?.trim() || '';
const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
const localDir = path.join(root, '.local-data');
const localFile = path.join(localDir, 'votes.json');
const localFinalFile = path.join(localDir, 'final-votes.json');
const localElectionFile = path.join(localDir, 'election.json');
const rateLimits = new Map();
const googleCache = new Map();
let pool;

const note = msg => console.log(`[AFTERHOURS] ${msg}`);
const databaseMode = databaseUrl ? 'postgres' : 'local-demo';
const initialElection = () => ({ round: 1, phase: 'open', finalists: { bars: [], burgers: [] }, updatedAt: new Date().toISOString() });
const readJson = (filename, fallback) => {
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch { return fallback; }
};
const writeJson = (filename, data) => {
  const temp = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, filename);
};

async function setupStorage() {
  if (databaseUrl) {
    pool = new pg.Pool({
      connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...(process.env.PG_SSL === 'false' ? { ssl: false } : {})
    });
    // Preserve the existing first-round table and all its historical votes.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.afterhours_votes (
        voter_hash CHAR(64) NOT NULL,
        category VARCHAR(16) NOT NULL CHECK (category IN ('bars','burgers')),
        venue_id VARCHAR(70) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (voter_hash, category)
      );
      CREATE TABLE IF NOT EXISTS public.afterhours_final_votes (
        voter_hash CHAR(64) NOT NULL,
        category VARCHAR(16) NOT NULL CHECK (category IN ('bars','burgers')),
        venue_id VARCHAR(70) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (voter_hash, category)
      );
      CREATE TABLE IF NOT EXISTS public.afterhours_ballots (
        voter_hash CHAR(64) NOT NULL,
        round SMALLINT NOT NULL CHECK (round IN (1,2)),
        slot SMALLINT NOT NULL CHECK (slot IN (1,2)),
        venue_id VARCHAR(70) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (voter_hash, round, slot),
        UNIQUE (voter_hash, round, venue_id)
      );
      CREATE TABLE IF NOT EXISTS public.afterhours_election_state (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        current_round SMALLINT NOT NULL DEFAULT 1 CHECK (current_round IN (1,2)),
        phase VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (phase IN ('open','closed')),
        bars_finalists VARCHAR(70)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(70)[],
        burgers_finalists VARCHAR(70)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(70)[],
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO public.afterhours_election_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);
    // Import existing ballots without erasing votes from the previous version.
    await pool.query(`
      INSERT INTO public.afterhours_ballots (voter_hash, round, slot, venue_id, updated_at)
      SELECT voter_hash, 1, CASE WHEN category='bars' THEN 1 ELSE 2 END, venue_id, updated_at
      FROM public.afterhours_votes ON CONFLICT DO NOTHING;
      INSERT INTO public.afterhours_ballots (voter_hash, round, slot, venue_id, updated_at)
      SELECT voter_hash, 2, CASE WHEN category='bars' THEN 1 ELSE 2 END, venue_id, updated_at
      FROM public.afterhours_final_votes ON CONFLICT DO NOTHING;
    `);
    note('PostgreSQL conectado; cédulas com dois votos livres por turno.');
  } else {
    fs.mkdirSync(localDir, { recursive: true });
    for (const file of [localFile, localFinalFile]) {
      if (!fs.existsSync(file)) writeJson(file, []);
    }
    if (!fs.existsSync(localElectionFile)) writeJson(localElectionFile, initialElection());
    note('ATENÇÃO: sem DATABASE_URL. Dados locais podem ser apagados no Render.');
  }
  if (!process.env.VOTE_SECRET) note('ATENÇÃO: configure VOTE_SECRET em produção.');
  if (!adminKey) note('Segundo turno: configure VOTE_ADMIN_KEY no Render para liberar o painel do organizador.');
}

const hashEmail = email => crypto.createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
function safeEqual(actual, expected) {
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function throttle(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const recent = (rateLimits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 25) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  recent.push(now); rateLimits.set(ip, recent);
  if (rateLimits.size > 3000) for (const [key, values] of rateLimits) {
    if (values.every(t => now - t > 600000)) rateLimits.delete(key);
  }
  next();
}
const validCategory = category => category === 'bars' || category === 'burgers';

async function getElection() {
  if (!pool) return readJson(localElectionFile, initialElection());
  const { rows } = await pool.query('SELECT current_round, phase, bars_finalists, burgers_finalists, updated_at FROM public.afterhours_election_state WHERE id = 1');
  const row = rows[0];
  return { round: row.current_round, phase: row.phase, finalists: { bars: row.bars_finalists, burgers: row.burgers_finalists }, updatedAt: row.updated_at };
}
async function countsForRound(round) {
  const counts = Object.fromEntries(venues.map(v => [v.id, 0]));
  const totals = { bars: 0, burgers: 0 };
  const votes = pool
    ? (await pool.query('SELECT venue_id AS "venueId" FROM public.afterhours_ballots WHERE round=$1', [round])).rows
    : readJson(round === 2 ? localFinalFile : localFile, []);
  for (const vote of votes) {
    const venue = venueMap.get(vote.venueId);
    if (!venue) continue;
    counts[venue.id] += 1;
    totals[venue.category] += 1;
  }
  return { counts, totals };
}

async function getResults() {
  const election = await getElection();
  const current = await countsForRound(election.round);
  const firstRound = election.round === 2 ? await countsForRound(1) : null;
  return {
    ...current, ...election, firstRound,
    updatedAt: new Date().toISOString()
  };
}
async function votedBothInFirstRound(voterHash) {
  if (pool) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM public.afterhours_ballots WHERE voter_hash=$1 AND round=1', [voterHash]);
    return rows[0].total === 2;
  }
  return readJson(localFile, []).filter(v => v.voterHash === voterHash).length === 2;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'afterhours' }));
app.get('/api/config', (_req, res) => res.json({
  persistence: databaseMode,
  googlePhotosEnabled: Boolean(googleKey),
  requiresAccessCode: Boolean(accessCode),
  adminEnabled: Boolean(adminKey),
  eventName: 'AFTERHOURS 2026'
}));
app.get('/api/results', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await getResults()); }
  catch (error) { next(error); }
});
app.post('/api/votes', throttle, async (req, res, next) => {
  try {
    const { category, venueId, slot } = req.body || {};
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]{2,80}@[^\s@]+\.[^\s@]{2,30}$/.test(email) || email.length > 150) {
      return res.status(400).json({ error: 'Informe um e-mail válido para registrar o voto.' });
    }
    if (accessCode && !safeEqual(String(req.body.accessCode || ''), accessCode)) {
      return res.status(403).json({ error: 'Código de acesso do time incorreto.' });
    }
    if (slot !== 1 && slot !== 2) return res.status(400).json({ error: 'Escolha o voto 1 ou 2.' });
    const selected = venueMap.get(venueId);
    if (!selected || selected.category !== category || !validCategory(category)) {
      return res.status(400).json({ error: 'Opção de voto inválida.' });
    }
    if (!selected.enabled) return res.status(400).json({ error: 'Este estabelecimento está fora da votação.' });
    const election = await getElection();
    if (election.phase !== 'open') return res.status(403).json({ error: 'A votação está encerrada.' });
    if (!eligibleForRound(selected, election)) {
      return res.status(400).json({ error: 'Somente os dois finalistas participam do segundo turno.' });
    }
    const voterHash = hashEmail(email);
    if (election.round === 2 && !await votedBothInFirstRound(voterHash)) {
      return res.status(403).json({ error: 'Para votar na final, registre seus dois votos no primeiro turno com este e-mail.' });
    }
    if (pool) {
      const { rows } = await pool.query(
        'SELECT slot, venue_id FROM public.afterhours_ballots WHERE voter_hash=$1 AND round=$2', [voterHash, election.round]
      );
      if (rows.some(v => v.venue_id === venueId && v.slot !== slot)) {
        return res.status(409).json({ error: 'Este local já foi escolhido no outro voto. Escolha dois locais diferentes.' });
      }
      await pool.query(`INSERT INTO public.afterhours_ballots (voter_hash,round,slot,venue_id)
        VALUES ($1,$2,$3,$4) ON CONFLICT (voter_hash,round,slot)
        DO UPDATE SET venue_id=EXCLUDED.venue_id,updated_at=NOW()`, [voterHash, election.round, slot, venueId]);
    } else {
      const file = election.round === 2 ? localFinalFile : localFile;
      const votes = readJson(file, []);
      if (votes.some(v => v.voterHash === voterHash && v.venueId === venueId && v.slot !== slot)) {
        return res.status(409).json({ error: 'Este local já está no outro voto.' });
      }
      const existing = votes.findIndex(v => v.voterHash === voterHash && v.slot === slot);
      const nextVote = { voterHash, slot, category, venueId, updatedAt: new Date().toISOString() };
      if (existing === -1) votes.push(nextVote); else votes[existing] = nextVote;
      writeJson(file, votes);
    }
    res.json({ ok: true, round: election.round, slot, venueId, category, results: await getResults(),
      message: `Voto do ${election.round}º turno registrado.` });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Local duplicado no outro voto. Atualize e escolha outro.' });
    next(error);
  }
});

// Organizer-only actions: no UI key is embedded in the frontend or logged.
function adminAuth(req, res, next) {
  if (!adminKey) return res.status(503).json({ error: 'Configure VOTE_ADMIN_KEY no Render para administrar os turnos.' });
  if (!safeEqual(String(req.get('x-admin-key') || ''), adminKey)) {
    return res.status(403).json({ error: 'Chave de organizador incorreta.' });
  }
  next();
}
app.get('/api/admin/status', throttle, adminAuth, async (_req, res, next) => {
  try { res.json(await getResults()); } catch (error) { next(error); }
});
app.post('/api/admin/advance', throttle, adminAuth, async (_req, res, next) => {
  try {
    const first = await countsForRound(1);
    if (first.totals.bars + first.totals.burgers < 2) {
      return res.status(409).json({ error: 'São necessários pelo menos dois votos antes de abrir o segundo turno.' });
    }
    const finalists = { bars: topTwo(venues, 'bars', first.counts), burgers: topTwo(venues, 'burgers', first.counts) };
    if (pool) {
      const { rowCount } = await pool.query(`UPDATE public.afterhours_election_state
        SET current_round=2, phase='open', bars_finalists=$1, burgers_finalists=$2, updated_at=NOW()
        WHERE id=1 AND current_round=1 AND phase='open'`, [finalists.bars, finalists.burgers]);
      if (!rowCount) return res.status(409).json({ error: 'O segundo turno já foi aberto ou a votação está encerrada.' });
    } else {
      const current = await getElection();
      if (current.round !== 1 || current.phase !== 'open') return res.status(409).json({ error: 'A etapa atual não permite abrir o segundo turno.' });
      writeJson(localElectionFile, { round: 2, phase: 'open', finalists, updatedAt: new Date().toISOString() });
    }
    res.json({ ok: true, message: 'Segundo turno aberto. Os dois mais votados de cada categoria são os finalistas.', results: await getResults() });
  } catch (error) { next(error); }
});
app.post('/api/admin/close', throttle, adminAuth, async (_req, res, next) => {
  try {
    const election = await getElection();
    if (election.round !== 2 || election.phase !== 'open') return res.status(409).json({ error: 'Apenas a final aberta pode ser encerrada.' });
    if (pool) {
      await pool.query('UPDATE public.afterhours_election_state SET phase=$1,updated_at=NOW() WHERE id=1 AND current_round=2 AND phase=$2', ['closed','open']);
    } else writeJson(localElectionFile, { ...election, phase: 'closed', updatedAt: new Date().toISOString() });
    res.json({ ok: true, message: 'Votação encerrada. Resultados finais disponíveis.', results: await getResults() });
  } catch (error) { next(error); }
});

async function getGoogleVenue(venue) {
  if (!googleKey) return null;
  const cached = googleCache.get(venue.id);
  if (cached && Date.now() - cached.time < 15 * 60 * 1000) return cached.value;
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': googleKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.photos' },
    body: JSON.stringify({ textQuery: `${venue.name}, ${venue.address}`, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 1 }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Google Places HTTP ${response.status}. Confira API, chave e faturamento.`);
  const payload = await response.json();
  const place = payload.places?.[0];
  if (!place) return null;
  const value = {
    displayName: place.displayName?.text || venue.name, address: place.formattedAddress || venue.address,
    googleMapsUrl: place.googleMapsUri,
    photos: (place.photos || []).slice(0, 3).map((p, index) => ({
      id: index, name: p.name, src: `/api/places/${venue.id}/photos/${index}`,
      attributions: (p.authorAttributions || []).map(a => ({ name: a.displayName, url: a.uri }))
    }))
  };
  googleCache.set(venue.id, { time: Date.now(), value });
  return value;
}
app.get('/api/places/:id', async (req, res) => {
  const venue = venueMap.get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Local não encontrado' });
  if (!googleKey) return res.json({ enabled: false, photos: [] });
  try {
    const data = await getGoogleVenue(venue);
    return res.json({ enabled: true, ...(data || { photos: [] }) });
  } catch (error) { note(error.message); return res.status(502).json({ error: 'Fotos temporariamente indisponíveis', photos: [] }); }
});
app.get('/api/places/:id/photos/:index', async (req, res) => {
  const venue = venueMap.get(req.params.id); const index = Number(req.params.index);
  if (!venue || !Number.isInteger(index) || index < 0 || index > 2 || !googleKey) return res.status(404).end();
  try {
    const place = await getGoogleVenue(venue);
    const photoName = place?.photos[index]?.name;
    if (!photoName || !/^[a-zA-Z0-9/_\.\-]+$/.test(photoName)) return res.status(404).end();
    const mediaUrl = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
    mediaUrl.searchParams.set('maxWidthPx', '1200');
    mediaUrl.searchParams.set('skipHttpRedirect', 'true');
    mediaUrl.searchParams.set('key', googleKey);
    const response = await fetch(mediaUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(502).end();
    const data = await response.json();
    if (!data.photoUri || !data.photoUri.startsWith('https://')) return res.status(502).end();
    res.set('Cache-Control', 'private, max-age=300'); return res.redirect(302, data.photoUri);
  } catch (error) { note(error.message); return res.status(502).end(); }
});

if (fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  app.use(express.static(path.join(root, 'dist'), { maxAge: '1h', index: false }));
  app.get('*', (req, res) => {
    const safeHost = (req.get('host') || '').replace(/[^a-zA-Z0-9.:-]/g, '');
    const origin = `${req.protocol}://${safeHost}`;
    const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8').replaceAll('__BASE_URL__', origin);
    res.type('html').send(html);
  });
} else {
  app.get('/', (_req, res) => res.type('text').send('Frontend não compilado. Execute npm run dev ou npm run build.'));
}
app.use((err, _req, res, _next) => {
  note(`Erro interno: ${err.stack || err.message}`);
  res.status(500).json({ error: 'Não foi possível completar a operação. Tente novamente.' });
});

setupStorage().then(() => app.listen(port, '0.0.0.0', () => note(`Servidor ouvindo porta ${port}`))).catch(error => {
  console.error('[AFTERHOURS] Falha ao iniciar:', error.message); process.exit(1);
});

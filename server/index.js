import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venues = JSON.parse(fs.readFileSync(path.join(root, 'data/venues.json'), 'utf8'));
const venueMap = new Map(venues.map(item => [item.id, item]));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '24kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const port = Number(process.env.PORT || 4000);
const databaseUrl = process.env.DATABASE_URL?.trim();
const secret = process.env.VOTE_SECRET || 'development-only-not-for-production';
const accessCode = process.env.VOTE_ACCESS_CODE?.trim() || '';
const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
const localFile = path.join(root, '.local-data', 'votes.json');
const rateLimits = new Map();
const googleCache = new Map();
let pool;

const note = msg => console.log(`[AFTERHOURS] ${msg}`);
const databaseMode = databaseUrl ? 'postgres' : 'local-demo';

async function setupStorage() {
  if (databaseUrl) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...(process.env.PG_SSL === 'false' ? { ssl: false } : {})
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS afterhours_votes (
        voter_hash CHAR(64) NOT NULL,
        category VARCHAR(16) NOT NULL CHECK (category IN ('bars','burgers')),
        venue_id VARCHAR(70) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (voter_hash, category)
      )
    `);
    note('PostgreSQL conectado. Votos persistentes habilitados.');
  } else {
    fs.mkdirSync(path.dirname(localFile), { recursive: true });
    if (!fs.existsSync(localFile)) fs.writeFileSync(localFile, '[]\n');
    note('ATENÇÃO: sem DATABASE_URL. JSON local (dados não persistem no Render após reinicializações).');
  }
  if (!process.env.VOTE_SECRET) note('ATENÇÃO: configure VOTE_SECRET em produção.');
}

function localVotes() {
  try { return JSON.parse(fs.readFileSync(localFile, 'utf8')); }
  catch { return []; }
}
function localSave(votes) {
  const temporary = `${localFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(votes, null, 2) + '\n');
  fs.renameSync(temporary, localFile);
}
function hashEmail(email) {
  return crypto.createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
}
async function getCounts() {
  const counts = Object.fromEntries(venues.map(v => [v.id, 0]));
  let totalBars = 0, totalBurgers = 0;
  if (pool) {
    const result = await pool.query('SELECT category, venue_id, COUNT(*)::int AS total FROM afterhours_votes GROUP BY category, venue_id');
    for (const vote of result.rows) {
      if (counts[vote.venue_id] !== undefined) counts[vote.venue_id] = vote.total;
      if (vote.category === 'bars') totalBars += vote.total;
      if (vote.category === 'burgers') totalBurgers += vote.total;
    }
  } else {
    for (const vote of localVotes()) {
      if (counts[vote.venueId] !== undefined) counts[vote.venueId]++;
      if (vote.category === 'bars') totalBars++;
      if (vote.category === 'burgers') totalBurgers++;
    }
  }
  return { counts, totals: { bars: totalBars, burgers: totalBurgers }, updatedAt: new Date().toISOString() };
}
function throttle(req, res, next) {
  const ip = req.get('cf-connecting-ip') || req.ip;
  const now = Date.now();
  const old = rateLimits.get(ip) || [];
  const recent = old.filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 25) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  recent.push(now);
  rateLimits.set(ip, recent);
  if (rateLimits.size > 3000) for (const [k, values] of rateLimits) if (values.every(t => now - t > 600000)) rateLimits.delete(k);
  next();
}
function safeEqual(actual, expected) {
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'afterhours' }));
app.get('/api/config', (_req, res) => res.json({
  persistence: databaseMode,
  googlePhotosEnabled: Boolean(googleKey),
  requiresAccessCode: Boolean(accessCode),
  eventName: 'AFTERHOURS 2026'
}));
app.get('/api/results', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await getCounts()); }
  catch (err) { next(err); }
});
app.post('/api/votes', throttle, async (req, res, next) => {
  try {
    const { category, venueId } = req.body || {};
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]{2,80}@[^\s@]+\.[^\s@]{2,30}$/.test(email) || email.length > 150) {
      return res.status(400).json({ error: 'Informe um e-mail válido para registrar um voto por pessoa.' });
    }
    if (accessCode && !safeEqual(String(req.body.accessCode || ''), accessCode)) {
      return res.status(403).json({ error: 'Código de acesso do time incorreto.' });
    }
    const selected = venueMap.get(venueId);
    if (!selected || selected.category !== category) return res.status(400).json({ error: 'Opção de voto inválida.' });
    if (!selected.enabled) return res.status(400).json({ error: 'Este estabelecimento está temporariamente fora da votação.' });
    const voterHash = hashEmail(email);
    if (pool) {
      await pool.query(`
        INSERT INTO afterhours_votes (voter_hash, category, venue_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (voter_hash, category)
        DO UPDATE SET venue_id = EXCLUDED.venue_id, updated_at = NOW()
      `, [voterHash, category, venueId]);
    } else {
      const votes = localVotes();
      const existing = votes.findIndex(v => v.voterHash === voterHash && v.category === category);
      const nextVote = { voterHash, category, venueId, updatedAt: new Date().toISOString() };
      if (existing === -1) votes.push(nextVote); else votes[existing] = nextVote;
      localSave(votes);
    }
    res.status(200).json({ ok: true, venueId, category, results: await getCounts(), message: 'Voto registrado. Você pode alterar sua escolha usando o mesmo e-mail.' });
  } catch (err) { next(err); }
});

async function getGoogleVenue(venue) {
  if (!googleKey) return null;
  const cached = googleCache.get(venue.id);
  if (cached && Date.now() - cached.time < 15 * 60 * 1000) return cached.value;
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googleKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.photos'
    },
    body: JSON.stringify({ textQuery: `${venue.name}, ${venue.address}`, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 1 }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Google Places respondeu HTTP ${response.status}. Verifique a API/chave/faturamento.`);
  const payload = await response.json();
  const place = payload.places?.[0];
  if (!place) return null;
  const value = {
    displayName: place.displayName?.text || venue.name,
    address: place.formattedAddress || venue.address,
    googleMapsUrl: place.googleMapsUri,
    photos: (place.photos || []).slice(0, 3).map((p, index) => ({
      id: index,
      name: p.name,
      src: `/api/places/${venue.id}/photos/${index}`,
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
    const googleVenue = await getGoogleVenue(venue);
    return res.json({ enabled: true, ...(googleVenue || { photos: [] }) });
  } catch (error) {
    note(error.message);
    return res.status(502).json({ error: 'Fotos do Google temporariamente indisponíveis', photos: [] });
  }
});
app.get('/api/places/:id/photos/:index', async (req, res) => {
  const venue = venueMap.get(req.params.id);
  const index = Number(req.params.index);
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
    res.set('Cache-Control', 'private, max-age=300');
    return res.redirect(302, data.photoUri);
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
  console.error('[AFTERHOURS] Falha ao iniciar:', error.message);
  process.exit(1);
});

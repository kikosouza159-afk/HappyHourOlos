import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  Check, ChevronRight, CircleAlert, Disc3, ExternalLink, GlassWater,
  Images, MapPin, Menu, Mic2, MousePointer2, Music2, Navigation,
  Share2, Sparkles, UtensilsCrossed, Vote, X
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import venueData from '../data/venues.json';

gsap.registerPlugin(ScrollTrigger);

const bars = venueData.filter(v => v.category === 'bars');
const burgers = venueData.filter(v => v.category === 'burgers');
const emptyResults = {
  counts: Object.fromEntries(venueData.map(item => [item.id, 0])),
  totals: { bars: 0, burgers: 0 }
};
const mapsLink = venue => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}`)}`;
const mapEmbed = venue => `https://www.google.com/maps?q=${encodeURIComponent(`${venue.name}, ${venue.address}`)}&output=embed`;

function Brand({ compact = false }) {
  return <a href="#inicio" className={`brand ${compact ? 'brand--small' : ''}`} aria-label="Afterhours, ir ao início">
    <span className="brand-mark"><span className="brand-mark__slash" /><span className="brand-mark__slash" /><span className="brand-mark__slash" /></span>
    <span>after<span className="brand-word-accent">hours.</span></span>
  </a>;
}

function HeroScene() {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame;
    const container = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 11;
    const group = new THREE.Group();
    scene.add(group);
    const green = new THREE.MeshBasicMaterial({ color: 0xcbf775, transparent: true, opacity: 0.87 });
    const purple = new THREE.MeshBasicMaterial({ color: 0x9e8aff, transparent: true, opacity: 0.8 });
    const gold = new THREE.MeshBasicMaterial({ color: 0xffc68b, transparent: true, opacity: 0.7 });
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 2), new THREE.MeshBasicMaterial({ color: 0x9f8cfb, wireframe: true, opacity: 0.22, transparent: true }));
    group.add(wire);
    const torus = (radius, tube, material, x, y) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 220), material);
      mesh.rotation.x = x; mesh.rotation.y = y; group.add(mesh); return mesh;
    };
    const a = torus(2.9, 0.035, green, 0.85, 0.34);
    const b = torus(3.1, 0.017, purple, -0.48, 1.1);
    const c = torus(2.5, 0.028, gold, -1.07, -0.31);
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 3.2 + Math.random() * 1.65;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const pointsGeom = new THREE.BufferGeometry(); pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(pointsGeom, new THREE.PointsMaterial({ color: 0xbbe9ff, size: 0.027, transparent: true, opacity: 0.78 }));
    group.add(points);
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height));
      camera.aspect = Math.max(1, width) / Math.max(1, height); camera.updateProjectionMatrix();
    };
    container.appendChild(renderer.domElement);
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let pointerX = 0, pointerY = 0;
    const pointer = e => { pointerX = (e.clientX / window.innerWidth - 0.5) * 0.35; pointerY = (e.clientY / window.innerHeight - 0.5) * 0.25; };
    window.addEventListener('pointermove', pointer, { passive: true });
    const started = performance.now();
    const animate = now => {
      const t = (now - started) / 1000;
      group.rotation.y += (pointerX - group.rotation.y) * 0.009;
      group.rotation.x += (pointerY - group.rotation.x) * 0.01;
      group.rotation.z = Math.sin(t * 0.21) * 0.12;
      wire.rotation.y = t * 0.055; wire.rotation.x = t * 0.038;
      a.rotation.z = t * 0.055; b.rotation.y = 1.1 + t * 0.07; c.rotation.x = -1.07 - t * 0.035;
      points.rotation.y = -t * 0.025;
      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('pointermove', pointer);
      observer.disconnect(); group.traverse(obj => { obj.geometry?.dispose(); });
      [green, purple, gold].forEach(m => m.dispose()); renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);
  return <div ref={host} className="hero-canvas" aria-hidden="true" />;
}

function useGooglePhoto(venueId, enabled, observeRef = null) {
  const [data, setData] = useState(null);
  const [visible, setVisible] = useState(!observeRef);
  useEffect(() => {
    if (!observeRef?.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '220px' });
    observer.observe(observeRef.current);
    return () => observer.disconnect();
  }, [observeRef]);
  useEffect(() => {
    setData(null);
    if (!enabled || !visible || !venueId) return;
    const ctrl = new AbortController();
    fetch(`/api/places/${venueId}`, { signal: ctrl.signal })
      .then(res => res.ok ? res.json() : null)
      .then(obj => { if (obj?.photos?.length) setData(obj); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [venueId, enabled, visible]);
  return data;
}

function VenueImg({ src, fallback, alt, className = '', ...props }) {
  return <img className={className} src={src || fallback} alt={alt} loading="lazy" onError={event => {
    if (event.currentTarget.dataset.fallback !== '1' && fallback && event.currentTarget.src !== fallback) {
      event.currentTarget.dataset.fallback = '1'; event.currentTarget.src = fallback;
    } else event.currentTarget.style.opacity = '0';
  }} {...props} />;
}

function ImageCredit({ google, venue }) {
  if (!google?.photos?.length) return <span className="photo-credit">{venue.imageSource || 'Imagem ilustrativa'}</span>;
  const authors = [...new Map(google.photos.flatMap(p => p.attributions || []).filter(a => a.name).map(a => [a.name, a])).values()];
  return <span className="photo-credit">Fotos via Google Places{authors.length ? ' · ' : ''}{authors.map((a, i) => <React.Fragment key={a.name}>{i > 0 && ', '}{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</React.Fragment>)}</span>;
}

function VenueDetails({ venue, category, onVote, google, compact = false }) {
  return <div className={`venue-details ${compact ? 'venue-details--compact' : ''}`}>
    <div className="venue-eyebrow"><span className="eyebrow-dot" style={{ background: venue.accent }} />{venue.type}</div>
    <h3>{venue.name}</h3>
    <p className="venue-tagline">{venue.tagline}</p>
    <p className="venue-description">{venue.description}</p>
    <div className="tag-set">{venue.details.map(tag => <span key={tag}>{tag}</span>)}</div>
    {venue.notice && <div className="venue-notice"><CircleAlert size={15} />{venue.notice}</div>}
    <div className="venue-actions">
      <button className="button button--lime" onClick={() => onVote(venue)} disabled={!venue.enabled}>
        <Vote size={17} />{venue.enabled ? 'Votar neste lugar' : 'Indisponível'}<ArrowUpRight size={17} />
      </button>
      <a className="button button--outline" href={google?.googleMapsUrl || mapsLink(venue)} target="_blank" rel="noreferrer"><Navigation size={17} />Traçar rota</a>
    </div>
  </div>;
}

function LocationPanel({ venue, google, mobile = false }) {
  const googlePhotos = google?.photos?.map(p => p.src) || [];
  const photoUrls = venue.images.map((fallback, index) => googlePhotos[index] || fallback);
  return <div className={`location-panel ${mobile ? 'location-panel--mobile' : ''}`}>
    <div className="location-panel__heading"><span><MapPin size={15} /> ONDE FICA</span><span>SP · BR</span></div>
    <p className="location-panel__address">{venue.address.replace(', São Paulo, SP, Brasil', '')}</p>
    <div className="gallery-strip">
      {photoUrls.slice(0, 3).map((url, index) => <a href={google?.googleMapsUrl || mapsLink(venue)} target="_blank" rel="noreferrer" key={`${venue.id}-${index}`} title="Ver fotos e avaliações no Google Maps">
        <VenueImg src={url} fallback={venue.images[index]} alt={`Ambiente: ${venue.name}, foto ${index + 1}`} />
      </a>)}
    </div>
    <ImageCredit venue={venue} google={google} />
    <div className="map-frame"><iframe title={`Mapa de ${venue.name}`} src={mapEmbed(venue)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
    <a className="map-external" href={google?.googleMapsUrl || mapsLink(venue)} target="_blank" rel="noreferrer">Abrir no Google Maps <ArrowUpRight size={15} /></a>
  </div>;
}

function MobileVenueCard({ venue, index, config, onVote }) {
  const ref = useRef(null);
  const google = useGooglePhoto(venue.id, config.googlePhotosEnabled, ref);
  return <article ref={ref} className="mobile-story-card" style={{ '--venue-accent': venue.accent }}>
    <div className="mobile-story-card__image">
      <VenueImg src={google?.photos?.[0]?.src} fallback={venue.images[0]} alt={`Ambiente de ${venue.name}`} />
      <div className="mobile-story-card__number">0{index + 1} / 05</div>
    </div>
    <div className="mobile-story-card__body"><VenueDetails venue={venue} onVote={onVote} compact /></div>
    <details className="mobile-story-card__map"><summary>Ver localização e fotos <ChevronRight size={18} /></summary><LocationPanel venue={venue} google={google} mobile /></details>
  </article>;
}

function StorySection({ category, items, config, onVote }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const current = items[active];
  const google = useGooglePhoto(current.id, config.googlePhotosEnabled);
  useEffect(() => {
    if (!ref.current) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', () => {
      const trigger = ScrollTrigger.create({
        trigger: ref.current, start: 'top top', end: 'bottom bottom',
        onUpdate: self => {
          const index = Math.min(items.length - 1, Math.max(0, Math.floor(self.progress * items.length)));
          setActive(prev => prev === index ? prev : index);
        }
      });
      return () => trigger.kill();
    });
    return () => mm.revert();
  }, [items]);
  const isBar = category === 'bars';
  const title = isBar ? 'A NOITE TEM' : 'O RODÍZIO TEM';
  const highlight = isBar ? 'VÁRIOS RITMOS.' : 'VÁRIAS CAMADAS.';
  const bg = google?.photos?.[0]?.src || current.images[0];
  return <section id={category} ref={ref} className={`story-section story-section--${category}`}>
    <div className="story-mobile-heading"><div className="section-kicker">0{isBar ? 1 : 2} / EXPLORAR</div><h2>{title}<br/><em>{highlight}</em></h2><p>{isBar ? 'Cinco jeitos de transformar uma sexta comum em história.' : 'Cinco rodízios para quem acredita no poder do repeteco.'}</p></div>
    <div className="story-track">
      <div className="story-stage" style={{ '--venue-accent': current.accent }}>
        <div className="story-background"><VenueImg key={current.id} src={bg} fallback={current.images[0]} alt="" /><div className="story-backdrop-overlay" /></div>
        <div className="stage-shell">
          <div className="stage-top"><span className="section-kicker">{isBar ? '01' : '02'} / {isBar ? 'BARES & EXPERIÊNCIAS' : 'HAMBURGUERIAS & RODÍZIOS'}</span><div className="stage-counter"><strong>0{active + 1}</strong><span>/ 05</span></div></div>
          <div className="stage-content">
            <div className="stage-main" key={`main-${current.id}`}>
              <div className="stage-intro"><span className="tiny-plus">+</span> {title} <br/><em>{highlight}</em></div>
              <VenueDetails venue={current} category={category} onVote={onVote} google={google} />
            </div>
            <div className="stage-side" key={`side-${current.id}`}><LocationPanel venue={current} google={google} /></div>
          </div>
          <div className="stage-bottom"><div className="stage-steps">{items.map((item, i) => <span key={item.id} className={i === active ? 'is-active' : ''} style={{ '--i': i }}><b>0{i + 1}</b><span /></span>)}</div><span className="scroll-label"><MousePointer2 size={15} /> ROLE PARA EXPLORAR</span></div>
        </div>
      </div>
    </div>
    <div className="mobile-stories">{items.map((venue, i) => <MobileVenueCard key={venue.id} venue={venue} index={i} config={config} onVote={onVote} />)}</div>
  </section>;
}

function VoteModal({ venue, onClose, onComplete, config }) {
  const [email, setEmail] = useState(() => localStorage.getItem('afterhours-email') || '');
  const [name, setName] = useState(() => localStorage.getItem('afterhours-name') || '');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!venue) return;
    const onEsc = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onEsc); document.body.style.overflow = oldOverflow; };
  }, [venue, onClose]);
  if (!venue) return null;
  async function submit(event) {
    event.preventDefault(); setError('');
    if (name.trim().length < 2) { setError('Informe seu primeiro nome.'); return; }
    setSending(true);
    try {
      const response = await fetch('/api/votes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: venue.category, venueId: venue.id, name: name.trim(), email, accessCode: code })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar o voto.');
      localStorage.setItem('afterhours-email', email.trim());
      localStorage.setItem('afterhours-name', name.trim());
      localStorage.setItem(`afterhours-choice-${venue.category}`, venue.id);
      onComplete(venue, payload.results);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="vote-dialog" role="dialog" aria-modal="true" aria-labelledby="vote-dialog-title">
      <button className="dialog-close" aria-label="Fechar" onClick={onClose}><X size={22} /></button>
      <div className="dialog-eyebrow"><span className="live-dot" /> SUA ESCOLHA IMPORTA</div>
      <h2 id="vote-dialog-title">É esse o <em>rolê?</em></h2>
      <div className="chosen-venue"><VenueImg src={venue.images[0]} fallback={venue.images[1]} alt={venue.name} /><div><span>{venue.category === 'bars' ? 'BAR' : 'HAMBURGUERIA'} SELECIONADO</span><strong>{venue.name}</strong><small><MapPin size={12}/>{venue.neighborhood}</small></div><Check size={22} /></div>
      <form onSubmit={submit} className="vote-form">
        <label>Seu nome<input autoFocus value={name} onChange={e => setName(e.target.value)} type="text" maxLength={60} placeholder="Como podemos te chamar?" required /></label>
        <label>E-mail para validar um voto por pessoa<input value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={150} placeholder="voce@empresa.com" required /></label>
        {config.requiresAccessCode && <label>Código de acesso do time<input value={code} onChange={e => setCode(e.target.value)} type="password" maxLength={80} placeholder="Código compartilhado com o time" required /></label>}
        {error && <p className="form-error" role="alert"><CircleAlert size={15} />{error}</p>}
        <button className="button button--lime button--submit" type="submit" disabled={sending}>{sending ? 'Registrando...' : 'Confirmar meu voto'} <ArrowUpRight size={18} /></button>
      </form>
      <p className="dialog-note">1 voto por e-mail em cada segmento. Você pode alterar sua escolha. O e-mail é transformado em um identificador criptográfico e não é exibido no placar.</p>
    </div>
  </div>;
}

function ResultsPanel({ category, items, results, onVote }) {
  const total = results?.totals?.[category] || 0;
  const ordered = [...items].sort((a, b) => (results?.counts?.[b.id] || 0) - (results?.counts?.[a.id] || 0));
  return <div className={`result-panel result-panel--${category}`}>
    <div className="result-panel__head"><span className="result-panel__icon">{category === 'bars' ? <Music2 size={20} /> : <UtensilsCrossed size={20} />}</span><div><span className="eyebrow">{category === 'bars' ? 'SEGMENTO 01' : 'SEGMENTO 02'}</span><h3>{category === 'bars' ? 'Bares' : 'Hamburguerias'}</h3></div><div className="result-votes"><strong>{total}</strong><span>votos</span></div></div>
    <div className="result-rows">{ordered.map((venue, idx) => {
      const count = results?.counts?.[venue.id] || 0;
      const pct = total ? Math.round(count / total * 100) : 0;
      return <div key={venue.id} className={`result-row ${!venue.enabled ? 'result-row--disabled' : ''}`}>
        <div className="result-row__top"><div className="result-row__name"><span className="result-position">{String(idx + 1).padStart(2, '0')}</span><span>{venue.name}</span>{!venue.enabled && <small>Indisponível</small>}</div><span className="result-row__pct">{pct}% <small>({count})</small></span></div>
        <div className="result-track"><div style={{ width: `${pct}%` }} /></div>
      </div>;
    })}</div>
    <button className="panel-secondary-action" onClick={() => onVote(ordered.find(v => v.enabled) || items[0])}>Votar em {category === 'bars' ? 'um bar' : 'uma hamburgueria'} <ArrowUpRight size={17}/></button>
  </div>;
}

export default function App() {
  const [config, setConfig] = useState({ persistence: 'loading', googlePhotosEnabled: false, requiresAccessCode: false });
  const [results, setResults] = useState(emptyResults);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(false);
  const refreshResults = useCallback(async () => {
    try {
      const response = await fetch('/api/results', { cache: 'no-store' });
      if (response.ok) setResults(await response.json());
    } catch { /* servidor ainda iniciando */ }
  }, []);
  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(setConfig).catch(() => setConfig({ persistence: 'offline', googlePhotosEnabled: false, requiresAccessCode: false }));
    refreshResults();
    const interval = setInterval(refreshResults, 15000);
    return () => clearInterval(interval);
  }, [refreshResults]);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      gsap.from('.hero-copy > *', { opacity: 0, y: 34, duration: 0.85, stagger: 0.1, ease: 'power3.out', delay: 0.15 });
      gsap.utils.toArray('.reveal').forEach(element => {
        gsap.from(element, { opacity: 0, y: 45, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
      });
      media.add('(max-width: 900px)', () => {
        gsap.utils.toArray('.mobile-story-card').forEach(card => {
          gsap.from(card, { opacity: 0, y: 35, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 95%', once: true } });
        });
      });
    });
    return () => { media.revert(); ctx.revert(); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const done = (venue, updated) => {
    if (updated) setResults(updated);
    setSelectedVenue(null);
    setToast(`Voto registrado em ${venue.name}! Você pode mudar de ideia com o mesmo e-mail.`);
  };
  const share = async () => {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AFTERHOURS · A escolha é sua', text: 'Vote no bar e na hamburgueria da nossa confraternização!', url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setToast('Link da votação copiado! Compartilhe no grupo do time.');
      } else {
        window.prompt('Copie o link da votação:', url);
      }
    } catch (error) { if (error.name !== 'AbortError') setToast('Não foi possível compartilhar o link. Copie a URL do navegador.'); }
  };
  const totalVotes = (results.totals.bars || 0) + (results.totals.burgers || 0);
  return <div className="site">
    <header className="site-header"><div className="site-header__inner"><Brand /><nav className={`site-nav ${menu ? 'site-nav--open' : ''}`} aria-label="Navegação principal">
      <a href="#conceito" onClick={() => setMenu(false)}>A experiência</a><a href="#bares" onClick={() => setMenu(false)}>Bares</a><a href="#burgers" onClick={() => setMenu(false)}>Hamburguerias</a><a href="#resultados" onClick={() => setMenu(false)}>Placar</a>
    </nav><a href="#bares" className="header-vote-button">ESCOLHER UM LUGAR <ArrowUpRight size={15} /></a><button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Abrir menu">{menu ? <X/> : <Menu/>}</button></div></header>

    <main>
      <section className="hero" id="inicio"><div className="hero-glow hero-glow--one"/><div className="hero-glow hero-glow--two"/><HeroScene />
        <div className="hero-inner"><div className="hero-copy"><div className="hero-meta"><span className="live-dot" /> O PRÓXIMO ROLÊ COMEÇA AQUI <span className="meta-line" /></div>
          <h1>O rolê é<br/><span className="hero-title-outline">nosso.</span><br/>A escolha <em>é sua.</em></h1>
          <p>10 lugares. 2 universos. Uma decisão feita em equipe. Explore cada ambiente, escolha seu favorito e acompanhe a votação ao vivo.</p>
          <div className="hero-actions"><a className="button button--lime button--big" href="#conceito">Explorar opções <ArrowDownRight size={21}/></a><a className="hero-link" href="#resultados"><BarChart3 size={18}/> Acompanhar placar</a><button className="hero-link hero-share" onClick={share}><Share2 size={18}/> Compartilhar</button></div>
          <div className="hero-kpis"><div><strong>10</strong><span>EXPERIÊNCIAS</span></div><div><strong>02</strong><span>SEGMENTOS</span></div><div><strong>{String(totalVotes).padStart(2, '0')}</strong><span>VOTOS ATÉ AGORA</span></div></div>
        </div><div className="hero-side-caption"><span>AFTERHOURS / 2026</span><span>23°33′ S · SÃO PAULO</span></div></div>
        <a href="#conceito" className="scroll-down" aria-label="Rolar para as experiências"><span>SCROLL TO EXPLORE</span><ArrowDown size={18}/></a>
      </section>

      {config.persistence === 'local-demo' && <div className="demo-notice"><CircleAlert size={18}/><span><b>Modo demonstração:</b> os votos são salvos no servidor local, mas para persistirem após reinicializações no Render é necessário configurar <code>DATABASE_URL</code>.</span></div>}
      {config.persistence === 'offline' && <div className="demo-notice"><CircleAlert size={18}/>Servidor de votação desconectado. Confirme que o backend está em execução.</div>}

      <section id="conceito" className="intro-section"><div className="intro-heading reveal"><span className="section-kicker">/// ESCOLHA A SUA EXPERIÊNCIA</span><div className="intro-title-row"><h2>QUAL É A <em>VIBE?</em></h2><p>Do karaokê até a última música ao rodízio que ninguém quer encerrar. Você escolhe o destino.</p></div></div>
        <div className="category-grid"><a href="#bares" className="category-card category-card--bars reveal"><span className="category-card__orb category-card__orb--purple"/><div className="category-card__top"><span>SEGMENTO / 01</span><Music2 size={24}/></div><div className="category-card__bottom"><span>🎤 &nbsp; KARAOKÊ · SINUCA · ROCK</span><h3>NOITE<br/>LÁ FORA.</h3><span className="category-card__footer">5 BARES PARA EXPLORAR <ArrowUpRight size={22}/></span></div></a>
        <a href="#burgers" className="category-card category-card--burgers reveal"><span className="category-card__orb category-card__orb--orange"/><div className="category-card__top"><span>SEGMENTO / 02</span><UtensilsCrossed size={24}/></div><div className="category-card__bottom"><span>🍔 &nbsp; MINI BURGERS · RODÍZIO · BBQ</span><h3>FOME DE<br/>ROLÊ.</h3><span className="category-card__footer">5 HAMBURGUERIAS PARA EXPLORAR <ArrowUpRight size={22}/></span></div></a></div>
        <div className="intro-bottom"><span><Sparkles size={15}/> DESLIZE PARA VIVER CADA AMBIENTE</span><span>FOTOS · MAPAS · VOTAÇÃO</span></div>
      </section>

      <StorySection category="bars" items={bars} config={config} onVote={setSelectedVenue}/>
      <div className="between-sections"><div className="between-sections__glow"/><span className="section-kicker reveal">/// SEGUNDO UNIVERSO</span><h2 className="reveal">A NOITE CONTINUA.<br/><em>AGORA COM FOME.</em></h2><div className="between-sections__badge">🍔 <span>NEXT CHAPTER</span><ArrowDownRight size={18}/></div></div>
      <StorySection category="burgers" items={burgers} config={config} onVote={setSelectedVenue}/>

      <section id="resultados" className="results-section"><div className="results-wrap"><div className="results-heading reveal"><div><span className="section-kicker">/// DEMOCRACIA DO ROLÊ</span><h2>O PLACAR<br/><em>DA GALERA.</em></h2></div><div className="results-head-right"><span className="results-live"><span className="live-dot"/> ATUALIZA A CADA 15 SEGUNDOS</span><p>Um voto por pessoa em cada segmento. Trocar de ideia faz parte da diversão.</p></div></div>
        <div className="result-grid"><ResultsPanel category="bars" items={bars} results={results} onVote={setSelectedVenue}/><ResultsPanel category="burgers" items={burgers} results={results} onVote={setSelectedVenue}/></div>
        <div className="results-footer"><span><Check size={17}/> Votos de bares e hamburguerias são contabilizados separadamente.</span><span>TOTAL DE {totalVotes} VOTOS REGISTRADOS</span></div>
      </div></section>

      <section className="closing-section"><div className="closing-marquee">GOOD VIBES <span>✳</span> GOOD FOOD <span>✳</span> GOOD PEOPLE <span>✳</span> </div><div className="closing-inner"><span className="section-kicker">ATÉ A PRÓXIMA NOITE</span><h2>O MELHOR PLANO<br/>É <em>DECIDIR JUNTO.</em></h2><a href="#inicio" className="button button--outline">Voltar ao início <ArrowUpRight size={18}/></a></div></section>
    </main>
    <footer className="footer"><Brand compact/><span>FEITO PARA O TIME · SÃO PAULO · 2026</span><span>EXPLORE. ESCOLHA. CELEBRE.</span></footer>
    <VoteModal venue={selectedVenue} onClose={() => setSelectedVenue(null)} onComplete={done} config={config}/>
    {toast && <div className="toast-message" role="status"><Check size={18}/>{toast}<button onClick={() => setToast(null)} aria-label="Fechar aviso"><X size={16}/></button></div>}
  </div>;
}

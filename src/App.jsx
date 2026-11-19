import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  Check, CircleAlert, Disc3, ExternalLink, GlassWater,
  Images, MapPin, Menu, Mic2, MousePointer2, Music2, Navigation,
  Share2, Sparkles, UtensilsCrossed, Vote, X, Trophy, LockKeyhole,
  ChevronLeft, ChevronRight, ShieldCheck, Flame, Eye, CalendarClock
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
  totals: { bars: 0, burgers: 0 }, round: 1, phase: 'open', finalists: { bars: [], burgers: [] }, firstRound: null
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

function VenueDetails({ venue, category, onVote, google, compact = false, eligibility = true, voted = false, onVoteLabel }) {
  return <div className={`venue-details ${compact ? 'venue-details--compact' : ''}`}>
    <div className="venue-eyebrow"><span className="eyebrow-dot" style={{ background: venue.accent }} />{venue.type}</div>
    <h3>{venue.name}</h3>
    <p className="venue-tagline">{venue.tagline}</p>
    <p className="venue-description">{venue.description}</p>
    <div className="tag-set">{venue.details.map(tag => <span key={tag}>{tag}</span>)}</div>
    {venue.notice && <div className="venue-notice"><CircleAlert size={15} />{venue.notice}</div>}
    <div className="venue-actions">
      <button className="button button--lime" onClick={() => onVote(venue)} disabled={!venue.enabled || !eligibility}>
        <Vote size={17} />{!venue.enabled ? 'Indisponível' : !eligibility ? 'Fora da final' : voted ? 'Alterar meu voto' : onVoteLabel || 'Votar neste lugar'}<ArrowUpRight size={17} />
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

function StageOrbit({ accent }) {
  const holder = useRef(null);
  useEffect(() => {
    const element = holder.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(1.3, window.devicePixelRatio));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 14;
    const group = new THREE.Group(); scene.add(group);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc9f775, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const mistMaterial = new THREE.MeshBasicMaterial({ color: 0x9885ff, wireframe: true, transparent: true, opacity: 0.13 });
    for (let index = 0; index < 5; index++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7 + index * 0.27, index % 2 ? 0.016 : 0.028, 8, 150), ringMaterial);
      ring.rotation.x = index * 0.48 + 0.35;
      ring.rotation.y = index * 0.66;
      group.add(ring);
    }
    const poly = new THREE.Mesh(new THREE.IcosahedronGeometry(3.3, 1), mistMaterial);
    group.add(poly);
    const position = new Float32Array(480 * 3);
    for (let n = 0; n < 480; n++) {
      const theta = Math.random() * Math.PI * 2;
      const y = Math.random() * 2 - 1;
      const radius = 4 + Math.random() * 3;
      position[n * 3] = radius * Math.sqrt(1 - y * y) * Math.cos(theta);
      position[n * 3 + 1] = radius * y;
      position[n * 3 + 2] = radius * Math.sqrt(1 - y * y) * Math.sin(theta);
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xf4e9ff, size: 0.026, transparent: true, opacity: 0.53 });
    const stars = new THREE.Points(starsGeometry, starsMaterial); scene.add(stars);
    const resize = () => {
      const rect = element.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix();
    };
    element.appendChild(renderer.domElement);
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(element); resize();
    let frame; let visible = false;
    const observer = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); }, { threshold: 0.01 });
    observer.observe(element);
    let last = 0;
    const animate = timestamp => {
      if (visible && timestamp - last >= 30) {
        group.rotation.y += 0.0013; group.rotation.x = Math.sin(timestamp * 0.00013) * 0.13;
        poly.rotation.y = timestamp * 0.00008; stars.rotation.y = -timestamp * 0.000012;
        renderer.render(scene, camera); last = timestamp;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect();
      group.traverse(obj => obj.geometry?.dispose());
      starsGeometry.dispose(); ringMaterial.dispose(); mistMaterial.dispose(); starsMaterial.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    const canvas = holder.current?.querySelector('canvas');
    if (canvas) canvas.style.filter = `drop-shadow(0 0 35px ${accent}40)`;
  }, [accent]);
  return <div className="stage-orbit" aria-hidden="true" ref={holder} />;
}

function ExperiencePortal({ category, election, config, choices, onVote, onClose, onSwitch, voteOpen }) {
  const scrollRef = useRef(null);
  const trackRef = useRef(null);
  const closeRef = useRef(null);
  const cardRef = useRef(null);
  const [active, setActive] = useState(0);
  const [locationOpen, setLocationOpen] = useState(false);
  const isBars = category === 'bars';
  const options = isBars ? bars : burgers;
  const finalists = election.finalists?.[category] || [];
  const available = election.round === 2 ? options.filter(v => finalists.includes(v.id)) : options;
  const visibleItems = available.length ? available : options;
  const index = Math.min(active, visibleItems.length - 1);
  const venue = visibleItems[index];
  const google = useGooglePhoto(venue.id, config.googlePhotosEnabled);
  const round = election.round || 1;
  const otherCategory = isBars ? 'burgers' : 'bars';
  const otherLabel = isBars ? 'Hamburguerias' : 'Bares';
  const canVote = election.phase === 'open' && venue.enabled;
  const selected = choices[category] === venue.id;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    const steps = Math.max(1, visibleItems.length - 1);
    const update = () => {
      const total = Math.max(1, track.offsetHeight - scroller.clientHeight);
      const fraction = Math.max(0, Math.min(1, scroller.scrollTop / total));
      const target = Math.min(visibleItems.length - 1, Math.round(fraction * steps));
      setActive(old => old === target ? old : target);
      track.style.setProperty('--portal-progress', `${Math.round(fraction * 100)}%`);
    };
    scroller.addEventListener('scroll', update, { passive: true });
    const trigger = ScrollTrigger.create({
      id: `portal-${category}`,
      scroller,
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: update
    });
    const frame = requestAnimationFrame(() => { ScrollTrigger.refresh(); update(); });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', update);
      trigger.kill();
    };
  }, [category, round, visibleItems.length]);

  useEffect(() => {
    if (!cardRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const photo = cardRef.current.querySelector('.experience-portal__photo');
    if (!photo) return;
    gsap.fromTo(photo,
      { opacity: 0.45, y: 50, scale: 1.12, filter: 'blur(7px)' },
      { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out', overwrite: true, clearProps: 'filter,transform,opacity' });
  }, [venue.id]);

  const goTo = useCallback((target) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const clamped = Math.min(visibleItems.length - 1, Math.max(0, target));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ top: clamped * scroller.clientHeight, behavior: reduced ? 'instant' : 'smooth' });
    if (reduced) setActive(clamped);
  }, [visibleItems.length]);

  useEffect(() => {
    const handleKey = event => {
      if (voteOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (locationOpen) setLocationOpen(false);
        else onClose();
      } else if (!locationOpen && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); goTo(index + 1); }
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); goTo(index - 1); }
      }
      if (event.key === 'Tab' && !locationOpen) {
        const focusable = [...document.querySelectorAll('.experience-portal button:not(:disabled), .experience-portal a[href]')].filter(node => node.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, goTo, index, locationOpen, voteOpen]);

  const tilt = event => {
    if (!cardRef.current || event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    cardRef.current.style.setProperty('--portal-tilt-x', `${(-y * 5).toFixed(2)}deg`);
    cardRef.current.style.setProperty('--portal-tilt-y', `${(x * 6).toFixed(2)}deg`);
  };
  const untilt = () => {
    cardRef.current?.style.setProperty('--portal-tilt-x', '0deg');
    cardRef.current?.style.setProperty('--portal-tilt-y', '0deg');
  };
  const photo = google?.photos?.[0]?.src || venue.images[0];

  return <div className={`experience-portal experience-portal--${category}`} role="dialog" aria-modal="true" aria-label={`Explorar ${isBars ? 'bares' : 'hamburguerias'}`} style={{ '--portal-accent': venue.accent }}>
    <div className="experience-portal__scroll" ref={scrollRef} tabIndex={-1}>
      <div className="experience-portal__track" ref={trackRef} style={{ height: `${Math.max(1, visibleItems.length) * 100}dvh` }}>
        <div className="experience-portal__stage">
          <div className="experience-portal__ambient" aria-hidden="true"><VenueImg key={`background-${venue.id}`} src={photo} fallback={venue.images[0]} alt="" /></div>
          <StageOrbit accent={venue.accent}/>
          <div className="experience-portal__content">
            <header className="experience-portal__header">
              <div className="experience-portal__identity"><span className="experience-portal__live"/> AFTERHOURS <span className="experience-portal__header-divider">/</span> {isBars ? 'BARES' : 'HAMBURGUERIAS'} <span className="experience-portal__header-divider">/</span> {round}º TURNO</div>
              <button ref={closeRef} type="button" className="experience-portal__close" onClick={onClose} aria-label="Fechar experiência"><span>SAIR DA EXPERIÊNCIA</span><X size={22}/></button>
            </header>
            <div className="experience-portal__heading"><div><span className="experience-portal__eyebrow">ESCOLHA / EXPLORE / VOTE</span><h2>{isBars ? 'A NOITE É SUA.' : 'A FOME É SUA.'} <em>A ESCOLHA TAMBÉM.</em></h2></div><span className="experience-portal__chapter">{String(index + 1).padStart(2, '0')} <small>/ {String(visibleItems.length).padStart(2, '0')}</small></span></div>
            <div className="experience-portal__layout">
              <div ref={cardRef} className="experience-portal__card" onPointerMove={tilt} onPointerLeave={untilt} key={`portal-card-${category}`}>
                <div className="experience-portal__photo" key={`photo-${venue.id}`}><VenueImg src={photo} fallback={venue.images[0]} alt={`Ambiente de ${venue.name}`} /></div>
                <div className="experience-portal__glass" aria-hidden="true" />
                <div className="experience-portal__frame" aria-hidden="true" />
                <div className="experience-portal__card-top"><span>DESTINATION #{String(index + 1).padStart(2, '0')}</span><button type="button" onClick={() => setLocationOpen(true)}><MapPin size={15}/> FOTOS & MAPA <ArrowUpRight size={14}/></button></div>
                <div className="experience-portal__card-bottom" aria-live="polite"><span><MapPin size={15}/>{venue.neighborhood} · {venue.type}</span><h3>{venue.name}</h3><p>{venue.tagline}</p></div>
                <button type="button" className="experience-portal__mobile-vote" disabled={!canVote} onClick={() => onVote(venue)}><Vote size={16}/>{!venue.enabled ? 'Indisponível' : election.phase !== 'open' ? 'Votação encerrada' : selected ? 'ALTERAR MEU VOTO' : 'VOTAR NESTE LOCAL'}<ArrowUpRight size={15}/></button>
              </div>
              <aside className="experience-portal__aside">
                <div className="experience-portal__aside-top"><span className="experience-portal__aside-kicker">ENTRE NESSE UNIVERSO</span><div className="experience-portal__icon">{isBars ? <Music2 size={27}/> : <UtensilsCrossed size={27}/>}</div></div>
                <p className="experience-portal__aside-lede" key={`lede-${venue.id}`}>{venue.description}</p>
                <div className="experience-portal__tags">{venue.details.map(tag => <span key={tag}>{tag}</span>)}</div>
                {venue.notice && <p className="experience-portal__notice"><CircleAlert size={15}/>{venue.notice}</p>}
                <div className="experience-portal__aside-actions"><button className="experience-portal__vote" type="button" onClick={() => onVote(venue)} disabled={!canVote}><Vote size={18}/>{!venue.enabled ? 'INDISPONÍVEL' : election.phase !== 'open' ? 'VOTAÇÃO ENCERRADA' : selected ? 'ALTERAR MEU VOTO' : 'VOTAR NESTE LUGAR'}<ArrowUpRight size={17}/></button><button className="experience-portal__maps" onClick={() => setLocationOpen(true)} type="button"><Images size={17}/> Ver fotos e localização <ChevronRight size={17}/></button></div>
                <div className="experience-portal__step-note">{choices[category] ? <><Check size={15}/> Seu voto neste segmento foi registrado.</> : <>São dois votos: um em cada segmento.</>}</div>
              </aside>
            </div>
            <footer className="experience-portal__footer">
              <div className="experience-portal__controls"><button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Ver estabelecimento anterior"><ChevronLeft size={20}/></button><div className="experience-portal__steps" aria-label="Navegação entre estabelecimentos">{visibleItems.map((item, i) => <button key={item.id} type="button" className={i === index ? 'active' : ''} onClick={() => goTo(i)} aria-label={`Explorar ${item.name}`} aria-current={i === index ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span><i/></button>)}</div><button type="button" onClick={() => goTo(index + 1)} disabled={index === visibleItems.length - 1} aria-label="Ver próximo estabelecimento"><ChevronRight size={20}/></button></div>
              <span className="experience-portal__scroll-hint"><MousePointer2 size={15}/>{index === visibleItems.length - 1 ? 'VOCÊ VIU TODAS AS OPÇÕES' : 'ROLE PARA ENTRAR NO PRÓXIMO AMBIENTE'}</span>
              <button className="experience-portal__switch" onClick={() => onSwitch(otherCategory)} type="button">IR PARA {otherLabel.toUpperCase()} <ArrowUpRight size={16}/></button>
            </footer>
          </div>
          <div className="experience-portal__progress" aria-hidden="true"><span/></div>
        </div>
      </div>
    </div>
    {locationOpen && <div className="experience-portal__location-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setLocationOpen(false); }}><div className="experience-portal__location-panel" role="region" aria-label={`Fotos e localização de ${venue.name}`}><div className="experience-portal__location-title"><strong>{venue.name}</strong><button type="button" onClick={() => setLocationOpen(false)} aria-label="Fechar fotos e mapa"><X size={22}/></button></div><LocationPanel venue={venue} google={google}/></div></div>}
  </div>;
}

function VoteModal({ venue, onClose, onComplete, config, election, progress }) {
  const [email, setEmail] = useState(() => localStorage.getItem('afterhours-email') || '');
  const [name, setName] = useState(() => localStorage.getItem('afterhours-name') || '');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!venue) return;
    setError('');
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
      localStorage.setItem(`afterhours-choice-r${payload.round}-${venue.category}`, venue.id);
      onComplete(venue, payload.results, payload.round);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="vote-dialog" role="dialog" aria-modal="true" aria-labelledby="vote-dialog-title">
      <button className="dialog-close" aria-label="Fechar" onClick={onClose}><X size={22}/></button>
      <div className="dialog-eyebrow"><span className="live-dot"/> {election.round}º TURNO · SUA ESCOLHA</div>
      <h2 id="vote-dialog-title">Seu voto.<br/><em>Seu rolê.</em></h2>
      <div className="chosen-venue"><VenueImg src={venue.images[0]} fallback={venue.images[1]} alt={venue.name}/><div><span>{venue.category === 'bars' ? 'BAR' : 'HAMBURGUERIA'} SELECIONADO</span><strong>{venue.name}</strong><small><MapPin size={12}/>{venue.neighborhood}</small></div><Check size={22}/></div>
      <div className="dialog-progress"><span>{election.round === 1 ? 'PRIMEIRO TURNO · 2 SEGMENTOS OBRIGATÓRIOS' : 'GRANDE FINAL · NOVO VOTO NOS DOIS SEGMENTOS'}</span><div><span className={progress.bars ? 'is-complete' : ''}>01 BAR {progress.bars ? '✓' : ''}</span><span className={progress.burgers ? 'is-complete' : ''}>02 HAMBURGUERIA {progress.burgers ? '✓' : ''}</span></div></div>
      <form onSubmit={submit} className="vote-form">
        <label>Seu nome<input autoFocus value={name} onChange={e => setName(e.target.value)} type="text" maxLength={60} placeholder="Como podemos te chamar?" required /></label>
        <label>Seu e-mail<input value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={150} placeholder="voce@empresa.com" required /></label>
        {config.requiresAccessCode && <label>Código do time<input value={code} onChange={e => setCode(e.target.value)} type="password" maxLength={80} placeholder="Código compartilhado com o time" required /></label>}
        {error && <p className="form-error" role="alert"><CircleAlert size={15}/>{error}</p>}
        <button className="button button--lime button--submit" type="submit" disabled={sending || election.phase !== 'open'}>{sending ? 'Registrando...' : `Confirmar voto · ${election.round}º turno`}<ArrowUpRight size={18}/></button>
      </form>
      <p className="dialog-note">Use sempre o mesmo e-mail nos dois segmentos e nos dois turnos. O primeiro turno permanece salvo separadamente. A votação utiliza hash do e-mail, sem confirmação de posse.</p>
    </div>
  </div>;
}

function ResultsPanel({ category, items, results, onVote, chosen }) {
  const total = results?.totals?.[category] || 0;
  const options = results.round === 2 ? items.filter(v => results.finalists?.[category]?.includes(v.id)) : items;
  const ordered = [...options].sort((a, b) => (results?.counts?.[b.id] || 0) - (results?.counts?.[a.id] || 0));
  const archive = results.round === 2 ? [...items].sort((a,b) => (results.firstRound?.counts?.[b.id]||0)-(results.firstRound?.counts?.[a.id]||0)) : [];
  return <div className={`result-panel result-panel--${category}`}>
    <div className="result-panel__head"><span className="result-panel__icon">{category === 'bars' ? <Music2 size={20}/> : <UtensilsCrossed size={20}/>}</span><div><span className="eyebrow">{results.round === 2 ? 'GRANDE FINAL' : category === 'bars' ? 'SEGMENTO 01' : 'SEGMENTO 02'}</span><h3>{category === 'bars' ? 'Bares' : 'Hamburguerias'}</h3></div><div className="result-votes"><strong>{total}</strong><span>votos</span></div></div>
    <div className="result-rows">{ordered.map((venue, idx) => {
      const count = results?.counts?.[venue.id] || 0;
      const pct = total ? Math.round(count / total * 100) : 0;
      return <div key={venue.id} className={`result-row ${!venue.enabled ? 'result-row--disabled' : ''}`}>
        <div className="result-row__top"><div className="result-row__name"><span className="result-position">{String(idx + 1).padStart(2, '0')}</span><span>{venue.name}</span>{chosen === venue.id ? <small>SEU VOTO</small> : !venue.enabled ? <small>Indisponível</small> : null}</div><span className="result-row__pct">{pct}% <small>({count})</small></span></div>
        <div className="result-track"><div style={{ width: `${pct}%` }}/></div>
      </div>;
    })}</div>
    {results.round === 2 && <details className="results-archive"><summary>Ver apuração do 1º turno <ChevronRight size={16}/></summary>{archive.map(venue => <p key={venue.id}><span>{venue.name}</span><b>{results.firstRound?.counts?.[venue.id] || 0} voto(s)</b></p>)}</details>}
    {results.phase === 'open' && <button className="panel-secondary-action" onClick={() => onVote(ordered.find(v => v.enabled) || items[0])}>Votar em {category === 'bars' ? 'um bar' : 'uma hamburgueria'} <ArrowUpRight size={17}/></button>}
  </div>;
}

function VotingJourney({ results, progress, onNavigate }) {
  const done = Number(Boolean(progress.bars)) + Number(Boolean(progress.burgers));
  return <section className="vote-journey" aria-label="Etapas do seu voto"><div className="vote-journey__label"><span className="live-dot"/> SUA MISSÃO · {results.round === 2 ? 'GRANDE FINAL' : 'PRIMEIRO TURNO'} <strong>{done}/2 CONCLUÍDOS</strong></div>
    <div className="vote-journey__grid"><button type="button" onClick={() => onNavigate('bares')} className={progress.bars ? 'is-complete' : ''}><span className="journey-number">01</span><span><b>{progress.bars ? 'BAR ESCOLHIDO' : 'ESCOLHA UM BAR'}</b><small>{progress.bars ? 'Voto registrado. Pode alterar.' : 'Karaokê, sinuca, rock e mais'}</small></span>{progress.bars ? <Check/> : <ArrowUpRight/>}</button><span className="journey-connector">+</span><button type="button" onClick={() => onNavigate('burgers')} className={progress.burgers ? 'is-complete' : ''}><span className="journey-number">02</span><span><b>{progress.burgers ? 'HAMBURGUERIA ESCOLHIDA' : 'ESCOLHA UMA HAMBURGUERIA'}</b><small>{progress.burgers ? 'Voto registrado. Pode alterar.' : 'Rodízios, mini burgers e BBQ'}</small></span>{progress.burgers ? <Check/> : <ArrowUpRight/>}</button></div>
    <p>{done === 2 ? results.round === 1 ? 'Perfeito! Seus dois votos estão registrados. Agora é aguardar a abertura do segundo turno.' : 'Missão completa! Seus dois votos da grande final estão registrados.' : 'É preciso escolher um lugar de cada segmento. O placar é separado e você pode alterar seu voto.'}</p>
  </section>;
}

function AdminPanel({ results, config, onRefresh, onToast }) {
  const [key, setKey] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = async (url, method = 'GET') => {
    setLoading(true); setError('');
    try {
      const response = await fetch(url, { method, headers: { 'x-admin-key': key } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Falha na administração.');
      setVerified(true); onRefresh();
      return payload;
    } catch (e) { setError(e.message); setVerified(false); return null; }
    finally { setLoading(false); }
  };
  const advance = async () => {
    if (!window.confirm('Abrir o 2º turno com os dois locais mais votados em cada segmento? Essa ação não pode ser desfeita e preserva os votos do 1º turno.')) return;
    const data = await request('/api/admin/advance', 'POST');
    if (data) onToast(data.message);
  };
  const close = async () => {
    if (!window.confirm('Encerrar definitivamente a votação? Novos votos não serão aceitos.')) return;
    const data = await request('/api/admin/close', 'POST');
    if (data) onToast(data.message);
  };
  return <section className="admin-section" id="organizacao"><details><summary><ShieldCheck size={18}/> Área da organização <ChevronRight size={16}/></summary><div className="admin-body"><h3>Controle dos turnos</h3><p>Somente a organização pode iniciar a grande final. A classificação é automática: os 2 mais votados de cada segmento, com desempate por nome.</p>{!config.adminEnabled && <p className="form-error"><CircleAlert size={16}/> Configure <code>VOTE_ADMIN_KEY</code> no Render para habilitar essa função.</p>}
    <label>Chave do organizador<input type="password" value={key} onChange={e => { setKey(e.target.value); setVerified(false); }} placeholder="Chave configurada no Render" autoComplete="off"/></label>
    <button type="button" className="button button--outline" disabled={!key || loading || !config.adminEnabled} onClick={() => request('/api/admin/status')}><LockKeyhole size={16}/> {verified ? 'Acesso confirmado' : 'Validar acesso'}</button>
    {verified && <div className="admin-actions"><div><b>{results.round === 1 ? '1º turno aberto' : results.phase === 'open' ? 'Grande final aberta' : 'Votação encerrada'}</b><small>O resultado do turno anterior nunca é apagado.</small></div>{results.round === 1 && <button className="button button--lime" type="button" disabled={loading} onClick={advance}><Trophy size={17}/> Abrir segundo turno</button>}{results.round === 2 && results.phase === 'open' && <button className="button button--lime" type="button" disabled={loading} onClick={close}><Check size={17}/> Encerrar votação</button>}</div>}
    {error && <p className="form-error" role="alert"><CircleAlert size={15}/>{error}</p>}</div></details></section>;
}

export default function App() {
  const [config, setConfig] = useState({ persistence: 'loading', googlePhotosEnabled: false, requiresAccessCode: false, adminEnabled: false });
  const [results, setResults] = useState(emptyResults);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [experienceCategory, setExperienceCategory] = useState(null);
  const lastFocusedRef = useRef(null);
  const [choices, setChoices] = useState({ bars: null, burgers: null });
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(false);
  const refreshResults = useCallback(async () => {
    try {
      const response = await fetch('/api/results', { cache: 'no-store' });
      if (response.ok) setResults(await response.json());
    } catch { /* servidor ainda iniciando */ }
  }, []);
  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(setConfig).catch(() => setConfig({ persistence: 'offline', googlePhotosEnabled: false, requiresAccessCode: false, adminEnabled: false }));
    refreshResults();
    const interval = setInterval(refreshResults, 15000);
    return () => clearInterval(interval);
  }, [refreshResults]);
  useEffect(() => {
    const round = results.round || 1;
    setChoices({
      bars: localStorage.getItem(`afterhours-choice-r${round}-bars`),
      burgers: localStorage.getItem(`afterhours-choice-r${round}-burgers`)
    });
  }, [results.round]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      gsap.from('.hero-copy > *', { opacity: 0, y: 34, duration: 0.85, stagger: 0.1, ease: 'power3.out', delay: 0.15 });
      gsap.utils.toArray('.reveal').forEach(element => {
        gsap.from(element, { opacity: 0, y: 45, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
      });
      media.add('(max-width: 900px)', () => {
        gsap.utils.toArray('.mobile-story-card').forEach(card => {
          gsap.fromTo(card, { opacity: 0.52, y: 65, rotationX: 9, scale: 0.91 }, { opacity: 1, y: 0, rotationX: 0, scale: 1, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 100%', end: 'center 56%', scrub: true } });
        });
      });
    });
    return () => { media.revert(); ctx.revert(); };
  }, [results.round]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  const openExperience = category => {
    lastFocusedRef.current = document.activeElement;
    setMenu(false);
    setExperienceCategory(category);
  };
  const closeExperience = () => {
    setExperienceCategory(null);
    requestAnimationFrame(() => lastFocusedRef.current?.focus?.({ preventScroll: true }));
  };
  const navigate = id => {
    if (id === 'bares') openExperience('bars');
    else if (id === 'burgers') openExperience('burgers');
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openVote = venue => {
    if (results.phase !== 'open') { setToast('Votação encerrada. O resultado final já está disponível.'); return; }
    if (results.round === 2 && !results.finalists?.[venue.category]?.includes(venue.id)) {
      setToast('Essa opção não está na grande final.'); return;
    }
    setSelectedVenue(venue);
  };
  const done = (venue, updated, round) => {
    if (updated) setResults(updated);
    setSelectedVenue(null);
    const next = { ...choices, [venue.category]: venue.id };
    setChoices(next);
    const other = venue.category === 'bars' ? 'burgers' : 'bars';
    setToast(next[other] ? `Seu voto em ${venue.name} foi salvo! Os dois segmentos do ${round}º turno estão completos.` : `Voto em ${venue.name} registrado! Falta escolher ${other === 'bars' ? 'um bar' : 'uma hamburgueria'}.`);
  };
  const share = async () => {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title: 'AFTERHOURS · A escolha é sua', text: 'Vote em um bar e uma hamburgueria para a nossa confraternização!', url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setToast('Link copiado! Compartilhe no grupo do time.'); }
      else window.prompt('Copie o link da votação:', url);
    } catch (error) { if (error.name !== 'AbortError') setToast('Não foi possível compartilhar. Copie o endereço do site.'); }
  };
  const totalVotes = (results.totals.bars || 0) + (results.totals.burgers || 0);
  const complete = Number(Boolean(choices.bars)) + Number(Boolean(choices.burgers));
  return <div className="site">
    <header className="site-header"><div className="site-header__inner"><Brand/><nav className={`site-nav ${menu ? 'site-nav--open' : ''}`} aria-label="Navegação principal">
      <a href="#conceito" onClick={() => setMenu(false)}>A experiência</a><button type="button" onClick={() => openExperience('bars')}>Bares</button><button type="button" onClick={() => openExperience('burgers')}>Hamburguerias</button><a href="#resultados" onClick={() => setMenu(false)}>Placar</a>
    </nav><a href="#votacao" className="header-vote-button">MEUS VOTOS {complete}/2 <ArrowUpRight size={15}/></a><button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Abrir menu">{menu ? <X/> : <Menu/>}</button></div></header>

    <main>
      <section className="hero" id="inicio"><div className="hero-glow hero-glow--one"/><div className="hero-glow hero-glow--two"/><HeroScene/>
        <div className="hero-inner"><div className="hero-copy"><div className="hero-meta"><span className="live-dot"/> {results.round === 2 ? 'A GRANDE FINAL COMEÇOU' : 'O PRÓXIMO ROLÊ COMEÇA AQUI'} <span className="meta-line"/></div>
          <h1>O rolê é<br/><span className="hero-title-outline">nosso.</span><br/>A escolha <em>é sua.</em></h1>
          <p>{results.round === 2 ? 'O primeiro turno escolheu os finalistas. Agora são dois confrontos: um bar e uma hamburgueria. Seu voto define o destino.' : '10 lugares. 2 universos. 2 votos por pessoa. Explore cada ambiente em 3D, escolha um bar e uma hamburgueria, e prepare-se para a grande final.'}</p>
          <div className="hero-actions"><a className="button button--lime button--big" href="#conceito">Explorar experiências <ArrowDownRight size={21}/></a><a className="hero-link" href="#resultados"><BarChart3 size={18}/> Acompanhar placar</a><button className="hero-link hero-share" onClick={share}><Share2 size={18}/> Compartilhar</button></div>
          <div className="hero-kpis"><div><strong>{results.round === 2 ? '04' : '10'}</strong><span>DESTINOS</span></div><div><strong>02</strong><span>VOTOS POR TURNO</span></div><div><strong>{String(totalVotes).padStart(2, '0')}</strong><span>VOTOS NO TURNO</span></div></div>
        </div><div className="hero-side-caption"><span>AFTERHOURS / 2026</span><span>O UNIVERSO DA SUA ESCOLHA</span></div></div>
        <a href="#conceito" className="scroll-down" aria-label="Rolar para as experiências"><span>SCROLL TO EXPLORE</span><ArrowDown size={18}/></a>
      </section>

      {config.persistence === 'local-demo' && <div className="demo-notice"><CircleAlert size={18}/><span><b>Modo demonstração:</b> sem PostgreSQL os votos podem desaparecer ao reiniciar o servidor. Configure <code>DATABASE_URL</code>.</span></div>}
      {config.persistence === 'offline' && <div className="demo-notice"><CircleAlert size={18}/>Servidor de votação desconectado. Confirme que o backend está em execução.</div>}

      <section id="conceito" className="intro-section"><div className="intro-heading reveal"><span className="section-kicker">/// EXPERIÊNCIA DE VOTAÇÃO · {results.round}º TURNO</span><div className="intro-title-row"><h2>ESCOLHA A SUA <em>EXPERIÊNCIA.</em></h2><p>Clique em um universo para abrir o portal em tela cheia. Role dentro da experiência, explore os ambientes e vote em um lugar por categoria.</p></div></div>
        <div className="category-grid"><span className="category-join" aria-hidden="true">+</span><button type="button" onClick={() => openExperience('bars')} className="category-card category-card--bars reveal" aria-label="Explorar bares em uma experiência interativa"><span className="category-card__photo"><VenueImg src={bars[0].images[0]} fallback={bars[0].images[1]} alt=""/></span><span className="category-card__orb category-card__orb--purple"/><div className="category-card__top"><span>SEGMENTO / 01</span><Music2 size={24}/></div><div className="category-card__bottom"><span>🎤 &nbsp; KARAOKÊ · SINUCA · ROCK</span><h3>NOITE<br/>LÁ FORA.</h3><span className="category-card__footer">{results.round === 2 ? '2 FINALISTAS' : '5 BARES'} · ENTRAR NO PORTAL <ArrowUpRight size={22}/></span></div></button>
        <button type="button" onClick={() => openExperience('burgers')} className="category-card category-card--burgers reveal" aria-label="Explorar hamburguerias em uma experiência interativa"><span className="category-card__photo"><VenueImg src={burgers[0].images[0]} fallback={burgers[0].images[1]} alt=""/></span><span className="category-card__orb category-card__orb--orange"/><div className="category-card__top"><span>SEGMENTO / 02</span><UtensilsCrossed size={24}/></div><div className="category-card__bottom"><span>🍔 &nbsp; MINI BURGERS · RODÍZIO · BBQ</span><h3>FOME DE<br/>ROLÊ.</h3><span className="category-card__footer">{results.round === 2 ? '2 FINALISTAS' : '5 HAMBURGUERIAS'} · ENTRAR NO PORTAL <ArrowUpRight size={22}/></span></div></button></div>
        <div className="intro-bottom"><span><Sparkles size={15}/> ROLE, EXPLORE, VOTE · DOIS SEGMENTOS OBRIGATÓRIOS</span><span>FOTOS · MAPAS · VOTAÇÃO · 3D</span></div>
      </section>

      <div id="votacao"><VotingJourney results={results} progress={choices} onNavigate={navigate}/></div>

      <section id="resultados" className="results-section"><div className="results-wrap"><div className="results-heading reveal"><div><span className="section-kicker">/// {results.round === 2 ? 'GRANDE FINAL · 2º TURNO' : 'PRIMEIRO TURNO · 10 DESTINOS'}</span><h2>O PLACAR<br/><em>DA GALERA.</em></h2></div><div className="results-head-right"><span className="results-live"><span className="live-dot"/> ATUALIZA A CADA 15 SEGUNDOS</span><p>{results.phase === 'closed' ? 'A votação foi encerrada. Confira os vencedores.' : results.round === 2 ? 'Os dois mais votados de cada segmento disputam a final. Os votos antigos continuam arquivados.' : 'Escolha um bar e uma hamburgueria. A organização abrirá o 2º turno com os dois primeiros de cada segmento.'}</p></div></div>
        <div className="result-grid"><ResultsPanel category="bars" items={bars} results={results} onVote={openVote} chosen={choices.bars}/><ResultsPanel category="burgers" items={burgers} results={results} onVote={openVote} chosen={choices.burgers}/></div>
        <div className="results-footer"><span><Check size={17}/> Um voto por e-mail em cada segmento e em cada turno.</span><span>{totalVotes} VOTOS NO {results.round}º TURNO</span></div>
      </div></section>

      <AdminPanel results={results} config={config} onRefresh={refreshResults} onToast={setToast}/>
      <section className="closing-section"><div className="closing-marquee">GOOD VIBES <span>✳</span> GOOD FOOD <span>✳</span> GOOD PEOPLE <span>✳</span> </div><div className="closing-inner"><span className="section-kicker">ATÉ A PRÓXIMA NOITE</span><h2>O MELHOR PLANO<br/>É <em>DECIDIR JUNTO.</em></h2><a href="#inicio" className="button button--outline">Voltar ao início <ArrowUpRight size={18}/></a></div></section>
    </main>
    <footer className="footer"><Brand compact/><span>FEITO PARA O TIME · SÃO PAULO · 2026</span><span>EXPLORE. ESCOLHA. CELEBRE.</span></footer>
    {experienceCategory && <ExperiencePortal key={experienceCategory} category={experienceCategory} election={results} config={config} choices={choices} onVote={openVote} onClose={closeExperience} onSwitch={setExperienceCategory} voteOpen={Boolean(selectedVenue)}/>}
    <VoteModal venue={selectedVenue} onClose={() => setSelectedVenue(null)} onComplete={done} config={config} election={results} progress={choices}/>
    {toast && <div className="toast-message" role="status"><Check size={18}/>{toast}<button onClick={() => setToast(null)} aria-label="Fechar aviso"><X size={16}/></button></div>}
  </div>;
}

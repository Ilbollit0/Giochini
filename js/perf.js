// Prestazioni adattive: sceglie quanti effetti mostrare in base al dispositivo.
// Livelli: 'high' (tutto), 'medium' (sfondo fermo, meno coriandoli), 'low' (niente sfocature
// né animazioni continue, foto più leggere). In "auto" il livello parte dalle specifiche
// (processore, memoria, rete, schermo) e si corregge misurando la fluidità reale.
// Va caricato nel <head>, così la classe su <html> c'è già al primo disegno della pagina.
window.Perf = (() => {
  const LEVELS = ['low', 'medium', 'high'];
  const LABELS = { auto: 'Auto', high: 'Alta', medium: 'Media', low: 'Leggera' };
  const read = (k, f) => {
    try {
      const v = JSON.parse(localStorage.getItem('giochini:' + k));
      return v ?? f;
    } catch {
      return f;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem('giochini:' + k, JSON.stringify(v));
    } catch {
      /* ignorato */
    }
  };

  // ---------- Specifiche del dispositivo ----------
  const conn = navigator.connection || {};
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory; // GB (solo Chrome/Edge), arrotondato
  const touch = matchMedia('(pointer: coarse)').matches;
  const hover = matchMedia('(hover: hover)').matches;
  const dpr = window.devicePixelRatio || 1;

  function hardwareLevel() {
    if (cores <= 2 || (memory && memory <= 2)) return 'low';
    if (cores <= 4 || (memory && memory <= 4)) return 'medium';
    // Schermi molto grandi con DPR alto: tanti pixel da ridisegnare a ogni fotogramma.
    if (screen.width * screen.height * dpr * dpr > 9e6 && cores <= 6) return 'medium';
    return 'high';
  }
  const hw = hardwareLevel();
  const netSlow = () => !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '');

  // ---------- Stato ----------
  let pref = read('perf', 'auto'); // scelta dell'utente
  if (!(pref in LABELS)) pref = 'auto';
  // Livello automatico: memorizzato tra una pagina e l'altra, abbassato dalle misure.
  // Un abbassamento vale una settimana, poi si riprova il livello delle specifiche.
  const WEEK = 7 * 24 * 3600 * 1000;
  let auto = read('perf-auto', null);
  if (!auto || auto.hw !== hw || !LEVELS.includes(auto.level) || !(auto.until > Date.now())) auto = { hw, level: hw, until: 0 };
  const level = () => (pref === 'auto' ? auto.level : pref);

  function apply() {
    const root = document.documentElement;
    LEVELS.forEach((l) => root.classList.toggle('perf-' + l, l === level()));
    window.dispatchEvent(new CustomEvent('perfchange', { detail: level() }));
  }

  // ---------- Misura della fluidità ----------
  // Riceve le durate dei fotogrammi (ms): se il dispositivo arranca (sotto ~40 fps o con
  // molti scatti) scende di un livello e lo ricorda.
  function report(deltas) {
    if (pref !== 'auto' || document.hidden || deltas.length < 20) return;
    const sorted = [...deltas].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const long = deltas.filter((d) => d > 50).length / deltas.length;
    const i = LEVELS.indexOf(auto.level);
    if ((median > 24 || long > 0.12) && i > 0) {
      auto = { hw, level: LEVELS[i - 1], until: Date.now() + WEEK };
      write('perf-auto', auto);
      apply();
    }
  }

  // Registra i fotogrammi per `ms` millisecondi e poi li valuta.
  function sample(ms = 1500) {
    if (pref !== 'auto' || document.hidden) return;
    const deltas = [];
    let last = performance.now();
    const t0 = last;
    const frame = (now) => {
      deltas.push(now - last);
      last = now;
      if (now - t0 < ms && !document.hidden) requestAnimationFrame(frame);
      else report(deltas.slice(1));
    };
    requestAnimationFrame(frame);
  }

  // Misura iniziale a pagina caricata (dopo che font e script si sono assestati).
  addEventListener('load', () => setTimeout(() => sample(1500), 800));

  // ---------- Foto ----------
  // Le miniature di Wikimedia esistono in larghezze standard: si sceglie la più piccola
  // che basta per lo schermo, mai più grande di quella salvata nei dati.
  const BUCKETS = [330, 500, 960, 1280];
  function img(url) {
    if (!url) return url;
    const m = url.match(/\/(\d+)px-[^/]+$/);
    if (!m) return url;
    const stored = Number(m[1]);
    const lvl = level();
    const cap = netSlow() ? 500 : lvl === 'low' ? 960 : 1280;
    // Le foto nel gioco occupano al massimo ~900 px di larghezza (vedi .photo-frame img).
    const needed = Math.min(innerWidth, 900) * Math.min(dpr, 2);
    const width = BUCKETS.find((b) => b >= Math.min(needed, cap)) || 1280;
    const w = Math.min(width, cap, stored);
    return w === stored ? url : url.replace(/\/\d+px-([^/]+)$/, `/${w}px-$1`);
  }

  apply();

  return {
    LABELS,
    hw,
    get level() {
      return level();
    },
    get pref() {
      return pref;
    },
    set(p) {
      pref = p in LABELS ? p : 'auto';
      write('perf', pref);
      apply();
    },
    // Opzioni derivate dal livello
    get confetti() {
      return { high: 1, medium: 0.6, low: 0.3 }[level()];
    },
    get canvasDpr() {
      return Math.min(dpr, { high: 2, medium: 1.5, low: 1 }[level()]);
    },
    get tilt() {
      return hover && !touch && level() === 'high';
    },
    get preload() {
      return !netSlow();
    },
    get mapAnim() {
      return level() !== 'low';
    },
    img,
    report,
    sample,
  };
})();

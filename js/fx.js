// Effetti: suoni sintetizzati, coriandoli, punti volanti, conto alla rovescia, zoom foto.
window.FX = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let audio;
  let muted = Store.get('mute', false);

  function tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    if (muted) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime + when;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch {
      /* audio non disponibile */
    }
  }

  const SOUNDS = {
    tick: () => tone(1400, 0.035, 'square', 0.04),
    pop: () => tone(620, 0.09, 'sine', 0.15),
    count: () => tone(440, 0.16, 'square', 0.07),
    go: () => { tone(660, 0.12, 'square', 0.08); tone(880, 0.4, 'square', 0.08, 0.1); },
    correct: () => { tone(660, 0.12, 'triangle', 0.22); tone(990, 0.3, 'triangle', 0.22, 0.1); },
    wrong: () => { tone(220, 0.25, 'sawtooth', 0.09); tone(160, 0.35, 'sawtooth', 0.09, 0.14); },
    timeout: () => tone(440, 0.6, 'sine', 0.2),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.18, i * 0.11)),
    fanfare: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i === 6 ? 0.7 : 0.18, 'triangle', 0.18, i * 0.13)),
  };

  // ---------- Coriandoli ----------
  let canvas, ctx2d, parts = [], raf = null;
  const COLORS = ['#ffd166', '#ff5c8a', '#8b7bff', '#2fd4c9', '#3ddc84', '#ffffff', '#ff8a5c'];
  function ensureCanvas() {
    if (canvas) return;
    canvas = Object.assign(document.createElement('canvas'), { id: 'fx-canvas' });
    document.body.append(canvas);
    ctx2d = canvas.getContext('2d');
    const size = () => {
      scale = Perf.canvasDpr;
      canvas.width = innerWidth * scale;
      canvas.height = innerHeight * scale;
    };
    size();
    addEventListener('resize', size);
    addEventListener('perfchange', size);
  }
  let scale = 1;
  // Il numero di coriandoli e la risoluzione del canvas dipendono dal livello grafico.
  function confetti({ count = 140, x = 0.5, y = 0.35, spread = 1, colors = COLORS } = {}) {
    if (reduced) return;
    ensureCanvas();
    count = Math.round(count * Perf.confetti);
    const dpr = scale;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
      const speed = (6 + Math.random() * 10) * dpr;
      parts.push({
        x: x * canvas.width,
        y: y * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: (6 + Math.random() * 6) * dpr,
        h: (8 + Math.random() * 10) * dpr,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = scale;
    parts = parts.filter((p) => p.y < canvas.height + 40 && p.life < 400);
    for (const p of parts) {
      p.life++;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.32 * dpr;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx2d.save();
      ctx2d.translate(p.x, p.y);
      ctx2d.rotate(p.r);
      ctx2d.scale(1, Math.cos(p.life * 0.15));
      ctx2d.fillStyle = p.c;
      ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx2d.restore();
    }
    raf = parts.length ? requestAnimationFrame(step) : (ctx2d.clearRect(0, 0, canvas.width, canvas.height), null);
  }
  function celebrate() {
    confetti({ count: 120, x: 0.2, y: 0.6, spread: 0.7 });
    setTimeout(() => confetti({ count: 120, x: 0.8, y: 0.6, spread: 0.7 }), 250);
    setTimeout(() => confetti({ count: 160, x: 0.5, y: 0.4, spread: 1.2 }), 550);
  }

  // ---------- Punti che volano ----------
  function floatText(text, target, color) {
    const r = target?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const el = document.createElement('div');
    el.className = 'float-points';
    el.textContent = text;
    el.style.left = r.left + r.width / 2 + 'px';
    el.style.top = r.top + 'px';
    if (color) el.style.color = color;
    document.body.append(el);
    setTimeout(() => el.remove(), 1300);
  }
  function flash(color) {
    if (reduced) return;
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.background = `radial-gradient(circle at center, transparent 30%, ${color})`;
    document.body.append(el);
    setTimeout(() => el.remove(), 700);
  }

  // ---------- Conto alla rovescia a schermo intero ----------
  function countdown({ kicker = '', emoji = '', title = '', from = 3, accent } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      if (accent) overlay.style.setProperty('--accent', accent);
      overlay.innerHTML = `<div><div class="overlay-kicker"></div><div class="overlay-emoji"></div><h1 class="overlay-title"></h1><div class="overlay-count" aria-live="assertive"></div></div>`;
      overlay.querySelector('.overlay-kicker').textContent = kicker;
      overlay.querySelector('.overlay-emoji').textContent = emoji;
      overlay.querySelector('.overlay-title').textContent = title;
      document.body.append(overlay);
      const num = overlay.querySelector('.overlay-count');
      let n = from;
      const show = () => {
        num.classList.remove('go');
        void num.offsetWidth;
        num.textContent = n > 0 ? n : 'VIA!';
        num.classList.add('go');
        n > 0 ? SOUNDS.count() : SOUNDS.go();
      };
      const skip = () => finish();
      let timer;
      function finish() {
        clearTimeout(timer);
        overlay.remove();
        removeEventListener('keydown', skip);
        resolve();
      }
      overlay.addEventListener('click', skip);
      addEventListener('keydown', skip);
      const tick = () => {
        if (n < 0) return finish();
        show();
        n--;
        timer = setTimeout(tick, 850);
      };
      timer = setTimeout(tick, title ? 900 : 100);
    });
  }

  // ---------- 3, 2, 1 sopra la domanda ----------
  // Copre `host` (che deve avere position: relative) e si salta con un clic o un tasto.
  function countIn(host, from = 3) {
    return new Promise((resolve) => {
      if (!host) return resolve();
      const box = document.createElement('div');
      box.className = 'count-in';
      const num = document.createElement('div');
      num.className = 'count-in-num';
      box.append(num);
      host.append(box);
      let n = from, timer;
      const finish = () => {
        clearTimeout(timer);
        box.remove();
        removeEventListener('keydown', finish);
        resolve();
      };
      box.addEventListener('click', finish);
      addEventListener('keydown', finish);
      const tick = () => {
        if (n < 0) return finish();
        num.classList.remove('go');
        void num.offsetWidth;
        num.textContent = n > 0 ? n : 'VIA!';
        num.classList.add('go');
        n > 0 ? SOUNDS.count() : SOUNDS.go();
        n--;
        timer = setTimeout(tick, n < 0 ? 450 : 650);
      };
      tick();
    });
  }

  // ---------- Foto a tutto schermo ----------
  function lightbox(src, alt = '') {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.append(Object.assign(document.createElement('img'), { src, alt }));
    const close = () => {
      box.remove();
      removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    box.addEventListener('click', close);
    addEventListener('keydown', onKey, true);
    document.body.append(box);
  }

  // Immagine con riquadro, caricamento animato e crediti mostrati dopo la risposta.
  // La foto viene scaricata alla larghezza adatta allo schermo e alla connessione (Perf.img);
  // lo zoom a tutto schermo usa la versione salvata nei dati, tranne in modalità leggera.
  function photo(full, credit, alt = 'Foto da indovinare') {
    const src = Perf.img(full);
    const big = Perf.level === 'low' || !Perf.preload ? src : full;
    const frame = document.createElement('figure');
    frame.className = 'photo-frame loading';
    frame.style.margin = '0 auto 1.2rem';
    const img = Object.assign(document.createElement('img'), { src, alt, decoding: 'async' });
    img.addEventListener('load', () => frame.classList.remove('loading'));
    img.addEventListener('error', () => {
      frame.classList.remove('loading');
      img.alt = 'Immagine non disponibile (serve la connessione a internet)';
    });
    img.addEventListener('click', () => lightbox(big, alt));
    const cap = document.createElement('figcaption');
    cap.className = 'photo-credit';
    cap.hidden = true;
    if (credit) {
      const [who, lic, page] = credit;
      cap.append('📷 ' + who + ' · ' + lic + ' · ');
      cap.append(Object.assign(document.createElement('a'), { href: page, target: '_blank', rel: 'noopener', textContent: 'Wikimedia Commons' }));
    }
    frame.append(img, cap);
    frame.showCredit = () => (cap.hidden = !credit);
    return frame;
  }

  function preload(src) {
    if (src && Perf.preload) new Image().src = Perf.img(src);
  }

  return {
    sound: (name) => SOUNDS[name]?.(),
    get muted() {
      return muted;
    },
    setMuted(v) {
      muted = v;
      Store.set('mute', v);
    },
    confetti,
    celebrate,
    floatText,
    flash,
    countdown,
    countIn,
    lightbox,
    photo,
    preload,
  };
})();

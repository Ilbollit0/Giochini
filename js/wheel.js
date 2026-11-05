// Ruota della fortuna in SVG. new Wheel(contenitore, voci) → spin(indice) restituisce una Promise.
// Ogni voce: { label, color, emoji? }.
window.Wheel = class {
  constructor(host, items = []) {
    this.host = host;
    this.rotation = 0;
    this.spinning = false;
    host.classList.add('wheel-wrap');
    host.innerHTML = `
      <svg class="wheel-pointer" viewBox="0 0 34 44" aria-hidden="true">
        <path d="M17 42 L3 10 A15 15 0 1 1 31 10 Z" fill="#fff"/>
        <circle cx="17" cy="15" r="6" fill="#8b7bff"/>
      </svg>
      <svg viewBox="-110 -110 220 220" role="img" aria-label="Ruota">
        <circle r="108" fill="#15163a" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
        <g class="wheel-rotor"></g>
        <g class="wheel-studs"></g>
      </svg>`;
    this.rotor = host.querySelector('.wheel-rotor');
    this.pointer = host.querySelector('.wheel-pointer');
    this.studs = host.querySelector('.wheel-studs');
    this.setItems(items);
  }

  setItems(items) {
    this.items = items;
    const n = Math.max(1, items.length);
    const a = 360 / n;
    const R = 100;
    const pt = (deg, r = R) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [(Math.cos(rad) * r).toFixed(2), (Math.sin(rad) * r).toFixed(2)];
    };
    const NS = 'http://www.w3.org/2000/svg';
    this.rotor.replaceChildren();
    const fontSize = Math.max(6, Math.min(13, 120 / n + 4));
    const maxChars = n > 8 ? 9 : 14;
    items.forEach((item, i) => {
      const g = document.createElementNS(NS, 'g');
      const path = document.createElementNS(NS, 'path');
      if (n === 1) {
        path.setAttribute('d', `M0 -${R} A${R} ${R} 0 1 1 -0.01 -${R} Z`);
      } else {
        const [x1, y1] = pt(i * a);
        const [x2, y2] = pt((i + 1) * a);
        path.setAttribute('d', `M0 0 L${x1} ${y1} A${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${x2} ${y2} Z`);
      }
      path.setAttribute('fill', item.color);
      path.setAttribute('stroke', 'rgba(10,10,30,.35)');
      path.setAttribute('stroke-width', '1');
      const shade = document.createElementNS(NS, 'path');
      shade.setAttribute('d', path.getAttribute('d'));
      shade.setAttribute('fill', i % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)');
      const text = document.createElementNS(NS, 'text');
      const mid = (i + 0.5) * a;
      text.setAttribute('transform', `rotate(${mid - 90}) translate(${R * 0.6} 0)`);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'wheel-label');
      text.setAttribute('font-size', fontSize.toFixed(1));
      let label = (item.emoji ? item.emoji + ' ' : '') + item.label;
      if ([...label].length > maxChars) label = [...label].slice(0, maxChars - 1).join('') + '…';
      text.textContent = label;
      g.append(path, shade, text);
      this.rotor.append(g);
    });
    // Borchie sul bordo
    this.studs.replaceChildren();
    const studs = Math.max(12, n * 2);
    for (let i = 0; i < studs; i++) {
      const [x, y] = pt((i * 360) / studs, 104);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', '2.2');
      c.setAttribute('fill', i % 2 ? '#ffd166' : '#fff');
      this.studs.append(c);
    }
    this.apply();
  }

  apply() {
    this.rotor.setAttribute('transform', `rotate(${(this.rotation % 360).toFixed(2)})`);
  }

  // Gira fino a fermarsi sulla voce `index` (casuale se omessa). Risolve con l'indice.
  spin(index = Math.floor(Math.random() * this.items.length), { duration = 5200, turns = 6 } = {}) {
    if (this.spinning || !this.items.length) return Promise.resolve(index);
    this.spinning = true;
    const n = this.items.length;
    const a = 360 / n;
    const jitter = (Math.random() - 0.5) * a * 0.6;
    const wanted = (((-(index + 0.5) * a + jitter) % 360) + 360) % 360;
    const start = this.rotation;
    const base = ((start % 360) + 360) % 360;
    const delta = turns * 360 + ((wanted - base + 360) % 360);
    const end = start + delta;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduced ? 300 : duration;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    let lastSeg = Math.floor(start / a);
    const t0 = performance.now();
    // La rotazione è il momento più pesante: i tempi dei fotogrammi servono a Perf
    // per capire se il dispositivo regge gli effetti.
    const deltas = [];
    let prev = t0;
    return new Promise((resolve) => {
      const frame = (now) => {
        deltas.push(now - prev);
        prev = now;
        const t = Math.min(1, (now - t0) / dur);
        this.rotation = start + delta * ease(t);
        this.apply();
        const seg = Math.floor(this.rotation / a);
        if (seg !== lastSeg) {
          lastSeg = seg;
          FX.sound('tick');
          this.pointer.classList.remove('tick');
          void this.pointer.getBoundingClientRect();
          this.pointer.classList.add('tick');
        }
        if (t < 1) requestAnimationFrame(frame);
        else {
          this.rotation = end;
          this.spinning = false;
          Perf.report(deltas.slice(2));
          resolve(index);
        }
      };
      requestAnimationFrame(frame);
    });
  }
};

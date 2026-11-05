// "Che momento è?": foto storica → luogo sulla mappa + anno + parola chiave bonus.
// Per round: posizione max 5.000, anno max 4.000, parola chiave 1.000 → 10.000 punti.
(() => {
  const { el } = U;
  const MIN_YEAR = 1826; // la più antica foto giunta fino a noi è di Niépce (1826 o 1827)
  const MAX_YEAR = new Date().getFullYear();
  const MAX = { loc: 5000, year: 4000, kw: 1000 };

  const locScore = (km) => (km == null ? 0 : km <= 25 ? MAX.loc : Math.round(MAX.loc * Math.exp(-km / 1500)));
  const yearScore = (diff) => (diff === 0 ? MAX.year : Math.round(MAX.year * Math.exp(-diff / 12)));
  function kwMatch(input, keywords) {
    const a = U.normalize(input);
    if (a.length < 3) return false;
    return keywords.some((k) => {
      const b = U.normalize(k);
      if (a === b) return true;
      if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
      const tol = b.length >= 8 ? 2 : b.length >= 5 ? 1 : 0;
      return U.lev(a, b) <= tol;
    });
  }

  // Sui dispositivi lenti la mappa rinuncia alle animazioni di zoom e tiene meno tasselli in memoria.
  const mapOpts = (extra) => ({ worldCopyJump: true, minZoom: 1, fadeAnimation: Perf.mapAnim, zoomAnimation: Perf.mapAnim, markerZoomAnimation: Perf.mapAnim, ...extra });
  function tiles(map) {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      keepBuffer: Perf.level === 'low' ? 1 : 2,
      updateWhenZooming: Perf.mapAnim,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
  }
  const pin = (color, cls = '') =>
    L.divIcon({ className: '', html: `<div class="map-pin ${cls}" style="--team:${color}">${cls ? '📍' : ''}</div>`, iconSize: cls ? [30, 30] : [22, 22], iconAnchor: cls ? [15, 15] : [11, 11] });

  GAMES.push({
    id: 'storico',
    rank: 1,
    isNew: true,
    kind: 'custom',
    scoring: 'big',
    title: 'Che momento è?',
    emoji: '🗺️',
    color: '#ffb347',
    desc: 'Foto storiche: punta il luogo sulla mappa, scegli l’anno e indovina l’evento. Fino a 10.000 punti a round.',
    options: [
      { key: 'rounds', label: 'Round', values: [[3, '3'], [5, '5'], [10, '10']], default: 5 },
      { key: 'timer', label: 'Tempo per squadra', values: [[0, 'Nessuno'], [60, '60 s'], [90, '90 s'], [120, '2 min']], default: 0 },
    ],
    common: [],

    mount(ctx) {
      const root = ctx.el;
      if (!window.L) {
        root.append(el('p', { textContent: 'La mappa non si è caricata: serve la connessione a internet. Ricarica la pagina.' }));
        return;
      }
      const rounds = Math.min(ctx.opts.rounds, STORICO.length);
      const items = U.shuffle(STORICO).slice(0, rounds);
      let round = 0, map, marker, seq, ti, guesses, item, photoFrame;

      function playRound() {
        item = items[round];
        FX.preload(items[round + 1]?.img);
        // A ogni round inizia una squadra diversa, sempre nell'ordine della ruota.
        const shift = round % ctx.teams.length;
        seq = [...ctx.teams.slice(shift), ...ctx.teams.slice(0, shift)];
        ti = 0;
        guesses = {};
        ctx.setProgress(`Round ${round + 1} di ${rounds}`, round / rounds);
        ctx.setTag('Max 10.000 punti');

        photoFrame = FX.photo(item.img, item.credit, 'Foto storica da indovinare');
        const mapBox = el('div', { className: 'st-map' });
        const year = el('input', { type: 'range', min: MIN_YEAR, max: MAX_YEAR, step: 1, value: 1926, id: 'st-year' });
        const out = el('output', { htmlFor: 'st-year', textContent: '1926' });
        const minus = el('button', { type: 'button', className: 'year-step', textContent: '−', ariaLabel: 'Un anno prima' });
        const plus = el('button', { type: 'button', className: 'year-step', textContent: '+', ariaLabel: 'Un anno dopo' });
        const kw = el('input', { type: 'text', className: 'text-input', id: 'st-kw', placeholder: 'Es. sbarco in Normandia, Titanic…', maxLength: 60, autocomplete: 'off' });
        const confirm = el('button', { type: 'button', className: 'primary-btn big', textContent: '📍 Metti la puntina sulla mappa', disabled: true });
        const waiting = el('div', { className: 'st-waiting' });
        const setYear = (v) => {
          year.value = Math.max(MIN_YEAR, Math.min(MAX_YEAR, v));
          out.textContent = year.value;
        };
        year.addEventListener('input', () => (out.textContent = year.value));
        minus.addEventListener('click', () => setYear(+year.value - 1));
        plus.addEventListener('click', () => setYear(+year.value + 1));

        const controls = el('div', { className: 'st-controls' },
          el('div', { className: 'st-field' }, el('label', { textContent: '1 · Dove? Clicca sulla mappa' }), mapBox),
          el('div', { className: 'st-field' },
            el('label', { htmlFor: 'st-year', textContent: '2 · Quando?' }),
            el('div', { className: 'year-display' }, minus, out, plus),
            year,
            el('div', { className: 'range-ends' }, el('span', { textContent: MIN_YEAR }), el('span', { textContent: MAX_YEAR }))),
          el('div', { className: 'st-field' },
            el('label', { htmlFor: 'st-kw', textContent: '3 · Bonus: una parola chiave (+1.000)' }),
            kw,
            el('p', { className: 'st-hint', textContent: 'Il nome dell’evento o una parola legata a quel momento. Si controlla alla risposta.' })),
          confirm,
          waiting);
        root.replaceChildren(el('div', { className: 'st-layout' }, el('div', { className: 'st-photo' }, photoFrame), controls));

        map?.remove();
        map = L.map(mapBox, mapOpts({ zoomSnap: 0.5 })).setView([25, 10], 1);
        tiles(map);
        map.on('click', (e) => {
          const ll = e.latlng.wrap();
          if (marker) marker.setLatLng(ll);
          else marker = L.marker(ll, { icon: pin(seq[ti].color) }).addTo(map);
          confirm.disabled = false;
          confirm.textContent = '✓ Conferma la risposta';
          FX.sound('pop');
        });

        function startTeam() {
          const team = seq[ti];
          ctx.setTurn(team);
          marker?.remove();
          marker = null;
          setYear(1926);
          kw.value = '';
          confirm.disabled = true;
          confirm.textContent = '📍 Metti la puntina sulla mappa';
          map.setView([25, 10], 1);
          waiting.replaceChildren(...seq.map((t) => el('span', { className: guesses[t.id] ? 'done' : '', textContent: (guesses[t.id] ? '✓ ' : '') + t.name })));
          ctx.startTimer(ctx.opts.timer, save);
        }

        function save() {
          if (!seq[ti]) return;
          const team = seq[ti];
          const ll = marker?.getLatLng();
          guesses[team.id] = { lat: ll?.lat, lng: ll?.lng, year: +year.value, kw: kw.value.trim() };
          ctx.stopTimer();
          FX.sound('correct');
          ti++;
          if (ti < seq.length) startTeam();
          else reveal();
        }
        confirm.addEventListener('click', save);
        ctx.onKey((e, k, typing) => {
          if (typing) {
            if (k === 'enter' && !confirm.disabled) save();
            return;
          }
          if (k === 'arrowleft') setYear(+year.value - (e.shiftKey ? 10 : 1));
          else if (k === 'arrowright') setYear(+year.value + (e.shiftKey ? 10 : 1));
          else if ((k === 'enter' || k === ' ') && !confirm.disabled && !e.target.matches('button, a')) {
            e.preventDefault();
            save();
          }
        });

        photoFrame.querySelector('img').addEventListener('load', () => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 50);
        startTeam();
      }

      function reveal() {
        ctx.stopTimer();
        ctx.setTurn(null);
        ctx.onKey(null);
        photoFrame.showCredit();

        const results = seq.map((team) => {
          const g = guesses[team.id];
          const km = g.lat == null ? null : U.km(g.lat, g.lng, item.lat, item.lng);
          const diff = Math.abs(g.year - item.year);
          const kwOk = kwMatch(g.kw, item.keywords);
          return { team, g, km, diff, kwOk, loc: locScore(km), yr: yearScore(diff) };
        });

        const mapBox = el('div', { className: 'st-map reveal' });
        const list = el('ol', { className: 'st-results' });
        const truth = el('div', { className: 'st-truth' },
          el('div', { className: 'yr', textContent: item.year }),
          el('strong', { textContent: '📍 ' + item.place }),
          el('p', { textContent: item.desc }));
        const nextBtn = el('button', { type: 'button', className: 'primary-btn big', textContent: round + 1 < rounds ? 'Prossimo round →' : 'Vedi la classifica 🏆' });
        root.replaceChildren(
          el('div', { className: 'st-layout' },
            el('div', { className: 'st-photo' }, photoFrame, truth),
            el('div', { className: 'st-controls' }, mapBox, list, el('div', { className: 'play-actions' }, nextBtn))));

        map?.remove();
        map = L.map(mapBox, mapOpts());
        tiles(map);
        const truthLL = [item.lat, item.lng];
        const points = [truthLL];
        results.forEach((r) => {
          if (r.g.lat == null) return;
          const ll = [r.g.lat, r.g.lng];
          points.push(ll);
          L.polyline([ll, truthLL], { color: r.team.color, weight: 3, dashArray: '6 8', opacity: 0.9 }).addTo(map);
          L.marker(ll, { icon: pin(r.team.color) }).addTo(map).bindTooltip(r.team.name);
        });
        L.marker(truthLL, { icon: pin('#ffd166', 'truth'), zIndexOffset: 1000 }).addTo(map).bindTooltip(item.place);
        setTimeout(() => {
          map.invalidateSize();
          if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 6 });
          else map.setView(truthLL, 4);
        }, 60);

        results
          .sort((a, b) => b.loc + b.yr + (b.kwOk ? MAX.kw : 0) - (a.loc + a.yr + (a.kwOk ? MAX.kw : 0)))
          .forEach((r, i) => {
            const total = el('span', { className: 'total', textContent: '0' });
            const kwBtn = el('button', { type: 'button', className: 'kw-toggle', title: 'Correggi a mano se la parola è giusta o sbagliata' });
            const paintKw = () => {
              kwBtn.setAttribute('aria-pressed', String(r.kwOk));
              kwBtn.textContent = r.g.kw ? `«${r.g.kw}» ${r.kwOk ? '✓ +1.000' : '✕'}` : 'nessuna parola';
            };
            paintKw();
            kwBtn.addEventListener('click', () => {
              r.kwOk = !r.kwOk;
              ctx.award(r.team.id, r.kwOk ? MAX.kw : -MAX.kw, kwBtn);
              paintKw();
              countTo(total, r.loc + r.yr + (r.kwOk ? MAX.kw : 0));
            });
            const li = el('li', {},
              el('span', { className: 'who', textContent: r.team.name }),
              total,
              el('span', { className: 'detail' },
                el('span', { textContent: r.km == null ? '📍 nessuna puntina · 0' : `📍 ${U.fmt(r.km)} km · ${U.fmt(r.loc)}` }),
                el('span', { textContent: `📅 ${r.g.year} (${r.diff === 0 ? 'esatto!' : (r.g.year > item.year ? '+' : '−') + r.diff}) · ${U.fmt(r.yr)}` }),
                kwBtn));
            li.style.setProperty('--team', r.team.color);
            li.style.setProperty('--i', i);
            list.append(li);
            const pts = r.loc + r.yr + (r.kwOk ? MAX.kw : 0);
            setTimeout(() => {
              countTo(total, pts);
              ctx.award(r.team.id, pts, total);
            }, 300 + i * 250);
          });
        FX.sound('win');
        nextBtn.addEventListener('click', () => {
          round++;
          if (round < rounds) playRound();
          else {
            map?.remove();
            ctx.finish();
          }
        });
        ctx.onKey((e, k, typing) => {
          if (!typing && (k === 'enter' || k === ' ') && !e.target.matches('button, a')) {
            e.preventDefault();
            nextBtn.click();
          }
        });
      }

      function countTo(node, target) {
        const from = Number(node.dataset.v || 0);
        node.dataset.v = target;
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / 900);
          node.textContent = U.fmt(from + (target - from) * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }

      playRound();
    },
  });
})();

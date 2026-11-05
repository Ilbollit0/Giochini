// "Che momento è?": foto storica → luogo sulla mappa + anno + parola chiave bonus.
// Per round: posizione max 5.000, anno max 4.000, parola chiave 1.000 → 10.000 punti.
(() => {
  const { el } = U;
  const esc = (t) => el('i', { textContent: t }).innerHTML;
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
  const mapOpts = (extra) => ({
    worldCopyJump: true,
    minZoom: 1.5,
    zoomSnap: 0.5,
    maxBounds: [[-75, -400], [85, 400]],
    maxBoundsViscosity: 0.8,
    zoomControl: false,
    fadeAnimation: Perf.mapAnim,
    zoomAnimation: Perf.mapAnim,
    markerZoomAnimation: Perf.mapAnim,
    ...extra,
  });
  // Cartografia Esri World Topo: rilievi, mari azzurri e nomi leggibili, senza chiave.
  // Se non si carica (rete che la blocca), si passa a OpenStreetMap.
  const TILES = [
    ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 'Mappa &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap', 19],
    ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', 18],
  ];
  let tileChoice = 0;
  function tiles(map) {
    const add = (i) => {
      const [url, attribution, maxZoom] = TILES[i];
      let errors = 0;
      const layer = L.tileLayer(url, { maxZoom, attribution, keepBuffer: Perf.level === 'low' ? 1 : 2, updateWhenZooming: Perf.mapAnim }).addTo(map);
      layer.on('tileerror', () => {
        if (++errors === 4 && i + 1 < TILES.length) {
          tileChoice = i + 1;
          map.removeLayer(layer);
          add(i + 1);
        }
      });
    };
    add(tileChoice);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Avvicina', zoomOutTitle: 'Allontana' }).addTo(map);
  }
  // Puntina a goccia del colore della squadra; quella della soluzione è una stella dorata.
  const pin = (color, truth = false) =>
    truth
      ? L.divIcon({ className: '', html: `<div class="map-truth"><span>★</span></div>`, iconSize: [44, 44], iconAnchor: [22, 22] })
      : L.divIcon({
          className: '',
          html: `<svg class="map-drop" viewBox="0 0 32 44" style="--team:${color}"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 43 16 43s15-16 15-27.2C31 7.6 24.3 1 16 1z"/><circle cx="16" cy="16" r="6"/></svg>`,
          iconSize: [32, 44],
          iconAnchor: [16, 43],
          tooltipAnchor: [0, -38],
        });
  const VIEWS = { '🌍 Mondo': [[25, 10], 1.5], 'Europa': [[50, 12], 3.5], 'Italia': [[42.2, 12.5], 5.5], 'Nord America': [[40, -97], 3], 'Asia': [[32, 100], 2.5] };
  // Riquadro della mappa con scorciatoie e pulsante per ingrandirla a tutto schermo.
  function mapShell(extraClass = '') {
    const box = el('div', { className: 'st-map ' + extraClass });
    const views = el('div', { className: 'map-views' });
    const grow = el('button', { type: 'button', className: 'map-grow', title: 'Ingrandisci la mappa', textContent: '⛶' });
    const wrap = el('div', { className: 'st-map-wrap' }, box, views, grow);
    wrap.setViews = (map) => {
      views.replaceChildren(
        ...Object.entries(VIEWS).map(([label, [c, z]]) => {
          const b = el('button', { type: 'button', textContent: label });
          b.addEventListener('click', () => map.flyTo(c, z, { duration: Perf.mapAnim ? 0.8 : 0 }));
          return b;
        })
      );
      // A tutto schermo la mappa si sposta direttamente nel body: dentro il pannello
      // (che ha l'effetto vetro) "position: fixed" resterebbe chiusa nel riquadro.
      let spot = null;
      wrap.setBig = (on) => {
        if (on === wrap.classList.contains('big')) return;
        if (on) {
          spot = document.createComment('mappa');
          wrap.before(spot);
          document.body.append(wrap);
          bigWrap = wrap;
        } else {
          spot?.replaceWith(wrap);
          spot = null;
          bigWrap = null;
        }
        wrap.classList.toggle('big', on);
        grow.textContent = on ? '✕' : '⛶';
        grow.title = on ? 'Rimpicciolisci la mappa' : 'Ingrandisci la mappa';
        document.body.classList.toggle('map-open', on);
        setTimeout(() => map.invalidateSize(), 60);
      };
      grow.onclick = () => wrap.setBig(!wrap.classList.contains('big'));
    };
    wrap.box = box;
    return wrap;
  }
  let bigWrap = null;
  const closeBigMap = () => {
    if (bigWrap) bigWrap.setBig(false);
    document.body.classList.remove('map-open');
  };
  addEventListener('keydown', (e) => e.key === 'Escape' && closeBigMap());

  GAMES.push({
    id: 'storico',
    rank: 1,
    isNew: true,
    kind: 'custom',
    scoring: 'big',
    turnBased: true,
    title: 'Che momento è?',
    emoji: '🗺️',
    color: '#ffb347',
    desc: 'Foto storiche: punta il luogo sulla mappa, scegli l’anno e indovina l’evento. Fino a 10.000 punti a round.',
    options: [
      { key: 'rounds', label: 'Round', values: [[3, '3'], [5, '5'], [10, '10'], [15, '15']], default: 5, fromTour: 'questions' },
      { key: 'timer', label: 'Tempo per squadra', values: [[0, 'Nessuno'], [60, '60 s'], [90, '90 s'], [120, '2 min']], default: 0, fromTour: 'timer' },
    ],
    common: [],

    mount(ctx) {
      const root = ctx.el;
      if (!window.L) {
        root.append(el('p', { textContent: 'La mappa non si è caricata: serve la connessione a internet. Ricarica la pagina.' }));
        return;
      }
      const rounds = Math.min(ctx.opts.rounds, STORICO.length);
      const draw = U.deck(STORICO, 'storico');
      const items = Array.from({ length: rounds }, draw);
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
        const mapWrap = mapShell();
        const mapBox = mapWrap.box;
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
          el('div', { className: 'st-field' }, el('label', { textContent: '1 · Dove? Tocca la mappa per mettere la puntina' }), mapWrap),
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
        closeBigMap();
        map = L.map(mapBox, mapOpts()).setView([25, 10], 1.5);
        tiles(map);
        mapWrap.setViews(map);
        map.on('click', (e) => {
          const ll = e.latlng.wrap();
          if (marker) marker.setLatLng(ll);
          else marker = L.marker(ll, { icon: pin(seq[ti].color), draggable: true }).addTo(map);
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
          map.setView([25, 10], 1.5);
          waiting.replaceChildren(...seq.map((t) => el('span', { className: guesses[t.id] ? 'done' : '', textContent: (guesses[t.id] ? '✓ ' : '') + t.name })));
          ctx.startTimer(ctx.opts.timer, save);
        }

        function save() {
          if (!seq[ti] || !ready) return;
          closeBigMap();
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
        let ready = false;
        (async () => {
          await ctx.countIn(root);
          ready = true;
          startTeam();
        })();
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

        const mapWrap = mapShell('reveal');
        const mapBox = mapWrap.box;
        const list = el('ol', { className: 'st-results' });
        const truth = el('div', { className: 'st-truth' },
          el('div', { className: 'yr', textContent: item.year }),
          el('strong', { textContent: '📍 ' + item.place }),
          el('p', { textContent: item.desc }));
        const nextBtn = el('button', { type: 'button', className: 'primary-btn big', textContent: round + 1 < rounds ? 'Prossimo round →' : 'Vedi la classifica 🏆' });
        root.replaceChildren(
          el('div', { className: 'st-layout' },
            el('div', { className: 'st-photo' }, photoFrame, truth),
            el('div', { className: 'st-controls' }, mapWrap, list, el('div', { className: 'play-actions' }, nextBtn))));

        map?.remove();
        closeBigMap();
        map = L.map(mapBox, mapOpts());
        tiles(map);
        mapWrap.setViews(map);
        const truthLL = [item.lat, item.lng];
        const points = [truthLL];
        results.forEach((r) => {
          if (r.g.lat == null) return;
          const ll = [r.g.lat, r.g.lng];
          points.push(ll);
          L.polyline([ll, truthLL], { color: '#1b1d3a', weight: 6, opacity: 0.25 }).addTo(map);
          L.polyline([ll, truthLL], { color: r.team.color, weight: 3.5, dashArray: '2 9', lineCap: 'round', className: 'map-line', opacity: 1 }).addTo(map);
          L.marker(ll, { icon: pin(r.team.color) })
            .addTo(map)
            .bindTooltip(`<b>${esc(r.team.name)}</b> · ${U.fmt(r.km)} km`, { permanent: true, direction: 'top', className: 'map-tip', offset: [0, -2] });
        });
        L.marker(truthLL, { icon: pin('#ffd166', true), zIndexOffset: 1000 })
          .addTo(map)
          .bindTooltip(esc('📍 ' + item.place), { permanent: true, direction: 'bottom', className: 'map-tip truth', offset: [0, 18] });
        setTimeout(() => {
          map.invalidateSize();
          if (points.length > 1) map.fitBounds(points, { padding: [60, 60], maxZoom: 6 });
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
            closeBigMap();
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

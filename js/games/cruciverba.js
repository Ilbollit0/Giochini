// Cruciverba a squadre: lo schema si genera a caso dalle parole in js/data/cruciverba.js.
// A turno ogni squadra sceglie una definizione e risponde; giusto = punti e parola nello schema.
(() => {
  const { el } = U;
  const MAX_SIDE = 13;

  // ---------- Generatore ----------
  function generate(entries, target) {
    let best = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const words = U.shuffle(entries).filter(([w]) => w.length >= 3 && w.length <= 10);
      const grid = new Map(); // "r,c" → { ch, dirs: Set }
      const placed = [];
      const box = { r0: 0, r1: 0, c0: 0, c1: 0 };
      const key = (r, c) => r + ',' + c;

      function check(w, r, c, dir) {
        const [dr, dc] = dir === 'a' ? [0, 1] : [1, 0];
        if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return -1;
        let cross = 0;
        for (let k = 0; k < w.length; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          const cell = grid.get(key(rr, cc));
          if (cell) {
            if (cell.ch !== w[k] || cell.dirs.has(dir)) return -1;
            cross++;
          } else if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return -1;
        }
        if (cross === w.length) return -1;
        const r1 = Math.max(box.r1, r + dr * (w.length - 1)), c1 = Math.max(box.c1, c + dc * (w.length - 1));
        if (r1 - Math.min(box.r0, r) >= MAX_SIDE || c1 - Math.min(box.c0, c) >= MAX_SIDE) return -1;
        return cross;
      }
      function put(entry, r, c, dir) {
        const [w] = entry;
        const [dr, dc] = dir === 'a' ? [0, 1] : [1, 0];
        for (let k = 0; k < w.length; k++) {
          const id = key(r + dr * k, c + dc * k);
          const cell = grid.get(id) || { ch: w[k], dirs: new Set() };
          cell.dirs.add(dir);
          grid.set(id, cell);
        }
        box.r0 = Math.min(box.r0, r);
        box.c0 = Math.min(box.c0, c);
        box.r1 = Math.max(box.r1, r + dr * (w.length - 1));
        box.c1 = Math.max(box.c1, c + dc * (w.length - 1));
        placed.push({ word: w, clue: entry[1], r, c, dir });
      }

      const first = words.find(([w]) => w.length >= 6) || words[0];
      put(first, 0, 0, 'a');
      for (const entry of words) {
        if (placed.length >= target) break;
        const [w] = entry;
        if (placed.some((p) => p.word === w)) continue;
        let options = [];
        let bestCross = 0;
        for (const [id, cell] of grid) {
          const [r, c] = id.split(',').map(Number);
          for (let i = 0; i < w.length; i++) {
            if (w[i] !== cell.ch) continue;
            for (const dir of ['a', 'd']) {
              const sr = dir === 'a' ? r : r - i, sc = dir === 'a' ? c - i : c;
              const cross = check(w, sr, sc, dir);
              if (cross < 1) continue;
              if (cross > bestCross) (bestCross = cross), (options = []);
              if (cross === bestCross) options.push([sr, sc, dir]);
            }
          }
        }
        if (options.length) put(entry, ...U.pick(options));
      }
      const score = placed.length * 100 - (box.r1 - box.r0 + box.c1 - box.c0);
      if (!best || score > best.score) best = { score, placed, box };
      if (placed.length >= target) break;
    }
    // Normalizza le coordinate e numera le caselle iniziali.
    const { placed, box } = best;
    placed.forEach((p) => ((p.r -= box.r0), (p.c -= box.c0)));
    const starts = [...new Set(placed.map((p) => p.r * 100 + p.c))].sort((a, b) => a - b);
    placed.forEach((p) => (p.num = starts.indexOf(p.r * 100 + p.c) + 1));
    placed.sort((a, b) => a.num - b.num);
    return { words: placed, rows: box.r1 - box.r0 + 1, cols: box.c1 - box.c0 + 1 };
  }

  const cellsOf = (w) => [...w.word].map((ch, k) => [w.dir === 'a' ? w.r : w.r + k, w.dir === 'a' ? w.c + k : w.c, ch]);

  GAMES.push({
    id: 'cruciverba',
    rank: 6,
    isNew: true,
    kind: 'custom',
    title: 'Cruciverba',
    emoji: '✏️',
    color: '#2fd4c9',
    desc: 'Uno schema sempre nuovo: a turno scegliete una definizione e risolvetela.',
    options: [{ key: 'size', label: 'Schema', values: [[8, 'Piccolo'], [12, 'Medio'], [16, 'Grande']], default: 12 }],
    common: ['timer', 'points'],

    mount(ctx) {
      const root = ctx.el;
      const puzzle = generate(CRUCIVERBA, ctx.opts.size);
      const { words, rows, cols } = puzzle;
      const solvedBy = new Map(); // word → team
      const shown = new Map(); // "r,c" → colore squadra o '' (lettera di aiuto)
      let turnIndex = 0;
      let active = null;

      const gridEl = el('div', { className: 'cw-grid' });
      gridEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
      const cellEls = {};
      const nums = {};
      words.forEach((w) => (nums[w.r + ',' + w.c] = w.num));
      const open = new Set(words.flatMap((w) => cellsOf(w).map(([r, c]) => r + ',' + c)));
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const id = r + ',' + c;
          const cell = el('div', { className: 'cw-cell ' + (open.has(id) ? 'open' : 'block') });
          if (nums[id]) cell.append(el('span', { className: 'cw-num', textContent: nums[id] }));
          cell.append(el('span', { className: 'cw-ch' }));
          cellEls[id] = cell;
          gridEl.append(cell);
        }
      const letterAt = {};
      words.forEach((w) => cellsOf(w).forEach(([r, c, ch]) => (letterAt[r + ',' + c] = ch)));

      const panel = el('div', { className: 'cw-panel' });
      const across = el('ol');
      const down = el('ol');
      const clueBtns = new Map();
      words.forEach((w) => {
        const b = el('button', { type: 'button', className: 'cw-clue' }, el('b', { textContent: w.num }), el('span', { textContent: w.clue }), el('span', { className: 'len', textContent: `${w.word.length} lettere` }));
        b.addEventListener('click', () => select(w));
        clueBtns.set(w, b);
        (w.dir === 'a' ? across : down).append(el('li', {}, b));
      });
      const endBtn = el('button', { type: 'button', className: 'ghost-btn', textContent: 'Termina partita' });
      endBtn.addEventListener('click', () => confirm('Terminare il cruciverba adesso?') && done());
      root.replaceChildren(
        el('div', { className: 'cw-layout' },
          el('div', {}, gridEl, panel),
          el('div', { className: 'cw-clues' },
            el('div', {}, el('h3', { textContent: 'Orizzontali →' }), across),
            el('div', {}, el('h3', { textContent: 'Verticali ↓' }), down),
            endBtn))
      );

      function paint() {
        for (const id in cellEls) {
          const cell = cellEls[id];
          const has = shown.has(id);
          cell.querySelector('.cw-ch').textContent = has ? letterAt[id] : '';
          if (shown.get(id)) cell.style.setProperty('--team', shown.get(id));
          cell.classList.toggle('hl', !!active && cellsOf(active).some(([r, c]) => r + ',' + c === id) && !solvedBy.has(active));
        }
        for (const [w, b] of clueBtns) {
          b.classList.toggle('solved', solvedBy.has(w));
          b.classList.toggle('active', w === active);
          b.disabled = solvedBy.has(w);
        }
        const solved = solvedBy.size;
        ctx.setProgress(`Parole trovate ${solved} di ${words.length}`, solved / words.length);
      }

      function turnTeam() {
        return ctx.teams[turnIndex % ctx.teams.length];
      }
      function idle() {
        active = null;
        ctx.stopTimer();
        ctx.setTurn(turnTeam());
        panel.replaceChildren(el('p', { className: 'clue-text', textContent: `${ctx.teams.length > 1 ? turnTeam().name + ': s' : 'S'}cegli una definizione dall’elenco` }));
        paint();
      }
      function select(w) {
        if (solvedBy.has(w)) return;
        active = w;
        FX.sound('pop');
        const yes = el('button', { type: 'button', className: 'verdict-btn yes', textContent: '✓ Giusta' });
        const no = el('button', { type: 'button', className: 'verdict-btn no', textContent: '✕ Sbagliata' });
        const help = el('button', { type: 'button', className: 'secondary-btn', textContent: '💡 Una lettera' });
        yes.addEventListener('click', () => verdict(true));
        no.addEventListener('click', () => verdict(false));
        help.addEventListener('click', () => {
          const hidden = cellsOf(w).filter(([r, c]) => !shown.has(r + ',' + c));
          if (hidden.length <= 1) return;
          const [r, c] = U.pick(hidden);
          shown.set(r + ',' + c, '');
          FX.sound('pop');
          paint();
          if (hidden.length <= 2) help.disabled = true;
        });
        panel.replaceChildren(
          el('div', { className: 'q-answer-label', textContent: `${w.num} ${w.dir === 'a' ? 'orizzontale' : 'verticale'} · ${w.word.length} lettere` }),
          el('p', { className: 'clue-text', textContent: w.clue }),
          el('div', { className: 'award-main' }, help, yes, no)
        );
        ctx.startTimer(ctx.opts.timer, () => verdict(false));
        paint();
      }
      function verdict(right) {
        if (!active) return;
        const w = active;
        const team = turnTeam();
        ctx.stopTimer();
        if (right) {
          solvedBy.set(w, team);
          cellsOf(w).forEach(([r, c], k) => {
            const id = r + ',' + c;
            if (!shown.get(id)) shown.set(id, team.color);
            const cell = cellEls[id];
            cell.style.setProperty('--k', k);
            cell.classList.remove('solved');
            void cell.offsetWidth;
            cell.classList.add('solved');
          });
          ctx.award(team.id, ctx.opts.points, panel);
          FX.sound('correct');
          FX.confetti({ count: 40, colors: [team.color, '#fff'] });
        } else {
          FX.sound('wrong');
        }
        turnIndex++;
        if (solvedBy.size === words.length) {
          paint();
          setTimeout(done, 900);
        } else idle();
      }
      function done() {
        ctx.stopTimer();
        // Mostra lo schema completo prima della classifica.
        words.forEach((w) => cellsOf(w).forEach(([r, c]) => shown.has(r + ',' + c) || shown.set(r + ',' + c, '')));
        active = null;
        paint();
        ctx.finish();
      }

      ctx.onKey((e, k, typing) => {
        if (typing || !active) return;
        if (k === 'enter' && !e.target.matches('button, a')) verdict(true);
      });
      idle();
    },
  });
})();

// Impiccato a turni: ogni squadra ha la sua parola e 6 errori a disposizione.
(() => {
  const { el } = U;
  const MAX_ERRORS = 6;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const NS = 'http://www.w3.org/2000/svg';

  function figure() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 240');
    svg.innerHTML = `
      <path class="gallows" d="M20 230 H120 M50 230 V20 H140 V45"/>
      <circle class="part" cx="140" cy="65" r="20"/>
      <path class="part" d="M140 85 V150"/>
      <path class="part" d="M140 100 L112 128"/>
      <path class="part" d="M140 100 L168 128"/>
      <path class="part" d="M140 150 L115 190"/>
      <path class="part" d="M140 150 L165 190"/>`;
    return svg;
  }

  GAMES.push({
    id: 'impiccato',
    rank: 5,
    isNew: true,
    kind: 'custom',
    title: 'Impiccato',
    emoji: '🪢',
    color: '#ff5c8a',
    desc: 'Una lettera alla volta: trova la parola prima di finire gli errori.',
    options: [
      { key: 'cat', label: 'Categoria', values: [['tutte', 'Tutte'], ...Object.keys(PAROLE).map((c) => [c, c])], default: 'tutte' },
    ],
    common: ['turns', 'points'],

    mount(ctx) {
      const root = ctx.el;
      const cats = ctx.opts.cat === 'tutte' ? Object.keys(PAROLE) : [ctx.opts.cat];
      const next = U.deck(cats.flatMap((cat) => PAROLE[cat].map((word) => ({ word, cat }))));
      const total = Math.max(1, ctx.opts.turns) * ctx.teams.length;
      let index = 0;

      function play() {
        const team = ctx.teams[index % ctx.teams.length];
        const { word, cat } = next();
        const letters = [...word];
        const guessed = new Set();
        let errors = 0;
        let over = false;

        ctx.setTurn(team);
        ctx.setProgress(`Parola ${index + 1} di ${total}`, index / total);
        ctx.setTag(cat);

        const fig = el('div', { className: 'hm-figure' }, figure());
        const lives = el('div', { className: 'hm-lives', ariaLabel: 'Errori rimasti' }, ...Array.from({ length: MAX_ERRORS }, () => el('span', { textContent: '❤️' })));
        const wordBox = el('div', { className: 'hm-word', ariaLive: 'polite' });
        const keys = el('div', { className: 'hm-keys' });
        const status = el('p', { className: 'q-prompt', textContent: `Indovina la parola (${letters.length} lettere)` });
        const actions = el('div', { className: 'play-actions' });
        fig.append(lives);
        root.replaceChildren(el('div', { className: 'hm-layout' }, fig, el('div', { className: 'question' }, status, wordBox, keys, actions)));

        const keyBtns = {};
        LETTERS.forEach((L) => {
          const b = el('button', { type: 'button', textContent: L, ariaLabel: 'Lettera ' + L });
          b.addEventListener('click', () => guess(L));
          keyBtns[L] = b;
          keys.append(b);
        });

        const solveBtn = el('button', { type: 'button', className: 'secondary-btn', textContent: '🗣 Dicono la parola' });
        const yes = el('button', { type: 'button', className: 'verdict-btn yes', textContent: '✓ Giusta' });
        const no = el('button', { type: 'button', className: 'verdict-btn no', textContent: '✕ Sbagliata' });
        solveBtn.addEventListener('click', () => actions.replaceChildren(yes, no));
        yes.addEventListener('click', () => end(true));
        no.addEventListener('click', () => {
          miss();
          if (!over) actions.replaceChildren(solveBtn);
        });
        actions.append(solveBtn);

        function paint(revealAll = false) {
          wordBox.replaceChildren(
            ...letters.map((ch) => {
              const shown = guessed.has(ch);
              return el('span', { className: shown ? 'on' : revealAll ? 'missed' : '', textContent: shown || revealAll ? ch : '' });
            })
          );
        }
        function miss() {
          errors++;
          fig.querySelectorAll('.part')[errors - 1]?.classList.add('on');
          lives.children[MAX_ERRORS - errors]?.classList.add('lost');
          FX.sound('wrong');
          fig.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
          if (errors >= MAX_ERRORS) end(false);
        }
        function guess(L) {
          if (over || guessed.has(L) || !keyBtns[L]) return;
          guessed.add(L);
          keyBtns[L].disabled = true;
          if (letters.includes(L)) {
            keyBtns[L].classList.add('hit');
            FX.sound('pop');
            paint();
            if (letters.every((ch) => guessed.has(ch))) end(true);
          } else {
            keyBtns[L].classList.add('miss');
            miss();
          }
        }
        function end(win) {
          if (over) return;
          over = true;
          letters.forEach((ch) => win && guessed.add(ch));
          paint(!win);
          Object.values(keyBtns).forEach((b) => (b.disabled = true));
          fig.classList.toggle('lost', !win);
          if (win) {
            ctx.award(team.id, ctx.opts.points, wordBox);
            FX.sound('correct');
            FX.confetti({ count: 70, colors: [team.color, '#fff', '#2ee59d'] });
            status.textContent = `Bravi ${team.name}! La parola era ${word}.`;
          } else {
            status.textContent = `Peccato! La parola era ${word}.`;
          }
          const nextBtn = el('button', { type: 'button', className: 'primary-btn big', textContent: index + 1 >= total ? 'Vedi i risultati 🏆' : 'Avanti →' });
          nextBtn.addEventListener('click', () => {
            index++;
            index >= total ? ctx.finish() : play();
          });
          actions.replaceChildren(nextBtn);
          nextBtn.focus({ preventScroll: true });
        }

        ctx.onKey((e, k, typing) => {
          if (typing) return;
          if (!over && /^[a-z]$/.test(k)) guess(k.toUpperCase());
          else if (over && (k === 'enter' || k === ' ') && !e.target.matches('button, a')) {
            e.preventDefault();
            actions.querySelector('button')?.click();
          }
        });
        paint();
      }

      play();
    },
  });
})();

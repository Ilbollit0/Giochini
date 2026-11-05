// Impiccato a round: una parola per tutte le squadre. Le squadre chiamano le lettere a voce
// (chi conduce le tocca), e chi si prenota prova a dire la parola intera.
// Ogni lettera sbagliata o tentativo sbagliato costa un errore: al sesto la parola è persa.
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
    desc: 'Chiamate le lettere a voce: chi indovina per primo la parola fa il punto.',
    options: [
      { key: 'cat', label: 'Categoria', values: [['tutte', 'Tutte'], ...Object.keys(PAROLE).map((c) => [c, c])], default: 'tutte' },
      { key: 'count', label: 'Parole', values: [[3, '3'], [5, '5'], [8, '8'], [10, '10'], [15, '15']], default: 5, fromTour: 'questions' },
      { key: 'timer', label: 'Tempo per parola', values: [[0, 'Nessuno'], [60, '60 s'], [90, '90 s'], [120, '2 min']], default: 0, fromTour: 'timer' },
    ],
    common: ['points', 'penalty'],

    mount(ctx) {
      const root = ctx.el;
      const cats = ctx.opts.cat === 'tutte' ? Object.keys(PAROLE) : [ctx.opts.cat];
      const next = U.deck(cats.flatMap((cat) => PAROLE[cat].map((word) => ({ word, cat }))), 'impiccato');
      const total = Math.max(1, ctx.opts.count || 5);
      let index = 0;

      async function play() {
        const { word, cat } = next();
        const letters = [...word];
        const guessed = new Set();
        let errors = 0;
        let over = false;
        let ready = false;

        ctx.setTurn(null);
        ctx.setProgress(`Parola ${index + 1} di ${total}`, index / total);
        ctx.setTag(cat);

        const fig = el('div', { className: 'hm-figure' }, figure());
        const lives = el('div', { className: 'hm-lives', ariaLabel: 'Errori rimasti' }, ...Array.from({ length: MAX_ERRORS }, () => el('span', { textContent: '❤️' })));
        const wordBox = el('div', { className: 'hm-word', ariaLive: 'polite' });
        const keys = el('div', { className: 'hm-keys' });
        const status = el('p', { className: 'q-prompt', textContent: `${letters.length} lettere · chiamate le lettere a voce` });
        const actions = el('div', { className: 'play-actions' });
        fig.append(lives);

        const buzz = ctx.buzz({
          onBuzz: (team) => {
            if (!ready || over) return false;
            ctx.pauseTimer();
            ctx.setTurn(team);
            status.textContent = `${team.name}, qual è la parola?`;
          },
          onCancel: () => {
            ctx.setTurn(null);
            ctx.resumeTimer();
            status.textContent = `${letters.length} lettere · chiamate le lettere a voce`;
          },
          onVerdict: (team, right) => {
            if (right) return end(team);
            if (ctx.opts.penalty) ctx.award(team.id, -ctx.opts.penalty);
            ctx.setTurn(null);
            status.textContent = `No! ${team.name} è fuori per questa parola.`;
            miss();
            if (!over && !buzz.available().length) end(null);
            else if (!over) ctx.resumeTimer();
          },
        });
        const buzzBox = el('div', { className: 'hm-buzz' }, el('p', { className: 'st-hint', textContent: 'Chi sa la parola si prenota:' }), buzz.el);

        root.replaceChildren(el('div', { className: 'hm-layout' }, fig, el('div', { className: 'question' }, status, wordBox, keys, buzzBox, actions)));

        const keyBtns = {};
        LETTERS.forEach((L) => {
          const b = el('button', { type: 'button', textContent: L, ariaLabel: 'Lettera ' + L });
          b.addEventListener('click', () => guess(L));
          keyBtns[L] = b;
          keys.append(b);
        });
        const giveUp = el('button', { type: 'button', className: 'ghost-btn', textContent: '🤷 Nessuno lo sa · Mostra' });
        giveUp.addEventListener('click', () => ready && end(null));
        actions.append(giveUp);

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
          if (errors >= MAX_ERRORS) end(null);
        }
        function guess(L) {
          if (!ready || over || guessed.has(L) || !keyBtns[L]) return;
          guessed.add(L);
          keyBtns[L].disabled = true;
          if (letters.includes(L)) {
            keyBtns[L].classList.add('hit');
            FX.sound('pop');
            paint();
            // Tutte le lettere scoperte senza che nessuno abbia detto la parola: chi conduce assegna il punto.
            if (letters.every((ch) => guessed.has(ch))) end(undefined);
          } else {
            keyBtns[L].classList.add('miss');
            miss();
          }
        }
        // winner: squadra = l'ha indovinata · null = persa · undefined = lettere finite (punto a scelta)
        function end(winner) {
          if (over) return;
          over = true;
          ready = false;
          ctx.stopTimer();
          buzz.lock();
          const won = !!winner;
          if (won || winner === undefined) letters.forEach((ch) => guessed.add(ch));
          paint(winner === null);
          Object.values(keyBtns).forEach((b) => (b.disabled = true));
          fig.classList.toggle('lost', winner === null);
          buzzBox.hidden = true;
          const extra = [];
          if (won) {
            ctx.setTurn(winner);
            ctx.award(winner.id, ctx.opts.points, wordBox);
            FX.sound('correct');
            FX.confetti({ count: 70, colors: [winner.color, '#fff', '#2ee59d'] });
            status.textContent = `Bravi ${winner.name}! La parola era ${word}.`;
          } else if (winner === undefined) {
            status.textContent = `Lettere finite! Chi l’aveva detta per primo?`;
            const given = new Set();
            ctx.teams.forEach((t) => {
              const b = el('button', { type: 'button', className: 'award-btn' }, el('span', { className: 'award-key', textContent: '+' }), el('span', { textContent: t.name }));
              b.style.setProperty('--team', t.color);
              b.addEventListener('click', () => {
                const on = !given.has(t.id);
                on ? given.add(t.id) : given.delete(t.id);
                ctx.award(t.id, on ? ctx.opts.points : -ctx.opts.points, b);
                b.setAttribute('aria-pressed', String(on));
              });
              extra.push(b);
            });
          } else {
            FX.sound('timeout');
            status.textContent = `Peccato! La parola era ${word}.`;
          }
          const nextBtn = el('button', { type: 'button', className: 'primary-btn big', textContent: index + 1 >= total ? 'Vedi i risultati 🏆' : 'Prossima parola →' });
          nextBtn.addEventListener('click', () => {
            index++;
            index >= total ? ctx.finish() : play();
          });
          actions.replaceChildren(...(extra.length ? [el('div', { className: 'award-teams' }, ...extra)] : []), nextBtn);
          nextBtn.focus({ preventScroll: true });
        }

        ctx.onKey((e, k, typing) => {
          if (typing) return;
          if (!over && ready) {
            if (buzz.key(k)) return;
            if (/^[a-z]$/.test(k) && !(buzz.selected && (k === 'v' || k === 'x'))) guess(k.toUpperCase());
          } else if (over && (k === 'enter' || k === ' ') && !e.target.matches('button, a')) {
            e.preventDefault();
            actions.querySelector('.primary-btn')?.click();
          }
        });
        paint();
        await ctx.countIn(root);
        ready = true;
        ctx.startTimer(ctx.opts.timer, () => end(null));
      }

      play();
    },
  });
})();

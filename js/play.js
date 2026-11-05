// Motore comune: impostazioni → (intro) → partita a turni → risultati → (torneo: gioco successivo).
(() => {
  const $ = (sel) => document.querySelector(sel);
  const { el } = U;
  const params = new URLSearchParams(location.search);
  const game = GAMES.find((g) => g.id === params.get('g'));
  if (!game) {
    location.replace('./');
    return;
  }

  // Siamo dentro un torneo solo se questo è proprio il gioco di turno.
  const tourState = Tour.get();
  const inTour = params.get('t') === '1' && Tour.active() && Tour.current() === game.id;
  const tourIndex = inTour ? tourState.index : -1;

  const COMMON = {
    turns: { key: 'turns', label: 'Turni per squadra', values: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], default: 2 },
    timer: { key: 'timer', label: 'Tempo', values: [[0, 'Nessuno'], [10, '10 s'], [20, '20 s'], [30, '30 s'], [60, '60 s']], default: 20 },
    points: { key: 'points', label: 'Punti per risposta', values: [[1, '1'], [2, '2'], [3, '3']], default: 1 },
  };
  const options = [...game.options, ...(game.common || ['turns', 'timer', 'points']).map((k) => COMMON[k])];

  document.title = `${game.title} · Giochini`;
  $('#game-name').textContent = game.title;
  $('#setup-emoji').textContent = game.emoji;
  $('#setup-title').textContent = game.title;
  $('#setup-desc').textContent = game.desc;
  document.documentElement.style.setProperty('--accent', game.color);

  const screens = { setup: $('#setup'), play: $('#play'), custom: $('#custom'), end: $('#end') };
  function show(name) {
    Object.entries(screens).forEach(([key, node]) => (node.hidden = key !== name));
    $('#hud').hidden = !(name === 'play' || name === 'custom');
    window.scrollTo(0, 0);
  }

  // ---------- Impostazioni ----------
  const saved = Store.get('opts:' + game.id, {});
  options.forEach((opt) => {
    const current = String(saved[opt.key] ?? opt.default);
    const group = el('div', { className: 'segmented' });
    opt.values.forEach(([value, label]) => {
      const id = `opt-${opt.key}-${value}`;
      group.append(
        el('input', { type: 'radio', name: opt.key, value: String(value), id, checked: String(value) === current }),
        el('label', { htmlFor: id, textContent: label })
      );
    });
    if (!group.querySelector(':checked')) group.querySelector('input').checked = true;
    $('#options').append(el('fieldset', { className: 'option' }, el('legend', { textContent: opt.label }), group));
  });
  const n = Teams.all().length;
  $('#setup-note').textContent = Order.isSet()
    ? `Si gioca a turno: ${Order.teams().map((t) => t.name).join(' → ')}.`
    : 'L’ordine delle squadre si decide con la ruota nella pagina principale.';
  if (n < 2) $('#setup-note').textContent += ' Con una sola squadra si gioca in solitario.';

  const cast = (opt, raw) => (typeof opt.default === 'number' ? Number(raw) : raw);
  function readOptions() {
    const data = new FormData($('#setup-form'));
    return Object.fromEntries(options.map((opt) => [opt.key, cast(opt, data.get(opt.key))]));
  }
  // Nel torneo: opzioni salvate del gioco + impostazioni del torneo dove applicabili.
  function tourOptions() {
    const o = {};
    const s = tourState.settings || {};
    options.forEach((opt) => {
      let v = saved[opt.key] ?? opt.default;
      if (opt.key in s && opt.values.some(([x]) => x === s[opt.key])) v = s[opt.key];
      o[opt.key] = cast(opt, v);
    });
    return o;
  }

  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = readOptions();
    Store.set('opts:' + game.id, o);
    await FX.countdown({ emoji: game.emoji, title: game.title, accent: game.color });
    start(o);
  });

  // ---------- Stato condiviso ----------
  let opts, teams, earned;

  function start(o) {
    opts = o;
    teams = Order.teams();
    earned = Object.fromEntries(teams.map((t) => [t.id, 0]));
    stopTimer();
    if (game.kind === 'custom') {
      show('custom');
      screens.custom.replaceChildren();
      customKey = null;
      game.mount(ctx);
    } else {
      show('play');
      Quiz.start();
    }
  }

  // API offerta ai giochi con interfaccia propria
  let customKey = null;
  const ctx = {
    game,
    get opts() { return opts; },
    get teams() { return teams; },
    get el() { return screens.custom; },
    get earned() { return earned; },
    setTurn,
    setProgress,
    setTag,
    startTimer,
    stopTimer,
    award,
    finish,
    onKey(fn) { customKey = fn; },
  };

  function setTurn(team) {
    const pill = $('#turn-pill');
    pill.hidden = !team || teams.length < 2;
    if (team) {
      pill.style.setProperty('--team', team.color);
      $('#turn-name').textContent = team.name;
      pill.style.animation = 'none';
      void pill.offsetWidth;
      pill.style.animation = '';
    }
    currentTurnId = team?.id || null;
    renderStrip(Teams.all());
  }
  function setProgress(text, fraction) {
    $('#q-progress').textContent = text;
    $('#progress-fill').style.width = Math.round((fraction || 0) * 100) + '%';
  }
  function setTag(text) {
    $('#q-tag').hidden = !text;
    $('#q-tag').textContent = text || '';
  }

  // Assegna (o toglie) punti a una squadra per questa partita.
  function award(teamId, pts, anchor) {
    if (!pts) return;
    earned[teamId] = (earned[teamId] || 0) + pts;
    if (game.scoring !== 'big') Teams.addPoints(teamId, pts);
    else renderStrip(Teams.all());
    if (pts > 0) {
      const team = teams.find((t) => t.id === teamId);
      FX.floatText('+' + U.fmt(pts), anchor || document.querySelector(`.strip-team[data-id="${teamId}"]`), team?.color);
    }
    const chip = document.querySelector(`.strip-team[data-id="${teamId}"] .strip-score`);
    chip?.classList.remove('bump');
    void chip?.offsetWidth;
    chip?.classList.add('bump');
  }

  // ---------- Timer ----------
  let timerId = null;
  function startTimer(seconds, onEnd) {
    stopTimer();
    const box = $('#timer');
    box.hidden = !seconds;
    if (!seconds) return;
    const total = seconds * 1000;
    const end = Date.now() + total;
    let lastSec = seconds;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      $('#timer-bar').style.transform = `scaleX(${left / total})`;
      const sec = Math.ceil(left / 1000);
      $('#timer-num').textContent = sec;
      box.classList.toggle('urgent', left <= 5000);
      if (sec !== lastSec && sec <= 5 && sec > 0) FX.sound('tick');
      lastSec = sec;
      if (left === 0) {
        stopTimer();
        FX.sound('timeout');
        onEnd?.();
      }
    };
    tick();
    timerId = setInterval(tick, 100);
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    $('#timer').classList.remove('urgent');
  }

  // ============================================================
  // Quiz a domande
  // ============================================================
  const Quiz = (() => {
    let nextQuestion, upcoming, index, total, q, revealed, awarded, hintIndex, turn, photoFrame;

    function start() {
      nextQuestion = game.create(opts);
      upcoming = nextQuestion();
      index = 0;
      total = Math.max(1, opts.turns || 1) * teams.length;
      showQuestion();
    }

    function showQuestion() {
      q = upcoming;
      upcoming = index + 1 < total ? nextQuestion() : null;
      FX.preload(upcoming?.photo);
      revealed = false;
      awarded = new Set();
      hintIndex = 0;
      turn = teams[index % teams.length];
      setTurn(turn);
      setProgress(`Domanda ${index + 1} di ${total}`, index / total);
      setTag(q.tag);

      const question = $('#question');
      question.classList.remove('enter');
      void question.offsetWidth;
      question.classList.add('enter');
      $('#q-prompt').textContent = q.prompt;

      const img = $('#q-image');
      img.hidden = !q.image;
      img.classList.remove('broken');
      if (q.image) img.src = q.image;
      else img.removeAttribute('src');

      photoFrame = q.photo ? FX.photo(q.photo, q.credit) : null;
      $('#q-photo').replaceChildren(...(photoFrame ? [photoFrame] : []));

      const career = $('#q-career');
      career.hidden = !q.career;
      career.replaceChildren(
        ...(q.career || []).map(([yrs, club, loan], i) => {
          const li = el('li', { className: loan ? 'loan' : '' }, el('span', { className: 'yrs', textContent: yrs }), el('span', { className: 'club', textContent: club }));
          li.style.setProperty('--i', i);
          return li;
        })
      );

      setBig(q.big);
      $('#q-hints').replaceChildren();

      const choices = $('#q-choices');
      choices.replaceChildren(
        ...(q.choices || []).map((text, i) => {
          const btn = el('button', { type: 'button', className: 'choice', textContent: text });
          btn.dataset.letter = 'ABCD'[i] || '';
          btn.style.setProperty('--i', i);
          btn.addEventListener('click', () => reveal(i));
          return el('li', {}, btn);
        })
      );
      choices.classList.toggle('two', (q.choices || []).length === 2);

      $('#q-answer').hidden = true;
      $('#award').hidden = true;
      $('#ask-actions').hidden = false;
      $('#btn-hint').hidden = !q.hints?.length;
      $('#btn-hint').disabled = false;
      startTimer(opts.timer, () => reveal(-1));
    }

    function setBig(text) {
      const big = $('#q-big');
      big.hidden = !text;
      big.textContent = text || '';
      const len = [...(text || '')].length;
      big.className = 'q-big ' + (q.emojiBig ? 'size-emoji' : len <= 12 ? 'size-xl' : len <= 28 ? 'size-l' : 'size-m');
    }

    function hint() {
      if (revealed || !q.hints || hintIndex >= q.hints.length) return;
      const h = q.hints[hintIndex++];
      if (h.big) setBig(h.big);
      if (h.text) $('#q-hints').append(el('li', { textContent: '💡 ' + h.text }));
      $('#btn-hint').disabled = hintIndex >= q.hints.length;
      FX.sound('pop');
    }

    function reveal(chosen) {
      if (revealed) return;
      revealed = true;
      stopTimer();

      document.querySelectorAll('.choice').forEach((btn, i) => {
        const right = q.choices[i] === q.answer;
        btn.classList.add(right ? 'correct' : i === chosen ? 'wrong' : 'dim');
        btn.disabled = true;
      });
      if (q.revealBig) setBig(q.revealBig);
      photoFrame?.showCredit();

      $('#q-answer-text').textContent = q.answer;
      $('#q-explain').textContent = q.explain || '';
      $('#q-explain').hidden = !q.explain;
      $('#q-answer').hidden = false;

      $('#ask-actions').hidden = true;
      const p = opts.points;
      $('#award-title').replaceChildren(
        teams.length > 1 ? `Ha indovinato ${turn.name}? ` : 'Risposta giusta? ',
        el('span', { textContent: `(+${p} ${p === 1 ? 'punto' : 'punti'})` })
      );
      document.querySelector('.award-others').hidden = teams.length < 2;
      renderAwardTeams();
      $('#btn-next').textContent = index + 1 >= total ? 'Vedi i risultati 🏆' : 'Avanti →';
      $('#award').hidden = false;

      // Con la scelta multipla il verdetto è automatico (correggibile a mano).
      if (chosen >= 0) {
        if (q.choices[chosen] === q.answer) setVerdict(true);
        else setVerdict(false);
      } else {
        paintVerdict(null);
      }
      $('#btn-next').focus({ preventScroll: true });
      setTimeout(() => $('#award').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
    }

    function setVerdict(right) {
      if (!revealed) return;
      const has = awarded.has(turn.id);
      if (right && !has) toggleAward(turn.id, $('#btn-yes'));
      if (!right && has) toggleAward(turn.id);
      if (right) {
        FX.sound('correct');
        FX.flash('rgba(46,229,157,.35)');
        FX.confetti({ count: 50, colors: [turn.color, '#2ee59d', '#fff'] });
      } else {
        FX.sound('wrong');
        FX.flash('rgba(255,84,112,.3)');
      }
      paintVerdict(right);
    }
    function paintVerdict(right) {
      $('#btn-yes').setAttribute('aria-pressed', String(right === true));
      $('#btn-no').setAttribute('aria-pressed', String(right === false));
    }

    function renderAwardTeams() {
      $('#award-teams').replaceChildren(
        ...teams
          .map((team, i) => ({ team, i }))
          .filter(({ team }) => team.id !== turn.id)
          .map(({ team, i }) => {
            const btn = el('button', { type: 'button', className: 'award-btn' });
            btn.style.setProperty('--team', team.color);
            btn.setAttribute('aria-pressed', String(awarded.has(team.id)));
            btn.append(el('span', { className: 'award-key', textContent: i + 1 }), el('span', { textContent: team.name }), el('span', { className: 'award-check', ariaHidden: 'true', textContent: '✓' }));
            btn.addEventListener('click', () => toggleAward(team.id, btn));
            return btn;
          })
      );
    }

    function toggleAward(id, anchor) {
      if (!revealed) return;
      const delta = awarded.has(id) ? -opts.points : opts.points;
      if (delta > 0) awarded.add(id);
      else awarded.delete(id);
      award(id, delta, anchor);
      if (id === turn.id) paintVerdict(delta > 0 ? true : false);
      else if (delta > 0) FX.sound('correct');
      renderAwardTeams();
    }

    function next() {
      index++;
      if (index >= total) finish();
      else showQuestion();
    }

    $('#btn-hint').addEventListener('click', hint);
    $('#btn-reveal').addEventListener('click', () => reveal(-1));
    $('#btn-next').addEventListener('click', next);
    $('#btn-yes').addEventListener('click', () => setVerdict(true));
    $('#btn-no').addEventListener('click', () => setVerdict(false));
    $('#q-image').addEventListener('error', (e) => e.target.classList.add('broken'));

    function key(e, k) {
      if (k === ' ' || (k === 'enter' && !e.target.matches('button, a'))) {
        e.preventDefault();
        revealed ? next() : reveal(-1);
      } else if (k === 'h') hint();
      else if (/^[1-8]$/.test(k) && revealed) {
        const team = teams[Number(k) - 1];
        if (team) team.id === turn.id ? setVerdict(!awarded.has(team.id)) : toggleAward(team.id);
      } else if (/^[a-d]$/.test(k) && !revealed && q.choices) {
        const i = 'abcd'.indexOf(k);
        if (i < q.choices.length) reveal(i);
      }
    }

    return { start, key };
  })();

  // ---------- Tastiera ----------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.overlay, .lightbox')) return;
    if (!(e.target instanceof Element)) return;
    const typing = e.target.matches('input[type="text"], input:not([type]), textarea');
    const k = e.key.toLowerCase();
    if (!screens.play.hidden && !typing) Quiz.key(e, k);
    else if (!screens.custom.hidden && customKey) customKey(e, k, typing);
  });

  // ============================================================
  // Fine partita
  // ============================================================
  let nextTimer = null;
  function finish() {
    stopTimer();
    setTurn(null);
    customKey = null;
    const rows = Tour.placements(earned, teams);
    const fmt = (v) => (game.scoring === 'big' ? U.fmt(v) : v);
    // Nei giochi a punteggio alto la classifica generale riceve i punti piazzamento.
    if (game.scoring === 'big') rows.forEach((r) => r.pts && Teams.addPoints(r.team.id, r.pts));

    const best = rows[0]?.earned || 0;
    const winners = rows.filter((r) => r.place === 1);
    $('#end-title').textContent =
      best <= 0 ? 'Nessun punto in questa partita!' : winners.length > 1 ? 'Pareggio!' : `Vince ${winners[0].team.name}!`;

    // Podio (prime tre posizioni)
    $('#podium').replaceChildren(
      ...(best > 0 && teams.length > 1
        ? rows.slice(0, 3).map((r, i) => {
            const step = el('div', { className: `podium-step p${i + 1}` }, el('span', { className: 'who', textContent: r.team.name }), el('span', { className: 'pts', textContent: fmt(r.earned) }), el('div', { className: 'block', textContent: r.place }));
            step.style.setProperty('--team', r.team.color);
            return step;
          })
        : [])
    );

    const all = Teams.all();
    $('#end-list').replaceChildren(
      ...rows.map((r, i) => {
        const li = el('li', {}, el('span', { className: 'end-name', textContent: r.team.name }), el('span', { className: 'end-earned', textContent: (r.earned > 0 ? '+' : '') + fmt(r.earned) }), el('span', { className: 'end-total', textContent: `${all.find((t) => t.id === r.team.id)?.score ?? 0} in classifica` }));
        li.style.setProperty('--team', r.team.color);
        li.style.setProperty('--i', i);
        li.classList.toggle('winner', best > 0 && r.place === 1);
        return li;
      })
    );

    $('#tour-end').replaceChildren();
    $('#btn-again').hidden = inTour;
    show('end');
    if (best > 0) {
      FX.sound('fanfare');
      setTimeout(FX.celebrate, 600);
    }
    if (inTour) showTournament();
  }

  function showTournament() {
    const res = Tour.record(tourIndex, game.id, earned, teams);
    const t = res ? res.tour : Tour.get();
    if (!t) return;
    const gained = Object.fromEntries((res?.rows || []).map((r) => [r.team.id, r.pts]));
    const standings = Tour.standings(teams);
    const box = $('#tour-end');
    const list = el('ol', { className: 'end-list' });
    standings.forEach((s, i) => {
      const li = el('li', {}, el('span', { className: 'end-name', textContent: s.team.name }), el('span', { className: 'end-earned', textContent: gained[s.team.id] ? `+${gained[s.team.id]}` : '' }), el('span', { className: 'end-total', textContent: `${s.pts} pt torneo` }));
      li.style.setProperty('--team', s.team.color);
      li.style.setProperty('--i', i + teams.length);
      li.classList.toggle('winner', i === 0 && s.pts > 0);
      list.append(li);
    });
    box.append(el('h2', { className: 'end-section-title', textContent: `🏆 Classifica del torneo · gioco ${t.index} di ${t.games.length}` }), list);

    if (t.index < t.games.length) {
      const nextGame = GAMES.find((g) => g.id === t.games[t.index]);
      const url = U.gameUrl(nextGame.id, true);
      const bar = el('i');
      const pause = el('button', { type: 'button', className: 'ghost-btn', textContent: '⏸ Aspetta' });
      const go = el('a', { className: 'primary-btn big', href: url, textContent: 'Vai subito ▶' });
      box.append(
        el('div', { className: 'next-game' },
          el('div', { className: 'overlay-kicker', textContent: 'Prossimo gioco' }),
          el('div', { className: 'ng-title', textContent: `${nextGame.emoji} ${nextGame.title}` }),
          el('div', { className: 'play-actions' }, pause, go),
          el('div', { className: 'next-ring' }, bar))
      );
      // Partenza automatica dopo qualche secondo, a meno di metterla in pausa.
      const total = 20000;
      const startAt = Date.now();
      nextTimer = setInterval(() => {
        const left = Math.max(0, total - (Date.now() - startAt));
        bar.style.transform = `scaleX(${left / total})`;
        if (!left) {
          clearInterval(nextTimer);
          location.href = url;
        }
      }, 100);
      pause.addEventListener('click', () => {
        clearInterval(nextTimer);
        bar.style.transform = 'scaleX(0)';
        pause.hidden = true;
      });
      $('#end-actions').hidden = true;
    } else {
      const champ = standings[0];
      $('#end-title').textContent = champ && champ.pts > 0 ? `🏆 ${champ.team.name} vince il torneo!` : 'Torneo concluso!';
      $('#end-actions').hidden = false;
      FX.sound('fanfare');
      setTimeout(FX.celebrate, 300);
      setTimeout(FX.celebrate, 1600);
      Tour.clear();
    }
  }

  $('#btn-again').addEventListener('click', () => show('setup'));

  // ---------- Striscia punteggi ----------
  let currentTurnId = null;
  function renderStrip(all) {
    const ordered = teams || Order.teams();
    $('#score-strip').replaceChildren(
      ...ordered.map((t) => {
        const team = all.find((x) => x.id === t.id) || t;
        const chip = el('div', { className: 'strip-team' }, el('span', { className: 'strip-name', textContent: team.name }), el('span', { className: 'strip-score', textContent: game.scoring === 'big' && earned ? U.fmt(earned[team.id] || 0) : team.score }));
        chip.dataset.id = team.id;
        chip.style.setProperty('--team', team.color);
        chip.classList.toggle('current', team.id === currentTurnId);
        return chip;
      })
    );
  }
  Teams.onChange(renderStrip);
  ctx.refreshStrip = () => renderStrip(Teams.all());
  renderStrip(Teams.all());

  // ---------- Avvio ----------
  if (inTour) {
    (async () => {
      opts = tourOptions();
      await FX.countdown({
        kicker: `Torneo · gioco ${tourIndex + 1} di ${tourState.games.length}`,
        emoji: game.emoji,
        title: game.title,
        accent: game.color,
      });
      start(opts);
    })();
  } else {
    show('setup');
  }
})();

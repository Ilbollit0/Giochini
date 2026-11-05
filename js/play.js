// Motore comune a tutti i giochi: impostazioni → domande → risultati.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const game = GAMES.find((g) => g.id === new URLSearchParams(location.search).get('g'));
  if (!game) {
    location.replace('./');
    return;
  }

  const COMMON_OPTIONS = [
    { key: 'count', label: 'Domande', values: [[5, '5'], [10, '10'], [15, '15'], [20, '20']], default: 10 },
    { key: 'timer', label: 'Tempo', values: [[0, 'Nessuno'], [10, '10 s'], [20, '20 s'], [30, '30 s'], [60, '60 s']], default: 20 },
    { key: 'points', label: 'Punti', values: [[1, '1'], [2, '2'], [3, '3']], default: 1 },
  ];
  const options = [...game.options, ...COMMON_OPTIONS];

  document.title = `${game.title} · Giochini`;
  $('#game-name').textContent = game.title;
  $('#setup-emoji').textContent = game.emoji;
  $('#setup-title').textContent = game.title;
  $('#setup-desc').textContent = game.desc;
  document.documentElement.style.setProperty('--accent', game.color);

  const screens = { setup: $('#setup'), play: $('#play'), end: $('#end') };
  function show(name) {
    Object.entries(screens).forEach(([key, el]) => (el.hidden = key !== name));
    window.scrollTo(0, 0);
  }

  // ---------- Impostazioni ----------
  const saved = Store.get('opts:' + game.id, {});
  const optionsBox = $('#options');
  options.forEach((opt) => {
    const current = String(saved[opt.key] ?? opt.default);
    const field = document.createElement('fieldset');
    field.className = 'option';
    const legend = document.createElement('legend');
    legend.textContent = opt.label;
    const group = document.createElement('div');
    group.className = 'segmented';
    opt.values.forEach(([value, label]) => {
      const input = Object.assign(document.createElement('input'), {
        type: 'radio',
        name: opt.key,
        value: String(value),
        id: `opt-${opt.key}-${value}`,
        checked: String(value) === current,
      });
      const lab = document.createElement('label');
      lab.htmlFor = input.id;
      lab.textContent = label;
      group.append(input, lab);
    });
    if (!group.querySelector(':checked')) group.querySelector('input').checked = true;
    field.append(legend, group);
    optionsBox.append(field);
  });

  function readOptions() {
    const data = new FormData($('#setup-form'));
    const o = {};
    options.forEach((opt) => {
      const raw = data.get(opt.key);
      o[opt.key] = typeof opt.default === 'number' ? Number(raw) : raw;
    });
    return o;
  }

  $('#setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const o = readOptions();
    Store.set('opts:' + game.id, o);
    start(o);
  });

  // ---------- Partita ----------
  let opts, nextQuestion, index, q, revealed, awarded, hintIndex, earned;

  function start(o) {
    opts = o;
    nextQuestion = game.create(o);
    index = 0;
    earned = {};
    show('play');
    showQuestion();
  }

  function showQuestion() {
    q = nextQuestion();
    revealed = false;
    awarded = new Set();
    hintIndex = 0;

    $('#q-progress').textContent = `Domanda ${index + 1} di ${opts.count}`;
    const tag = $('#q-tag');
    tag.hidden = !q.tag;
    tag.textContent = q.tag || '';
    $('#q-prompt').textContent = q.prompt;

    const img = $('#q-image');
    img.hidden = !q.image;
    img.classList.remove('broken');
    if (q.image) img.src = q.image;
    else img.removeAttribute('src');

    setBig(q.big);
    $('#q-hints').replaceChildren();

    const choices = $('#q-choices');
    choices.replaceChildren(
      ...(q.choices || []).map((text, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice';
        btn.dataset.letter = 'ABCD'[i] || '';
        btn.textContent = text;
        btn.addEventListener('click', () => reveal(i));
        li.append(btn);
        return li;
      })
    );
    choices.classList.toggle('two', (q.choices || []).length === 2);

    $('#q-answer').hidden = true;
    $('#award').hidden = true;
    $('#ask-actions').hidden = false;
    $('#btn-hint').hidden = !q.hints?.length;
    $('#btn-hint').disabled = false;
    startTimer();
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
    if (h.text) {
      const li = document.createElement('li');
      li.textContent = '💡 ' + h.text;
      $('#q-hints').append(li);
    }
    $('#btn-hint').disabled = hintIndex >= q.hints.length;
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

    $('#q-answer-text').textContent = q.answer;
    $('#q-explain').textContent = q.explain || '';
    $('#q-explain').hidden = !q.explain;
    $('#q-answer').hidden = false;

    $('#ask-actions').hidden = true;
    $('#award-points').textContent = `(+${opts.points} ${opts.points === 1 ? 'punto' : 'punti'})`;
    renderAwardTeams();
    $('#btn-next').textContent = index + 1 >= opts.count ? 'Vedi i risultati 🏆' : 'Avanti →';
    $('#award').hidden = false;
    $('#btn-next').focus({ preventScroll: true });
    $('#award').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderAwardTeams() {
    $('#award-teams').replaceChildren(
      ...Teams.all().map((team, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'award-btn';
        btn.style.setProperty('--team', team.color);
        btn.setAttribute('aria-pressed', String(awarded.has(team.id)));
        btn.innerHTML = `<span class="award-key">${i + 1}</span><span class="award-name"></span><span class="award-check" aria-hidden="true">✓</span>`;
        btn.querySelector('.award-name').textContent = team.name;
        btn.addEventListener('click', () => toggleAward(team.id));
        return btn;
      })
    );
  }

  function toggleAward(id) {
    if (!revealed) return;
    const delta = awarded.has(id) ? -opts.points : opts.points;
    if (delta > 0) awarded.add(id);
    else awarded.delete(id);
    earned[id] = (earned[id] || 0) + delta;
    Teams.addPoints(id, delta);
    renderAwardTeams();
  }

  function next() {
    index++;
    if (index >= opts.count) finish();
    else showQuestion();
  }

  $('#btn-hint').addEventListener('click', hint);
  $('#btn-reveal').addEventListener('click', () => reveal(-1));
  $('#btn-next').addEventListener('click', next);

  // ---------- Timer ----------
  let timerId = null;
  function startTimer() {
    stopTimer();
    const box = $('#timer');
    box.hidden = !opts.timer;
    if (!opts.timer) return;
    const total = opts.timer * 1000;
    const end = Date.now() + total;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      $('#timer-bar').style.transform = `scaleX(${left / total})`;
      $('#timer-num').textContent = Math.ceil(left / 1000);
      box.classList.toggle('urgent', left <= 5000);
      if (left === 0) {
        beep();
        reveal(-1);
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

  let audio;
  function beep() {
    try {
      audio ||= new AudioContext();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.2, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.6);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.6);
    } catch {
      /* audio non disponibile */
    }
  }

  // ---------- Fine partita ----------
  function finish() {
    stopTimer();
    const teams = [...Teams.all()].sort((a, b) => (earned[b.id] || 0) - (earned[a.id] || 0) || b.score - a.score);
    const best = Math.max(0, ...teams.map((t) => earned[t.id] || 0));
    const winners = teams.filter((t) => (earned[t.id] || 0) === best);
    $('#end-title').textContent =
      best === 0 ? 'Nessun punto in questa partita!' : winners.length > 1 ? 'Pareggio!' : `Vince ${winners[0].name}!`;

    $('#end-list').replaceChildren(
      ...teams.map((team) => {
        const li = document.createElement('li');
        li.style.setProperty('--team', team.color);
        li.classList.toggle('winner', best > 0 && (earned[team.id] || 0) === best);
        li.innerHTML = '<span class="end-name"></span><span class="end-earned"></span><span class="end-total"></span>';
        li.querySelector('.end-name').textContent = team.name;
        li.querySelector('.end-earned').textContent = `+${earned[team.id] || 0}`;
        li.querySelector('.end-total').textContent = `${team.score} totali`;
        return li;
      })
    );
    show('end');
  }
  $('#btn-again').addEventListener('click', () => show('setup'));

  // ---------- Tastiera ----------
  document.addEventListener('keydown', (e) => {
    if (screens.play.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches('input, textarea')) return;
    const key = e.key.toLowerCase();
    if (key === ' ' || (key === 'enter' && !e.target.matches('button, a'))) {
      e.preventDefault();
      revealed ? next() : reveal(-1);
    } else if (key === 'h') {
      hint();
    } else if (/^[1-8]$/.test(key) && revealed) {
      const team = Teams.all()[Number(key) - 1];
      if (team) toggleAward(team.id);
    } else if (/^[a-d]$/.test(key) && !revealed && q.choices) {
      const i = 'abcd'.indexOf(key);
      if (i < q.choices.length) reveal(i);
    }
  });

  // ---------- Striscia punteggi ----------
  function renderStrip(teams) {
    $('#score-strip').replaceChildren(
      ...teams.map((team) => {
        const chip = document.createElement('div');
        chip.className = 'strip-team';
        chip.style.setProperty('--team', team.color);
        chip.innerHTML = '<span class="strip-name"></span><span class="strip-score"></span>';
        chip.querySelector('.strip-name').textContent = team.name;
        chip.querySelector('.strip-score').textContent = team.score;
        return chip;
      })
    );
  }
  Teams.onChange(renderStrip);
  renderStrip(Teams.all());

  // Errore di caricamento della bandiera (es. senza connessione).
  $('#q-image').addEventListener('error', (e) => e.target.classList.add('broken'));

  show('setup');
})();

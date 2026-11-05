// Pagina principale: giochi, classifica, ruota dell'ordine e creazione del torneo.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const { el } = U;
  const games = [...GAMES].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // ---------- Giochi ----------
  const grid = $('#games-grid');
  games.forEach((game, i) => {
    const card = el('a', { className: 'game-card', href: U.gameUrl(game.id) });
    card.style.setProperty('--accent', game.color);
    card.style.setProperty('--i', i);
    card.append(
      el('span', { className: 'game-emoji', ariaHidden: 'true', textContent: game.emoji }),
      el('span', { className: 'game-title', textContent: game.title }),
      el('span', { className: 'game-desc', textContent: game.desc }),
      game.isNew ? el('span', { className: 'game-badge', textContent: 'Nuovo' }) : null
    );
    // Effetto 3D che segue il mouse (solo con mouse e grafica alta)
    card.addEventListener('pointermove', (e) => {
      if (!Perf.tilt) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', x * 100 + '%');
      card.style.setProperty('--my', y * 100 + '%');
      card.style.setProperty('--ry', (x - 0.5) * 10 + 'deg');
      card.style.setProperty('--rx', (0.5 - y) * 10 + 'deg');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
    // I giochi a turni hanno bisogno dell'ordine delle squadre.
    card.addEventListener('click', (e) => {
      Songs.stop();
      if (game.turnBased && needsOrder()) {
        e.preventDefault();
        openOrder(() => (location.href = card.href));
      }
    });
    grid.append(el('li', {}, card));
  });

  const needsOrder = () => Teams.all().length > 1 && !Order.isSet();

  // ---------- Classifica ----------
  const list = $('#teams');
  const template = $('#team-template');
  const addBtn = $('#btn-add-team');
  const sortBtn = $('#btn-sort');
  let sorted = Store.get('sorted', false);

  function render(teams) {
    const ordered = sorted ? [...teams].sort((a, b) => b.score - a.score) : teams;
    const best = Math.max(...teams.map((t) => t.score));
    const focusedId = document.activeElement?.closest('.team')?.dataset.id;
    const focusedClass = document.activeElement?.className;

    list.replaceChildren(
      ...ordered.map((team, i) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.dataset.id = team.id;
        node.style.setProperty('--team', team.color);
        node.classList.toggle('leader', teams.length > 1 && team.score === best && best > 0);
        node.querySelector('.team-rank').textContent = sorted ? i + 1 : '';
        node.querySelector('.team-name').value = team.name;
        node.querySelector('.team-score').textContent = team.score;
        node.querySelector('.remove-btn').hidden = teams.length <= 1;
        const song = Songs.get(team.id);
        node.querySelector('.team-song-name').textContent = song ? song.title : 'Scegli canzone';
        node.querySelector('.team-song').classList.toggle('set', !!song);
        return node;
      })
    );

    if (focusedId && focusedClass) {
      const sel = '.' + focusedClass.trim().split(/\s+/).join('.');
      list.querySelector(`[data-id="${focusedId}"] ${sel}`)?.focus();
    }

    list.classList.toggle('ranked', sorted);
    addBtn.disabled = teams.length >= Teams.MAX_TEAMS;
    sortBtn.setAttribute('aria-pressed', String(sorted));
    renderOrderBar();
  }

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.team');
    if (!row) return;
    const scoreBtn = e.target.closest('.score-btn');
    if (scoreBtn) {
      Teams.addPoints(row.dataset.id, Number(scoreBtn.dataset.delta));
      bump(row.dataset.id);
      FX.sound('pop');
    } else if (e.target.closest('.team-song')) {
      openSong(row.dataset.id);
    } else if (e.target.closest('.remove-btn')) {
      const name = row.querySelector('.team-name').value;
      if (confirm(`Eliminare "${name}"?`)) Teams.remove(row.dataset.id);
    }
  });
  list.addEventListener('change', (e) => {
    if (!e.target.matches('.team-name')) return;
    Teams.rename(e.target.closest('.team').dataset.id, e.target.value);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.team-name')) e.target.blur();
  });

  function bump(id) {
    const score = list.querySelector(`[data-id="${id}"] .team-score`);
    score?.classList.remove('bump');
    void score?.offsetWidth;
    score?.classList.add('bump');
  }

  addBtn.addEventListener('click', () => {
    Teams.add();
    list.lastElementChild?.querySelector('.team-name').select();
  });
  $('#btn-reset').addEventListener('click', () => {
    if (confirm('Azzerare i punteggi di tutte le squadre?')) Teams.resetScores();
  });
  sortBtn.addEventListener('click', () => {
    sorted = !sorted;
    Store.set('sorted', sorted);
    render(Teams.all());
  });

  // ---------- Canzone della vittoria ----------
  const songModal = $('#song-modal');
  let songTeam = null;
  function openSong(teamId) {
    songTeam = Teams.all().find((t) => t.id === teamId);
    if (!songTeam) return;
    $('#song-title').textContent = `Canzone di ${songTeam.name}`;
    songModal.style.setProperty('--accent', songTeam.color);
    renderSongs();
    songModal.showModal();
  }
  function renderSongs() {
    const current = Songs.get(songTeam.id);
    const lib = Songs.library();
    // Il file caricato dal dispositivo compare in cima alla lista.
    const items = [...(current?.key ? [current] : []), ...lib];
    $('#song-empty').hidden = items.length > 0;
    $('#song-list').replaceChildren(
      ...items.map((song) => {
        const chosen = current && (song.key ? song.key === current.key : song.file === current.file);
        const play = el('button', { type: 'button', className: 'ghost-btn small', textContent: '▶', title: 'Ascolta' });
        const pick = el('button', { type: 'button', className: 'song-pick', ariaPressed: String(!!chosen) },
          el('span', { textContent: song.title }),
          el('small', { textContent: song.key ? 'dal dispositivo' : song.file }));
        play.addEventListener('click', async () => {
          if (!(await Songs.preview(song))) alert('Non riesco a riprodurre questo file. Controlla che sia nella cartella musica/ con lo stesso nome.');
        });
        pick.addEventListener('click', async () => {
          await Songs.set(songTeam.id, song.key ? current : { file: song.file, title: song.title });
          FX.sound('pop');
          renderSongs();
          render(Teams.all());
        });
        return el('li', {}, pick, play);
      })
    );
  }
  $('#song-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !songTeam) return;
    try {
      const song = await Songs.upload(file);
      await Songs.set(songTeam.id, song);
      FX.sound('correct');
      renderSongs();
      render(Teams.all());
      Songs.preview(song);
    } catch {
      alert('Non è stato possibile salvare il file in questo browser.');
    }
  });
  $('#btn-song-none').addEventListener('click', async () => {
    await Songs.set(songTeam.id, null);
    Songs.stop();
    renderSongs();
    render(Teams.all());
  });
  songModal.addEventListener('close', () => Songs.stop());

  // ---------- Ordine di gioco ----------
  function renderOrderBar() {
    const bar = $('#order-bar');
    if (Teams.all().length < 2) {
      bar.replaceChildren('Aggiungi almeno due squadre per sfidarvi.');
      return;
    }
    if (!Order.isSet()) {
      bar.replaceChildren('🎡 Nei quiz ci si prenota a voce. L’ordine con la ruota serve solo per i giochi a turni, come «Che momento è?».');
      return;
    }
    bar.replaceChildren(
      el('span', { textContent: 'Ordine di gioco:' }),
      ...Order.teams().map((t, i) => {
        const chip = el('span', { className: 'order-chip' }, el('b', { textContent: i + 1 }), t.name);
        chip.style.setProperty('--team', t.color);
        chip.style.setProperty('--i', i);
        return chip;
      })
    );
  }

  const orderModal = $('#order-modal');
  const orderWheel = new Wheel($('#order-wheel'));
  let orderRemaining = [];
  let orderPicked = [];
  let afterOrder = null;

  function openOrder(then = null) {
    afterOrder = then;
    orderRemaining = [...Teams.all()];
    orderPicked = [];
    orderWheel.setItems(orderRemaining.map((t) => ({ label: t.name, color: t.color })));
    $('#order-result').replaceChildren();
    $('#order-picked').replaceChildren();
    $('#order-text').textContent = then
      ? 'Prima di iniziare decidiamo chi risponde per primo. La ruota lo deciderà una volta sola: poi ce lo ricordiamo.'
      : "La ruota decide l'ordine delle squadre. Lo ricorderemo per tutte le partite.";
    $('#btn-order-spin').hidden = false;
    $('#btn-order-spin').disabled = false;
    $('#btn-order-done').hidden = true;
    orderModal.showModal();
  }

  async function spinOrder() {
    const btn = $('#btn-order-spin');
    if (orderWheel.spinning || !orderRemaining.length) return;
    btn.disabled = true;
    const idx = await orderWheel.spin();
    const team = orderRemaining[idx];
    pickTeam(team);
    orderRemaining.splice(idx, 1);
    if (orderRemaining.length === 1) {
      await wait(900);
      pickTeam(orderRemaining.pop());
    }
    if (orderRemaining.length) {
      await wait(900);
      orderWheel.setItems(orderRemaining.map((t) => ({ label: t.name, color: t.color })));
      btn.textContent = `🎡 Chi è ${orderPicked.length + 1}°?`;
      btn.disabled = false;
    } else {
      Order.set(orderPicked.map((t) => t.id));
      FX.sound('fanfare');
      FX.celebrate();
      btn.hidden = true;
      $('#btn-order-done').hidden = false;
      $('#btn-order-done').textContent = afterOrder ? 'Iniziamo! ▶' : 'Fatto ✓';
      $('#btn-order-done').focus();
      renderOrderBar();
    }
  }

  function pickTeam(team) {
    orderPicked.push(team);
    const n = orderPicked.length;
    const res = $('#order-result');
    res.replaceChildren(el('span', { className: 'pop', textContent: `${n}° · ${team.name}` }));
    res.style.color = team.color;
    const chip = el('li', { className: 'order-chip' }, el('b', { textContent: n }), team.name);
    chip.style.setProperty('--team', team.color);
    $('#order-picked').append(chip);
    FX.sound('win');
    FX.confetti({ count: 60, colors: [team.color, '#ffffff', '#ffd166'] });
  }

  $('#btn-order').addEventListener('click', () => {
    if (Teams.all().length < 2) return alert('Servono almeno due squadre.');
    openOrder();
  });
  $('#btn-order-spin').addEventListener('click', spinOrder);
  $('#btn-order-done').addEventListener('click', () => {
    orderModal.close();
    $('#btn-order-spin').textContent = '🎡 Gira la ruota';
    afterOrder?.();
  });
  orderWheel.host.addEventListener('click', spinOrder);

  // ---------- Torneo ----------
  const tourModal = $('#tour-modal');
  const tourWheel = new Wheel($('#tour-wheel'));
  const TOUR_OPTIONS = [
    { key: 'games', label: 'Quanti giochi', values: [[3, '3'], [5, '5'], [7, '7'], [10, '10'], [games.length, `Tutti (${games.length})`]], default: 5 },
    { key: 'questions', label: 'Domande (round) per ogni gioco', values: [[5, '5'], [10, '10'], [15, '15'], [20, '20']], default: 10 },
    { key: 'timer', label: 'Tempo per domanda', values: [[0, 'Nessuno'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [60, '60 s']], default: 20 },
    { key: 'repeat', label: 'Lo stesso gioco può uscire più volte', values: [[0, 'No'], [1, 'Sì']], default: 0 },
  ];
  const tourSaved = Store.get('tour-opts', {});
  TOUR_OPTIONS.forEach((opt) => {
    const current = String(tourSaved[opt.key] ?? opt.default);
    const group = el('div', { className: 'segmented' });
    opt.values.forEach(([value, label]) => {
      const id = `tour-${opt.key}-${value}`;
      group.append(
        el('input', { type: 'radio', name: opt.key, value: String(value), id, checked: String(value) === current }),
        el('label', { htmlFor: id, textContent: label })
      );
    });
    if (!group.querySelector(':checked')) group.querySelector('input').checked = true;
    $('#tour-form').append(el('fieldset', { className: 'option' }, el('legend', { textContent: opt.label }), group));
  });

  let lineup = [];
  function openTour() {
    if (Tour.active() && !confirm('C’è già un torneo in corso. Ricominciare da capo?')) return;
    $('#tour-step-setup').hidden = false;
    $('#tour-step-draw').hidden = true;
    tourModal.showModal();
  }

  async function drawGames() {
    const data = new FormData($('#tour-form'));
    const settings = Object.fromEntries(TOUR_OPTIONS.map((o) => [o.key, Number(data.get(o.key))]));
    Store.set('tour-opts', settings);
    const repeat = settings.repeat === 1;
    const count = repeat ? settings.games : Math.min(settings.games, games.length);
    $('#tour-step-setup').hidden = true;
    $('#tour-step-draw').hidden = false;
    $('#btn-tour-start').hidden = true;
    $('#btn-tour-back').hidden = true;
    $('#tour-lineup').replaceChildren();
    $('#tour-result').replaceChildren();
    $('#tour-draw-text').textContent = `La ruota sceglie ${count} giochi a caso${repeat ? ' (anche ripetuti)' : ''}.`;

    let pool = [...games];
    lineup = [];
    for (let k = 0; k < count; k++) {
      // Con le ripetizioni la ruota ha tutti i giochi, tranne quello appena uscito.
      if (repeat) pool = games.filter((g) => g.id !== lineup[lineup.length - 1]);
      tourWheel.setItems(pool.map((g) => ({ label: g.title, color: g.color, emoji: g.emoji })));
      await wait(k ? 500 : 250);
      const idx = pool.length > 1 ? await tourWheel.spin(undefined, { duration: count > 5 ? 2800 : 3800, turns: 4 }) : 0;
      const g = pool.splice(idx, 1)[0];
      lineup.push(g.id);
      $('#tour-result').replaceChildren(el('span', { className: 'pop', textContent: `${g.emoji} ${g.title}` }));
      const li = el('li', {}, el('span', { className: 'li-emoji', textContent: g.emoji }), el('span', { className: 'li-title', textContent: g.title }));
      li.style.setProperty('--accent', g.color);
      $('#tour-lineup').append(li);
      FX.sound('win');
      FX.confetti({ count: 50, colors: [g.color, '#fff', '#ffd166'] });
      if (!tourModal.open) return;
    }
    $('#tour-result').textContent = 'Ecco il torneo!';
    FX.sound('fanfare');
    $('#btn-tour-start').hidden = false;
    $('#btn-tour-back').hidden = false;
    $('#btn-tour-start').focus();
    $('#tour-step-draw').dataset.settings = JSON.stringify(settings);
  }

  function startTour() {
    const settings = JSON.parse($('#tour-step-draw').dataset.settings);
    Tour.create(lineup, settings);
    const go = () => (location.href = U.gameUrl(lineup[0], true));
    tourModal.close();
    const turnBased = lineup.some((id) => GAMES.find((g) => g.id === id)?.turnBased);
    if (turnBased && needsOrder()) openOrder(go);
    else go();
  }

  $('#btn-tour').addEventListener('click', () => {
    if (Teams.all().length < 2) return alert('Servono almeno due squadre per un torneo.');
    openTour();
  });
  $('#btn-tour-draw').addEventListener('click', drawGames);
  $('#btn-tour-start').addEventListener('click', startTour);
  $('#btn-tour-back').addEventListener('click', () => {
    $('#tour-step-setup').hidden = false;
    $('#tour-step-draw').hidden = true;
  });

  function renderTourBanner() {
    const t = Tour.get();
    const active = Tour.active();
    $('#tour-banner').hidden = !active;
    if (!active) return;
    const g = GAMES.find((x) => x.id === t.games[t.index]);
    $('#tour-banner-text').textContent = `gioco ${t.index + 1} di ${t.games.length}: ${g ? g.emoji + ' ' + g.title : ''}`;
    $('#btn-tour-continue').href = U.gameUrl(t.games[t.index], true);
  }
  $('#btn-tour-quit').addEventListener('click', () => {
    if (confirm('Abbandonare il torneo in corso?')) {
      Tour.clear();
      renderTourBanner();
    }
  });

  // Chiusura delle finestre
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  Teams.onChange(render);
  render(Teams.all());
  renderTourBanner();
})();

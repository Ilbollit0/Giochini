(() => {
  const $ = (sel) => document.querySelector(sel);

  // ---------- Giochi ----------
  const grid = $('#games-grid');
  const modal = $('#game-modal');

  GAMES.forEach((game) => {
    const li = document.createElement('li');
    const card = document.createElement(game.url ? 'a' : 'button');
    card.className = 'game-card';
    card.style.setProperty('--accent', game.color);
    if (game.url) card.href = game.url;
    else card.type = 'button';
    card.innerHTML = `
      <span class="game-emoji" aria-hidden="true">${game.emoji}</span>
      <span class="game-title">${game.title}</span>
      <span class="game-desc">${game.desc}</span>
      ${game.url ? '' : '<span class="game-badge">In arrivo</span>'}`;
    if (!game.url) card.addEventListener('click', () => openComingSoon(game));
    li.append(card);
    grid.append(li);
  });

  function openComingSoon(game) {
    $('#modal-emoji').textContent = game.emoji;
    $('#modal-title').textContent = game.title;
    $('#modal-text').textContent = 'Questo gioco è in preparazione. Torna presto!';
    if (typeof modal.showModal === 'function') modal.showModal();
    else alert(game.title + ': in arrivo!');
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

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
        return node;
      })
    );

    // Dopo il re-render rimetti il focus sul pulsante che si stava usando.
    if (focusedId && focusedClass) {
      const sel = '.' + focusedClass.trim().split(/\s+/).join('.');
      list.querySelector(`[data-id="${focusedId}"] ${sel}`)?.focus();
    }

    list.classList.toggle('ranked', sorted);
    addBtn.disabled = teams.length >= Teams.MAX_TEAMS;
    sortBtn.setAttribute('aria-pressed', String(sorted));
  }

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.team');
    if (!row) return;
    const scoreBtn = e.target.closest('.score-btn');
    if (scoreBtn) {
      Teams.addPoints(row.dataset.id, Number(scoreBtn.dataset.delta));
      bump(row.dataset.id);
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

  Teams.onChange(render);
  render(Teams.all());
})();

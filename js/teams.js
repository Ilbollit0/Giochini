// Gestione squadre e punteggi. Lo stato vive qui; la UI si iscrive con onChange.
window.Teams = (() => {
  const COLORS = ['#ff8a5c', '#4da3ff', '#ffd166', '#3ddc84', '#b388ff', '#ff5c8a', '#2fd4c9', '#a0a7c0'];
  const DEFAULT_NAMES = ['Arancioni', 'Blu', 'Gialli', 'Verdi', 'Viola', 'Rosa', 'Azzurri', 'Grigi'];
  const MAX_TEAMS = 8;

  let teams = Store.get('teams', null);
  // Al primo avvio le squadre predefinite vanno salvate subito: altrimenti ogni pagina
  // ne creerebbe di nuove, con identificativi diversi (e si perderebbero canzoni e ordine).
  if (!teams) {
    teams = [makeTeam(0), makeTeam(1)];
    Store.set('teams', teams);
  }
  const listeners = [];

  // Squadre salvate con la vecchia palette: riassegna i colori attuali.
  teams.forEach((t, i) => {
    if (!COLORS.includes(t.color)) t.color = COLORS[i % COLORS.length];
  });

  function makeTeam(index) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: 'Squadra ' + DEFAULT_NAMES[index % DEFAULT_NAMES.length],
      color: COLORS[index % COLORS.length],
      score: 0,
    };
  }

  function nextColorIndex() {
    const used = new Set(teams.map((t) => t.color));
    const free = COLORS.findIndex((c) => !used.has(c));
    return free === -1 ? teams.length : free;
  }

  function commit() {
    Store.set('teams', teams);
    listeners.forEach((fn) => fn(teams));
  }

  return {
    MAX_TEAMS,
    all: () => teams,
    onChange(fn) {
      listeners.push(fn);
    },
    add() {
      if (teams.length >= MAX_TEAMS) return;
      teams.push(makeTeam(nextColorIndex()));
      commit();
    },
    remove(id) {
      teams = teams.filter((t) => t.id !== id);
      commit();
    },
    rename(id, name) {
      const team = teams.find((t) => t.id === id);
      if (!team) return;
      team.name = name.trim() || team.name;
      commit();
    },
    addPoints(id, delta) {
      const team = teams.find((t) => t.id === id);
      if (!team) return;
      team.score += delta;
      commit();
    },
    resetScores() {
      teams.forEach((t) => (t.score = 0));
      commit();
    },
  };
})();

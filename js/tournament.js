// Stato del torneo: elenco dei giochi estratti, gioco corrente e classifica a punti piazzamento.
window.Tour = (() => {
  const PLACE_POINTS = [5, 3, 2, 1];

  const get = () => Store.get('tour', null);
  const save = (t) => Store.set('tour', t);

  // Classifica di una partita: a pari punti stesso piazzamento.
  function placements(earned, teams) {
    const rows = teams.map((t) => ({ team: t, earned: earned[t.id] || 0 }));
    rows.sort((a, b) => b.earned - a.earned);
    const best = rows[0]?.earned || 0;
    rows.forEach((r, i) => {
      r.place = i > 0 && r.earned === rows[i - 1].earned ? rows[i - 1].place : i + 1;
      r.pts = best > 0 ? PLACE_POINTS[r.place - 1] || 0 : 0;
    });
    return rows;
  }

  return {
    PLACE_POINTS,
    placements,
    get,
    active() {
      const t = get();
      return !!t && t.index < t.games.length;
    },
    current() {
      const t = get();
      return t && t.index < t.games.length ? t.games[t.index] : null;
    },
    create(games, settings) {
      const standings = Object.fromEntries(Teams.all().map((t) => [t.id, 0]));
      save({ games, settings, index: 0, standings, history: [], startedAt: Date.now() });
    },
    // Registra il risultato del gioco numero `index` (una sola volta).
    record(index, gameId, earned, teams) {
      const t = get();
      if (!t || t.index !== index || t.games[index] !== gameId) return null;
      const rows = placements(earned, teams);
      rows.forEach((r) => (t.standings[r.team.id] = (t.standings[r.team.id] || 0) + r.pts));
      t.history.push({ game: gameId, rows: rows.map((r) => ({ id: r.team.id, earned: r.earned, place: r.place, pts: r.pts })) });
      t.index++;
      save(t);
      return { tour: t, rows };
    },
    standings(teams) {
      const t = get();
      if (!t) return [];
      return teams.map((team) => ({ team, pts: t.standings[team.id] || 0 })).sort((a, b) => b.pts - a.pts);
    },
    clear() {
      Store.set('tour', null);
    },
  };
})();

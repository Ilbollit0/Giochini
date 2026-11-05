// Funzioni di supporto condivise dai giochi.
window.U = {
  rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  // Mazzo che pesca senza ripetizioni finché non lo ha esaurito.
  deck(items) {
    let pile = [];
    return () => {
      if (!pile.length) pile = U.shuffle(items);
      return pile.pop();
    };
  },
  // La risposta giusta più tre alternative prese da `pool`.
  choicesFrom(answer, pool, n = 4) {
    const others = U.shuffle([...new Set(pool)].filter((x) => x !== answer)).slice(0, n - 1);
    return U.shuffle([answer, ...others]);
  },
  // Alternative numeriche vicine alla risposta giusta.
  numberChoices(answer, n = 4) {
    const set = new Set([answer]);
    const spread = Math.max(3, Math.round(Math.abs(answer) * 0.15));
    while (set.size < n) {
      const v = answer + U.rand(1, spread) * (Math.random() < 0.5 ? -1 : 1);
      if (v >= 0) set.add(v);
    }
    return U.shuffle([...set]).map(String);
  },
};

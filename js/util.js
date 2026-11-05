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
  // Minuscolo, senza accenti né punteggiatura: per confrontare risposte scritte.
  normalize(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  },
  // Distanza di modifica (errori di battitura tollerati).
  lev(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  },
  fmt(n) {
    return Math.round(n).toLocaleString('it-IT');
  },
  // Distanza in km tra due punti sulla Terra.
  km(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  },
  el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
  },
  gameUrl(id, tour) {
    return `gioco.html?g=${encodeURIComponent(id)}${tour ? '&t=1' : ''}`;
  },
};

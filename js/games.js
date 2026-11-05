// Elenco dei giochi. Ogni gioco ha:
// - i dati mostrati nella pagina principale (titolo, emoji, colore, descrizione);
// - `options`: impostazioni specifiche scelte prima di iniziare;
// - `create(opts)`: restituisce una funzione che genera la prossima domanda.
//
// Una domanda è un oggetto:
//   { prompt, big?, image?, tag?, choices?, answer, explain?, hints?, revealBig? }
// `hints` è una lista di aiuti: { big } sostituisce il testo grande, { text } aggiunge una riga.
(() => {
  const MODE = {
    key: 'mode',
    label: 'Risposte',
    values: [['choice', 'Scelta multipla'], ['open', 'Aperte']],
    default: 'choice',
  };
  const LEVEL = {
    key: 'level',
    label: 'Difficoltà',
    values: [['facile', 'Facile'], ['medio', 'Media'], ['difficile', 'Difficile']],
    default: 'medio',
  };
  const { rand, pick, shuffle, deck, choicesFrom, numberChoices } = U;

  // ---------- Matematica ----------
  function mathQuestion(level) {
    const ops = {
      facile: [
        () => { const a = rand(1, 20), b = rand(1, 20); return [`${a} + ${b}`, a + b]; },
        () => { const a = rand(5, 20), b = rand(1, a); return [`${a} − ${b}`, a - b]; },
        () => { const a = rand(2, 5), b = rand(1, 10); return [`${a} × ${b}`, a * b]; },
      ],
      medio: [
        () => { const a = rand(10, 99), b = rand(10, 99); return [`${a} + ${b}`, a + b]; },
        () => { const a = rand(30, 99), b = rand(10, a - 5); return [`${a} − ${b}`, a - b]; },
        () => { const a = rand(3, 10), b = rand(3, 10); return [`${a} × ${b}`, a * b]; },
        () => { const b = rand(2, 10), r = rand(2, 10); return [`${b * r} ÷ ${b}`, r]; },
      ],
      difficile: [
        () => { const a = rand(11, 25), b = rand(3, 9); return [`${a} × ${b}`, a * b]; },
        () => { const a = rand(4, 12), b = rand(4, 12), c = rand(5, 30); return [`${a} × ${b} − ${c}`, a * b - c]; },
        () => { const a = rand(3, 9), b = rand(10, 40), c = rand(2, 9); return [`${a} + ${b} × ${c}`, a + b * c]; },
        () => { const a = rand(11, 20); return [`${a}²`, a * a]; },
        () => { const p = pick([10, 20, 25, 50, 75]), n = rand(1, 12) * 20; return [`${p}% di ${n}`, (p * n) / 100]; },
        () => { const b = rand(3, 15), r = rand(5, 20); return [`${b * r} ÷ ${b}`, r]; },
      ],
    };
    const [text, result] = pick(ops[level])();
    return { prompt: 'Quanto fa?', big: text, answer: String(result), number: result };
  }

  // ---------- Sequenze ----------
  function sequenceQuestion(level) {
    const kinds = {
      facile: ['arit', 'arit', 'desc', 'geo2'],
      medio: ['arit', 'desc', 'geo', 'quadrati', 'alterna'],
      difficile: ['geo', 'quadrati', 'alterna', 'fibonacci', 'cubi', 'crescente'],
    };
    const kind = pick(kinds[level]);
    let terms = [], explain = '';
    if (kind === 'arit') {
      const start = rand(1, 20), step = rand(2, level === 'facile' ? 5 : 12);
      terms = Array.from({ length: 6 }, (_, i) => start + step * i);
      explain = `Ogni volta +${step}`;
    } else if (kind === 'desc') {
      const start = rand(50, 100), step = rand(2, 9);
      terms = Array.from({ length: 6 }, (_, i) => start - step * i);
      explain = `Ogni volta −${step}`;
    } else if (kind === 'geo' || kind === 'geo2') {
      const start = rand(1, 4), r = kind === 'geo2' ? 2 : rand(2, 3);
      terms = Array.from({ length: 6 }, (_, i) => start * r ** i);
      explain = `Ogni volta ×${r}`;
    } else if (kind === 'quadrati') {
      const k = rand(1, 6);
      terms = Array.from({ length: 6 }, (_, i) => (k + i) ** 2);
      explain = `Quadrati: ${k}×${k}, ${k + 1}×${k + 1}, …`;
    } else if (kind === 'cubi') {
      const k = rand(1, 3);
      terms = Array.from({ length: 5 }, (_, i) => (k + i) ** 3);
      explain = `Cubi: ${k}×${k}×${k}, …`;
    } else if (kind === 'alterna') {
      const a = rand(2, 6);
      let b = rand(1, 9);
      if (b === a) b++;
      terms = [rand(1, 10)];
      for (let i = 1; i < 7; i++) terms.push(terms[i - 1] + (i % 2 ? a : b));
      explain = `Si alterna +${a} e +${b}`;
    } else if (kind === 'fibonacci') {
      terms = [rand(1, 4), rand(2, 6)];
      for (let i = 2; i < 7; i++) terms.push(terms[i - 1] + terms[i - 2]);
      explain = 'Ogni numero è la somma dei due precedenti';
    } else {
      const inc = rand(1, 3);
      let d = rand(1, 4);
      terms = [rand(1, 10)];
      for (let i = 1; i < 6; i++, d += inc) terms.push(terms[i - 1] + d);
      explain = `La differenza cresce di ${inc} ogni volta`;
    }
    const answer = terms.pop();
    return { prompt: 'Che numero viene dopo?', big: terms.join(', ') + ', ?', answer: String(answer), number: answer, explain };
  }

  function withMode(q, mode, makeChoices) {
    if (mode === 'choice') q.choices = makeChoices();
    return q;
  }

  // ---------- Parole ----------
  function wordDeck() {
    return deck(Object.entries(PAROLE).flatMap(([cat, words]) => words.map((w) => ({ word: w, cat }))));
  }
  const spaced = (letters) => letters.join(' ');

  window.GAMES = [
    {
      id: 'matematica',
      title: 'Matematica',
      emoji: '🧮',
      color: '#4a7fb5',
      desc: 'Calcoli a tempo: chi risponde prima?',
      options: [LEVEL, MODE],
      create: (o) => () => {
        const q = mathQuestion(o.level);
        return withMode(q, o.mode, () => numberChoices(q.number));
      },
    },
    {
      id: 'sequenze',
      title: 'Sequenze',
      emoji: '🔢',
      color: '#2f8f9d',
      desc: 'Scopri la regola e trova il numero mancante.',
      options: [LEVEL, MODE],
      create: (o) => () => {
        const q = sequenceQuestion(o.level);
        return withMode(q, o.mode, () => numberChoices(q.number));
      },
    },
    {
      id: 'bandiere',
      title: 'Indovina la bandiera',
      emoji: '🏳️',
      color: '#c4566b',
      desc: 'Riconosci il paese dalla sua bandiera.',
      options: [
        { key: 'level', label: 'Paesi', values: [['1', 'Più famosi'], ['2', 'Tutti']], default: '1' },
        MODE,
      ],
      create(o) {
        const pool = PAESI.filter((p) => p.level <= Number(o.level));
        const next = deck(pool);
        return () => {
          const p = next();
          return withMode(
            { prompt: 'Di quale paese è questa bandiera?', image: `img/bandiere/${p.code}.svg`, answer: p.name },
            o.mode,
            () => choicesFrom(p.name, pool.map((x) => x.name))
          );
        };
      },
    },
    {
      id: 'capitali',
      title: 'Capitali',
      emoji: '🏛️',
      color: '#b8901c',
      desc: 'Dalla nazione alla capitale, e ritorno.',
      options: [
        { key: 'dir', label: 'Domanda', values: [['capitale', 'Paese → capitale'], ['paese', 'Capitale → paese']], default: 'capitale' },
        { key: 'level', label: 'Paesi', values: [['1', 'Più famosi'], ['2', 'Tutti']], default: '1' },
        MODE,
      ],
      create(o) {
        const pool = PAESI.filter((p) => p.level <= Number(o.level));
        const next = deck(pool);
        const toCapital = o.dir === 'capitale';
        return () => {
          const p = next();
          const answer = toCapital ? p.capital : p.name;
          return withMode(
            {
              prompt: toCapital ? 'Qual è la capitale di…' : 'Di quale paese è la capitale?',
              big: toCapital ? p.name : p.capital,
              answer,
            },
            o.mode,
            () => choicesFrom(answer, pool.map((x) => (toCapital ? x.capital : x.name)))
          );
        };
      },
    },
    {
      id: 'parola',
      title: 'Indovina la parola',
      emoji: '🔤',
      color: '#4f8f63',
      desc: 'Lettere nascoste e aiuti: trova la parola.',
      options: [],
      create() {
        const next = wordDeck();
        return () => {
          const { word, cat } = next();
          const letters = [...word];
          const shown = letters.map(() => '_');
          // Ogni aiuto scopre una lettera in più, fino a lasciarne due nascoste.
          const order = shuffle(letters.map((_, i) => i)).slice(0, Math.max(1, letters.length - 2));
          const hints = order.map((i) => {
            shown[i] = letters[i];
            return { big: spaced(shown) };
          });
          return {
            tag: cat,
            prompt: `Indovina la parola (${letters.length} lettere)`,
            big: spaced(letters.map(() => '_')),
            hints,
            answer: word,
            revealBig: spaced(letters),
          };
        };
      },
    },
    {
      id: 'anagrammi',
      title: 'Anagrammi',
      emoji: '🔀',
      color: '#7a6f63',
      desc: 'Lettere mescolate: rimettile in ordine.',
      options: [],
      create() {
        const next = wordDeck();
        return () => {
          const { word, cat } = next();
          let mixed;
          do mixed = shuffle([...word]); while (mixed.join('') === word);
          return {
            tag: cat,
            prompt: 'Riordina le lettere',
            big: spaced(mixed),
            hints: [{ text: `Inizia con «${word[0]}»` }, { text: `Finisce con «${word.at(-1)}»` }],
            answer: word,
            revealBig: spaced([...word]),
          };
        };
      },
    },
    {
      id: 'emoji',
      title: 'Indovina dalle emoji',
      emoji: '🎬',
      color: '#8565b3',
      desc: 'Film, personaggi e proverbi raccontati in emoji.',
      options: [
        {
          key: 'cat',
          label: 'Categoria',
          values: [['tutte', 'Tutte'], ...Object.keys(EMOJI_QUIZ).map((c) => [c, c])],
          default: 'tutte',
        },
        MODE,
      ],
      create(o) {
        const cats = o.cat === 'tutte' ? Object.keys(EMOJI_QUIZ) : [o.cat];
        const next = deck(cats.flatMap((cat) => EMOJI_QUIZ[cat].items.map(([emoji, answer]) => ({ cat, emoji, answer }))));
        return () => {
          const item = next();
          const { prompt, items } = EMOJI_QUIZ[item.cat];
          return withMode(
            { tag: item.cat, prompt, big: item.emoji, emojiBig: true, answer: item.answer },
            o.mode,
            () => choicesFrom(item.answer, items.map((x) => x[1]))
          );
        };
      },
    },
    {
      id: 'vero-falso',
      title: 'Vero o falso',
      emoji: '✅',
      color: '#d97757',
      desc: 'Curiosità incredibili: sono vere o no?',
      options: [],
      create() {
        const next = deck(VERO_FALSO);
        return () => {
          const [text, isTrue, explain] = next();
          return { prompt: 'Vero o falso?', big: text, choices: ['Vero', 'Falso'], answer: isTrue ? 'Vero' : 'Falso', explain };
        };
      },
    },
  ];

  GAMES.forEach((g) => (g.url = `gioco.html?g=${g.id}`));
})();

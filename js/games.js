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
  function wordDeck(key) {
    return deck(Object.entries(PAROLE).flatMap(([cat, words]) => words.map((w) => ({ word: w, cat }))), key);
  }
  const spaced = (letters) => letters.join(' ');

  window.GAMES = [
    {
      id: 'cultura',
      rank: 0,
      isNew: true,
      title: 'Cultura generale',
      emoji: '🧠',
      color: '#8b7bff',
      desc: 'Storia, geografia, scienza, arte, sport e spettacolo: oltre 100 domande.',
      options: [
        { key: 'cat', label: 'Argomento', values: [['tutte', 'Tutti'], ...[...new Set(CULTURA.map((x) => x[0]))].map((c) => [c, c])], default: 'tutte' },
        MODE,
      ],
      create(o) {
        const pool = o.cat === 'tutte' ? CULTURA : CULTURA.filter((x) => x[0] === o.cat);
        const next = deck(pool, 'cultura');
        return () => {
          const [cat, question, answer, wrong, explain] = next();
          return withMode(
            { tag: cat, prompt: '', big: question, answer, explain: explain || '' },
            o.mode,
            // Le risposte escono ogni volta in un ordine diverso.
            () => shuffle([answer, ...wrong.slice(0, 3)])
          );
        };
      },
    },

    {
      id: 'foto',
      rank: 4,
      isNew: true,
      title: 'Indovina dalla foto',
      emoji: '📸',
      color: '#ff8a5c',
      desc: 'Monumenti, piatti tipici e stadi famosi: riconoscili dalla foto.',
      options: [
        { key: 'cat', label: 'Categoria', values: [['tutte', 'Tutte'], ...Object.keys(FOTO_QUIZ).map((c) => [c, c])], default: 'tutte' },
        MODE,
      ],
      create(o) {
        const PROMPT = { Monumenti: 'Che monumento è?', Cibi: 'Che piatto è?', Stadi: 'Che stadio è?' };
        const cats = o.cat === 'tutte' ? Object.keys(FOTO_QUIZ) : [o.cat];
        const next = deck(cats.flatMap((cat) => FOTO_QUIZ[cat].map((x) => ({ ...x, cat }))), 'foto');
        return () => {
          const x = next();
          return withMode(
            { tag: x.cat, prompt: PROMPT[x.cat], photo: x.img, credit: x.credit, answer: x.answer, explain: '📍 ' + x.where, hints: [{ text: `Si trova in: ${x.where}` }] },
            o.mode,
            () => choicesFrom(x.answer, FOTO_QUIZ[x.cat].map((y) => y.answer))
          );
        };
      },
    },
    {
      id: 'calciatore',
      rank: 2,
      isNew: true,
      title: 'Indovina il calciatore',
      emoji: '⚽',
      color: '#3ddc84',
      desc: 'Dalla carriera, squadra dopo squadra, o dalla foto.',
      options: [
        { key: 'tipo', label: 'Indizio', values: [['carriera', 'Trasferimenti'], ['foto', 'Foto']], default: 'carriera' },
        MODE,
      ],
      create(o) {
        const pool = o.tipo === 'foto' ? CALCIATORI.filter((p) => p.img) : CALCIATORI.filter((p) => p.career?.length >= 3);
        const next = deck(pool, 'calciatore-' + o.tipo);
        const initials = (name) => name.replace(/\(.*\)/, '').trim().split(/\s+/).map((w) => w[0] + '.').join(' ');
        const clubs = (p) => [...new Set(p.career.map((c) => c[1]))];
        return () => {
          const p = next();
          const base = o.tipo === 'foto'
            ? {
                prompt: 'Chi è questo calciatore?',
                photo: p.img,
                credit: p.credit,
                hints: [{ text: `Ha giocato in: ${clubs(p).slice(0, 3).join(', ')}` }, { text: `Iniziali: ${initials(p.name)}` }],
              }
            : {
                prompt: 'Di chi è questa carriera?',
                career: p.career,
                hints: [{ text: `Iniziali: ${initials(p.name)}` }],
              };
          return withMode(
            { ...base, answer: p.name, explain: o.tipo === 'foto' ? clubs(p).join(' → ') : '' },
            o.mode,
            () => choicesFrom(p.name, pool.map((x) => x.name))
          );
        };
      },
    },
    {
      id: 'momenti-calcio',
      rank: 3,
      isNew: true,
      title: 'Momenti del calcio',
      emoji: '🏟️',
      color: '#4da3ff',
      desc: 'Finali e partite leggendarie: riconosci il momento dalla foto.',
      options: [MODE],
      create(o) {
        const next = deck(MOMENTI_CALCIO, 'momenti-calcio');
        return () => {
          const m = next();
          return withMode(
            { prompt: 'Che momento del calcio è?', photo: m.img, credit: m.credit, answer: m.answer, explain: m.desc, hints: [{ text: `Anno: ${m.year}` }] },
            o.mode,
            () => choicesFrom(m.answer, MOMENTI_CALCIO.map((x) => x.answer))
          );
        };
      },
    },
    {
      id: 'matematica',
      rank: 20,
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
      rank: 21,
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
      rank: 12,
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
        const next = deck(pool, 'bandiere');
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
      rank: 13,
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
        const next = deck(pool, 'capitali');
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
      rank: 14,
      title: 'Indovina la parola',
      emoji: '🔤',
      color: '#4f8f63',
      desc: 'Lettere nascoste e aiuti: trova la parola.',
      options: [],
      create() {
        const next = wordDeck('parola');
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
      rank: 15,
      title: 'Anagrammi',
      emoji: '🔀',
      color: '#7a6f63',
      desc: 'Lettere mescolate: rimettile in ordine.',
      options: [],
      create() {
        const next = wordDeck('anagrammi');
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
      rank: 16,
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
        const next = deck(cats.flatMap((cat) => EMOJI_QUIZ[cat].items.map(([emoji, answer]) => ({ cat, emoji, answer }))), 'emoji');
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
      rank: 17,
      title: 'Vero o falso',
      emoji: '✅',
      color: '#d97757',
      desc: 'Curiosità incredibili: sono vere o no?',
      options: [],
      create() {
        const next = deck(VERO_FALSO, 'vero-falso');
        return () => {
          const [text, isTrue, explain] = next();
          return { prompt: 'Vero o falso?', big: text, choices: ['Vero', 'Falso'], answer: isTrue ? 'Vero' : 'Falso', explain };
        };
      },
    },
  ];

})();

// Aggiorna js/data/canzoni.js con tutti i file audio presenti nella cartella musica/.
// Uso: doppio clic su "aggiorna-canzoni.bat", oppure da terminale: node strumenti/aggiorna-canzoni.js
// Il titolo mostrato nel sito è il nome del file (senza estensione): per cambiarlo, rinomina il file.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'musica');
const out = path.join(root, 'js', 'data', 'canzoni.js');
const AUDIO = /\.(mp3|m4a|aac|ogg|oga|wav|flac|webm)$/i;

// "il-leone_remix.mp3" → "Il leone remix"
function title(file) {
  const t = file.replace(AUDIO, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => AUDIO.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort((a, b) => a.localeCompare(b, 'it'))
  : [];

const lines = files.map((f) => `  { file: ${JSON.stringify(f)}, title: ${JSON.stringify(title(f))} },`);
const js = `// Canzoni della vittoria nella cartella \`musica/\`.
// FILE GENERATO DA strumenti/aggiorna-canzoni.js: non serve modificarlo a mano.
// Per aggiungere canzoni: copia gli mp3 in musica/ e fai doppio clic su aggiorna-canzoni.bat.
// Il titolo è il nome del file: per cambiarlo, rinomina il file e rilancia lo script.
window.CANZONI = [
${lines.join('\n')}
];
`;
fs.writeFileSync(out, js, 'utf8');

console.log(`Trovate ${files.length} canzoni in musica/:`);
files.forEach((f) => console.log('  🎵 ' + title(f) + '  (' + f + ')'));
console.log('\nElenco aggiornato in js/data/canzoni.js. Ricarica la pagina del sito.');

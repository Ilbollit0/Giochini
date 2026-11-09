# Giochini
Giochini, nasce basandosi su una web app che uso spesso per fare qualche quiz con i miei amici: https://www.ed0.it/quizzesarchive/

Mini giochi a squadre da fare insieme: si gioca dal telefono, dal computer o in screen sharing sulla TV.

## Come si usa

È un sito statico: non serve installare niente. Apri `index.html` nel browser oppure pubblica la
cartella con GitHub Pages (Settings → Pages → branch `main`, cartella `/`).

1. Nella pagina principale dai un nome alle squadre (da 1 a 8) e, se vuoi, scegli la loro canzone della vittoria 🎵.
2. Scegli un gioco, oppure crea un **torneo**: la ruota estrae i giochi e si passa dall'uno all'altro.
3. Prima di ogni domanda c'è il conto alla rovescia **3, 2, 1**, poi parte il timer.
4. Tutte le squadre vedono la stessa domanda e **si prenotano a voce**: chi conduce tocca la squadra
   che ha parlato per prima, poi la risposta data (o *Giusta* / *Sbagliata*). Se sbaglia, possono
   provare le altre squadre. Mentre una squadra risponde, il timer è in pausa.

Il punteggio resta salvato nel browser. I pulsanti in alto attivano la **Modalità TV** (testi più
grandi), lo **schermo intero**, l'audio e la qualità grafica.

### Tastiera (dal computer)

| Tasto | Azione |
|---|---|
| `1`–`8` | squadra che si è prenotata |
| `A`–`D` | risposta data (scelta multipla) |
| `V` / `X` | risposta giusta / sbagliata |
| `H` | aiuto |
| `Spazio` | mostra la risposta / domanda successiva |
| `Esc` | annulla la prenotazione |

## I giochi

| Gioco | Contenuti |
|---|---|
| 🧠 Cultura generale | 120 domande su storia, geografia, scienza, arte, sport, spettacolo e varie |
| 🗺️ Che momento è? | 66 foto storiche: punta il luogo sulla mappa, scegli l'anno e indovina l'evento |
| ⚽ Indovina il calciatore | 171 calciatori, dalla carriera squadra per squadra o dalla foto |
| 🏟️ Momenti del calcio | 21 partite e momenti leggendari |
| 📸 Indovina dalla foto | monumenti, piatti tipici e stadi (circa 200 foto) |
| 🪢 Impiccato | lettere chiamate a voce, vince chi indovina la parola |
| ✏️ Cruciverba | schema sempre nuovo, oltre 300 definizioni |
| 🏳️ Bandiere e 🏛️ Capitali | 138 paesi |
| 🔤 Indovina la parola e 🔀 Anagrammi | circa 300 parole in 9 categorie |
| 🎬 Indovina dalle emoji | film, personaggi, proverbi e canzoni |
| ✅ Vero o falso | 80 curiosità con spiegazione |
| 🧮 Matematica e 🔢 Sequenze | domande sempre nuove, tre livelli di difficoltà |

Le risposte escono ogni volta in un ordine diverso, e le domande già uscite non si ripetono
finché non sono state usate tutte.

## Canzone della vittoria

Ogni squadra può avere una canzone che parte quando vince una partita o il torneo
(nella pagina principale, tocca 🎵 accanto al nome della squadra). Il tasto ■ Stop la ferma.

- **Dalla cartella `musica/`**: copia lì i file mp3 e scrivi i loro nomi in `js/data/canzoni.js`.
  Già presente: `illeone.mp3` (*Il leone*).
- **Dal dispositivo**: carica un mp3 dalla finestra della canzone; resta salvato solo in quel browser.

Se l'audio è disattivato (🔇), la canzone non parte.

## Aggiungere contenuti

- **Domande e parole**: nei file in `js/data/` (`cultura.js`, `parole.js`, `verofalso.js`, `emoji.js`, `cruciverba.js`, `paesi.js`…).
- **Nuovo gioco**: una voce in `js/games.js`, oppure un file in `js/games/` per i giochi con un'interfaccia propria.

## Crediti

- Foto da Wikimedia Commons, con licenza libera: autore e licenza compaiono sotto ogni foto dopo la risposta.
- Bandiere: [flag-icons](https://github.com/lipis/flag-icons) (licenza MIT).
- Mappa: Esri World Topo Map e © OpenStreetMap.

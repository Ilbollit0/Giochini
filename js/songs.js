// Canzone della vittoria: ogni squadra può sceglierne una, che parte quando vince.
// Le canzoni arrivano da due posti:
// - la cartella `musica/`, elencate in js/data/canzoni.js (vanno bene per GitHub Pages);
// - un file mp3 caricato dal dispositivo, salvato nel browser (IndexedDB).
window.Songs = (() => {
  const DB = 'giochini-songs';
  let audio = null;
  let toast = null;
  let fadeId = null;

  // ---------- IndexedDB per i file caricati ----------
  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  const all = () => Store.get('songs', {});
  const library = () => (window.CANZONI || []).map((c) => (typeof c === 'string' ? { file: c, title: c.replace(/\.[a-z0-9]+$/i, '') } : c));

  async function urlOf(song) {
    if (!song) return null;
    if (song.file) return 'musica/' + song.file.split('/').map(encodeURIComponent).join('/');
    if (song.key) {
      const blob = await idb('readonly', (s) => s.get(song.key)).catch(() => null);
      return blob ? URL.createObjectURL(blob) : null;
    }
    return null;
  }

  function stop() {
    clearInterval(fadeId);
    if (audio) {
      audio.pause();
      if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
    }
    audio = null;
    toast?.remove();
    toast = null;
  }

  // Suona una canzone. `team` serve solo per l'etichetta e il colore.
  async function start(song, { team, label, volume = 0.9 } = {}) {
    stop();
    const url = await urlOf(song);
    if (!url) return false;
    const a = new Audio(url);
    audio = a;
    a.volume = 0;
    try {
      await a.play();
    } catch {
      if (audio === a) stop();
      return false;
    }
    // Entrata morbida
    let v = 0;
    fadeId = setInterval(() => {
      v = Math.min(volume, v + 0.05);
      if (audio === a) a.volume = v;
      if (v >= volume) clearInterval(fadeId);
    }, 80);
    a.addEventListener('ended', () => audio === a && stop());

    const { el } = U;
    const btn = el('button', { type: 'button', className: 'song-stop', textContent: '■ Stop' });
    btn.addEventListener('click', stop);
    toast = el('div', { className: 'song-toast', role: 'status' },
      el('span', { className: 'song-disc', ariaHidden: 'true', textContent: '🎵' }),
      el('span', { className: 'song-info' },
        el('small', { textContent: label || (team ? `Canzone di ${team.name}` : 'Anteprima') }),
        el('b', { textContent: song.title || 'Canzone' })),
      btn);
    if (team) toast.style.setProperty('--team', team.color);
    document.body.append(toast);
    return true;
  }

  return {
    library,
    get(teamId) {
      return all()[teamId] || null;
    },
    async set(teamId, song) {
      const map = all();
      const old = map[teamId];
      if (song) map[teamId] = song;
      else delete map[teamId];
      Store.set('songs', map);
      // Il file caricato in precedenza non serve più a nessuno? Lo togliamo.
      if (old?.key && !Object.values(map).some((s) => s.key === old.key)) idb('readwrite', (s) => s.delete(old.key)).catch(() => {});
    },
    // Salva un file caricato dal dispositivo e restituisce la canzone da assegnare.
    async upload(file) {
      const key = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await idb('readwrite', (s) => s.put(file, key));
      return { key, title: file.name.replace(/\.[a-z0-9]+$/i, '') };
    },
    preview(song) {
      return start(song, { label: 'Anteprima' });
    },
    // Fa partire la canzone della squadra, se ne ha una (e l'audio non è disattivato).
    play(team, { champion = false } = {}) {
      const song = team && this.get(team.id);
      if (!song || FX.muted) return Promise.resolve(false);
      return start(song, { team, label: champion ? `🏆 ${team.name} campioni!` : `🎉 Vince ${team.name}` });
    },
    stop,
    get playing() {
      return !!audio && !audio.paused;
    },
  };
})();

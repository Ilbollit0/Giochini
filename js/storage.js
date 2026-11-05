// Piccolo wrapper su localStorage: se non è disponibile (navigazione privata,
// anteprime) l'app funziona comunque, solo senza ricordare lo stato.
window.Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('giochini:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('giochini:' + key, JSON.stringify(value));
    } catch {
      /* ignorato */
    }
  },
};

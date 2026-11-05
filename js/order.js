// Ordine di gioco delle squadre, deciso una volta con la ruota e ricordato nel browser.
window.Order = {
  ids() {
    return Store.get('order', null);
  },
  // Deciso e valido per tutte le squadre attuali?
  isSet() {
    const ids = this.ids();
    if (!ids) return false;
    const teams = Teams.all();
    return teams.every((t) => ids.includes(t.id));
  },
  // Squadre nell'ordine deciso; quelle aggiunte dopo vanno in fondo.
  teams() {
    const ids = this.ids() || [];
    const teams = Teams.all();
    const known = ids.map((id) => teams.find((t) => t.id === id)).filter(Boolean);
    return [...known, ...teams.filter((t) => !ids.includes(t.id))];
  },
  set(ids) {
    Store.set('order', ids);
  },
  clear() {
    Store.set('order', null);
  },
};

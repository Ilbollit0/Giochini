// Prenotazione a voce: tutte le squadre vedono la stessa domanda, chi si prenota per primo
// risponde. Chi conduce tocca la squadra, poi dice se la risposta è giusta o sbagliata.
// Se sbaglia, quella squadra è fuori per questa domanda e possono provare le altre.
window.Buzz = class Buzz {
  // verdict: true = pulsanti Giusta/Sbagliata; false = si tocca la risposta (scelta multipla).
  constructor({ teams, verdict = true, onBuzz, onVerdict, onCancel } = {}) {
    const { el } = U;
    this.teams = teams;
    this.verdictMode = verdict;
    this.cb = { onBuzz, onVerdict, onCancel };
    this.out = new Set();
    this.selected = null;
    this.locked = false;

    this.title = el('p', { className: 'buzz-title' });
    this.row = el('div', { className: 'buzz-teams' });
    this.yes = el('button', { type: 'button', className: 'verdict-btn yes', textContent: '✓ Giusta' });
    this.no = el('button', { type: 'button', className: 'verdict-btn no', textContent: '✕ Sbagliata' });
    this.undo = el('button', { type: 'button', className: 'ghost-btn small', textContent: 'Annulla' });
    this.help = el('p', { className: 'buzz-help', textContent: 'Tocca la risposta che ha dato' });
    this.answer = el('div', { className: 'buzz-answer' }, this.help, this.yes, this.no, this.undo);
    this.el = el('div', { className: 'buzz' }, this.title, this.row, this.answer);

    this.yes.addEventListener('click', () => this.verdict(true));
    this.no.addEventListener('click', () => this.verdict(false));
    this.undo.addEventListener('click', () => this.cancel());
    this.btns = teams.map((team, i) => {
      const b = el('button', { type: 'button', className: 'buzz-btn' },
        el('span', { className: 'award-key', textContent: i + 1 }),
        el('span', { className: 'buzz-name', textContent: team.name }));
      b.style.setProperty('--team', team.color);
      b.addEventListener('click', () => this.select(team));
      this.row.append(b);
      return b;
    });
    this.reset();
  }

  get solo() {
    return this.teams.length < 2;
  }
  available() {
    return this.teams.filter((t) => !this.out.has(t.id));
  }
  setVerdictMode(on) {
    this.verdictMode = on;
    this.render();
  }

  reset() {
    this.out.clear();
    this.selected = this.solo ? this.teams[0] : null;
    this.locked = false;
    this.render();
  }
  lock() {
    this.locked = true;
    this.render();
  }
  select(team) {
    if (this.locked || !team || this.out.has(team.id) || this.solo) return;
    if (this.selected?.id === team.id) return this.cancel();
    if (this.cb.onBuzz?.(team) === false) return;
    this.selected = team;
    FX.sound('pop');
    this.render();
  }
  cancel() {
    if (this.locked || !this.selected || this.solo) return;
    this.selected = null;
    this.cb.onCancel?.();
    this.render();
  }
  // La squadra selezionata ha risposto: giusta o sbagliata.
  verdict(right) {
    const team = this.selected;
    if (this.locked || !team) return;
    if (!right) this.markOut(team);
    this.cb.onVerdict?.(team, right);
    this.render();
  }
  markOut(team) {
    this.out.add(team.id);
    if (this.selected?.id === team.id) this.selected = null;
    this.render();
  }
  // Attira l'attenzione sulle squadre (es. si è toccata una risposta senza prenotazione).
  nudge() {
    this.title.textContent = '👆 Prima tocca la squadra che si è prenotata';
    this.row.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 320 });
    FX.sound('tick');
  }

  render() {
    this.el.hidden = this.locked;
    const sel = this.selected;
    this.el.classList.toggle('has-selected', !!sel);
    this.el.style.setProperty('--team', sel?.color || 'var(--accent)');
    if (this.solo) this.title.textContent = this.verdictMode ? 'La risposta è giusta?' : 'Tocca la risposta';
    else if (sel) this.title.replaceChildren('Risponde ', U.el('b', { textContent: sel.name }));
    else this.title.textContent = this.out.size ? 'Chi altro si prenota?' : 'Chi si è prenotato?';
    this.row.hidden = this.solo;
    this.btns.forEach((b, i) => {
      const t = this.teams[i];
      b.disabled = this.out.has(t.id);
      b.classList.toggle('out', this.out.has(t.id));
      b.setAttribute('aria-pressed', String(sel?.id === t.id));
    });
    this.answer.hidden = !sel;
    this.yes.hidden = this.no.hidden = !this.verdictMode;
    this.help.hidden = this.verdictMode;
    this.undo.hidden = this.solo;
  }

  // Tastiera: 1–8 prenota, V giusta, X sbagliata, Esc annulla. Restituisce true se gestito.
  key(k) {
    if (this.locked) return false;
    if (/^[1-8]$/.test(k)) {
      this.select(this.teams[Number(k) - 1]);
      return true;
    }
    if (this.selected && this.verdictMode && (k === 'v' || k === 'x')) {
      this.verdict(k === 'v');
      return true;
    }
    if (k === 'escape' && this.selected) {
      this.cancel();
      return true;
    }
    return false;
  }
};

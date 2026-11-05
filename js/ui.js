// Pulsanti comuni della barra in alto: audio, modalità TV e schermo intero.
(() => {
  const tvBtn = document.querySelector('#btn-tv');
  const fsBtn = document.querySelector('#btn-fullscreen');
  const muteBtn = document.querySelector('#btn-mute');

  function setTv(on) {
    document.documentElement.classList.toggle('tv', on);
    tvBtn?.setAttribute('aria-pressed', String(on));
    Store.set('tv', on);
  }
  setTv(Store.get('tv', false));
  tvBtn?.addEventListener('click', () => setTv(!document.documentElement.classList.contains('tv')));

  function paintMute() {
    if (!muteBtn) return;
    muteBtn.querySelector('[aria-hidden]').textContent = FX.muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(!FX.muted));
    muteBtn.title = FX.muted ? 'Audio disattivato' : 'Audio attivo';
  }
  muteBtn?.addEventListener('click', () => {
    FX.setMuted(!FX.muted);
    paintMute();
    FX.sound('pop');
  });
  paintMute();

  if (fsBtn) {
    if (!document.fullscreenEnabled) fsBtn.hidden = true;
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  }
})();

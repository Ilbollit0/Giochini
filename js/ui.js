// Pulsanti comuni della barra in alto: modalità TV e schermo intero.
(() => {
  const tvBtn = document.querySelector('#btn-tv');
  const fsBtn = document.querySelector('#btn-fullscreen');

  function setTv(on) {
    document.documentElement.classList.toggle('tv', on);
    tvBtn?.setAttribute('aria-pressed', String(on));
    Store.set('tv', on);
  }
  setTv(Store.get('tv', false));
  tvBtn?.addEventListener('click', () => setTv(!document.documentElement.classList.contains('tv')));

  if (fsBtn) {
    if (!document.fullscreenEnabled) fsBtn.hidden = true;
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  }
})();

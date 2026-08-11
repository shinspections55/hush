(function () {
  try {
    var isStandalone = (window.matchMedia && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
    )) || window.navigator.standalone === true || (typeof document.referrer === 'string' && document.referrer.startsWith('android-app://'));

    if (isStandalone && document.documentElement) {
      document.documentElement.classList.add('pwa-startup-veil');
    }
  } catch (_error) {
    // Ignore startup detection failures.
  }
})();

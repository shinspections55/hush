(function registerHushServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let hasRefreshed = false;
  let registrationRef = null;

  function activateWaitingWorker(registration) {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  function refreshServiceWorker() {
    if (!registrationRef) return;
    registrationRef.update().catch(() => {});
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        updateViaCache: 'none'
      });
      registrationRef = registration;
      console.log('[PWA] Service Worker registered:', registration);

      activateWaitingWorker(registration);
      refreshServiceWorker();

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasRefreshed) return;
        hasRefreshed = true;
        window.location.reload();
      });

      window.setInterval(() => {
        refreshServiceWorker();
      }, 60 * 1000);

      window.addEventListener('focus', refreshServiceWorker);
      window.addEventListener('online', refreshServiceWorker);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          refreshServiceWorker();
        }
      });
    } catch (error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    }
  });
})();

(function () {
  'use strict';
  fetch('/api/public/learn-hush', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data.ok || !data.content) throw new Error('Invalid guide response');
      document.querySelectorAll('[data-learn-key]').forEach(element => {
        const key = element.dataset.learnKey;
        if (Object.prototype.hasOwnProperty.call(data.content, key)
            && data.content[key] !== element.textContent.trim()) {
          element.textContent = data.content[key];
          element.style.whiteSpace = 'pre-line';
        }
      });
    })
    .catch(error => {
      console.error('[learn-hush] Unable to load published guide:', error);
      const notice = document.createElement('p');
      notice.setAttribute('role', 'status');
      notice.textContent = 'The latest guide could not be loaded. The default guide is shown.';
      document.querySelector('main').prepend(notice);
    });
})();

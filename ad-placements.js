'use strict';

(() => {
  const allowedPage = /\/(?:dashboard|mock-draft-contest-intro|rankings)(?:\.html)?\/?$/i.test(location.pathname);
  if (!allowedPage) return;
  if (/\/rankings(?:\.html)?\/?$/i.test(location.pathname) && new URLSearchParams(location.search).get('draftView') !== 'off') return;
  const slots = [...document.querySelectorAll('[data-ad-placement]')];
  if (!slots.length) return;
  if (window.top !== window.self || new URLSearchParams(location.search).get('adminBuilder') === '1') return;
  if (new URLSearchParams(location.search).get('adPreview') === '1') {
    slots.forEach(slot => {
      const disclosure = document.createElement('span');
      disclosure.className = 'hush-ad-disclosure';
      disclosure.textContent = `Sample advertisement - preview only (${slot.dataset.adPlacement})`;
      const banner = document.createElement('div');
      banner.className = 'hush-ad-preview-banner';
      const brand = document.createElement('span');
      brand.className = 'hush-ad-preview-brand';
      brand.textContent = 'GAME DAY GEAR';
      const message = document.createElement('strong');
      message.textContent = 'Ready for your next game day.';
      const detail = document.createElement('span');
      detail.textContent = 'Fictional sponsor. Real placement preview.';
      banner.append(brand, message, detail);
      slot.replaceChildren(disclosure, banner);
      slot.hidden = false;
    });
    return;
  }
  let googleScript;

  function loadGoogle(publisherId) {
    if (!googleScript) googleScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    return googleScript;
  }

  async function fillGoogleSlot(slot, ad, config) {
    if (!config || config.enabled !== true || config.launchApproved !== true ||
        !/^ca-pub-\d{16}$/.test(config.publisherId) || !/^\d{10}$/.test(ad.slotId) ||
        location.protocol !== 'https:' || !Array.isArray(config.productionHosts) ||
        !config.productionHosts.includes(location.hostname) ||
        /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return;
    await loadGoogle(config.publisherId);
    const unit = document.createElement('ins');
    unit.className = 'adsbygoogle';
    unit.style.display = 'block';
    unit.dataset.adClient = config.publisherId;
    unit.dataset.adSlot = ad.slotId;
    unit.dataset.adFormat = 'auto';
    unit.dataset.fullWidthResponsive = 'true';
    const disclosure = document.createElement('span');
    disclosure.className = 'hush-ad-disclosure';
    disclosure.textContent = 'Advertisement';
    slot.replaceChildren(disclosure, unit);
    slot.classList.add('hush-ad-google');
    const observer = new MutationObserver(() => {
      if (unit.dataset.adStatus === 'unfilled') {
        slot.hidden = true;
        observer.disconnect();
      }
    });
    observer.observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] });
    slot.hidden = false;
    if (slot.getBoundingClientRect().width <= 0) {
      slot.hidden = true;
      observer.disconnect();
      return;
    }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch (_error) { slot.hidden = true; observer.disconnect(); }
  }

  function safeUrl(value, image = false) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const url = new URL(value, location.href);
    if (image) return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    return url.protocol === 'https:' || url.origin === location.origin && url.protocol === 'http:' ? url.href : null;
  }

  async function fillSlot(slot, ad, config) {
    if (!ad || ad.enabled !== true) return;
    if (ad.provider === 'adsense') return fillGoogleSlot(slot, ad, config.adsense);
    if (typeof ad.alt !== 'string' || !ad.alt.trim()) return;
    const destination = safeUrl(ad.href);
    const source = safeUrl(ad.image, true);
    if (!destination || !source) return;
    const image = new Image();
    image.alt = ad.alt.trim();
    image.decoding = 'async';
    image.width = 1200;
    image.height = 180;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = source;
    });
    if (!image.naturalWidth) return;
    const disclosure = document.createElement('span');
    disclosure.className = 'hush-ad-disclosure';
    disclosure.textContent = 'Advertisement';
    const link = document.createElement('a');
    link.href = destination;
    link.target = '_blank';
    link.rel = 'sponsored noopener noreferrer';
    link.append(image);
    slot.replaceChildren(disclosure, link);
    slot.hidden = false;
  }

  fetch('/ad-placements.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Ad configuration unavailable');
      return response.json();
    })
    .then(config => {
      const activate = slot => Promise.resolve().then(() => fillSlot(slot, config.placements?.[slot.dataset.adPlacement], config)).catch(() => {});
      if (!('IntersectionObserver' in window)) return Promise.allSettled(slots.map(activate));
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const slot = entry.target.nextElementSibling;
          entry.target.remove();
          activate(slot);
        });
      }, { rootMargin: '300px' });
      slots.forEach(slot => {
        if (config.placements?.[slot.dataset.adPlacement]?.enabled !== true) return;
        const marker = document.createElement('span');
        marker.className = 'hush-ad-marker';
        marker.setAttribute('aria-hidden', 'true');
        slot.before(marker);
        observer.observe(marker);
      });
    })
    .catch(() => {});
})();
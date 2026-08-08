(function () {
  const ADMIN_KEY_STORAGE_KEY = 'adminApiKey';
  const gifUrlInput = document.getElementById('gifUrlInput');
  const gifBulkInput = document.getElementById('gifBulkInput');
  const gifCategorySelect = document.getElementById('gifCategorySelect');
  const createCategoryInput = document.getElementById('createCategoryInput');
  const createCategoryBtn = document.getElementById('createCategoryBtn');
  const deleteCategorySelect = document.getElementById('deleteCategorySelect');
  const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
  const gifCapInput = document.getElementById('gifCapInput');
  const saveGifCapBtn = document.getElementById('saveGifCapBtn');
  const addGifBtn = document.getElementById('addGifBtn');
  const addBulkGifBtn = document.getElementById('addBulkGifBtn');
  const refreshLibraryBtn = document.getElementById('refreshLibraryBtn');
  const playAllPreviewsBtn = document.getElementById('playAllPreviewsBtn');
  const pauseAllPreviewsBtn = document.getElementById('pauseAllPreviewsBtn');
  const statusEl = document.getElementById('gifManagerStatus');
  const gifLibraryGrid = document.getElementById('gifLibraryGrid');
  const adminKeyInput = document.getElementById('adminKeyInput');
  let previewPlaybackMode = 'play';
  let draggedGifPayload = null;
  let rightColumnCategory = '';
  let lastRenderedLibrary = {};
  let lastPreviewMap = new Map();

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = String(message || '');
    statusEl.dataset.tone = tone || 'info';
  }

  function getStoredAdminKey() {
    try {
      return String(localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '').trim();
    } catch (_error) {
      return '';
    }
  }

  function setStoredAdminKey(key) {
    try {
      localStorage.setItem(ADMIN_KEY_STORAGE_KEY, String(key || '').trim());
    } catch (_error) {
      // ignore
    }
  }

  function getAdminKey() {
    const typed = String(adminKeyInput && adminKeyInput.value || '').trim();
    return typed || getStoredAdminKey();
  }

  function authHeaders() {
    const key = getAdminKey();
    return {
      'Content-Type': 'application/json',
      'x-admin-key': key
    };
  }

  function extractGifId(url) {
    const value = String(url || '').trim();
    if (!value) return '';

    try {
      const parsed = new URL(value);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (!parts.length) return '';
      const last = parts[parts.length - 1];
      const fromSlug = last.includes('-') ? last.split('-').pop() : last;
      return String(fromSlug || '').trim();
    } catch (_error) {
      const pieces = value.split('-');
      return String(pieces[pieces.length - 1] || '').trim();
    }
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function previewKey(category, id) {
    return `${String(category || '').trim()}::${String(id || '').trim()}`;
  }

  function compactThemeLabel(category) {
    const key = String(category || '').trim();
    const map = {
      uncategorized: 'uncat',
      trashTalk: 'trash',
      favorites: 'favs'
    };
    return map[key] || key;
  }

  function hasUncategorizedBucket(library) {
    return Object.prototype.hasOwnProperty.call(library || {}, 'uncategorized');
  }

  function renderGifPreviewCell(category, id, previewMap) {
    const entry = previewMap && previewMap.get(previewKey(category, id));
    if (!entry) {
      return '<div class="gif-preview-empty">Preview unavailable</div>';
    }

    const videoUrl = String(entry.videoUrl || '').trim();
    const previewUrl = String(entry.previewUrl || '').trim();
    const gifUrl = String(entry.url || '').trim();
    const title = escapeAttr(entry.title || id || 'GIF preview');

    if (videoUrl) {
      const shouldAutoplay = previewPlaybackMode === 'play';
      const autoplayAttr = shouldAutoplay ? ' autoplay' : '';
      return `
        <video class="gif-preview-media" data-preview-video="true" muted loop${autoplayAttr} playsinline preload="metadata" title="${title}" poster="${escapeAttr(previewUrl || gifUrl)}">
          <source src="${escapeAttr(videoUrl)}" type="video/mp4">
        </video>
      `;
    }

    if (previewUrl || gifUrl) {
      const src = escapeAttr(previewUrl || gifUrl);
      return `<img class="gif-preview-media" src="${src}" alt="${title}" loading="lazy">`;
    }

    return '<div class="gif-preview-empty">Preview unavailable</div>';
  }

  function updatePreviewPlaybackButtons() {
    if (playAllPreviewsBtn) {
      playAllPreviewsBtn.classList.toggle('is-active', previewPlaybackMode === 'play');
      playAllPreviewsBtn.disabled = previewPlaybackMode === 'play';
    }
    if (pauseAllPreviewsBtn) {
      pauseAllPreviewsBtn.classList.toggle('is-active', previewPlaybackMode === 'pause');
      pauseAllPreviewsBtn.disabled = previewPlaybackMode === 'pause';
    }
  }

  function applyPreviewPlaybackMode() {
    if (!gifLibraryGrid) return;
    const videos = gifLibraryGrid.querySelectorAll('video.gif-preview-media[data-preview-video="true"]');
    videos.forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;

      if (previewPlaybackMode === 'pause') {
        video.removeAttribute('autoplay');
        video.pause();
        return;
      }

      video.setAttribute('autoplay', '');
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay errors caused by browser policies.
        });
      }
    });
    updatePreviewPlaybackButtons();
  }

  function setPreviewPlaybackMode(mode) {
    const nextMode = mode === 'pause' ? 'pause' : 'play';
    previewPlaybackMode = nextMode;
    applyPreviewPlaybackMode();
  }

  function renderCategoryOptions(library) {
    const categories = Object.keys(library || {});
    const fallback = categories[0] || '';
    const selectedCategory = String(gifCategorySelect && gifCategorySelect.value || fallback);
    const selectedDeleteCategory = String(deleteCategorySelect && deleteCategorySelect.value || fallback);

    if (gifCategorySelect) {
      gifCategorySelect.innerHTML = categories.map((category) => {
        const selectedAttr = category === selectedCategory ? ' selected' : '';
        return `<option value="${escapeHtml(category)}"${selectedAttr}>${escapeHtml(category)}</option>`;
      }).join('');
      if (!gifCategorySelect.value && fallback) {
        gifCategorySelect.value = fallback;
      }
    }

    if (deleteCategorySelect) {
      deleteCategorySelect.innerHTML = categories.map((category) => {
        const selectedAttr = category === selectedDeleteCategory ? ' selected' : '';
        return `<option value="${escapeHtml(category)}"${selectedAttr}>${escapeHtml(category)}</option>`;
      }).join('');

      if (categories.length === 0) {
        deleteCategorySelect.innerHTML = '<option value="">No themes</option>';
        deleteCategorySelect.value = '';
        deleteCategorySelect.disabled = true;
        if (deleteCategoryBtn) deleteCategoryBtn.disabled = true;
      } else {
        deleteCategorySelect.disabled = false;
        if (deleteCategoryBtn) deleteCategoryBtn.disabled = false;
        if (!deleteCategorySelect.value && fallback) {
          deleteCategorySelect.value = fallback;
        }
      }
    }
  }

  function renderLibrary(library, previewMap) {
    if (!gifLibraryGrid) return;
    const categories = Object.keys(library || {});
    lastRenderedLibrary = library || {};
    lastPreviewMap = previewMap instanceof Map ? previewMap : new Map();
    renderCategoryOptions(library);
    if (!categories.length) {
      rightColumnCategory = '';
      gifLibraryGrid.innerHTML = '<p>No categories found.</p>';
      return;
    }

    const sortedCategories = [...categories];
    const hasUncategorized = hasUncategorizedBucket(library);
    const uncategorizedKey = 'uncategorized';
    const switchableCategories = hasUncategorized
      ? sortedCategories.filter((category) => category !== uncategorizedKey)
      : sortedCategories;
    if (!rightColumnCategory || !switchableCategories.includes(rightColumnCategory)) {
      rightColumnCategory = switchableCategories[0] || uncategorizedKey;
    }

    const displayCategories = hasUncategorized
      ? [uncategorizedKey, rightColumnCategory]
      : [rightColumnCategory];

    gifLibraryGrid.innerHTML = displayCategories.map((category, slotIndex) => {
      const ids = Array.isArray(library[category]) ? library[category] : [];
      const rows = ids.length
        ? ids.map((id) => `
          <li draggable="true" data-gif-id="${escapeAttr(id)}" data-gif-category="${escapeAttr(category)}">
            <div class="gif-preview-wrap">
              ${renderGifPreviewCell(category, id, previewMap)}
            </div>
            <div class="gif-row-meta">
              <code>${escapeHtml(id)}</code>
              <button type="button" data-remove-id="${escapeHtml(id)}" data-remove-category="${escapeHtml(category)}">Remove</button>
            </div>
          </li>
        `).join('')
        : '<li class="empty">No GIF IDs yet</li>';

      const isPinnedUncategorizedColumn = hasUncategorized && slotIndex === 0;
      const switcherButtons = isPinnedUncategorizedColumn
        ? '<span class="gif-card-switcher-label">unassigned</span>'
        : switchableCategories.map((switchCategory) => {
            const activeClass = switchCategory === category ? ' is-active' : '';
            return `<button type="button" class="gif-card-switch-btn${activeClass}" data-switch-category="${escapeAttr(switchCategory)}" title="Switch to ${escapeAttr(switchCategory)}">${escapeHtml(compactThemeLabel(switchCategory))}</button>`;
          }).join('');

      const cardClass = isPinnedUncategorizedColumn
        ? 'gif-category-card gif-left-column'
        : 'gif-category-card gif-right-column';

      return `
        <article class="${cardClass}" data-drop-category="${escapeAttr(category)}">
          <div class="gif-card-switcher" role="group" aria-label="Theme switcher for column ${slotIndex + 1}">${switcherButtons}</div>
          <h3>${escapeHtml(category)} <span>${ids.length}</span></h3>
          <ul>${rows}</ul>
        </article>
      `;
    }).join('');

    applyPreviewPlaybackMode();
  }

  function getLibraryStats(library) {
    const categoryKeys = Object.keys(library || {});
    const totalEntries = categoryKeys.reduce((sum, category) => {
      const ids = Array.isArray(library[category]) ? library[category] : [];
      return sum + ids.length;
    }, 0);
    const uniqueCount = new Set(
      categoryKeys.flatMap((category) => Array.isArray(library[category]) ? library[category] : [])
    ).size;

    return {
      totalEntries,
      uniqueCount
    };
  }

  async function loadPreviewMap(library) {
    const previewMap = new Map();
    const categoryEntries = Object.entries(library || {}).filter(([, ids]) => Array.isArray(ids) && ids.length > 0);

    await Promise.all(categoryEntries.map(async ([category, ids]) => {
      const cleanedIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
      if (!cleanedIds.length) return;

      const params = new URLSearchParams({
        category,
        ids: cleanedIds.join(',')
      });

      const response = await fetch(`/api/hush-gifs?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const payload = await response.json().catch(() => ({}));
      const items = Array.isArray(payload && payload.items) ? payload.items : [];
      items.forEach((item) => {
        const id = String(item && item.id || '').trim();
        if (!id) return;
        previewMap.set(previewKey(category, id), item);
      });
    }));

    return previewMap;
  }

  function getLimitInfo(library, limits) {
    const computed = getLibraryStats(library);
    const maxUnique = Math.max(1, Number.parseInt(String(limits && limits.maxUniqueCount || 150), 10) || 150);
    const uniqueCount = Number.isFinite(Number(limits && limits.uniqueCount))
      ? Number(limits.uniqueCount)
      : computed.uniqueCount;
    const remaining = Number.isFinite(Number(limits && limits.remainingUniqueSlots))
      ? Number(limits.remainingUniqueSlots)
      : Math.max(0, maxUnique - uniqueCount);
    const overBy = Math.max(0, uniqueCount - maxUnique);

    return {
      maxUnique,
      uniqueCount,
      remaining,
      overBy
    };
  }

  async function loadLibrary() {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key to load the GIF library.', 'warning');
      return;
    }

    const payload = await requestJson('/api/admin/gifs', {
      method: 'GET',
      headers: {
        'x-admin-key': key
      }
    });

    const library = payload.library || {};
    renderLibrary(library, new Map());
    const previewMap = await loadPreviewMap(library).catch(() => new Map());
    renderLibrary(library, previewMap);

    const limitInfo = getLimitInfo(library, payload.limits || {});
    if (gifCapInput) {
      gifCapInput.value = String(limitInfo.maxUnique);
    }

    if (limitInfo.overBy > 0) {
      setStatus(`GIF library loaded. Unique IDs: ${limitInfo.uniqueCount}/${limitInfo.maxUnique}. Over cap by ${limitInfo.overBy}. Remove some IDs or increase cap.`, 'warning');
      return;
    }

    setStatus(`GIF library loaded. Unique IDs: ${limitInfo.uniqueCount}/${limitInfo.maxUnique}. Remaining slots: ${limitInfo.remaining}.`, 'success');
  }

  async function saveGifCap() {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    const nextCap = Number.parseInt(String(gifCapInput && gifCapInput.value || ''), 10);
    if (!Number.isFinite(nextCap) || nextCap < 1 || nextCap > 5000) {
      setStatus('Cap must be a whole number between 1 and 5000.', 'error');
      return;
    }

    const payload = await requestJson('/api/admin/gif-limits', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ maxUniqueCount: nextCap })
    });

    const limitInfo = getLimitInfo(payload.library || {}, payload.limits || {});
    if (gifCapInput) {
      gifCapInput.value = String(limitInfo.maxUnique);
    }

    if (limitInfo.overBy > 0) {
      setStatus(`Saved cap: ${limitInfo.maxUnique}. Current unique IDs: ${limitInfo.uniqueCount}. Over cap by ${limitInfo.overBy}.`, 'warning');
    } else {
      setStatus(`Saved cap: ${limitInfo.maxUnique}. Remaining slots: ${limitInfo.remaining}.`, 'success');
    }

    renderLibrary(payload.library || {}, new Map());
  }

  async function addGif() {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    const url = String(gifUrlInput && gifUrlInput.value || '').trim();
    const category = String(gifCategorySelect && gifCategorySelect.value || '').trim();
    const id = extractGifId(url);

    if (!id) {
      setStatus('Paste a valid GIPHY URL so an ID can be extracted.', 'error');
      return;
    }

    const existingPayload = await requestJson('/api/admin/gifs', {
      method: 'GET',
      headers: {
        'x-admin-key': key
      }
    });
    const existingLibrary = existingPayload.library || {};
    const idLocationMap = getGlobalGifLocationMap(existingLibrary);
    if (idLocationMap.has(id)) {
      const categoryList = Array.from(idLocationMap.get(id) || []).join(', ');
      setStatus(`${id} already exists in ${categoryList || 'library'}. Duplicate skipped.`, 'warning');
      return;
    }

    await requestJson('/api/admin/gifs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id, category })
    });

    setStoredAdminKey(key);
    setStatus(`Added ${id} to ${category}.`, 'success');
    if (gifUrlInput) gifUrlInput.value = '';
    await loadLibrary();
  }

  async function createCategory() {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    const category = String(createCategoryInput && createCategoryInput.value || '').trim();
    if (!category) {
      setStatus('Enter a theme name first.', 'warning');
      return;
    }

    await requestJson('/api/admin/gif-categories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ category })
    });

    setStatus(`Created theme: ${category}`, 'success');
    if (createCategoryInput) createCategoryInput.value = '';
    await loadLibrary();
  }

  async function deleteCategory() {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    const category = String(deleteCategorySelect && deleteCategorySelect.value || '').trim();
    if (!category) {
      setStatus('Choose a theme to delete.', 'warning');
      return;
    }

    await requestJson('/api/admin/gif-categories', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ category })
    });

    setStatus(`Deleted theme: ${category}`, 'success');
    await loadLibrary();
  }

  function parseBulkIds(rawText) {
    const tokens = String(rawText || '')
      .split(/[\n,;]+/)
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return Array.from(new Set(
      tokens
        .map((token) => extractGifId(token))
        .filter(Boolean)
    ));
  }

  function getGlobalGifLocationMap(library) {
    const out = new Map();
    Object.entries(library || {}).forEach(([category, ids]) => {
      const categoryName = String(category || '').trim();
      if (!categoryName || !Array.isArray(ids)) return;

      ids.forEach((value) => {
        const id = String(value || '').trim();
        if (!id) return;
        if (!out.has(id)) {
          out.set(id, new Set());
        }
        out.get(id).add(categoryName);
      });
    });
    return out;
  }

  async function addBulkGifs() {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    const category = String(gifCategorySelect && gifCategorySelect.value || '').trim();
    const ids = parseBulkIds(gifBulkInput && gifBulkInput.value || '');

    if (!ids.length) {
      setStatus('Paste at least one valid GIPHY URL or GIF ID.', 'error');
      return;
    }

    const existingPayload = await requestJson('/api/admin/gifs', {
      method: 'GET',
      headers: {
        'x-admin-key': key
      }
    });
    const existingLibrary = existingPayload.library || {};
    const idLocationMap = getGlobalGifLocationMap(existingLibrary);
    const idsToAdd = ids.filter((id) => !idLocationMap.has(id));
    const duplicateCount = ids.length - idsToAdd.length;

    if (!idsToAdd.length) {
      setStatus(`No new GIFs added. Skipped ${duplicateCount} duplicate ${duplicateCount === 1 ? 'ID' : 'IDs'}.`, 'warning');
      return;
    }

    const failures = [];
    for (const id of idsToAdd) {
      try {
        await requestJson('/api/admin/gifs', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ id, category })
        });
      } catch (error) {
        failures.push({ id, message: error && error.message ? error.message : 'Request failed' });
      }
    }

    setStoredAdminKey(key);
    if (failures.length) {
      const successCount = idsToAdd.length - failures.length;
      setStatus(`Imported ${successCount}/${idsToAdd.length}. Failed: ${failures.length}. Skipped duplicates: ${duplicateCount}.`, successCount > 0 ? 'warning' : 'error');
    } else {
      setStatus(`Imported ${idsToAdd.length} GIF${idsToAdd.length === 1 ? '' : 's'} into ${category}. Skipped duplicates: ${duplicateCount}.`, 'success');
    }

    if (gifBulkInput) gifBulkInput.value = '';
    await loadLibrary();
  }

  async function removeGif(id, category) {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    await requestJson('/api/admin/gifs', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ id, category })
    });

    setStatus(`Removed ${id} from ${category}.`, 'success');
    await loadLibrary();
  }

  async function moveGif(id, fromCategory, toCategory) {
    const key = getAdminKey();
    if (!key) {
      setStatus('Enter your admin key first.', 'warning');
      return;
    }

    const cleanId = String(id || '').trim();
    const from = String(fromCategory || '').trim();
    const to = String(toCategory || '').trim();
    if (!cleanId || !from || !to || from === to) {
      return;
    }

    await requestJson('/api/admin/gifs/move', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id: cleanId, fromCategory: from, toCategory: to })
    });

    setStatus(`Moved ${cleanId} from ${from} to ${to}.`, 'success');
    await loadLibrary();
  }

  function clearDropHighlights() {
    if (!gifLibraryGrid) return;
    gifLibraryGrid.querySelectorAll('.gif-category-card.is-drop-target').forEach((card) => {
      card.classList.remove('is-drop-target');
    });
  }

  if (adminKeyInput) {
    adminKeyInput.value = getStoredAdminKey();
    adminKeyInput.addEventListener('change', () => {
      const key = getAdminKey();
      if (key) setStoredAdminKey(key);
    });
  }

  if (addGifBtn) {
    addGifBtn.addEventListener('click', () => {
      addGif().catch((error) => {
        setStatus(error.message || 'Unable to add GIF.', 'error');
      });
    });
  }

  if (createCategoryBtn) {
    createCategoryBtn.addEventListener('click', () => {
      createCategory().catch((error) => {
        setStatus(error.message || 'Unable to create theme.', 'error');
      });
    });
  }

  if (deleteCategoryBtn) {
    deleteCategoryBtn.addEventListener('click', () => {
      deleteCategory().catch((error) => {
        setStatus(error.message || 'Unable to delete theme.', 'error');
      });
    });
  }

  if (saveGifCapBtn) {
    saveGifCapBtn.addEventListener('click', () => {
      saveGifCap().catch((error) => {
        setStatus(error.message || 'Unable to save GIF cap.', 'error');
      });
    });
  }

  if (addBulkGifBtn) {
    addBulkGifBtn.addEventListener('click', () => {
      addBulkGifs().catch((error) => {
        setStatus(error.message || 'Unable to import GIF batch.', 'error');
      });
    });
  }

  if (refreshLibraryBtn) {
    refreshLibraryBtn.addEventListener('click', () => {
      loadLibrary().catch((error) => {
        setStatus(error.message || 'Unable to load library.', 'error');
      });
    });
  }

  if (playAllPreviewsBtn) {
    playAllPreviewsBtn.addEventListener('click', () => {
      setPreviewPlaybackMode('play');
    });
  }

  if (pauseAllPreviewsBtn) {
    pauseAllPreviewsBtn.addEventListener('click', () => {
      setPreviewPlaybackMode('pause');
    });
  }

  updatePreviewPlaybackButtons();

  if (gifLibraryGrid) {
    gifLibraryGrid.addEventListener('dragstart', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest('li[data-gif-id][data-gif-category]');
      if (!(row instanceof HTMLElement)) return;

      const id = String(row.getAttribute('data-gif-id') || '').trim();
      const category = String(row.getAttribute('data-gif-category') || '').trim();
      if (!id || !category) return;

      draggedGifPayload = { id, fromCategory: category };
      row.classList.add('is-dragging');

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(draggedGifPayload));
      }
    });

    gifLibraryGrid.addEventListener('dragend', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const row = target.closest('li[data-gif-id][data-gif-category]');
        if (row) row.classList.remove('is-dragging');
      }
      draggedGifPayload = null;
      clearDropHighlights();
    });

    gifLibraryGrid.addEventListener('dragover', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const card = target.closest('.gif-category-card[data-drop-category]');
      if (!(card instanceof HTMLElement)) return;

      event.preventDefault();
      clearDropHighlights();
      card.classList.add('is-drop-target');
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    });

    gifLibraryGrid.addEventListener('drop', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const card = target.closest('.gif-category-card[data-drop-category]');
      if (!(card instanceof HTMLElement)) return;

      event.preventDefault();
      const toCategory = String(card.getAttribute('data-drop-category') || '').trim();
      const payload = draggedGifPayload;
      draggedGifPayload = null;
      clearDropHighlights();

      if (!payload || !payload.id || !payload.fromCategory || !toCategory) return;
      if (payload.fromCategory === toCategory) return;

      moveGif(payload.id, payload.fromCategory, toCategory).catch((error) => {
        setStatus(error.message || 'Unable to move GIF.', 'error');
      });
    });

    gifLibraryGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const switchButton = target.closest('button[data-switch-category]');
      if (switchButton instanceof HTMLElement) {
        const nextCategory = String(switchButton.getAttribute('data-switch-category') || '').trim();
        if (nextCategory) {
          rightColumnCategory = nextCategory;
          renderLibrary(lastRenderedLibrary, lastPreviewMap);
        }
        return;
      }

      const button = target.closest('button[data-remove-id][data-remove-category]');
      if (!(button instanceof HTMLElement)) return;
      const id = String(button.getAttribute('data-remove-id') || '').trim();
      const category = String(button.getAttribute('data-remove-category') || '').trim();
      if (!id || !category) return;
      removeGif(id, category).catch((error) => {
        setStatus(error.message || 'Unable to remove GIF.', 'error');
      });
    });
  }

  loadLibrary().catch((error) => {
    setStatus(error.message || 'Unable to load GIF library.', 'error');
  });
})();

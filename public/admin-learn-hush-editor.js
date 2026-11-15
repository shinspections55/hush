(function () {
  'use strict';
  const loadButton = document.getElementById('learnEditorLoad');
  const form = document.getElementById('learnEditorForm');
  const fields = document.getElementById('learnEditorFields');
  const status = document.getElementById('learnEditorStatus');
  if (!loadButton || !form || !fields || !status) return;
  let baseRevision = '';
  let originalContent = {};
  let dirty = false;

  async function getJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  loadButton.addEventListener('click', async () => {
    if (dirty && !window.confirm('Discard your unsaved guide edits and reload?')) return;
    loadButton.disabled = true;
    fields.disabled = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = 'Loading guide...';
    try {
      const [templateResponse, published] = await Promise.all([
        fetch('/learn-hush.html', { cache: 'no-store' }),
        getJson('/api/public/learn-hush', { cache: 'no-store' })
      ]);
      if (!templateResponse.ok) throw new Error(`Guide template: HTTP ${templateResponse.status}`);
      const template = new DOMParser().parseFromString(await templateResponse.text(), 'text/html');
      const nodes = template.querySelectorAll('[data-learn-key]');
      if (!nodes.length) throw new Error('Guide template has no editable text.');
      fields.replaceChildren();
      originalContent = published.content;
      baseRevision = published.revision;
      let group = 'Page labels';
      let subsection = '';
      for (const node of nodes) {
        const key = node.dataset.learnKey;
        const clone = node.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        const defaultText = clone.textContent.trim();
        const value = Object.prototype.hasOwnProperty.call(originalContent, key) ? originalContent[key] : defaultText;
        if (node.tagName === 'H2') {
          group = value;
          subsection = '';
        } else if (node.tagName === 'H3') {
          subsection = value;
        }
        const label = document.createElement('label');
        label.style.cssText = 'display:block;margin:12px 0;';
        const caption = document.createElement('span');
        caption.textContent = `${group}${subsection ? ` / ${subsection}` : ''} - ${node.tagName === 'LI' ? 'List item' : node.tagName === 'P' ? 'Paragraph' : 'Heading / label'} (${key})`;
        const input = document.createElement('textarea');
        input.name = key;
        input.value = value;
        input.dataset.defaultText = defaultText;
        input.maxLength = 4000;
        input.rows = node.tagName === 'P' ? 4 : 2;
        input.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin-top:4px;resize:vertical;';
        label.append(caption, input);
        fields.append(label);
      }
      form.hidden = false;
      dirty = false;
      status.textContent = 'Guide loaded. Edit the fields below and save.';
    } catch (error) {
      console.error('[learn-editor] Load failed:', error);
      status.textContent = `Unable to load guide: ${error.message}`;
    } finally {
      loadButton.disabled = false;
      fields.disabled = false;
      submit.disabled = false;
    }
  });

  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const keyInput = document.getElementById('adminKeyInput');
    let key = String(keyInput && keyInput.value || '').trim();
    try {
      if (!key) key = String(sessionStorage.getItem('adminApiKey') || '').trim();
    } catch (error) {
      console.warn('[learn-editor] Could not read admin session:', error);
    }
    if (!key) {
      status.textContent = 'Enter your admin key above and connect before saving.';
      return;
    }
    const content = { ...originalContent };
    fields.querySelectorAll('textarea').forEach(input => {
      if (input.value === input.dataset.defaultText) delete content[input.name];
      else content[input.name] = input.value;
    });
    const submit = form.querySelector('button[type="submit"]');
    fields.disabled = true;
    submit.disabled = true;
    loadButton.disabled = true;
    status.textContent = 'Saving guide...';
    try {
      const result = await getJson('/api/admin/learn-hush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ content, baseRevision })
      });
      baseRevision = result.revision;
      originalContent = content;
      dirty = false;
      status.textContent = 'Guide saved. Changes are visible to visitors.';
    } catch (error) {
      console.error('[learn-editor] Save failed:', error);
      status.textContent = `Unable to save guide: ${error.message}`;
    } finally {
      fields.disabled = false;
      submit.disabled = false;
      loadButton.disabled = false;
    }
  });
  window.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  });
})();

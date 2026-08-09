document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('joinPrivateForm');
  const codeInput = form ? form.querySelector('input[name="code"]') : null;
  const user = sessionStorage.getItem('username');
  if(!user){ window.location.href='index.html'; return; }
  if (codeInput) {
    codeInput.setAttribute('autocapitalize', 'characters');
    codeInput.setAttribute('autocomplete', 'off');
    codeInput.setAttribute('spellcheck', 'false');
    codeInput.style.textTransform = 'uppercase';
    codeInput.addEventListener('input', () => {
      const start = codeInput.selectionStart;
      const end = codeInput.selectionEnd;
      codeInput.value = String(codeInput.value || '').toUpperCase();
      try {
        if (typeof start === 'number' && typeof end === 'number') {
          codeInput.setSelectionRange(start, end);
        }
      } catch (_error) {
        // ignore selection restore issues on unsupported browsers
      }
    });
  }
  // If an invite link like /ABC123 was used, location.pathname will contain the code
  const pathCode = (function(){
    const p = location.pathname.replace(/^\//,'').replace(/\/.*/,'');
    // Ignore if it's an HTML file or too short to be a code
    if(!p || p.length < 3 || p.endsWith('.html')) return null;
    return String(p).toUpperCase();
  })();

  async function attemptJoin(code){
    code = String(code || '').trim().toUpperCase();
    // Prefer server-side authoritative join if socket available
    try{
      if(window.io){
        const socket = io({ reconnection: false });
        return new Promise((resolve)=>{
          socket.emit('requestJoin', code, user, (resp)=>{
            if(!resp || !resp.ok){
              if(resp && resp.reason === 'capacity') alert('Draft is full (capacity reached)');
              else if(resp && resp.reason === 'closed') alert('This draft has been closed by the host');
              else alert('Could not join the draft');
              resolve(false);
              return;
            }
            // merge server draft into localStorage
            const draftsRaw = localStorage.getItem('drafts');
            const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
            drafts[code] = resp.draft;
            localStorage.setItem('drafts', JSON.stringify(drafts));
            sessionStorage.setItem('currentDraft', code);
            window.location.href = 'lobby-private.html';
            resolve(true);
          });
        });
      }
    }catch(e){ console.warn('socket join failed, falling back to local join', e); }
    // fallback to client-side join
    const draftsRaw = localStorage.getItem('drafts');
    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
    if(!drafts[code]) drafts[code] = { members: [] };
    const capacity = drafts[code].capacity ? drafts[code].capacity : null;
    if(capacity && drafts[code].members.length > capacity && !drafts[code].members.includes(user)){
      alert('Draft is full (capacity reached)');
      return false;
    }
    if(!drafts[code].members.includes(user)) drafts[code].members.push(user);
    localStorage.setItem('drafts', JSON.stringify(drafts));
  sessionStorage.setItem('currentDraft', code);
  window.location.href = 'lobby-private.html';
    return true;
  }

  if(pathCode){
    // auto attempt join for invite links
    const ok = confirm('Join draft ' + pathCode + '?');
    if(ok) attemptJoin(pathCode);
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = new FormData(form);
    const code = String(data.get('code') || '').trim().toUpperCase();
    if(!code || code.length < 3){ alert('Enter a valid draft code'); return; }
    attemptJoin(code);
  });
});

document.addEventListener('DOMContentLoaded', ()=>{
  try{ if(typeof window.initializeLobby === 'function'){ window.initializeLobby({ pageType:'public' }); } else { console.error('initializeLobby not found'); } }catch(e){ console.error(e); }
});

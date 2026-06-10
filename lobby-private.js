// Check if DOM is already loaded, if so run immediately, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrivateLobby);
} else {
  initPrivateLobby();
}

function initPrivateLobby() {
  try{ 
    if(typeof window.initializeLobby === 'function'){ 
      window.initializeLobby({ pageType:'private' }); 
    } else { 
      console.error('initializeLobby not found'); 
    } 
  }catch(e){ 
    console.error(e); 
  }
}

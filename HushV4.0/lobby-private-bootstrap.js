(function () {
  var s = document.createElement('script');
  s.src = '/socket.io/socket.io.js';
  s.onload = function () {
    console.log('âœ“ Loaded socket.io from server');
    loadLobbyScripts();
  };
  s.onerror = function () {
    console.warn('Local socket.io not available, falling back to CDN');
    var c = document.createElement('script');
    c.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    c.onload = function () {
      console.log('âœ“ Loaded socket.io from CDN');
      loadLobbyScripts();
    };
    c.onerror = function () {
      console.error('âœ— Failed to load socket.io from CDN');
    };
    document.head.appendChild(c);
  };
  document.head.appendChild(s);

  function loadLobbyScripts() {
    console.log('Loading lobby scripts...');
    var lobby = document.createElement('script');
    lobby.async = false;
    lobby.src = 'lobby.js?v=20260616a';
    lobby.onload = function () {
      console.log('âœ“ Loaded lobby.js');
    };
    document.head.appendChild(lobby);
  }
})();

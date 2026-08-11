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
    lobby.src = 'lobby.js?v=20260805l';
    lobby.onload = function () {
      console.log('âœ“ Loaded lobby.js');
      var lobbyPrivate = document.createElement('script');
      lobbyPrivate.async = false;
      lobbyPrivate.src = 'lobby-private.js?v=20260805f';
      lobbyPrivate.onload = function () {
        console.log('âœ“ Loaded lobby-private.js');
      };
      document.head.appendChild(lobbyPrivate);
    };
    document.head.appendChild(lobby);
  }
})();

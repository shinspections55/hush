(function () {
  var s = document.createElement('script');
  s.src = '/socket.io/socket.io.js';
  s.onload = function () {
    console.debug('Loaded socket.io from server');
  };
  s.onerror = function () {
    console.warn('Local socket.io not available, falling back to CDN');
    var c = document.createElement('script');
    c.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    c.onload = function () {
      console.debug('Loaded socket.io from CDN');
    };
    document.head.appendChild(c);
  };
  document.head.appendChild(s);
})();

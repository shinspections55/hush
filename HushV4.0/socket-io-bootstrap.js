(function () {
  var script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.async = false;
  script.onerror = function () {
    var fallback = document.createElement('script');
    fallback.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    fallback.async = false;
    document.head.appendChild(fallback);
  };
  document.head.appendChild(script);
})();

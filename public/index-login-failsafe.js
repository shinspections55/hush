window.__hushLoginHandlerAttached = false;
document.addEventListener('DOMContentLoaded', function () {
  var loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', function (event) {
    if (window.__hushLoginHandlerAttached) return;
    event.preventDefault();
    alert('Login is unavailable right now because required scripts did not load. Please refresh and try again on a stable network.');
  });
});

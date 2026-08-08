document.addEventListener('DOMContentLoaded', () => {
  window.handleAdminSessionUnauthorized = function handleAdminSessionUnauthorized() {
    // Session auth was removed; keep this as a no-op for older callers.
  };
});

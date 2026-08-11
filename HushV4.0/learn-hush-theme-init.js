document.addEventListener('DOMContentLoaded', () => {
  const username = sessionStorage.getItem('username');
  if (typeof getUserThemePreference === 'function' && username) {
    document.body.classList.toggle('dashboard-light-mode', getUserThemePreference(username, 'dark') === 'light');
  }
});

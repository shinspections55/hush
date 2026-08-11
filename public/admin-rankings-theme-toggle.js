document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  function setThemeToggleIcon(theme) {
    const isLight = theme === 'light';
    themeToggleBtn.innerHTML = isLight ? 'Mode: &#9728;' : 'Mode: &#127769;';
    themeToggleBtn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    themeToggleBtn.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    themeToggleBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
  }

  function updateThemeButton() {
    const htmlElement = document.documentElement;
    const isDarkMode = !htmlElement.classList.contains('light-mode');
    setThemeToggleIcon(isDarkMode ? 'dark' : 'light');
  }

  updateThemeButton();

  themeToggleBtn.addEventListener('click', () => {
    const htmlElement = document.documentElement;
    const isDarkMode = !htmlElement.classList.contains('light-mode');
    const username = String(
      sessionStorage.getItem('username') ||
      localStorage.getItem('lastSignedInUsername') ||
      ''
    ).trim();

    if (isDarkMode) {
      if (typeof setUserThemePreference === 'function' && username) {
        setUserThemePreference(username, 'light');
      }
      localStorage.setItem('dashboardTheme', 'light');
    } else {
      if (typeof setUserThemePreference === 'function' && username) {
        setUserThemePreference(username, 'dark');
      }
      localStorage.setItem('dashboardTheme', 'dark');
    }

    if (typeof applySiteThemePreference === 'function') {
      applySiteThemePreference(isDarkMode ? 'light' : 'dark');
    }
    if (typeof initializePageTheme === 'function') {
      initializePageTheme();
    }
    updateThemeButton();
  });

  window.addEventListener('storage', () => {
    updateThemeButton();
  });
});

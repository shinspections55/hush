document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('resetStatus');
  if (!status) return;
  status.textContent = 'Use the email link from Firebase to complete your password reset.';
});

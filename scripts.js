import {
  browserLocalPersistence,
  browserSessionPersistence,
  formatAuthError,
  requireFirebaseAuth,
  setPersistence,
  signInWithEmailAndPassword,
  syncSessionFromUser
} from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', ()=>{
  const signup = document.getElementById('signupForm');
  const login = document.getElementById('loginForm');
  const rememberCheckbox = document.getElementById('rememberPassword');

  const rememberedEmail = localStorage.getItem('rememberedEmail') || localStorage.getItem('lastSignedInEmail') || '';
  if (login && rememberedEmail) {
    const emailInput = login.querySelector('input[name="email"]');
    if (emailInput) emailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  function onSignup(e){
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const username = data.get('username');
    if(!username || username.length < 3){
      alert('Signup: Please enter a username with at least 3 characters.');
      return;
    }
    alert('Signup successful for ' + username + ' (local stub)');
    form.reset();
  }

  function onLogin(e){
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const rememberPassword = !!(rememberCheckbox && rememberCheckbox.checked);
    if(!email || !email.includes('@')){
      alert('Login: Please enter a valid email address.');
      return;
    }

    (async ()=>{
      try{
        const auth = requireFirebaseAuth();
        await setPersistence(auth, rememberPassword ? browserLocalPersistence : browserSessionPersistence);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = syncSessionFromUser(credential.user);

        if (rememberPassword) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        if (!sessionStorage.getItem('username') && profile && profile.username) {
          sessionStorage.setItem('username', profile.username);
        }
        window.location.href = 'dashboard.html';
      }catch(err){
        console.error(err);
        alert(formatAuthError(err, 'Login failed.'));
      }
    })();
  }

  if (signup) signup.addEventListener('submit', onSignup);
  if (login) login.addEventListener('submit', onLogin);
});

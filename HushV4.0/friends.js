import {
  auth,
  clearAuthSession,
  requireCurrentUser,
  signOut,
  syncSessionFromUser
} from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const friendUsernameInput = document.getElementById('friendUsernameInput');
  const addFriendBtn = document.getElementById('addFriendBtn');
  const friendSuggestions = document.getElementById('friendSuggestions');
  const friendsStatus = document.getElementById('friendsStatus');
  const viewSendBtn = document.getElementById('viewSendBtn');
  const viewIncomingBtn = document.getElementById('viewIncomingBtn');
  const viewPendingBtn = document.getElementById('viewPendingBtn');
  const pendingTabNotice = document.getElementById('pendingTabNotice');
  const viewFriendsBtn = document.getElementById('viewFriendsBtn');
  const sendRequestView = document.getElementById('sendRequestView');
  const incomingView = document.getElementById('incomingView');
  const pendingView = document.getElementById('pendingView');
  const friendsView = document.getElementById('friendsView');
  const incomingRequestsList = document.getElementById('incomingRequestsList');
  const outgoingRequestsList = document.getElementById('outgoingRequestsList');
  const friendsList = document.getElementById('friendsList');
  const chatColumnTitle = document.getElementById('chatColumnTitle');
  const chatColumnSubtitle = document.getElementById('chatColumnSubtitle');
  const chatMessages = document.getElementById('chatMessages');
  const chatMessageInput = document.getElementById('chatMessageInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const friendsLogoutBtn = document.getElementById('friendsLogoutBtn');

  let username = '';
  let userEmail = '';
  let userFullname = '';
  let userPhone = '';
  let autoRefreshTimer = null;
  let suggestionAbortController = null;
  let latestIncomingRequests = [];
  let latestOutgoingRequests = [];
  let latestFriends = [];
  let activeChatFriend = null;
  let activeView = 'send';
  const FRIENDS_API_BASE = `${window.location.origin}/api/auth/friends`;

  function friendsApiUrl(path = '', params) {
    const base = `${FRIENDS_API_BASE}${path}`;
    if (!params) return base;
    const search = new URLSearchParams(params).toString();
    return search ? `${base}?${search}` : base;
  }

  function requesterProfileParams(extra = {}) {
    return {
      username,
      email: userEmail,
      fullname: userFullname,
      phone: userPhone,
      ...extra
    };
  }

  try {
    const currentUser = await requireCurrentUser();
    const profile = syncSessionFromUser(currentUser);
    username = profile && profile.username ? String(profile.username).trim() : '';
    userEmail = profile && profile.email ? String(profile.email).trim() : '';
    userFullname = profile && profile.fullname ? String(profile.fullname).trim() : '';
    userPhone = profile && profile.phone ? String(profile.phone).trim() : '';
  } catch (_error) {
    clearAuthSession();
    window.location.href = 'index.html';
    return;
  }

  if (!username) {
    window.location.href = 'index.html';
    return;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function parseJsonResponse(response, fallbackMessage) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();
    let payload = null;

    if (contentType.includes('application/json')) {
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        payload = null;
      }
    }

    if (!payload && rawText && rawText.trim().startsWith('{')) {
      try {
        payload = JSON.parse(rawText);
      } catch (_error) {
        payload = null;
      }
    }

    if (!response.ok || !payload || payload.ok === false) {
      const serverMessage = payload && payload.error ? payload.error : '';
      let detail = '';
      if (!payload && rawText) {
        detail = String(rawText).replace(/\s+/g, ' ').trim().slice(0, 120);
      }
      const baseMessage = serverMessage || fallbackMessage || 'Request failed';
      const debugSuffix = ` (HTTP ${response.status}${contentType ? `, ${contentType}` : ''}${detail ? `, ${detail}` : ''})`;
      const error = new Error(`${baseMessage}${debugSuffix}`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function setStatus(message, isError = false) {
    if (!friendsStatus) return;
    if (!message) {
      friendsStatus.textContent = '';
      friendsStatus.classList.add('hidden');
      friendsStatus.classList.remove('is-error');
      return;
    }

    friendsStatus.textContent = message;
    friendsStatus.classList.remove('hidden');
    friendsStatus.classList.toggle('is-error', !!isError);
  }

  function updatePendingNotice(count) {
    if (!pendingTabNotice) return;
    const numeric = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    if (numeric <= 0) {
      pendingTabNotice.classList.add('hidden');
      pendingTabNotice.textContent = '0';
      return;
    }
    pendingTabNotice.classList.remove('hidden');
    pendingTabNotice.textContent = numeric > 99 ? '99+' : String(numeric);
  }

  function clearChatPanel(message = 'Select a friend from your friends list to start chatting.') {
    if (chatColumnTitle) chatColumnTitle.textContent = 'Messages';
    if (chatColumnSubtitle) chatColumnSubtitle.textContent = message;
    if (chatMessages) {
      chatMessages.innerHTML = '<p class="friends-chat-empty">No messages yet.</p>';
    }
    if (chatMessageInput) {
      chatMessageInput.value = '';
      chatMessageInput.disabled = true;
    }
    if (chatSendBtn) chatSendBtn.disabled = true;
  }

  function renderChatMessages(messages) {
    if (!chatMessages) return;
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) {
      chatMessages.innerHTML = '<p class="friends-chat-empty">No messages yet.</p>';
      return;
    }

    const myKey = String(username || '').trim().toLowerCase();
    chatMessages.innerHTML = list.map((entry) => {
      const from = String(entry && entry.from || '').trim().toLowerCase();
      const text = escapeHtml(entry && entry.text || '');
      const ts = Number(entry && entry.createdAt || 0);
      const stamp = ts ? new Date(ts).toLocaleString() : '';
      const own = from === myKey;
      return `
        <div class="friends-chat-bubble ${own ? 'is-own' : 'is-peer'}">
          <p>${text}</p>
          <span>${escapeHtml(stamp)}</span>
        </div>
      `;
    }).join('');

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function loadChatThread() {
    if (!activeChatFriend) {
      clearChatPanel();
      return;
    }

    try {
      const response = await fetch(
        friendsApiUrl('/messages', requesterProfileParams({ friendUsername: activeChatFriend.usernameKey || activeChatFriend.username })),
        { cache: 'no-store' }
      );
      const payload = await parseJsonResponse(response, 'Unable to load messages');
      const label = String(
        (payload.friend && (payload.friend.fullname || payload.friend.username)) ||
        activeChatFriend.fullname ||
        activeChatFriend.username ||
        activeChatFriend.usernameKey ||
        'Friend'
      ).trim();
      if (chatColumnTitle) chatColumnTitle.textContent = `Chat with ${label}`;
      if (chatColumnSubtitle) chatColumnSubtitle.textContent = 'Messages are synced to your account.';
      if (chatMessageInput) chatMessageInput.disabled = false;
      if (chatSendBtn) chatSendBtn.disabled = false;
      renderChatMessages(payload.messages || []);
    } catch (error) {
      clearChatPanel('Unable to load this conversation right now.');
      setStatus(error.message || 'Unable to load messages.', true);
    }
  }

  async function sendChatMessage() {
    if (!activeChatFriend || !chatMessageInput) return;
    const text = String(chatMessageInput.value || '').trim();
    if (!text) return;

    if (chatSendBtn) chatSendBtn.disabled = true;
    if (chatMessageInput) chatMessageInput.disabled = true;
    try {
      const response = await fetch(friendsApiUrl('/messages/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requesterProfileParams({
          friendUsername: activeChatFriend.usernameKey || activeChatFriend.username,
          text
        }))
      });
      const payload = await parseJsonResponse(response, 'Unable to send message');
      chatMessageInput.value = '';
      renderChatMessages(payload.messages || []);
    } catch (error) {
      setStatus(error.message || 'Unable to send message.', true);
    } finally {
      if (chatMessageInput) chatMessageInput.disabled = false;
      if (chatSendBtn) chatSendBtn.disabled = false;
      if (chatMessageInput) chatMessageInput.focus();
    }
  }

  function selectChatFriend(friendUsernameRaw) {
    const friendKey = String(friendUsernameRaw || '').trim().toLowerCase();
    if (!friendKey) return;
    const friend = latestFriends.find((entry) => {
      const key = String(entry && (entry.usernameKey || entry.username) || '').trim().toLowerCase();
      return key === friendKey;
    });
    if (!friend) {
      setStatus('Select a friend from your current friends list to message them.', true);
      return;
    }

    activeChatFriend = {
      username: String(friend.username || '').trim(),
      usernameKey: String(friend.usernameKey || friend.username || '').trim(),
      fullname: String(friend.fullname || '').trim()
    };
    switchView('friends');
    loadChatThread();
  }

  function switchView(viewKey) {
    activeView = viewKey;
    const isSend = viewKey === 'send';
    const isIncoming = viewKey === 'incoming';
    const isPending = viewKey === 'pending';
    const isFriends = viewKey === 'friends';

    if (sendRequestView) sendRequestView.classList.toggle('hidden', !isSend);
    if (incomingView) incomingView.classList.toggle('hidden', !isIncoming);
    if (pendingView) pendingView.classList.toggle('hidden', !isPending);
    if (friendsView) friendsView.classList.toggle('hidden', !isFriends);

    if (viewSendBtn) viewSendBtn.classList.toggle('is-active', isSend);
    if (viewIncomingBtn) viewIncomingBtn.classList.toggle('is-active', isIncoming);
    if (viewPendingBtn) viewPendingBtn.classList.toggle('is-active', isPending);
    if (viewFriendsBtn) viewFriendsBtn.classList.toggle('is-active', isFriends);
  }

  function setSendButtonState(state) {
    if (!addFriendBtn) return;

    if (state === 'sending') {
      addFriendBtn.disabled = true;
      addFriendBtn.textContent = 'Sending...';
      addFriendBtn.classList.add('is-sending');
      addFriendBtn.classList.remove('is-sent');
      return;
    }

    if (state === 'sent') {
      addFriendBtn.disabled = false;
      addFriendBtn.textContent = 'Request Sent';
      addFriendBtn.classList.remove('is-sending');
      addFriendBtn.classList.add('is-sent');
      setTimeout(() => {
        if (!addFriendBtn) return;
        addFriendBtn.textContent = 'Send Request';
        addFriendBtn.classList.remove('is-sent');
      }, 1500);
      return;
    }

    addFriendBtn.disabled = false;
    addFriendBtn.textContent = 'Send Request';
    addFriendBtn.classList.remove('is-sending');
    addFriendBtn.classList.remove('is-sent');
  }

  function hideSuggestions() {
    if (!friendSuggestions) return;
    friendSuggestions.classList.add('hidden');
    friendSuggestions.innerHTML = '';
  }

  function renderSuggestions(results) {
    if (!friendSuggestions) return;
    const list = Array.isArray(results) ? results : [];
    if (!list.length) {
      hideSuggestions();
      return;
    }

    friendSuggestions.innerHTML = list.map((entry) => {
      const usernameText = escapeHtml(entry.username || entry.usernameKey || '');
      const nameText = escapeHtml(entry.fullname || entry.username || '');
      return `
        <li class="friend-suggestion-item" data-username="${usernameText}">
          <span class="friend-suggestion-name">${nameText}</span>
          <span class="friend-suggestion-username">@${usernameText}</span>
        </li>
      `;
    }).join('');

    friendSuggestions.classList.remove('hidden');
    friendSuggestions.querySelectorAll('.friend-suggestion-item').forEach((item) => {
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const selectedUsername = String(item.dataset.username || '').trim();
        if (!selectedUsername || !friendUsernameInput) return;
        friendUsernameInput.value = selectedUsername;
        hideSuggestions();
      });
    });
  }

  async function loadUsernameSuggestions(query) {
    const normalizedQuery = String(query || '').trim();
    if (normalizedQuery.length < 1) {
      hideSuggestions();
      return;
    }

    if (suggestionAbortController) {
      suggestionAbortController.abort();
    }
    suggestionAbortController = new AbortController();

    try {
      const response = await fetch(
        friendsApiUrl('/search', requesterProfileParams({ query: normalizedQuery })),
        { signal: suggestionAbortController.signal, cache: 'no-store' }
      );
      const payload = await parseJsonResponse(response, 'Unable to search users');
      renderSuggestions(payload.results || []);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      hideSuggestions();
    }
  }

  function renderIncomingRequests(requests) {
    if (!incomingRequestsList) return;
    latestIncomingRequests = Array.isArray(requests) ? requests : [];
    const list = latestIncomingRequests;

    if (!list.length) {
      incomingRequestsList.innerHTML = '<li class="friends-empty-card">No incoming requests.</li>';
      return;
    }

    incomingRequestsList.innerHTML = list.map((entry) => {
      const friendUsername = escapeHtml(entry.username || entry.usernameKey || '');
      return `
        <li class="friends-card-item">
          <p class="friends-request-line">${friendUsername} has sent you a friend request.</p>
          <div class="friends-action-buttons">
            <button type="button" class="friend-accept-btn" data-friend="${friendUsername}">Accept</button>
            <button type="button" class="friend-decline-btn" data-friend="${friendUsername}">Decline</button>
          </div>
        </li>
      `;
    }).join('');
  }

  function renderOutgoingRequests(requests) {
    if (!outgoingRequestsList) return;
    latestOutgoingRequests = Array.isArray(requests) ? requests : [];
    updatePendingNotice(latestOutgoingRequests.length);
    const list = latestOutgoingRequests;

    if (!list.length) {
      outgoingRequestsList.innerHTML = '<li class="friends-empty-card">No pending requests.</li>';
      return;
    }

    outgoingRequestsList.innerHTML = list.map((entry) => {
      const friendUsername = escapeHtml(entry.username || entry.usernameKey || '');
      return `
        <li class="friends-card-item">
          <p class="friends-request-line">Pending friend request for ${friendUsername}.</p>
          <div class="friends-action-buttons">
            <button type="button" class="friend-cancel-btn" data-friend="${friendUsername}">Cancel</button>
          </div>
        </li>
      `;
    }).join('');
  }

  function renderFriends(friends) {
    if (!friendsList) return;
    latestFriends = Array.isArray(friends) ? friends : [];
    const list = latestFriends;

    if (!list.length) {
      friendsList.innerHTML = '<li class="friends-empty-card">No friends added yet.</li>';
      return;
    }

    friendsList.innerHTML = list.map((friend) => {
      const friendUsername = escapeHtml(friend.username || friend.usernameKey || '');
      const friendName = escapeHtml(friend.fullname || friendUsername);
      return `
        <li class="friends-card-item">
          <div class="friends-card-copy">
            <p class="friends-card-name">${friendName}</p>
            <p class="friends-card-username">@${friendUsername}</p>
          </div>
          <div class="friends-action-buttons">
            <button type="button" class="friend-message-btn" data-friend="${friendUsername}">Send Message</button>
            <button type="button" class="friend-remove-btn" data-friend="${friendUsername}">Remove</button>
          </div>
        </li>
      `;
    }).join('');
  }

  function renderState(payload) {
    renderFriends(payload.friends || []);
    renderIncomingRequests(payload.incomingRequests || []);
    renderOutgoingRequests(payload.outgoingRequests || []);
  }

  function bindActionButtons() {
    if (friendsList) {
      friendsList.querySelectorAll('.friend-message-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const friendUsername = String(button.dataset.friend || '').trim();
          if (!friendUsername) return;
          selectChatFriend(friendUsername);
        });
      });

      friendsList.querySelectorAll('.friend-remove-btn').forEach((button) => {
        button.addEventListener('click', async () => {
          const friendUsername = String(button.dataset.friend || '').trim();
          if (!friendUsername) return;
          try {
            const response = await fetch(friendsApiUrl('/remove'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requesterProfileParams({ friendUsername }))
            });
            const payload = await parseJsonResponse(response, 'Unable to remove friend');
            renderState(payload);
            bindActionButtons();
            setStatus(`Removed @${friendUsername}.`);
          } catch (error) {
            setStatus(error.message || 'Unable to remove friend.', true);
          }
        });
      });
    }

    if (incomingRequestsList) {
      incomingRequestsList.querySelectorAll('.friend-accept-btn').forEach((button) => {
        button.addEventListener('click', async () => {
          const friendUsername = String(button.dataset.friend || '').trim();
          if (!friendUsername) return;
          try {
            const response = await fetch(friendsApiUrl('/accept'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requesterProfileParams({ friendUsername }))
            });
            const payload = await parseJsonResponse(response, 'Unable to accept request');
            renderState(payload);
            bindActionButtons();
            setStatus(`Accepted @${friendUsername}.`);
          } catch (error) {
            setStatus(error.message || 'Unable to accept request.', true);
          }
        });
      });

      incomingRequestsList.querySelectorAll('.friend-decline-btn').forEach((button) => {
        button.addEventListener('click', async () => {
          const friendUsername = String(button.dataset.friend || '').trim();
          if (!friendUsername) return;
          try {
            const response = await fetch(friendsApiUrl('/decline'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requesterProfileParams({ friendUsername }))
            });
            const payload = await parseJsonResponse(response, 'Unable to decline request');
            renderState(payload);
            bindActionButtons();
            setStatus(`Declined @${friendUsername}.`);
          } catch (error) {
            setStatus(error.message || 'Unable to decline request.', true);
          }
        });
      });
    }

    if (outgoingRequestsList) {
      outgoingRequestsList.querySelectorAll('.friend-cancel-btn').forEach((button) => {
        button.addEventListener('click', async () => {
          const friendUsername = String(button.dataset.friend || '').trim();
          if (!friendUsername) return;
          try {
            const response = await fetch(friendsApiUrl('/decline'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requesterProfileParams({ friendUsername }))
            });
            const payload = await parseJsonResponse(response, 'Unable to cancel request');
            renderState(payload);
            bindActionButtons();
            setStatus(`Canceled request to @${friendUsername}.`);
          } catch (error) {
            setStatus(error.message || 'Unable to cancel request.', true);
          }
        });
      });
    }
  }

  async function loadFriends(options = {}) {
    const silent = Boolean(options && options.silent);
    if (!silent) setStatus('Loading friends...');

    try {
      const response = await fetch(
        friendsApiUrl('', requesterProfileParams()),
        { cache: 'no-store' }
      );
      const payload = await parseJsonResponse(response, 'Unable to load friends');
      renderState(payload);
      bindActionButtons();
      if (!silent) setStatus('');
    } catch (error) {
      if (!silent) {
        renderState({ friends: [], incomingRequests: [], outgoingRequests: [] });
        setStatus(error.message || 'Unable to load friends.', true);
      }
    }
  }

  async function addFriend() {
    const friendUsername = String(friendUsernameInput && friendUsernameInput.value || '').trim();
    if (!friendUsername) {
      setStatus('Enter a username first.', true);
      return;
    }

    setStatus('Sending request...');
    setSendButtonState('sending');

    try {
      let payload = null;
      try {
        const response = await fetch(friendsApiUrl('/request'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requesterProfileParams({ friendUsername }))
        });
        payload = await parseJsonResponse(response, 'Unable to send friend request');
      } catch (primaryError) {
        if (primaryError && (primaryError.status === 404 || primaryError.status === 405)) {
          const fallbackResponse = await fetch(friendsApiUrl('/add'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requesterProfileParams({ friendUsername }))
          });
          payload = await parseJsonResponse(fallbackResponse, 'Unable to send friend request');
        } else {
          throw primaryError;
        }
      }

      renderState(payload);
      bindActionButtons();
      if (friendUsernameInput) friendUsernameInput.value = '';
      hideSuggestions();
      setStatus(payload && payload.message ? String(payload.message) : `Request sent to @${friendUsername}.`);
      setSendButtonState('sent');
    } catch (error) {
      setStatus(error.message || 'Unable to send friend request.', true);
      setSendButtonState('idle');
    }
  }

  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', addFriend);
  }

  setSendButtonState('idle');

  if (friendUsernameInput) {
    friendUsernameInput.addEventListener('input', () => {
      loadUsernameSuggestions(friendUsernameInput.value);
    });

    friendUsernameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addFriend();
        return;
      }
      if (event.key === 'Escape') hideSuggestions();
    });

    friendUsernameInput.addEventListener('blur', () => {
      setTimeout(() => hideSuggestions(), 120);
    });
  }

  if (viewSendBtn) viewSendBtn.addEventListener('click', () => switchView('send'));
  if (viewIncomingBtn) viewIncomingBtn.addEventListener('click', () => switchView('incoming'));
  if (viewPendingBtn) viewPendingBtn.addEventListener('click', () => switchView('pending'));
  if (viewFriendsBtn) viewFriendsBtn.addEventListener('click', () => switchView('friends'));

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', () => {
      sendChatMessage();
    });
  }

  if (chatMessageInput) {
    chatMessageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!friendSuggestions || !friendUsernameInput) return;
    if (event.target === friendUsernameInput) return;
    if (friendSuggestions.contains(event.target)) return;
    hideSuggestions();
  });

  if (friendsLogoutBtn) {
    friendsLogoutBtn.addEventListener('click', () => {
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
      Promise.resolve(auth ? signOut(auth) : null)
        .catch((error) => console.warn('[friends] sign out failed', error))
        .finally(() => {
          clearAuthSession();
          window.location.href = 'index.html';
        });
    });
  }

  switchView(activeView);
  clearChatPanel();
  await loadFriends();
  autoRefreshTimer = setInterval(() => {
    loadFriends({ silent: true });
  }, 5000);
});

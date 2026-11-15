import { requireCurrentUser } from './firebase-auth.js';

export async function contestRequest(url, body) {
  const user = await requireCurrentUser();
  async function send(forceRefresh) {
    const token = await user.getIdToken(forceRefresh);
    return fetch(url, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  }
  let response = await send(false);
  if (response.status === 401) response = await send(true);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Unable to load your contest entry.');
  return payload;
}

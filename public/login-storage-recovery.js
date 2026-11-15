export function isStorageQuotaError(error) {
  return Boolean(error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'));
}

export async function retryAfterStorageCleanup(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    try {
      if (localStorage.getItem('silentDraftDefaultRankingsCache') === null) throw error;
      localStorage.removeItem('silentDraftDefaultRankingsCache');
      console.warn('[login] Removed rebuildable default rankings cache after storage quota error.');
    } catch (cleanupError) {
      if (cleanupError !== error) console.error('[login] Could not clear the rankings cache:', cleanupError);
      throw error;
    }
    return operation();
  }
}

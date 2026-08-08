const HUSH_GIFS = {
  favorites: [],
  football: [],
  funny: [],
  hype: [],
  victory: [],
  trashTalk: [],
  fails: [],
  money: []
};

if (typeof window !== 'undefined') {
  window.HUSH_GIFS = HUSH_GIFS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HUSH_GIFS;
}

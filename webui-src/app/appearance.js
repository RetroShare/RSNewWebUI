const KEY = 'rs.webui.appearance';
const preferences = ['system', 'light', 'dark'];

function getPreference() {
  const value = document.documentElement.dataset.appearance;
  return preferences.includes(value) ? value : 'system';
}

function setPreference(value) {
  const preference = preferences.includes(value) ? value : 'system';
  document.documentElement.dataset.appearance = preference;
  try {
    localStorage.setItem(KEY, preference);
  } catch (_error) {
    // The choice still works when storage is blocked.
  }
}

module.exports = { getPreference, setPreference };

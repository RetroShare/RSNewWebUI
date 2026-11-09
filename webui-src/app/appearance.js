const KEY = 'rs.webui.appearance';
const storage = require('preferences');
const preferences = ['system', 'light', 'dark'];

function getPreference() {
  const value = document.documentElement.dataset.appearance;
  return preferences.includes(value) ? value : 'system';
}

function setPreference(value) {
  const preference = preferences.includes(value) ? value : 'system';
  document.documentElement.dataset.appearance = preference;
  storage.write(KEY, preference);
}

module.exports = { getPreference, setPreference };

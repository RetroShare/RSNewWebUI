function read(key, fallback, valid = (value) => typeof value === typeof fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    let value = stored;
    if (typeof fallback === 'number') value = stored.trim() ? Number(stored) : NaN;
    if (typeof fallback === 'boolean') value = stored === 'true' ? true : stored === 'false' ? false : null;
    return valid(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (_) {
    // The choice still works when storage is blocked.
  }
}

module.exports = { read, write };

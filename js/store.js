/* Flow Sketch: browser-local storage. Nothing leaves this browser. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});

  const P = 'flowsketch.v1.';
  const SK = P + 'sketch.';
  let ls = null;
  try {
    ls = window.localStorage;
    ls.setItem(P + 'probe', '1');
    ls.removeItem(P + 'probe');
  } catch (e) {
    ls = null;
  }

  function get(key) {
    try { return ls ? ls.getItem(key) : null; } catch (e) { return null; }
  }

  FS.store = {
    available: !!ls,

    /* Saved sketches, newest first. Unreadable entries are listed, never deleted. */
    list() {
      const out = [];
      if (!ls) return out;
      let keys = [];
      try {
        for (let i = 0; i < ls.length; i++) keys.push(ls.key(i));
      } catch (e) { keys = []; }
      keys.forEach((k) => {
        if (!k || k.indexOf(SK) !== 0) return;
        const id = k.slice(SK.length);
        try {
          const o = JSON.parse(get(k));
          out.push({
            id,
            title: (o && typeof o.title === 'string' && o.title.trim()) || 'Untitled sketch',
            updated: (o && typeof o.updated === 'string' && o.updated) || '',
            steps: o && Array.isArray(o.steps) ? o.steps.length : 0,
          });
        } catch (e) {
          out.push({ id, title: 'Unreadable sketch', updated: '', steps: 0, broken: true });
        }
      });
      return out.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    },

    load(id) {
      const raw = get(SK + id);
      if (!raw) return null;
      try {
        const res = FS.model.normalize(JSON.parse(raw));
        res.sketch.id = id;
        return res.sketch;
      } catch (e) {
        return null;
      }
    },

    /* Throws when the browser refuses (quota, privacy mode). */
    save(sketch) {
      if (!ls) throw new Error('Browser storage is unavailable.');
      ls.setItem(SK + sketch.id, JSON.stringify(sketch));
    },

    remove(id) {
      try { if (ls) ls.removeItem(SK + id); } catch (e) { /* ignore */ }
    },

    has(id) { return get(SK + id) !== null; },

    keyFor(id) { return SK + id; },

    currentId() { return get(P + 'current'); },
    setCurrentId(id) {
      try { if (ls) ls.setItem(P + 'current', id); } catch (e) { /* ignore */ }
    },

    prefs() {
      try { return JSON.parse(get(P + 'prefs')) || {}; } catch (e) { return {}; }
    },
    setPrefs(p) {
      try { if (ls) ls.setItem(P + 'prefs', JSON.stringify(p)); } catch (e) { /* ignore */ }
    },
  };
})();

/* Flow Sketch: sketch data, geometry, ordering, layout and validation. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});

  const VERSION = 1;
  const DEFAULT_TITLE = 'Untitled sketch';
  const MAX_STEPS = 500;

  /* ---------- Geometry ---------- */

  const G = (FS.geom = {
    W: 184,          // card width
    H: 60,           // card height, process view
    HT: 88,          // card height, Tools view
    PX: 344,         // column pitch (leaves room for connection labels; on the 8px grid)
    PY: 208,         // row pitch
    GRID: 8,
    cardH(tools) { return tools ? G.HT : G.H; },
    snap(v) { return Math.round(v / G.GRID) * G.GRID; },
    rect(s, tools) {
      const h = G.cardH(tools);
      return { x: s.x, y: s.y, w: G.W, h, r: s.x + G.W, b: s.y + h, cx: s.x + G.W / 2, cy: s.y + h / 2 };
    },
    /* Cubic route between two card rects. Back edges (loops) curve away so
       they never sit on top of the forward edge they return along. */
    route(a, b, back) {
      const GAP = 18;
      let p0, p1, p2, p3;
      const below = b.y >= a.b + GAP;
      const above = b.b <= a.y - GAP;
      const loop = back && !below && !above;
      if (loop) {
        const dip = Math.max(a.b, b.b) + 58;
        p0 = [a.cx, a.b]; p1 = [a.cx, dip]; p2 = [b.cx, dip]; p3 = [b.cx, b.b];
      } else if (below || above) {
        const off = back ? 30 : 0;
        if (below) {
          const k = Math.max(26, (b.y - a.b) / 2);
          p0 = [a.cx + off, a.b]; p1 = [a.cx + off, a.b + k]; p2 = [b.cx + off, b.y - k]; p3 = [b.cx + off, b.y];
        } else {
          const k = Math.max(26, (a.y - b.b) / 2);
          p0 = [a.cx + off, a.y]; p1 = [a.cx + off, a.y - k]; p2 = [b.cx + off, b.b + k]; p3 = [b.cx + off, b.b];
        }
      } else if (b.r <= a.x - GAP) {
        const k = Math.max(30, (a.x - b.r) / 2);
        p0 = [a.x, a.cy]; p1 = [a.x - k, a.cy]; p2 = [b.r + k, b.cy]; p3 = [b.r, b.cy];
      } else {
        const k = Math.max(30, (b.x - a.r) / 2);
        p0 = [a.r, a.cy]; p1 = [a.r + k, a.cy]; p2 = [b.x - k, b.cy]; p3 = [b.x, b.cy];
      }
      const f = (n) => Math.round(n * 10) / 10;
      const d = 'M' + f(p0[0]) + ',' + f(p0[1]) + ' C' + f(p1[0]) + ',' + f(p1[1]) + ' ' +
        f(p2[0]) + ',' + f(p2[1]) + ' ' + f(p3[0]) + ',' + f(p3[1]);
      const lx = (p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8;
      const ly = (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8;
      return {
        d, lx, ly, loop,
        minX: Math.min(p0[0], p1[0], p2[0], p3[0]), maxX: Math.max(p0[0], p1[0], p2[0], p3[0]),
        minY: Math.min(p0[1], p1[1], p2[1], p3[1]), maxY: Math.max(p0[1], p1[1], p2[1], p3[1]),
      };
    },
  });

  /* ---------- Small helpers ---------- */

  function rid(n) {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    const arr = new Uint32Array(n);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    for (let i = 0; i < n; i++) s += chars[arr[i] % chars.length];
    return s;
  }
  function uniqueId(prefix, taken) {
    let id;
    do { id = prefix + rid(6); } while (taken && taken.has(id));
    return id;
  }
  function str(v, max) {
    if (typeof v !== 'string') return '';
    // Drop control characters other than tab and newline.
    return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
  }
  function oneOf(v, list, dflt) {
    for (let i = 0; i < list.length; i++) if (list[i].id === v) return v;
    return dflt;
  }
  function num(v) {
    return typeof v === 'number' && isFinite(v) ? Math.max(-50000, Math.min(50000, v)) : null;
  }
  function nowIso() { return new Date().toISOString(); }

  /* ---------- Constructors ---------- */

  function emptyTool() {
    return { product: '', productOther: '', surface: '', surfaceOther: '', setupKind: '', setupName: '', resources: '', confirmed: false };
  }

  function newSketch(title) {
    const t = nowIso();
    return { format: 'flowsketch', version: VERSION, id: uniqueId('sk_'), title: title || DEFAULT_TITLE, created: t, updated: t, steps: [], links: [] };
  }

  function newStep(sk, props) {
    const taken = new Set(sk.steps.map((s) => s.id));
    return Object.assign({
      id: uniqueId('s_', taken), title: '', category: '', performer: 'undecided', x: 0, y: 0,
      owner: '', purpose: '', notes: '', evidence: '', tool: null, extIn: null, extOut: null,
    }, props || {});
  }

  function newLink(sk, from, to, props) {
    const taken = new Set(sk.links.map((l) => l.id));
    return Object.assign({
      id: uniqueId('l_', taken), from, to, artifact: '', label: '', handoff: 'undecided',
      method: '', who: '', how: '', tested: false, condition: '', notes: '',
    }, props || {});
  }

  /* ---------- Lookups ---------- */

  function stepById(sk, id) { return sk.steps.find((s) => s.id === id) || null; }
  function linkById(sk, id) { return sk.links.find((l) => l.id === id) || null; }
  function incoming(sk, id) { return sk.links.filter((l) => l.to === id); }
  function outgoing(sk, id) { return sk.links.filter((l) => l.from === id); }

  function band(s) { return Math.round(s.y / 120); }
  function cmpPos(a, b) {
    return band(a) - band(b) || a.x - b.x || a.y - b.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  /* Links that close a cycle (review loops). Found by depth-first search from
     the steps nothing points to, so "send back for changes" is the loop. */
  function backEdges(sk) {
    const back = new Set();
    const byId = new Map(sk.steps.map((s) => [s.id, s]));
    const out = new Map(sk.steps.map((s) => [s.id, []]));
    const indeg = new Map(sk.steps.map((s) => [s.id, 0]));
    sk.links.forEach((l) => {
      if (!byId.has(l.from) || !byId.has(l.to)) return;
      out.get(l.from).push(l);
      indeg.set(l.to, indeg.get(l.to) + 1);
    });
    out.forEach((list) => list.sort((p, q) => cmpPos(byId.get(p.to), byId.get(q.to))));
    const sorted = sk.steps.slice().sort(cmpPos);
    const starts = sorted.filter((s) => indeg.get(s.id) === 0).concat(sorted);
    const color = new Map(); // 1 = on stack, 2 = done
    starts.forEach((start) => {
      if (color.has(start.id)) return;
      const stack = [[start.id, 0]];
      color.set(start.id, 1);
      while (stack.length) {
        const top = stack[stack.length - 1];
        const list = out.get(top[0]);
        if (top[1] >= list.length) { color.set(top[0], 2); stack.pop(); continue; }
        const l = list[top[1]++];
        const c = color.get(l.to);
        if (c === 1) back.add(l.id);
        else if (!c) { color.set(l.to, 1); stack.push([l.to, 0]); }
      }
    });
    return back;
  }

  /* Steps in flow order: follow connections, break ties by position. */
  function order(sk, backSet) {
    const back = backSet || backEdges(sk);
    const byId = new Map(sk.steps.map((s) => [s.id, s]));
    const indeg = new Map(sk.steps.map((s) => [s.id, 0]));
    const out = new Map(sk.steps.map((s) => [s.id, []]));
    sk.links.forEach((l) => {
      if (back.has(l.id) || !byId.has(l.from) || !byId.has(l.to)) return;
      out.get(l.from).push(l.to);
      indeg.set(l.to, indeg.get(l.to) + 1);
    });
    const avail = sk.steps.filter((s) => indeg.get(s.id) === 0).sort(cmpPos);
    const result = [];
    const seen = new Set();
    while (avail.length) {
      const s = avail.shift();
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      result.push(s);
      let added = false;
      out.get(s.id).forEach((tid) => {
        indeg.set(tid, indeg.get(tid) - 1);
        if (indeg.get(tid) === 0) { avail.push(byId.get(tid)); added = true; }
      });
      if (added) avail.sort(cmpPos);
    }
    if (result.length < sk.steps.length) {
      sk.steps.slice().sort(cmpPos).forEach((s) => { if (!seen.has(s.id)) result.push(s); });
    }
    return result;
  }

  function overlaps(sk, x, y, ignoreId) {
    const m = 24;
    return sk.steps.some((s) => s.id !== ignoreId &&
      x < s.x + G.W + m && x + G.W + m > s.x && y < s.y + G.HT + m && y + G.HT + m > s.y);
  }

  /* Nearest open spot to (x, y), stepping by whole rows, then columns. */
  function freeSpot(sk, x, y, ignoreId) {
    x = G.snap(x); y = G.snap(y);
    const offsets = [0, 1, -1, 2, -2, 3, -3];
    for (let c = 0; c < 6; c++) {
      for (let i = 0; i < offsets.length; i++) {
        const cx = x + c * G.PX, cy = y + offsets[i] * G.PY;
        if (!overlaps(sk, cx, cy, ignoreId)) return { x: cx, y: cy };
      }
    }
    return { x: x + 6 * G.PX, y };
  }

  /* Layered left-to-right layout. A plain chain longer than four steps
     wraps into rows that read back and forth, so it stays readable. */
  function tidy(sk) {
    if (!sk.steps.length) return;
    const back = backEdges(sk);
    const ord = order(sk, back);
    const idx = new Map(ord.map((s, i) => [s.id, i]));
    const layer = new Map();
    const preds = new Map(ord.map((s) => [s.id, []]));
    sk.links.forEach((l) => {
      if (!back.has(l.id) && preds.has(l.to) && preds.has(l.from)) preds.get(l.to).push(l.from);
    });
    ord.forEach((s) => {
      let L = 0;
      preds.get(s.id).forEach((p) => { if (layer.has(p)) L = Math.max(L, layer.get(p) + 1); });
      layer.set(s.id, L);
    });
    const layers = [];
    ord.forEach((s) => {
      const L = layer.get(s.id);
      (layers[L] = layers[L] || []).push(s);
    });
    const dense = layers.filter(Boolean);
    const linear = dense.every((l) => l.length === 1);
    if (linear && ord.length > 4) {
      ord.forEach((s, i) => {
        const row = Math.floor(i / 4), col = i % 4;
        s.x = (row % 2 ? 3 - col : col) * G.PX;
        s.y = row * G.PY;
      });
      return;
    }
    const y = new Map();
    dense.forEach((list, L) => {
      if (L > 0) {
        list.sort((a, b) => {
          const avg = (s) => {
            const ps = preds.get(s.id).filter((p) => y.has(p));
            return ps.length ? ps.reduce((t, p) => t + y.get(p), 0) / ps.length : idx.get(s.id) * G.PY;
          };
          return avg(a) - avg(b) || idx.get(a.id) - idx.get(b.id);
        });
      }
      list.forEach((s, i) => {
        s.x = L * G.PX;
        y.set(s.id, (i - (list.length - 1) / 2) * G.PY);
      });
    });
    let minY = Infinity;
    y.forEach((v) => { minY = Math.min(minY, v); });
    sk.steps.forEach((s) => { s.y = G.snap(y.get(s.id) - minY); });
  }

  /* ---------- Labels ---------- */

  function stepTitle(s) { return (s && s.title && s.title.trim()) || 'Untitled step'; }

  function artifactName(id) { const a = FS.find(FS.ARTIFACTS, id); return a ? a.name : ''; }

  function linkWhat(l) { return (l.label && l.label.trim()) || artifactName(l.artifact); }

  function linkText(l) {
    const parts = [];
    if (l.condition && l.condition.trim()) parts.push(l.condition.trim());
    const what = linkWhat(l);
    if (what) parts.push(what);
    return parts.join(' · ');
  }

  function product(tool) { return tool && tool.product ? FS.find(FS.PRODUCTS, tool.product) : null; }

  function surfaceOf(tool) {
    const p = product(tool);
    if (!p || !tool.surface) return null;
    if (tool.surface === 'other') {
      const n = (tool.surfaceOther || '').trim();
      return n ? { id: 'other', name: n, short: n } : null;
    }
    return FS.find(p.surfaces, tool.surface);
  }

  function productName(tool) {
    const p = product(tool);
    if (!p) return '';
    if (p.id === 'other') return (tool.productOther || '').trim() || 'Other tool';
    return p.name;
  }

  function toolBadge(tool) {
    const p = product(tool);
    if (!p) return null;
    if (p.id === 'human') {
      const role = (tool.setupName || '').trim();
      return role ? 'Human · ' + role : 'Human expertise';
    }
    const name = p.id === 'other' ? productName(tool) : p.short;
    const s = surfaceOf(tool);
    if (s && s.badge) return s.badge;
    return s ? name + ' · ' + s.short : name;
  }

  function toolLong(tool) {
    const p = product(tool);
    if (!p) return '';
    if (p.id === 'human') {
      const role = (tool.setupName || '').trim();
      return 'Human expertise' + (role ? ' (' + role + ')' : '');
    }
    const parts = [productName(tool)];
    const s = surfaceOf(tool);
    if (s) parts.push(s.name);
    if ((tool.setupName || '').trim()) parts.push((tool.setupKind ? tool.setupKind + ': ' : '') + tool.setupName.trim());
    let out = parts.join(', ');
    if ((tool.resources || '').trim()) out += '; relies on ' + tool.resources.trim();
    return out;
  }

  /* ---------- Validation (load and import) ---------- */

  function fail(msg) { const e = new Error(msg); e.userMessage = msg; return e; }

  function normArtifact(a) {
    if (!a || typeof a !== 'object') return null;
    const out = { type: oneOf(a.type, FS.ARTIFACTS, ''), label: str(a.label, 120) };
    return out.type || out.label.trim() ? out : null;
  }

  function normTool(t) {
    if (!t || typeof t !== 'object') return null;
    const p = FS.find(FS.PRODUCTS, t.product);
    if (!p) return null;
    const tool = emptyTool();
    tool.product = p.id;
    tool.productOther = str(t.productOther, 80);
    tool.surface = t.surface === 'other' || FS.find(p.surfaces, t.surface) ? t.surface : '';
    tool.surfaceOther = str(t.surfaceOther, 80);
    tool.setupKind = p.setupKinds.indexOf(t.setupKind) >= 0 ? t.setupKind : '';
    tool.setupName = str(t.setupName, 120);
    tool.resources = str(t.resources, 300);
    tool.confirmed = t.confirmed === true;
    return tool;
  }

  /* Returns { sketch, warnings }. Throws an Error with .userMessage when the
     data cannot be used, so callers can keep the current sketch untouched. */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('This file is not a Flow Sketch backup.');
    const src = raw.sketch && typeof raw.sketch === 'object' && !Array.isArray(raw.sketch) ? raw.sketch : raw;
    if (src.format !== undefined && src.format !== 'flowsketch') throw fail('This file is not a Flow Sketch backup.');
    if (!Array.isArray(src.steps)) throw fail('This file has no list of steps, so it is not a Flow Sketch backup.');
    if (typeof src.version === 'number' && src.version > VERSION) throw fail('This backup was made by a newer version of Flow Sketch.');
    if (src.steps.length > MAX_STEPS) throw fail('This backup has more than ' + MAX_STEPS + ' steps.');

    const warnings = [];
    const steps = [];
    const ids = new Set();
    let needsLayout = false;
    src.steps.forEach((s, i) => {
      if (!s || typeof s !== 'object') { warnings.push('Skipped item ' + (i + 1) + ' in the step list because it is not a step.'); return; }
      let id = str(s.id, 64).trim();
      if (!id || ids.has(id)) {
        if (id) warnings.push('Two steps shared the id "' + id + '"; the second got a new id.');
        id = uniqueId('s_', ids);
      }
      ids.add(id);
      const x = num(s.x), y = num(s.y);
      if (x === null || y === null) needsLayout = true;
      steps.push({
        id,
        title: str(s.title, 120),
        category: oneOf(s.category, FS.CATEGORIES, ''),
        performer: oneOf(s.performer, FS.PERFORMERS, 'undecided'),
        x: x === null ? 0 : x, y: y === null ? 0 : y,
        owner: str(s.owner, 200), purpose: str(s.purpose, 2000), notes: str(s.notes, 4000), evidence: str(s.evidence, 4000),
        tool: normTool(s.tool),
        extIn: normArtifact(s.extIn), extOut: normArtifact(s.extOut),
      });
    });

    const links = [];
    const linkIds = new Set();
    const pairs = new Set();
    (Array.isArray(src.links) ? src.links : []).forEach((l, i) => {
      if (!l || typeof l !== 'object') { warnings.push('Skipped item ' + (i + 1) + ' in the connection list.'); return; }
      if (!ids.has(l.from) || !ids.has(l.to) || l.from === l.to) { warnings.push('Skipped a connection that pointed to a missing step.'); return; }
      const pair = l.from + '>' + l.to;
      if (pairs.has(pair)) { warnings.push('Skipped a duplicate connection.'); return; }
      pairs.add(pair);
      let id = str(l.id, 64).trim();
      if (!id || linkIds.has(id)) id = uniqueId('l_', linkIds);
      linkIds.add(id);
      links.push({
        id, from: l.from, to: l.to,
        artifact: oneOf(l.artifact, FS.ARTIFACTS, ''),
        label: str(l.label, 120),
        handoff: oneOf(l.handoff, FS.HANDOFFS, 'undecided'),
        method: oneOf(l.method, FS.MANUAL_METHODS, ''),
        who: str(l.who, 200), how: str(l.how, 1000),
        tested: l.tested === true,
        condition: str(l.condition, 60),
        notes: str(l.notes, 4000),
      });
    });

    const sketch = {
      format: 'flowsketch', version: VERSION,
      id: /^[\w-]{1,64}$/.test(src.id || '') ? src.id : uniqueId('sk_'),
      title: str(src.title, 120).trim() || DEFAULT_TITLE,
      created: typeof src.created === 'string' ? str(src.created, 40) : nowIso(),
      updated: typeof src.updated === 'string' ? str(src.updated, 40) : nowIso(),
      steps, links,
    };
    if (needsLayout) tidy(sketch);
    return { sketch, warnings };
  }

  function isPristine(sk) {
    return !sk.steps.length && !sk.links.length && sk.title === DEFAULT_TITLE;
  }

  FS.model = {
    VERSION, DEFAULT_TITLE,
    uniqueId, newSketch, newStep, newLink, emptyTool,
    stepById, linkById, incoming, outgoing,
    backEdges, order, freeSpot, overlaps, tidy, cmpPos,
    stepTitle, artifactName, linkWhat, linkText, product, surfaceOf, productName, toolBadge, toolLong,
    normalize, isPristine, nowIso,
  };
})();

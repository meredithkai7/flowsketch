/* Flow Sketch: application state, history, saving and the toolbar. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});
  const esc = (v) => FS.ui.esc(v);
  const icon = (n, s, c) => FS.icon(n, s, c);
  const M = () => FS.model;

  const state = { selection: null, view: 'canvas', tools: false, checkOpen: false, palette: true };
  let sketch = null;
  const history = { past: [], future: [], lastKey: null, lastTime: 0 };
  let checkCache = null;
  let saveTimer = null;
  let saveState = 'saved';
  let suppressSave = false;
  let needsFit = true;

  /* ---------- History and change ---------- */

  function record(coalesce, snapshot) {
    const now = Date.now();
    if (coalesce && coalesce === history.lastKey && now - history.lastTime < 1500) { history.lastTime = now; return; }
    history.past.push(snapshot || JSON.stringify(sketch));
    if (history.past.length > 200) history.past.shift();
    history.future = [];
    history.lastKey = coalesce || null;
    history.lastTime = now;
  }

  /* Every edit goes through here: snapshot for undo, mutate, save, render.
     If the mutation throws, the sketch is restored untouched. */
  function change(fn, opts) {
    opts = opts || {};
    const before = JSON.stringify(sketch);
    try {
      fn(sketch);
    } catch (err) {
      console.error(err);
      sketch = JSON.parse(before);
      FS.ui.toast('Something went wrong, so nothing changed.', { warn: true });
      renderAll();
      return false;
    }
    record(opts.coalesce, before);
    touched(opts.from);
    return true;
  }

  function checkpoint() { record(null); }
  function committed(from) { touched(from); }

  function touched(from) {
    sketch.updated = M().nowIso();
    if (state.view !== 'canvas') needsFit = true; // canvas hasn't seen this layout yet
    scheduleSave();
    validateSelection();
    renderAll(from);
  }

  function undo() {
    if (!history.past.length) return;
    history.future.push(JSON.stringify(sketch));
    sketch = JSON.parse(history.past.pop());
    history.lastKey = null;
    touched();
    FS.ui.announce('Undone');
  }

  function redo() {
    if (!history.future.length) return;
    history.past.push(JSON.stringify(sketch));
    sketch = JSON.parse(history.future.pop());
    history.lastKey = null;
    touched();
    FS.ui.announce('Redone');
  }

  function validateSelection() {
    const sel = state.selection;
    if (!sel) return;
    const ok = sel.type === 'step' ? M().stepById(sketch, sel.id) : M().linkById(sketch, sel.id);
    if (!ok) state.selection = null;
  }

  /* ---------- Saving ---------- */

  function scheduleSave() {
    if (saveState !== 'failed') saveState = 'pending';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
    renderStatus();
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!sketch || suppressSave) return;
    if (!FS.store.available) { saveState = 'unavailable'; renderStatus(); return; }
    try {
      if (M().isPristine(sketch)) FS.store.remove(sketch.id);
      else FS.store.save(sketch);
      FS.store.setCurrentId(sketch.id);
      saveState = 'saved';
    } catch (e) {
      saveState = 'failed';
    }
    renderStatus();
  }

  function renderStatus() {
    const el = document.getElementById('save-status');
    if (!el) return;
    const map = {
      saved: ['Saved', 'Saved in this browser only. Use Export → Backup to keep a copy.'],
      pending: ['Saving…', 'Saving in this browser'],
      failed: ['Not saved', 'This browser refused to save. Download a backup now.'],
      unavailable: ['Not saved', 'Browser storage is off, so nothing is saved. Use Export → Backup.'],
    };
    const v = map[saveState];
    const pristine = M().isPristine(sketch) && saveState === 'saved';
    el.textContent = pristine ? '' : v[0];
    el.title = v[1];
    el.classList.toggle('warn', saveState === 'failed' || saveState === 'unavailable');
    el.disabled = !(saveState === 'failed' || saveState === 'unavailable');
  }

  /* Phone-sized screens force Outline and a collapsed palette; those
     defaults are not saved, so a desktop visit keeps its own layout. */
  function savePrefs() {
    const prev = FS.store.prefs();
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    FS.store.setPrefs({
      tools: state.tools,
      view: narrow ? prev.view : state.view,
      palette: narrow ? prev.palette : state.palette,
    });
  }

  /* ---------- Rendering ---------- */

  function flagged() {
    return state.checkOpen ? checkResult().flagged : null;
  }

  function checkResult() {
    if (!checkCache) checkCache = FS.check.run(sketch, { tools: state.tools });
    return checkCache;
  }

  function renderAll(from) {
    checkCache = null;
    FS.canvas.render();
    if (state.view === 'outline' && from !== 'outline-text') FS.outline.render();
    if (from !== 'side-text') FS.side.render();
    renderTopbar();
  }

  function renderTopbar() {
    const title = document.getElementById('sketch-title');
    if (document.activeElement !== title) title.value = sketch.title;
    document.getElementById('undo-btn').disabled = !history.past.length;
    document.getElementById('redo-btn').disabled = !history.future.length;
    const check = document.getElementById('check-btn');
    check.setAttribute('aria-pressed', state.checkOpen ? 'true' : 'false');
    const cnt = state.checkOpen ? checkResult().total : 0;
    check.querySelector('.count').textContent = state.checkOpen && cnt ? cnt : '';
    document.getElementById('tools-toggle').checked = state.tools;
    document.getElementById('view-canvas').setAttribute('aria-selected', state.view === 'canvas' ? 'true' : 'false');
    document.getElementById('view-outline').setAttribute('aria-selected', state.view === 'outline' ? 'true' : 'false');
    const app = document.getElementById('app');
    app.classList.toggle('palette-collapsed', !state.palette);
    app.classList.toggle('view-outline', state.view === 'outline');
    const pc = document.getElementById('pal-collapse');
    pc.setAttribute('aria-expanded', state.palette ? 'true' : 'false');
    pc.setAttribute('aria-label', state.palette ? 'Collapse palette' : 'Expand palette');
    pc.innerHTML = icon(state.palette ? 'chevronLeft' : 'chevronRight', 14);
    renderStatus();
  }

  /* ---------- Selection and editing actions ---------- */

  function sameSel(a, b) { return a && b ? a.type === b.type && a.id === b.id : a === b; }

  function select(sel, opts) {
    opts = opts || {};
    if (!sameSel(state.selection, sel)) {
      state.selection = sel;
      renderAll(opts.from);
    }
    if (opts.reveal && sel) FS.canvas.reveal(sel);
  }

  function title(id) { return M().stepTitle(M().stepById(sketch, id)); }

  function addStep(opts) {
    opts = opts || {};
    const cat = FS.find(FS.CATEGORIES, opts.category || '');
    const G = FS.geom;
    let newId = null;
    change((sk) => {
      const m = M();
      const src = opts.after ? m.stepById(sk, opts.after) : null;
      const outs = src ? m.outgoing(sk, src.id) : [];
      const insert = !!(src && opts.insert && outs.length === 1);
      let pos;
      if (opts.at) {
        pos = { x: G.snap(opts.at.x - G.W / 2), y: G.snap(opts.at.y - G.cardH(state.tools) / 2) };
      } else if (src) {
        const want = { x: src.x + G.PX, y: src.y };
        if (insert && m.overlaps(sk, want.x, want.y)) {
          // Make room on this row rather than dropping the new step elsewhere.
          sk.steps.forEach((s) => { if (s.x > src.x && Math.abs(s.y - src.y) < G.HT) s.x += G.PX; });
        }
        pos = m.freeSpot(sk, want.x, want.y);
      } else if (sk.steps.length) {
        const ord = m.order(sk);
        const last = ord[ord.length - 1];
        pos = m.freeSpot(sk, last.x + G.PX, last.y);
      } else {
        pos = { x: 0, y: 0 };
      }
      const step = m.newStep(sk, { title: cat ? cat.verb : '', category: cat ? cat.id : '', x: pos.x, y: pos.y });
      sk.steps.push(step);
      newId = step.id;
      if (src) {
        if (insert) {
          const old = outs[0];
          const next = old.to;
          old.to = step.id;
          sk.links.push(m.newLink(sk, step.id, next));
        } else {
          sk.links.push(m.newLink(sk, src.id, step.id));
        }
      }
    }, { from: opts.from });
    if (opts.select !== false) select({ type: 'step', id: newId });
    FS.ui.announce('Step added' + (opts.after ? ' and connected' : ''));
    return newId;
  }

  function connect(from, to, opts) {
    opts = opts || {};
    if (!from || !to || from === to) return null;
    const existing = sketch.links.find((l) => l.from === from && l.to === to);
    if (existing) {
      FS.ui.toast('Those steps are already connected.');
      if (opts.select !== false) select({ type: 'link', id: existing.id });
      return existing.id;
    }
    let id = null;
    change((sk) => { const l = M().newLink(sk, from, to); sk.links.push(l); id = l.id; }, { from: opts.from });
    if (opts.select !== false) select({ type: 'link', id });
    FS.ui.announce('Connected ' + title(from) + ' to ' + title(to));
    return id;
  }

  function duplicate(id) {
    const s = M().stepById(sketch, id);
    if (!s) return;
    let newId = null;
    change((sk) => {
      const copy = JSON.parse(JSON.stringify(s));
      delete copy.id;
      const pos = M().freeSpot(sk, s.x, s.y + FS.geom.PY);
      const n = M().newStep(sk, Object.assign(copy, pos));
      sk.steps.push(n);
      newId = n.id;
    });
    select({ type: 'step', id: newId }, { reveal: true });
    FS.ui.toast('Step duplicated. Connect it where it belongs.');
  }

  function deleteStep(id) {
    const t = title(id);
    change((sk) => {
      sk.steps = sk.steps.filter((s) => s.id !== id);
      sk.links = sk.links.filter((l) => l.from !== id && l.to !== id);
    });
    FS.ui.toast('Deleted “' + t + '”', { action: { label: 'Undo', run: undo } });
  }

  function deleteLink(id) {
    change((sk) => { sk.links = sk.links.filter((l) => l.id !== id); });
    FS.ui.toast('Connection deleted', { action: { label: 'Undo', run: undo } });
  }

  function deleteSelection() {
    const sel = state.selection;
    if (!sel) return;
    if (sel.type === 'step') deleteStep(sel.id);
    else deleteLink(sel.id);
  }

  function tidy() {
    if (!sketch.steps.length) return;
    change((sk) => M().tidy(sk));
    FS.canvas.fit();
    FS.ui.toast('Layout tidied', { action: { label: 'Undo', run: undo } });
  }

  function toggleCheck(on) {
    state.checkOpen = typeof on === 'boolean' ? on : !state.checkOpen;
    if (state.checkOpen) state.selection = null;
    renderAll();
    if (state.checkOpen) {
      const r = checkResult();
      FS.ui.announce(r.total ? r.total + ' things to look at' : 'No gaps found');
    }
  }

  function setTools(on) {
    state.tools = !!on;
    savePrefs();
    renderAll();
    FS.ui.announce(state.tools ? 'Tools shown' : 'Tools hidden');
  }

  function setView(v) {
    state.view = v === 'outline' ? 'outline' : 'canvas';
    document.getElementById('canvas-view').hidden = state.view !== 'canvas';
    document.getElementById('outline-view').hidden = state.view !== 'outline';
    savePrefs();
    renderAll();
    if (state.view === 'canvas' && needsFit) { needsFit = false; FS.canvas.fit(); }
  }

  /* ---------- Sketch management ---------- */

  function switchTo(sk) {
    if (sketch) saveNow();
    sketch = sk;
    history.past = []; history.future = []; history.lastKey = null;
    state.selection = null;
    state.checkOpen = false;
    FS.store.setCurrentId(sk.id);
    renderAll();
    needsFit = true;
    if (state.view === 'canvas') { needsFit = false; FS.canvas.fit(); }
  }

  function newSketch() {
    switchTo(M().newSketch());
    FS.ui.toast('New sketch');
  }

  function openExample(id) {
    const sk = FS.examples.create(id);
    if (!sk) return;
    switchTo(sk);
    saveNow();
    FS.ui.toast('Opened a copy of the example. Edit it freely.');
  }

  function openSaved(id) {
    if (id === sketch.id) return;
    const sk = FS.store.load(id);
    if (!sk) { FS.ui.toast('That sketch could not be opened. It may be damaged.', { warn: true }); return; }
    switchTo(sk);
  }

  async function deleteSaved(id) {
    const entry = FS.store.list().find((x) => x.id === id);
    const name = entry ? entry.title : 'this sketch';
    const ok = await FS.ui.dialog({
      title: 'Delete sketch?',
      body: 'Delete “' + name + '” from this browser? This cannot be undone. Download a backup first if you might need it.',
      ok: 'Delete', cancel: 'Cancel', danger: true,
    });
    if (!ok) return;
    FS.store.remove(id);
    if (id === sketch.id) {
      const next = FS.store.list().find((x) => !x.broken);
      const sk = next && FS.store.load(next.id);
      sketch = null;
      switchTo(sk || M().newSketch());
    }
    FS.ui.toast('Deleted “' + name + '”');
  }

  async function importFile(file) {
    if (!file) return;
    const fail = (msg) => FS.ui.dialog({ title: 'Could not import', body: msg + ' Your current sketch is unchanged.', ok: 'OK' });
    if (file.size > 5 * 1024 * 1024) { fail('That file is larger than 5 MB, which is too big for a sketch backup.'); return; }
    let text;
    try { text = await file.text(); } catch (e) { fail('That file could not be read.'); return; }
    let raw;
    try { raw = JSON.parse(text); } catch (e) { fail('That file is not valid JSON, so it is not a Flow Sketch backup.'); return; }
    let res;
    try { res = M().normalize(raw); } catch (e) { fail(e.userMessage || 'That backup could not be read.'); return; }
    const sk = res.sketch;
    if (FS.store.has(sk.id) || sk.id === sketch.id) sk.id = M().uniqueId('sk_');
    const titles = new Set(FS.store.list().map((x) => x.title));
    if (titles.has(sk.title)) sk.title = sk.title + ' (imported)';
    sk.updated = M().nowIso();
    switchTo(sk);
    saveNow();
    const skipped = res.warnings.length;
    FS.ui.toast('Imported “' + sk.title + '” as a new sketch.' + (skipped ? ' ' + skipped + ' item' + (skipped === 1 ? ' was' : 's were') + ' skipped.' : ''));
  }

  /* ---------- Menus ---------- */

  function sketchesMenu() {
    const saved = FS.store.list();
    let h = '<button type="button" role="menuitem" class="mi" data-mi="new">' + icon('plus') + '<span class="mi-text"><span>New sketch</span></span></button>';
    h += '<div class="menu-sep"></div><div class="menu-label">Examples</div>';
    FS.examples.list.forEach((ex) => {
      h += '<button type="button" role="menuitem" class="mi" data-mi="example" data-id="' + esc(ex.id) + '">' + icon('file') +
        '<span class="mi-text"><span>' + esc(ex.name) + '</span><span class="mi-hint">' + esc(ex.hint) + '</span></span></button>';
    });
    h += '<div class="menu-sep"></div><div class="menu-label">Saved in this browser</div>';
    if (!FS.store.available) h += '<p class="menu-note">Browser storage is off, so nothing is saved here. Use Export → Backup.</p>';
    else if (!saved.length) h += '<p class="menu-note">Nothing saved yet.</p>';
    else {
      h += '<div class="menu-scroll">' + saved.map((x) =>
        '<div class="mi-row' + (x.id === sketch.id ? ' current' : '') + '">' +
        '<button type="button" role="menuitem" class="mi" data-mi="open" data-id="' + esc(x.id) + '"' + (x.broken ? ' disabled' : '') + '>' +
        (x.id === sketch.id ? icon('check') : '<span class="ic-space"></span>') +
        '<span class="mi-text"><span>' + esc(x.title) + '</span><span class="mi-hint">' + x.steps + ' step' + (x.steps === 1 ? '' : 's') +
        (x.updated ? ' · ' + esc(FS.ui.timeAgo(x.updated)) : '') + '</span></span></button>' +
        '<button type="button" role="menuitem" class="icon-btn sm" data-mi="delete" data-id="' + esc(x.id) + '" aria-label="Delete ' + esc(x.title) + ' from this browser" title="Delete">' + icon('trash', 14) + '</button>' +
        '</div>').join('') + '</div>';
    }
    h += '<div class="menu-sep"></div><button type="button" role="menuitem" class="mi" data-mi="import">' + icon('upload') + '<span class="mi-text"><span>Import backup…</span></span></button>';
    h += '<p class="menu-note">Sketches are saved only in this browser, which is not a backup.</p>';
    return h;
  }

  function exportMenu() {
    const big = !FS.exporter.fitsOnePage(sketch);
    return '<button type="button" role="menuitem" class="mi" data-mi="backup">' + icon('download') +
      '<span class="mi-text"><span>Backup</span><span class="mi-hint">Editable JSON file you can import later</span></span></button>' +
      '<button type="button" role="menuitem" class="mi" data-mi="svg">' + icon('image') +
      '<span class="mi-text"><span>Diagram (SVG)</span><span class="mi-hint">Scalable image' + (state.tools ? ', with tools' : '') + '</span></span></button>' +
      '<button type="button" role="menuitem" class="mi" data-mi="print">' + icon('printer') +
      '<span class="mi-text"><span>Print</span><span class="mi-hint">' + (big ? 'Overview plus ordered step list' : 'One page') + '</span></span></button>' +
      '<p class="menu-note">Files are saved to your device. Sharing them is a separate choice.</p>';
  }

  function onMenu(e) {
    const b = e.target.closest('[data-mi]');
    if (!b || b.disabled) return;
    const id = b.dataset.id;
    FS.ui.closeMenus();
    switch (b.dataset.mi) {
      case 'new': newSketch(); break;
      case 'example': openExample(id); break;
      case 'open': openSaved(id); break;
      case 'delete': deleteSaved(id); break;
      case 'import': document.getElementById('import-input').click(); break;
      case 'backup':
        saveNow();
        FS.exporter.downloadBackup(sketch);
        FS.ui.toast('Backup downloaded. Keep it somewhere safe.');
        break;
      case 'svg':
        FS.exporter.downloadSvg(sketch, state.tools);
        FS.ui.toast('Diagram downloaded');
        break;
      case 'print':
        FS.exporter.print(sketch, state.tools);
        break;
    }
  }

  /* ---------- Palette ---------- */

  function initPalette() {
    const pal = document.getElementById('palette');
    const items = pal.querySelector('.pal-items');
    items.innerHTML = '<button type="button" class="pal-item" data-cat="" title="Blank step">' + icon('step') + '<span>Step</span></button>' +
      FS.CATEGORIES.map((c) => '<button type="button" class="pal-item" data-cat="' + c.id + '" title="' + esc(c.name + ': ' + c.hint) + '">' +
        icon(c.id) + '<span>' + esc(c.name) + '</span></button>').join('');
    let pd = null, ghost = null, suppressClick = false;

    const add = (cat, at) => {
      const sel = state.selection;
      const after = !at && sel && sel.type === 'step' ? sel.id : null;
      const outline = state.view === 'outline';
      const id = addStep({ category: cat, after, at, select: !outline });
      if (outline) FS.outline.focusTitle(id);
      else FS.canvas.editTitle(id, { fresh: true });
    };

    items.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.pal-item');
      if (!b || e.button !== 0) return;
      pd = { cat: b.dataset.cat, sx: e.clientX, sy: e.clientY, b };
      b.setPointerCapture(e.pointerId);
    });
    items.addEventListener('pointermove', (e) => {
      if (!pd) return;
      if (!ghost && Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) > 6 && state.view === 'canvas') {
        ghost = document.createElement('div');
        ghost.className = 'pal-ghost';
        const c = FS.find(FS.CATEGORIES, pd.cat);
        ghost.innerHTML = '<span class="perf perf-undecided">' + icon('undecided', 14) + '</span><span>' + esc(c ? c.verb + '…' : 'New step') + '</span>';
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.transform = 'translate(' + (e.clientX - FS.geom.W / 2) + 'px,' + (e.clientY - 22) + 'px)';
        ghost.classList.toggle('over', FS.canvas.isOverCanvas(e.clientX, e.clientY));
      }
    });
    const end = (e, cancel) => {
      if (!pd) return;
      const p = pd;
      pd = null;
      if (ghost) {
        ghost.remove();
        ghost = null;
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
        if (!cancel && FS.canvas.isOverCanvas(e.clientX, e.clientY)) add(p.cat, FS.canvas.clientToWorld(e.clientX, e.clientY));
      }
    };
    items.addEventListener('pointerup', (e) => end(e, false));
    items.addEventListener('pointercancel', (e) => end(e, true));
    items.addEventListener('click', (e) => {
      const b = e.target.closest('.pal-item');
      if (!b || suppressClick) return;
      add(b.dataset.cat, null);
    });
    document.getElementById('pal-collapse').addEventListener('click', () => {
      state.palette = !state.palette;
      savePrefs();
      renderTopbar();
    });
  }

  /* ---------- Keyboard ---------- */

  function onKey(e) {
    if (e.defaultPrevented) return;
    const dlg = document.getElementById('dialog');
    if (dlg.open) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const inText = FS.ui.isTextTarget(e.target);
    if (mod && !e.altKey && k === 'z') { if (inText) return; e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && !e.altKey && k === 'y') { if (inText) return; e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') {
      const pop = document.getElementById('gloss-pop');
      if (!pop.hidden) { pop.hidden = true; return; }
      const key = document.getElementById('key-pop');
      if (!key.hidden) { key.hidden = true; return; }
      if (FS.canvas.isConnecting()) { FS.canvas.cancelConnect(); return; }
      if (inText) return;
      if (state.selection) { select(null); return; }
      if (state.checkOpen) toggleCheck(false);
      return;
    }
    if (inText) return;
    if (mod && k === 'd') {
      const card = document.activeElement && document.activeElement.closest && document.activeElement.closest('.card');
      const id = card ? card.dataset.id : state.selection && state.selection.type === 'step' ? state.selection.id : null;
      if (id) { e.preventDefault(); duplicate(id); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
      const card = document.activeElement && document.activeElement.closest && document.activeElement.closest('.card');
      if (card) { e.preventDefault(); deleteStep(card.dataset.id); return; }
      if (state.selection) { e.preventDefault(); deleteSelection(); }
    }
  }

  /* ---------- Startup ---------- */

  function init() {
    FS.ui.$('#undo-btn').innerHTML = icon('undo');
    FS.ui.$('#redo-btn').innerHTML = icon('redo');
    FS.ui.$('#help-btn').innerHTML = icon('help');
    FS.ui.$('#zoom-in').innerHTML = icon('plus');
    FS.ui.$('#zoom-out').innerHTML = icon('minus');
    FS.ui.$('#zoom-fit').innerHTML = icon('fit');
    FS.ui.$('#tidy-btn').innerHTML = icon('tidy') + '<span>Tidy</span>';
    FS.ui.$('#key-btn').innerHTML = icon('key') + '<span>Key</span>';

    const prefs = FS.store.prefs();
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    state.tools = prefs.tools === true;
    state.palette = narrow ? false : prefs.palette !== false;
    state.view = narrow ? 'outline' : prefs.view === 'outline' ? 'outline' : 'canvas';

    const cur = FS.store.currentId();
    let sk = cur ? FS.store.load(cur) : null;
    if (!sk) {
      const next = FS.store.list().find((x) => !x.broken);
      sk = next ? FS.store.load(next.id) : null;
    }
    sketch = sk || M().newSketch();
    if (!FS.store.available) saveState = 'unavailable';

    FS.canvas.init(api);
    FS.side.init(api);
    FS.outline.init(api);
    initPalette();

    const titleEl = FS.ui.$('#sketch-title');
    titleEl.addEventListener('input', () => change((s) => { s.title = titleEl.value.slice(0, 120); }, { coalesce: 'title', from: 'title' }));
    titleEl.addEventListener('change', () => {
      if (!titleEl.value.trim()) change((s) => { s.title = M().DEFAULT_TITLE; });
    });
    titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); titleEl.blur(); } });

    FS.ui.$('#view-canvas').addEventListener('click', () => setView('canvas'));
    FS.ui.$('#view-outline').addEventListener('click', () => setView('outline'));
    FS.ui.$('.seg[role="tablist"]').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setView(state.view === 'canvas' ? 'outline' : 'canvas');
        FS.ui.$(state.view === 'canvas' ? '#view-canvas' : '#view-outline').focus();
      }
    });
    FS.ui.$('#tools-toggle').addEventListener('change', (e) => setTools(e.target.checked));
    FS.ui.$('#check-btn').addEventListener('click', () => toggleCheck());
    FS.ui.$('#undo-btn').addEventListener('click', undo);
    FS.ui.$('#redo-btn').addEventListener('click', redo);
    FS.ui.$('#help-btn').addEventListener('click', () => FS.ui.showHelp());
    FS.ui.$('#save-status').addEventListener('click', () => {
      FS.ui.dialog({
        title: 'Not saved in this browser',
        body: 'This browser is not letting Flow Sketch save. Your work is still on screen. Download a backup now so you do not lose it.',
        ok: 'Download backup', cancel: 'Not now',
      }).then((ok) => { if (ok) FS.exporter.downloadBackup(sketch); });
    });

    const sb = FS.ui.$('#sketches-btn'), sm = FS.ui.$('#sketches-menu');
    sb.addEventListener('click', () => FS.ui.toggleMenu(sb, sm, sketchesMenu));
    sm.addEventListener('click', onMenu);
    const eb = FS.ui.$('#export-btn'), em = FS.ui.$('#export-menu');
    eb.addEventListener('click', () => FS.ui.toggleMenu(eb, em, exportMenu));
    em.addEventListener('click', onMenu);

    const imp = FS.ui.$('#import-input');
    imp.addEventListener('change', () => { const f = imp.files && imp.files[0]; imp.value = ''; importFile(f); });

    document.addEventListener('keydown', onKey);
    // Another tab saved this same sketch: say so rather than silently overwriting it later.
    window.addEventListener('storage', (e) => {
      if (sketch && e.key === FS.store.keyFor(sketch.id) && e.newValue) {
        FS.ui.toast('This sketch was changed in another tab. Reload to see those changes.', {
          // Reload without saving this tab's copy over the newer one.
          warn: true, duration: 10000, action: { label: 'Reload', run: () => { suppressSave = true; location.reload(); } },
        });
      }
    });
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
    let errShown = 0;
    window.addEventListener('error', () => {
      if (Date.now() - errShown < 5000) return;
      errShown = Date.now();
      FS.ui.toast('Something went wrong. Your last saved version is safe.', { warn: true });
    });

    setView(state.view);
    FS.store.setCurrentId(sketch.id);
    requestAnimationFrame(() => { if (state.view === 'canvas') FS.canvas.fit(); });
    window.addEventListener('resize', () => { if (state.view === 'canvas' && !sketch.steps.length) FS.canvas.fit(); });
  }

  const api = {
    state,
    get sketch() { return sketch; },
    change, checkpoint, committed, undo, redo,
    select, addStep, connect, duplicate, deleteSelection, deleteStep, tidy,
    toggleCheck, setTools, setView, flagged, checkResult, openExample,
  };
  FS.app = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Flow Sketch: the canvas view. Cards are HTML, connections are SVG,
   both inside one transformed "world" layer. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});
  const G = FS.geom;
  const esc = (v) => FS.ui.esc(v);
  const M = () => FS.model;

  let app, root, canvas, world, edgesSvg, labelsLayer, cardsLayer, tempSvg, emptyEl, zoomLabel, keyPop;
  const vp = { x: 80, y: 80, z: 1 };
  const cardEls = new Map();
  let routes = new Map();
  let lastOrder = '';
  let drag = null;
  let connecting = null;
  let dropTarget = null;

  const MARKERS = {
    undecided: '#a3a9b3', manual: '#59606b', workspace: '#2f6fec', integration: '#2f6fec', sel: '#1d4fd7', flag: '#b7791f',
  };

  function init(appRef) {
    app = appRef;
    root = document.getElementById('canvas-view');
    canvas = document.getElementById('canvas');
    world = document.getElementById('world');
    edgesSvg = document.getElementById('edges');
    labelsLayer = document.getElementById('labels');
    cardsLayer = document.getElementById('cards');
    tempSvg = document.getElementById('temp');
    emptyEl = document.getElementById('empty');
    zoomLabel = document.getElementById('zoom-level');
    keyPop = document.getElementById('key-pop');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', () => endDrag(null));
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('click', onClick);

    document.getElementById('zoom-in').addEventListener('click', () => zoomCenter(1.2));
    document.getElementById('zoom-out').addEventListener('click', () => zoomCenter(1 / 1.2));
    document.getElementById('zoom-level').addEventListener('click', () => zoomCenter(1 / vp.z));
    document.getElementById('zoom-fit').addEventListener('click', fit);
    document.getElementById('tidy-btn').addEventListener('click', () => app.tidy());
    document.getElementById('key-btn').addEventListener('click', toggleKey);
    emptyEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-empty]');
      if (!b) return;
      if (b.dataset.empty === 'add') { const id = app.addStep({}); editTitle(id); }
      else app.openExample('nda');
    });

    applyViewport();
  }

  /* ---------- Viewport ---------- */

  function applyViewport() {
    world.style.transform = 'translate(' + vp.x + 'px,' + vp.y + 'px) scale(' + vp.z + ')';
    const g = 20 * vp.z;
    canvas.style.backgroundSize = g + 'px ' + g + 'px';
    canvas.style.backgroundPosition = vp.x + 'px ' + vp.y + 'px';
    zoomLabel.textContent = Math.round(vp.z * 100) + '%';
  }

  function clientToWorld(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left - vp.x) / vp.z, y: (cy - r.top - vp.y) / vp.z };
  }

  function isOverCanvas(cx, cy) {
    if (root.hidden) return false;
    const r = canvas.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  function zoomAt(cx, cy, factor) {
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const nz = Math.max(0.2, Math.min(2, vp.z * factor));
    const wx = (px - vp.x) / vp.z, wy = (py - vp.y) / vp.z;
    vp.z = nz;
    vp.x = px - wx * nz;
    vp.y = py - wy * nz;
    applyViewport();
  }

  function zoomCenter(f) {
    const r = canvas.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }

  function contentBounds() {
    const tools = app.state.tools;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    app.sketch.steps.forEach((s) => {
      const r = G.rect(s, tools);
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.r); maxY = Math.max(maxY, r.b);
    });
    routes.forEach((rt) => {
      minX = Math.min(minX, rt.minX); minY = Math.min(minY, rt.minY); maxX = Math.max(maxX, rt.maxX); maxY = Math.max(maxY, rt.maxY + 12);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function fit() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (!app.sketch.steps.length) {
      vp.z = 1; vp.x = Math.round(cw / 2 - G.W / 2); vp.y = Math.round(ch / 2 - 40);
      applyViewport();
      return;
    }
    const b = contentBounds();
    const pad = cw < 600 ? 28 : 64;
    const z = Math.max(0.2, Math.min(1, (cw - pad * 2) / b.w, (ch - pad * 2) / b.h));
    vp.z = z;
    vp.x = Math.round((cw - b.w * z) / 2 - b.x * z);
    vp.y = Math.round((ch - b.h * z) / 2 - b.y * z);
    applyViewport();
  }

  function centerOnPoint(x, y) {
    vp.x = Math.round(canvas.clientWidth / 2 - x * vp.z);
    vp.y = Math.round(canvas.clientHeight / 2 - y * vp.z);
    applyViewport();
  }

  /* Pan only when the item is off screen, so the view doesn't jump around. */
  function reveal(sel) {
    if (!sel || root.hidden) return;
    let x, y, w = 40, h = 20;
    if (sel.type === 'step') {
      const s = M().stepById(app.sketch, sel.id);
      if (!s) return;
      const r = G.rect(s, app.state.tools);
      x = r.x; y = r.y; w = r.w; h = r.h;
    } else {
      const rt = routes.get(sel.id);
      if (!rt) return;
      x = rt.lx - 40; y = rt.ly - 10; w = 80;
    }
    const cw = canvas.clientWidth, ch = canvas.clientHeight, pad = 48;
    const sx = x * vp.z + vp.x, sy = y * vp.z + vp.y;
    if (sx < pad || sy < pad || sx + w * vp.z > cw - pad || sy + h * vp.z > ch - pad) centerOnPoint(x + w / 2, y + h / 2);
  }

  /* ---------- Rendering ---------- */

  function render() {
    const sk = app.sketch;
    root.classList.toggle('tools', app.state.tools);
    const flagged = app.flagged();
    renderCards(flagged);
    renderEdges(flagged);
    emptyEl.hidden = sk.steps.length > 0;
    canvas.classList.toggle('connecting', !!(connecting && connecting.sticky));
  }

  function cardInner(s, tools, badge) {
    const perf = FS.find(FS.PERFORMERS, s.performer);
    const title = s.title.trim();
    let h = '<div class="card-main"><span class="perf perf-' + s.performer + '" title="' + esc(perf.name) + '">' + FS.icon(s.performer, 14) + '</span>' +
      '<span class="card-title' + (title ? '' : ' untitled') + '">' + esc(title || 'Untitled step') + '</span></div>';
    if (tools) {
      if (badge) {
        const p = M().product(s.tool);
        h += '<div class="badge" title="' + esc(M().toolLong(s.tool)) + '"><i style="background:' + p.color + '"></i><span>' + esc(badge) + '</span></div>';
      } else {
        h += '<div class="badge none">No tool yet</div>';
      }
    }
    h += '<span class="port" title="Drag or click to connect"></span>' +
      '<button type="button" class="add-next" tabindex="-1" title="Add next step" aria-label="Add next step">' + FS.icon('plus', 14) + '</button>';
    return h;
  }

  function renderCards(flagged) {
    const sk = app.sketch, st = app.state, tools = st.tools;
    const H = G.cardH(tools);
    const sel = st.selection;
    const ord = M().order(sk);
    const seen = new Set();
    ord.forEach((s, i) => {
      let el = cardEls.get(s.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'card';
        el.dataset.id = s.id;
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        cardsLayer.appendChild(el);
        cardEls.set(s.id, el);
      }
      seen.add(s.id);
      const badge = tools ? M().toolBadge(s.tool) : null;
      const sig = [s.title, s.performer, tools ? 1 : 0, badge || '', s.tool ? s.tool.product : ''].join('|');
      if (el._sig !== sig && !el._editing) { el.innerHTML = cardInner(s, tools, badge); el._sig = sig; }
      el.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px)';
      el.style.width = G.W + 'px';
      el.style.height = H + 'px';
      const isSel = !!(sel && sel.type === 'step' && sel.id === s.id);
      el.classList.toggle('selected', isSel);
      el.classList.toggle('flag', !!(flagged && flagged.has(s.id)));
      el.setAttribute('aria-pressed', isSel ? 'true' : 'false');
      const perf = FS.find(FS.PERFORMERS, s.performer);
      el.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + M().stepTitle(s) + '. ' + perf.name + '.' + (badge ? ' Tool: ' + badge + '.' : ''));
    });
    cardEls.forEach((el, id) => { if (!seen.has(id)) { el.remove(); cardEls.delete(id); } });
    // Keep DOM order = flow order so Tab moves along the flow.
    const sig = ord.map((s) => s.id).join(',');
    if (sig !== lastOrder && !anyEditing()) {
      const active = document.activeElement;
      ord.forEach((s) => cardsLayer.appendChild(cardEls.get(s.id)));
      lastOrder = sig;
      if (active && cardsLayer.contains(active) && document.activeElement !== active) active.focus({ preventScroll: true });
    }
  }

  function anyEditing() {
    let e = false;
    cardEls.forEach((el) => { if (el._editing) e = true; });
    return e;
  }

  function markerDefs() {
    return '<defs>' + Object.keys(MARKERS).map((k) =>
      '<marker id="fs-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">' +
      '<path d="M0,1.2 L9,5 L0,8.8 z" fill="' + MARKERS[k] + '"/></marker>').join('') + '</defs>';
  }

  function renderEdges(flagged) {
    const sk = app.sketch, st = app.state, tools = st.tools;
    const back = M().backEdges(sk);
    const rects = new Map(sk.steps.map((s) => [s.id, G.rect(s, tools)]));
    const sel = st.selection;
    routes = new Map();
    let minX = 0, minY = 0, maxX = 1, maxY = 1;
    let paths = '', labels = '';
    rects.forEach((r) => { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.r); maxY = Math.max(maxY, r.b); });
    sk.links.forEach((l) => {
      const a = rects.get(l.from), b = rects.get(l.to);
      if (!a || !b) return;
      const rt = G.route(a, b, back.has(l.id));
      routes.set(l.id, rt);
      minX = Math.min(minX, rt.minX); minY = Math.min(minY, rt.minY); maxX = Math.max(maxX, rt.maxX); maxY = Math.max(maxY, rt.maxY);
      const isSel = !!(sel && sel.type === 'link' && sel.id === l.id);
      const isFlag = !!(flagged && flagged.has(l.id));
      const cls = 'edge h-' + l.handoff + (isSel ? ' sel' : '') + (isFlag ? ' flag' : '');
      const marker = isSel ? 'sel' : l.handoff;
      paths += '<g class="' + cls + '" data-link="' + esc(l.id) + '">' +
        (isFlag ? '<path class="halo" d="' + rt.d + '"/>' : '') +
        '<path class="line" d="' + rt.d + '" marker-end="url(#fs-' + marker + ')"/>' +
        '<path class="hit" d="' + rt.d + '"/></g>';
      const lp = FS.exporter.labelParts(l);
      if (lp.cond || lp.what || lp.glyph || isSel) {
        const h = FS.find(FS.HANDOFFS, l.handoff);
        const tip = [lp.cond, lp.what].filter(Boolean).join(' · ') + (lp.cond || lp.what ? ' — ' : '') + h.name + (h.proposed ? ' (proposed)' : '');
        labels += '<div class="elabel h-' + l.handoff + (rt.loop ? ' loop' : '') + (isSel ? ' sel' : '') + (isFlag ? ' flag' : '') + (lp.cond || lp.what ? '' : ' glyph-only') +
          '" data-link="' + esc(l.id) + '" style="left:' + rt.lx.toFixed(1) + 'px;top:' + rt.ly.toFixed(1) + 'px" title="' + esc(tip) + '">' +
          (lp.glyph ? FS.icon(lp.glyph, 12, 'el-glyph') : '') +
          (lp.cond || lp.what ? '<span class="el-text">' + (lp.cond ? '<b>' + esc(lp.cond) + '</b>' : '') + (lp.cond && lp.what ? ' · ' : '') + esc(lp.what) + '</span>' : '') +
          (!lp.glyph && !lp.cond && !lp.what ? '<span class="el-text muted">Undecided</span>' : '') +
          '</div>';
      }
    });
    const pad = 120;
    const x = Math.floor(minX - pad), y = Math.floor(minY - pad), w = Math.ceil(maxX - minX + pad * 2), h = Math.ceil(maxY - minY + pad * 2);
    edgesSvg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    edgesSvg.setAttribute('width', w);
    edgesSvg.setAttribute('height', h);
    edgesSvg.style.left = x + 'px';
    edgesSvg.style.top = y + 'px';
    edgesSvg.innerHTML = markerDefs() + paths;
    labelsLayer.innerHTML = labels;
  }

  /* ---------- Pointer interaction ---------- */

  function cardAt(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    const c = el && el.closest ? el.closest('.card') : null;
    return c && cardsLayer.contains(c) ? c : null;
  }

  function onPointerDown(e) {
    const t = e.target;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    if (t.closest('.card-edit')) return;
    if (connecting && connecting.sticky) {
      e.preventDefault();
      const c = t.closest('.card');
      if (c && c.dataset.id !== connecting.from) finishConnect(c.dataset.id);
      else cancelConnect();
      return;
    }
    if (e.button === 1) { startPan(e); return; }
    const port = t.closest('.port');
    if (port) { startConnect(port.closest('.card').dataset.id, e); return; }
    if (t.closest('.add-next')) return;
    const card = t.closest('.card');
    if (card) {
      const s = M().stepById(app.sketch, card.dataset.id);
      if (!s) return;
      e.preventDefault();
      card.focus({ preventScroll: true });
      drag = { type: 'card', id: s.id, sx: e.clientX, sy: e.clientY, ox: s.x, oy: s.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const linkEl = t.closest('[data-link]');
    if (linkEl) {
      e.preventDefault();
      app.select({ type: 'link', id: linkEl.dataset.link });
      return;
    }
    startPan(e);
  }

  function startPan(e) {
    e.preventDefault();
    drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: vp.x, vy: vp.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
    if (document.activeElement && cardsLayer.contains(document.activeElement)) document.activeElement.blur();
  }

  function onPointerMove(e) {
    if (connecting) { drawTemp(e.clientX, e.clientY); }
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    if (drag.type === 'card') {
      if (!drag.moved) {
        if (dist < 4) return;
        drag.moved = true;
        app.checkpoint();
        const el = cardEls.get(drag.id);
        if (el) el.classList.add('dragging');
      }
      const s = M().stepById(app.sketch, drag.id);
      if (!s) return;
      s.x = G.snap(drag.ox + (e.clientX - drag.sx) / vp.z);
      s.y = G.snap(drag.oy + (e.clientY - drag.sy) / vp.z);
      const el = cardEls.get(s.id);
      if (el) el.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px)';
      renderEdges(app.flagged());
    } else if (drag.type === 'pan') {
      if (!drag.moved && dist < 3) return;
      drag.moved = true;
      canvas.classList.add('panning');
      vp.x = drag.vx + (e.clientX - drag.sx);
      vp.y = drag.vy + (e.clientY - drag.sy);
      applyViewport();
    } else if (drag.type === 'connect') {
      if (dist > 4) drag.moved = true;
      setDropTarget(cardAt(e.clientX, e.clientY));
    }
  }

  function onPointerUp(e) { endDrag(e); }

  function endDrag(e) {
    const d = drag;
    drag = null;
    canvas.classList.remove('panning');
    if (!d) return;
    if (d.type === 'card') {
      const el = cardEls.get(d.id);
      if (el) el.classList.remove('dragging');
      if (d.moved) app.committed('canvas');
      else if (e) app.select({ type: 'step', id: d.id });
    } else if (d.type === 'pan') {
      if (!d.moved && e) app.select(null);
    } else if (d.type === 'connect') {
      const target = e ? cardAt(e.clientX, e.clientY) : null;
      setDropTarget(null);
      if (target && target.dataset.id !== d.from) finishConnect(target.dataset.id);
      else if (!d.moved && e) {
        connecting.sticky = true;
        canvas.classList.add('connecting');
        FS.ui.announce('Choose the step to connect to. Press Escape to cancel.');
        FS.ui.toast('Click the step to connect to. Esc cancels.');
      } else cancelConnect();
    }
  }

  function startConnect(fromId, e) {
    e.preventDefault();
    e.stopPropagation();
    connecting = { from: fromId, sticky: false };
    drag = { type: 'connect', from: fromId, sx: e.clientX, sy: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    drawTemp(e.clientX, e.clientY);
  }

  function setDropTarget(el) {
    if (dropTarget === el) return;
    if (dropTarget) dropTarget.classList.remove('drop-target');
    dropTarget = el && el.dataset.id !== (connecting && connecting.from) ? el : null;
    if (dropTarget) dropTarget.classList.add('drop-target');
  }

  function drawTemp(cx, cy) {
    if (!connecting) return;
    const s = M().stepById(app.sketch, connecting.from);
    if (!s) return;
    const r = G.rect(s, app.state.tools);
    const p = clientToWorld(cx, cy);
    const k = Math.max(30, Math.abs(p.x - r.r) / 2);
    tempSvg.innerHTML = '<path d="M' + r.r + ',' + r.cy + ' C' + (r.r + k) + ',' + r.cy + ' ' + (p.x - k) + ',' + p.y + ' ' + p.x + ',' + p.y + '"/>';
    if (connecting.sticky) setDropTarget(cardAt(cx, cy));
  }

  function finishConnect(toId) {
    const from = connecting && connecting.from;
    cancelConnect();
    if (from) app.connect(from, toId);
  }

  function cancelConnect() {
    if (connecting && connecting.sticky) FS.ui.hideToast();
    connecting = null;
    tempSvg.innerHTML = '';
    setDropTarget(null);
    canvas.classList.remove('connecting');
  }

  function isConnecting() { return !!connecting; }

  function onClick(e) {
    const b = e.target.closest('.add-next');
    if (!b) return;
    const id = b.closest('.card').dataset.id;
    const nid = app.addStep({ after: id });
    editTitle(nid);
  }

  function onDblClick(e) {
    const card = e.target.closest('.card');
    if (card && !e.target.closest('.port, .add-next, .card-edit')) {
      app.select({ type: 'step', id: card.dataset.id });
      editTitle(card.dataset.id);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const d = Math.max(-50, Math.min(50, e.deltaMode ? e.deltaY * 16 : e.deltaY));
      zoomAt(e.clientX, e.clientY, Math.exp(-d * 0.006));
    } else {
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      vp.x -= dx;
      vp.y -= dy;
      applyViewport();
    }
  }

  function onKeyDown(e) {
    const card = e.target.closest && e.target.closest('.card');
    if (!card || FS.ui.isTextTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const id = card.dataset.id;
    const sel = app.state.selection;
    const selected = sel && sel.type === 'step' && sel.id === id;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      if (selected || e.key === 'F2') { app.select({ type: 'step', id }); editTitle(id); }
      else app.select({ type: 'step', id });
    } else if (e.key === ' ') {
      e.preventDefault();
      app.select({ type: 'step', id });
    } else if (e.key.indexOf('Arrow') === 0) {
      e.preventDefault();
      const n = e.shiftKey ? 40 : 8;
      const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0;
      const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      app.change((sk) => { const s = M().stepById(sk, id); s.x += dx; s.y += dy; }, { coalesce: 'nudge:' + id, from: 'canvas' });
      if (!selected) app.select({ type: 'step', id });
    }
  }

  /* ---------- Inline rename ---------- */

  function editTitle(id, opts) {
    opts = opts || {};
    const el = cardEls.get(id);
    const s = M().stepById(app.sketch, id);
    if (!el || !s || el._editing || root.hidden) return;
    reveal({ type: 'step', id });
    el._editing = true;
    el.classList.add('editing');
    const titleEl = el.querySelector('.card-title');
    const ta = document.createElement('textarea');
    ta.className = 'card-edit';
    ta.rows = 2;
    ta.maxLength = 80;
    ta.setAttribute('aria-label', 'Step name');
    const cat = FS.find(FS.CATEGORIES, s.category);
    ta.value = s.title || '';
    if (opts.fresh && cat && s.title === cat.verb) ta.value = cat.verb + ' ';
    ta.placeholder = 'Name this step';
    titleEl.replaceWith(ta);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
    let done = false;
    const finish = (commit, refocus) => {
      if (done) return;
      done = true;
      el._editing = false;
      el.classList.remove('editing');
      el._sig = null;
      const v = ta.value.replace(/\s+/g, ' ').trim().slice(0, 80);
      const cur = M().stepById(app.sketch, id);
      if (commit && cur && v !== cur.title) app.change((sk) => { M().stepById(sk, id).title = v; }, { from: 'canvas' });
      else render();
      if (refocus) { const again = cardEls.get(id); if (again) again.focus({ preventScroll: true }); }
    };
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true, true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false, true); }
    });
    ta.addEventListener('blur', () => finish(true, false));
    ta.addEventListener('pointerdown', (e) => e.stopPropagation());
    ta.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  /* ---------- Key (legend) ---------- */

  function toggleKey() {
    const btn = document.getElementById('key-btn');
    const open = keyPop.hidden;
    if (open) keyPop.innerHTML = FS.exporter.legendHtml() + '<p class="key-note">Arrows show the intended flow. They never mean an integration exists.</p>';
    keyPop.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  FS.canvas = {
    init, render, fit, reveal, editTitle, clientToWorld, isOverCanvas, isConnecting, cancelConnect,
    get viewport() { return vp; },
  };
})();

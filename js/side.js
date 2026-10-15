/* Flow Sketch: the details panel. Shows the selected step or connection,
   or the Check results. Essential fields first; the rest folds away. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});
  const esc = (v) => FS.ui.esc(v);
  const icon = (n, s, c) => FS.icon(n, s, c);
  const M = () => FS.model;

  let app, side;
  const userOpen = new Map(); // section -> open/closed, as the user left it

  function init(a) {
    app = a;
    side = document.getElementById('side');
    side.addEventListener('input', onInput);
    side.addEventListener('change', onChange);
    side.addEventListener('click', onClick);
    side.addEventListener('toggle', (e) => {
      const d = e.target;
      if (d.tagName === 'DETAILS' && d.dataset.sec && !side._rendering) userOpen.set(d.dataset.sec, d.open);
    }, true);
  }

  function secOpen(name, dflt) { return userOpen.has(name) ? userOpen.get(name) : dflt; }

  /* ---------- Small builders ---------- */

  function field(label, control, id, gloss) {
    return '<div class="field"><div class="field-label"><label for="' + id + '">' + esc(label) + '</label>' +
      (gloss ? FS.ui.glossBtn(gloss) : '') + '</div>' + control + '</div>';
  }
  function input(bind, val, ph, id, max) {
    return '<input type="text" id="' + id + '" data-bind="' + bind + '" data-fkey="' + id + '" value="' + esc(val) +
      '" placeholder="' + esc(ph || '') + '" maxlength="' + (max || 120) + '" autocomplete="off">';
  }
  function area(bind, val, ph, id) {
    return '<textarea id="' + id + '" data-bind="' + bind + '" data-fkey="' + id + '" rows="3" placeholder="' + esc(ph || '') +
      '" maxlength="4000">' + esc(val) + '</textarea>';
  }
  function select(bind, options, val, id, attrs) {
    return '<select id="' + id + '" data-bind="' + bind + '" data-fkey="' + id + '"' + (attrs || '') + '>' +
      options.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  }
  function checkbox(bind, val, label, id) {
    return '<label class="check"><input type="checkbox" id="' + id + '" data-bind="' + bind + '" data-fkey="' + id + '"' + (val ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }
  function head(kicker) {
    const back = app.state.checkOpen && app.state.selection;
    return '<div class="side-head">' +
      (back ? '<button type="button" class="link-btn back" data-act="back">' + icon('chevronLeft', 14) + 'Check</button>' : '') +
      '<span class="side-kicker">' + esc(kicker) + '</span>' +
      '<button type="button" class="icon-btn" data-act="close" aria-label="Close details" title="Close">' + icon('close') + '</button></div>';
  }
  function artifactOptions(blank) {
    return [['', blank]].concat(FS.ARTIFACTS.map((a) => [a.id, a.name]));
  }

  /* ---------- Step ---------- */

  function ioItem(l, dir) {
    const sk = app.sketch;
    const other = M().stepById(sk, dir === 'in' ? l.from : l.to);
    const h = FS.find(FS.HANDOFFS, l.handoff);
    const what = [l.condition.trim(), M().linkWhat(l) || 'Nothing named yet'].filter(Boolean).join(' · ');
    return '<button type="button" class="io-item" data-act="select-link" data-id="' + esc(l.id) + '">' +
      '<span class="io-main"><span class="io-step">' + (dir === 'in' ? 'From ' : 'To ') + esc(M().stepTitle(other)) + '</span>' +
      '<span class="io-what">' + esc(what) + '</span></span>' +
      '<span class="io-h h-' + l.handoff + '">' + (l.handoff !== 'undecided' ? icon(l.handoff, 12) : '') + esc(h.short) + '</span></button>';
  }

  function toolSection(s) {
    const t = s.tool || M().emptyTool();
    const p = M().product(t);
    let h = '<details class="sec" data-sec="tool"' + (secOpen('tool', app.state.tools) ? ' open' : '') + '>' +
      '<summary><span class="sec-title">Tool</span><span class="sum-val">' + esc(M().toolBadge(s.tool) || 'Optional') + '</span></summary><div class="sec-body">';
    h += field('Product', select('tool.product', [['', 'None yet']].concat(FS.PRODUCTS.map((x) => [x.id, x.name])), t.product, 'f-product'), 'f-product');
    if (p && p.nameField) h += field('Tool name', input('tool.productOther', t.productOther, 'Name of the tool', 'f-pother', 80), 'f-pother');
    if (p && p.surfaces.length) {
      h += field('Surface', select('tool.surface', [['', 'Not chosen']].concat(p.surfaces.map((x) => [x.id, x.name]), [['other', 'Other…']]), t.surface, 'f-surface'), 'f-surface', 'surface');
      if (t.surface === 'other') h += input('tool.surfaceOther', t.surfaceOther, 'Describe the surface', 'f-sother', 80);
    } else if (p && p.id === 'other') {
      h += field('Surface', input('tool.surfaceOther', t.surfaceOther, 'e.g. web app, add-in', 'f-sother', 80), 'f-sother', 'surface');
    }
    if (p && p.roleField) {
      h += field('Role', input('tool.setupName', t.setupName, 'e.g. Contracts attorney', 'f-role', 80), 'f-role');
    } else if (p) {
      h += field('Reusable setup', '<div class="row2">' + select('tool.setupKind', [['', 'None']].concat(p.setupKinds.map((k) => [k, k])), t.setupKind, 'f-skind', ' aria-label="Kind of setup"') +
        input('tool.setupName', t.setupName, 'Name', 'f-sname', 120) + '</div>', 'f-skind', 'setup');
      h += field('Supporting resources', input('tool.resources', t.resources, p.resourcesHint || 'Plugins, connectors…', 'f-res', 300), 'f-res', 'resources');
      h += checkbox('tool.confirmed', t.confirmed, 'We confirmed it is available to us', 'f-confirmed');
    }
    h += '<p class="hint">' + (p ? 'A candidate, not a verified capability. Changing it never changes the process.' : 'Sketch the process first. A tool is optional and never changes the process.') + '</p>';
    return h + '</div></details>';
  }

  function stepHtml(s) {
    const sk = app.sketch;
    const ord = M().order(sk);
    const n = ord.findIndex((x) => x.id === s.id) + 1;
    const ins = M().incoming(sk, s.id), outs = M().outgoing(sk, s.id);
    const targets = new Set(outs.map((l) => l.to));
    const perf = FS.PERFORMERS.map((p) =>
      '<label class="seg-opt"><input type="radio" name="perf" value="' + p.id + '" data-bind="performer" data-fkey="perf-' + p.id + '"' + (s.performer === p.id ? ' checked' : '') + '>' +
      '<span class="seg-face" title="' + esc(p.hint) + '"><span class="perf perf-' + p.id + '">' + icon(p.id, 12) + '</span>' + esc(p.name) + '</span></label>').join('');
    const cats = [['', 'No category']].concat(FS.CATEGORIES.map((c) => [c.id, c.name]));
    const connectOpts = ord.filter((x) => x.id !== s.id && !targets.has(x.id))
      .map((x) => '<option value="' + esc(x.id) + '">' + (ord.indexOf(x) + 1) + '. ' + esc(M().stepTitle(x)) + '</option>').join('');
    const extIn = s.extIn || { type: '', label: '' }, extOut = s.extOut || { type: '', label: '' };

    let h = head('Step ' + n) + '<div class="side-body">';
    h += field('Name', input('title', s.title, 'Verb first, e.g. Draft response', 'f-title', 80), 'f-title');
    h += '<div class="field"><div class="field-label"><span id="perf-lbl">Who does the work</span>' + FS.ui.glossBtn('human') + '</div>' +
      '<div class="seg-grid" role="radiogroup" aria-labelledby="perf-lbl">' + perf + '</div></div>';
    h += field('Kind of step', select('category', cats, s.category, 'f-cat'), 'f-cat');
    h += toolSection(s);

    h += '<div class="sec sec-static"><div class="sec-title">Inputs and outputs' + FS.ui.glossBtn('artifact') + '</div>';
    h += '<div class="io-label">Receives</div>' + (ins.length || s.extIn ? '' : '<p class="io-none">Nothing yet</p>');
    if (s.extIn) h += '<div class="io-ext">From outside: ' + esc(FS.exporter.artifactText(s.extIn)) + '</div>';
    h += ins.map((l) => ioItem(l, 'in')).join('');
    h += '<div class="io-label">Passes on</div>' + (outs.length || s.extOut ? '' : '<p class="io-none">Nothing yet</p>');
    h += outs.map((l) => ioItem(l, 'out')).join('');
    if (s.extOut) h += '<div class="io-ext">Leaves the sketch: ' + esc(FS.exporter.artifactText(s.extOut)) + '</div>';
    if (connectOpts) {
      h += '<div class="connect-row"><label class="sr-only" for="f-connect">Connect this step to</label>' +
        '<select id="f-connect" data-act="connect" data-fkey="f-connect"><option value="">Connect to…</option>' + connectOpts + '</select></div>';
    }
    h += '<details class="sub" data-sec="ext"' + (secOpen('ext', !!(s.extIn || s.extOut)) ? ' open' : '') + '><summary>Outside this sketch</summary>' +
      field('Starts with', '<div class="row2">' + select('extIn.type', artifactOptions('Type'), extIn.type, 'f-intype', ' aria-label="Type of starting input"') +
        input('extIn.label', extIn.label, 'e.g. Request form', 'f-inlabel') + '</div>', 'f-intype') +
      field('Produces', '<div class="row2">' + select('extOut.type', artifactOptions('Type'), extOut.type, 'f-outtype', ' aria-label="Type of final output"') +
        input('extOut.label', extOut.label, 'e.g. Weekly digest', 'f-outlabel') + '</div>', 'f-outtype') +
      '</details></div>';

    h += '<details class="sec" data-sec="more"' + (secOpen('more', false) ? ' open' : '') + '><summary><span class="sec-title">More details</span><span class="sum-val">' +
      esc(s.owner.trim() ? s.owner.trim() : 'Owner, purpose, notes') + '</span></summary><div class="sec-body">' +
      field('Owner', input('owner', s.owner, 'Role or team', 'f-owner', 200), 'f-owner') +
      field('Purpose', area('purpose', s.purpose, 'Why this step exists', 'f-purpose'), 'f-purpose') +
      field('Notes', area('notes', s.notes, '', 'f-notes'), 'f-notes') +
      field('Evidence and assumptions', area('evidence', s.evidence, 'What you know, what you are guessing', 'f-evidence'), 'f-evidence') +
      '</div></details>';
    h += '</div><div class="side-foot">' +
      '<button type="button" class="btn" data-act="duplicate">' + icon('copy', 14) + 'Duplicate</button>' +
      '<button type="button" class="btn danger" data-act="delete">' + icon('trash', 14) + 'Delete</button></div>';
    return h;
  }

  /* ---------- Connection ---------- */

  function linkHtml(l) {
    const sk = app.sketch;
    const from = M().stepById(sk, l.from), to = M().stepById(sk, l.to);
    const h = FS.find(FS.HANDOFFS, l.handoff);
    const ord = M().order(sk);
    const opts = (exclude) => ord.filter((x) => x.id !== exclude).map((x) => [x.id, (ord.indexOf(x) + 1) + '. ' + M().stepTitle(x)]);
    const handoffs = FS.HANDOFFS.map((x) =>
      '<label class="ho-opt"><input type="radio" name="handoff" value="' + x.id + '" data-bind="handoff" data-fkey="ho-' + x.id + '"' + (l.handoff === x.id ? ' checked' : '') + '>' +
      '<span class="ho-face"><span class="ho-glyph h-' + x.id + '">' + icon(x.id === 'undecided' ? 'undecided' : x.id, 14) + '</span>' +
      '<span class="ho-text"><span class="ho-name">' + esc(x.name) + (x.proposed ? ' <em>proposed</em>' : '') + '</span>' +
      '<span class="ho-hint">' + esc(x.hint) + '</span></span></span></label>').join('');

    let out = head('Connection') + '<div class="side-body">';
    out += '<div class="route"><button type="button" class="route-step" data-act="select-step" data-id="' + esc(from.id) + '">' + esc(M().stepTitle(from)) + '</button>' +
      icon('arrowRight', 14, 'route-arrow') + '<button type="button" class="route-step" data-act="select-step" data-id="' + esc(to.id) + '">' + esc(M().stepTitle(to)) + '</button></div>';
    out += field('What moves', '<div class="row2">' + select('artifact', artifactOptions('Type'), l.artifact, 'f-art', ' aria-label="Type of artifact"') +
      input('label', l.label, 'Name, e.g. Draft memo', 'f-label', 80) + '</div>', 'f-art', 'artifact');
    out += '<div class="field"><div class="field-label"><span id="ho-lbl">Handoff</span>' + FS.ui.glossBtn('handoff') + '</div>' +
      '<div class="ho-list" role="radiogroup" aria-labelledby="ho-lbl">' + handoffs + '</div></div>';
    if (l.handoff === 'manual') {
      out += '<div class="sub-fields">' +
        field('How it moves', select('method', [['', 'Not chosen']].concat(FS.MANUAL_METHODS.map((x) => [x.id, x.name])), l.method, 'f-method'), 'f-method') +
        field('Who moves it', input('who', l.who, 'Role or team', 'f-who', 200), 'f-who') + '</div>';
    } else if (h.proposed) {
      out += '<div class="sub-fields"><p class="proposed-note">' + icon('integration', 12) + 'Proposed, not verified. Test it in your environment before relying on it.</p>' +
        field('How it would work', input('how', l.how, l.handoff === 'workspace' ? 'e.g. Same Word file with tracked changes' : 'e.g. A flow saves the file to SharePoint', 'f-how', 1000), 'f-how',
          l.handoff === 'workspace' ? 'workspace' : 'integration') +
        checkbox('tested', l.tested, 'We tested this route', 'f-tested') + '</div>';
    }
    out += field('Condition', input('condition', l.condition, 'Optional, e.g. Approved, Needs changes', 'f-cond', 60), 'f-cond');
    out += '<details class="sec" data-sec="lmore"' + (secOpen('lmore', false) ? ' open' : '') + '><summary><span class="sec-title">More details</span><span class="sum-val">Notes, route</span></summary><div class="sec-body">' +
      field('Notes', area('notes', l.notes, '', 'f-lnotes'), 'f-lnotes') +
      field('From', select('from', opts(l.to), l.from, 'f-from'), 'f-from') +
      field('To', select('to', opts(l.from), l.to, 'f-to'), 'f-to') +
      '<button type="button" class="btn sm" data-act="reverse">Reverse direction</button>' +
      '</div></details>';
    out += '</div><div class="side-foot"><button type="button" class="btn danger" data-act="delete">' + icon('trash', 14) + 'Delete</button></div>';
    return out;
  }

  /* ---------- Check ---------- */

  function checkHtml() {
    const r = app.checkResult();
    const sm = r.summary;
    const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    const groups = [
      ['missing', 'Missing details'],
      ['handoffs', 'Uncertain handoffs'],
      ['look', 'Worth a look'],
      ['confirm', 'Confirm before building'],
    ];
    let h = head('Check') + '<div class="side-body">';
    h += '<p class="chk-summary">' + [plural(sm.steps, 'step'), plural(sm.human, 'human step'), plural(sm.manual, 'manual transfer'), plural(sm.proposed, 'proposed handoff')].join(' · ') + '</p>';
    if (!sm.steps) h += '<p class="chk-ok">Add a few steps, then check again.</p>';
    else if (!r.total) h += '<p class="chk-ok">' + icon('check', 14) + 'No gaps found.</p>';
    groups.forEach((g) => {
      const items = r.groups[g[0]];
      if (!items.length) return;
      const list = '<ul>' + items.map((it) => '<li><button type="button" class="chk-item" data-act="goto" data-type="' + it.type + '" data-id="' + esc(it.id) + '">' + esc(it.text) + '</button></li>').join('') + '</ul>';
      const title = '<h3>' + esc(g[1]) + '<span class="count">' + items.length + '</span></h3>';
      // Confirmation reminders are secondary, so they start folded.
      if (g[0] === 'confirm') {
        h += '<details class="chk-group chk-confirm" data-sec="confirm"' + (secOpen('confirm', false) ? ' open' : '') + '><summary>' + title + '</summary>' + list + '</details>';
      } else {
        h += '<div class="chk-group chk-' + g[0] + '">' + title + list + '</div>';
      }
    });
    if (!app.state.tools && sm.steps) h += '<p class="hint">Turn on Tools to also check tool choices.</p>';
    return h + '</div>';
  }

  /* ---------- Render ---------- */

  function render() {
    const st = app.state, sel = st.selection;
    let html = '', mode = null;
    if (sel && sel.type === 'step') { const s = M().stepById(app.sketch, sel.id); if (s) { html = stepHtml(s); mode = 'step'; } }
    else if (sel && sel.type === 'link') { const l = M().linkById(app.sketch, sel.id); if (l) { html = linkHtml(l); mode = 'link'; } }
    else if (st.checkOpen) { html = checkHtml(); mode = 'check'; }
    side.hidden = !mode;
    document.getElementById('app').classList.toggle('side-open', !!mode);
    if (!mode) { side.innerHTML = ''; side._key = null; return; }
    const key = mode + ':' + (sel ? sel.id : '');
    side._rendering = true;
    if (side._key !== key) { side.innerHTML = html; side.scrollTop = 0; side._key = key; }
    else FS.ui.preserveFocus(side, () => { side.innerHTML = html; });
    side._rendering = false;
  }

  function focusTitle() {
    const el = side.querySelector('#f-title');
    if (el) { el.focus(); el.select(); }
  }

  /* ---------- Events ---------- */

  function target() {
    const sel = app.state.selection;
    if (!sel) return null;
    return sel;
  }

  function applyPath(obj, path, value) {
    const parts = path.split('.');
    const a = parts[0], b = parts[1];
    if (!b) { obj[a] = value; return; }
    if (a === 'tool') {
      if (b === 'product') {
        if (!value) { obj.tool = null; return; }
        if (obj.tool && obj.tool.product === value) return;
        const t = M().emptyTool();
        t.product = value;
        obj.tool = t;
        return;
      }
      if (!obj.tool) return;
      obj.tool[b] = value;
      if (b === 'surface' && value !== 'other') obj.tool.surfaceOther = '';
      return;
    }
    if (a === 'extIn' || a === 'extOut') {
      const cur = obj[a] || { type: '', label: '' };
      cur[b] = value;
      obj[a] = cur.type || cur.label.trim() ? cur : null;
    }
  }

  function setField(path, value, isText) {
    const sel = target();
    if (!sel) return;
    if (sel.type === 'link' && (path === 'from' || path === 'to')) {
      const l = M().linkById(app.sketch, sel.id);
      const from = path === 'from' ? value : l.from, to = path === 'to' ? value : l.to;
      if (from === to || app.sketch.links.some((x) => x.id !== l.id && x.from === from && x.to === to)) {
        FS.ui.toast('Those steps are already connected.');
        render();
        return;
      }
    }
    app.change((sk) => {
      const obj = sel.type === 'step' ? M().stepById(sk, sel.id) : M().linkById(sk, sel.id);
      if (obj) applyPath(obj, path, value);
    }, { coalesce: isText ? sel.id + ':' + path : null, from: isText ? 'side-text' : 'side' });
  }

  function onInput(e) {
    const t = e.target;
    if (!t.dataset.bind || t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio') return;
    setField(t.dataset.bind, t.value, true);
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset.act === 'connect') {
      const sel = target();
      if (t.value && sel) app.connect(sel.id, t.value, { select: false, from: 'side' });
      return;
    }
    if (!t.dataset.bind) return;
    if (t.type === 'checkbox') setField(t.dataset.bind, t.checked, false);
    else if (t.tagName === 'SELECT' || t.type === 'radio') setField(t.dataset.bind, t.value, false);
  }

  function onClick(e) {
    const g = e.target.closest('[data-gloss]');
    if (g) { FS.ui.glossaryPop(g.dataset.gloss, g); return; }
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const sel = target();
    switch (b.dataset.act) {
      case 'close':
        if (sel) app.select(null);
        else app.toggleCheck(false);
        break;
      case 'back': app.select(null); break;
      case 'select-link': app.select({ type: 'link', id: b.dataset.id }, { reveal: true }); break;
      case 'select-step': app.select({ type: 'step', id: b.dataset.id }, { reveal: true }); break;
      case 'goto': app.select({ type: b.dataset.type, id: b.dataset.id }, { reveal: true }); break;
      case 'duplicate': if (sel) app.duplicate(sel.id); break;
      case 'delete': app.deleteSelection(); break;
      case 'reverse': {
        const l = sel && M().linkById(app.sketch, sel.id);
        if (!l) break;
        if (app.sketch.links.some((x) => x.from === l.to && x.to === l.from)) { FS.ui.toast('A connection already runs the other way.'); break; }
        app.change((sk) => { const x = M().linkById(sk, l.id); const f = x.from; x.from = x.to; x.to = f; }, { from: 'side' });
        break;
      }
    }
  }

  FS.side = { init, render, focusTitle };
})();

/* Flow Sketch: Outline view. The same sketch as an ordered, editable list,
   so the whole workflow can be built and connected without dragging. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});
  const esc = (v) => FS.ui.esc(v);
  const icon = (n, s, c) => FS.icon(n, s, c);
  const M = () => FS.model;

  let app, view, pendingFocus = null;

  function init(a) {
    app = a;
    view = document.getElementById('outline-view');
    view.addEventListener('input', onInput);
    view.addEventListener('change', onChange);
    view.addEventListener('click', onClick);
  }

  function opt(v, label, cur) {
    return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function linkRow(s, l, n, ord, num, showCond) {
    const sk = app.sketch;
    const taken = new Set(M().outgoing(sk, s.id).filter((x) => x.id !== l.id).map((x) => x.to));
    const targets = ord.filter((x) => x.id !== s.id && !taken.has(x.id))
      .map((x) => opt(x.id, num.get(x.id) + '. ' + M().stepTitle(x), l.to)).join('');
    const handoffs = FS.HANDOFFS.map((h) => opt(h.id, h.name + (h.proposed ? ' (proposed)' : ''), l.handoff)).join('');
    const to = M().stepById(sk, l.to);
    const sel = app.state.selection;
    const isSel = sel && sel.type === 'link' && sel.id === l.id;
    return '<li class="ol-link h-' + l.handoff + (isSel ? ' selected' : '') + '" data-lid="' + esc(l.id) + '">' +
      '<span class="ol-arrow" aria-hidden="true">' + icon('arrowRight', 14) + '</span>' +
      '<select class="ol-to" data-lbind="to" data-fkey="lt-' + esc(l.id) + '" aria-label="Step ' + n + ' passes to">' + targets + '</select>' +
      (showCond ? '<input type="text" class="ol-cond" data-lbind="condition" data-fkey="lc-' + esc(l.id) + '" value="' + esc(l.condition) +
        '" placeholder="When…" maxlength="60" aria-label="Condition for path to ' + esc(M().stepTitle(to)) + '">' : '') +
      '<input type="text" class="ol-what" data-lbind="label" data-fkey="ll-' + esc(l.id) + '" value="' + esc(l.label) +
        '" placeholder="' + esc(M().artifactName(l.artifact) || 'What moves') + '" maxlength="80" aria-label="What moves to ' + esc(M().stepTitle(to)) + '">' +
      '<select class="ol-ho" data-lbind="handoff" data-fkey="lh-' + esc(l.id) + '" aria-label="Handoff to ' + esc(M().stepTitle(to)) + '">' + handoffs + '</select>' +
      '<button type="button" class="icon-btn sm" data-act="link-details" aria-label="Connection details: step ' + n + ' to ' + esc(M().stepTitle(to)) + '" title="Details">' + icon('more') + '</button>' +
      '</li>';
  }

  function stepRow(s, n, ord, num, flagged) {
    const sk = app.sketch, tools = app.state.tools;
    const outs = M().outgoing(sk, s.id).sort((a, b) => num.get(a.to) - num.get(b.to));
    const targets = new Set(outs.map((l) => l.to));
    const sel = app.state.selection;
    const isSel = sel && sel.type === 'step' && sel.id === s.id;
    const perfOpts = FS.PERFORMERS.map((p) => opt(p.id, p.name, s.performer)).join('');
    const toolOpts = opt('', 'No tool yet', s.tool ? s.tool.product : '') + FS.PRODUCTS.map((p) => opt(p.id, p.name, s.tool ? s.tool.product : '')).join('');
    const connect = ord.filter((x) => x.id !== s.id && !targets.has(x.id)).map((x) => opt(x.id, num.get(x.id) + '. ' + M().stepTitle(x), '')).join('');
    const showCond = outs.length > 1 || s.category === 'decide';
    const badge = tools ? M().toolBadge(s.tool) : null;
    return '<li class="ol-step' + (isSel ? ' selected' : '') + (flagged && flagged.has(s.id) ? ' flag' : '') + '" data-sid="' + esc(s.id) + '">' +
      '<div class="ol-row">' +
      '<span class="ol-num" aria-hidden="true">' + n + '</span>' +
      '<span class="perf perf-' + s.performer + '" aria-hidden="true">' + icon(s.performer, 12) + '</span>' +
      '<input type="text" class="ol-title" data-bind="title" data-fkey="t-' + esc(s.id) + '" value="' + esc(s.title) +
        '" placeholder="Name this step" maxlength="80" aria-label="Step ' + n + ' name">' +
      '<select class="ol-perf" data-bind="performer" data-fkey="p-' + esc(s.id) + '" aria-label="Who does step ' + n + '">' + perfOpts + '</select>' +
      (tools ? '<select class="ol-tool" data-bind="tool.product" data-fkey="tp-' + esc(s.id) + '" aria-label="Tool for step ' + n + '" title="' + esc(badge || '') + '">' + toolOpts + '</select>' : '') +
      '<button type="button" class="icon-btn sm" data-act="add-after" aria-label="Add a step after step ' + n + '" title="Add after">' + icon('plus') + '</button>' +
      '<button type="button" class="icon-btn sm" data-act="details" aria-label="Details for step ' + n + '" title="Details">' + icon('more') + '</button>' +
      '</div>' +
      '<ul class="ol-links">' + outs.map((l) => linkRow(s, l, n, ord, num, showCond)).join('') +
      (connect ? '<li class="ol-connect"><span class="ol-arrow" aria-hidden="true">' + icon('plus', 14) + '</span>' +
        '<select data-act="connect" data-fkey="c-' + esc(s.id) + '" aria-label="Connect step ' + n + ' to another step"><option value="">Connect to…</option>' + connect + '</select></li>' : '') +
      '</ul></li>';
  }

  function render() {
    if (!view || view.hidden) return;
    const sk = app.sketch;
    const ord = M().order(sk);
    const num = new Map(ord.map((s, i) => [s.id, i + 1]));
    const flagged = app.flagged();
    let html;
    if (!ord.length) {
      html = '<div class="ol-wrap"><div class="ol-empty"><p>Add your first step.</p>' +
        '<div class="ol-empty-actions"><button type="button" class="btn primary" data-act="add-end">' + icon('plus', 14) + 'Add step</button>' +
        '<button type="button" class="btn" data-act="example">Open example</button></div></div></div>';
    } else {
      html = '<div class="ol-wrap"><div class="ol-head"><h2>Steps</h2><span class="muted">In flow order</span></div>' +
        '<ol class="ol-list">' + ord.map((s, i) => stepRow(s, i + 1, ord, num, flagged)).join('') + '</ol>' +
        '<div class="ol-foot"><button type="button" class="btn primary" data-act="add-end">' + icon('plus', 14) + 'Add step</button></div></div>';
    }
    FS.ui.preserveFocus(view, () => { view.innerHTML = html; });
    if (pendingFocus) {
      const el = view.querySelector('[data-fkey="t-' + CSS.escape(pendingFocus) + '"]');
      pendingFocus = null;
      if (el) { el.focus(); el.select(); el.scrollIntoView({ block: 'nearest' }); }
    }
  }

  function focusTitle(id) {
    pendingFocus = id;
    render();
  }

  /* ---------- Events ---------- */

  function setStep(id, path, value, isText) {
    app.change((sk) => {
      const s = M().stepById(sk, id);
      if (!s) return;
      if (path === 'tool.product') {
        if (!value) s.tool = null;
        else if (!s.tool || s.tool.product !== value) { s.tool = M().emptyTool(); s.tool.product = value; }
      } else s[path] = value;
    }, { coalesce: isText ? 'o:' + id + ':' + path : null, from: isText ? 'outline-text' : 'outline' });
  }

  function setLink(id, path, value, isText) {
    if (path === 'to') {
      const l = M().linkById(app.sketch, id);
      if (!l || value === l.from || app.sketch.links.some((x) => x.id !== id && x.from === l.from && x.to === value)) {
        FS.ui.toast('Those steps are already connected.');
        render();
        return;
      }
    }
    app.change((sk) => {
      const l = M().linkById(sk, id);
      if (l) l[path] = value;
    }, { coalesce: isText ? 'o:' + id + ':' + path : null, from: isText ? 'outline-text' : 'outline' });
  }

  function ids(t) {
    const step = t.closest('[data-sid]'), link = t.closest('[data-lid]');
    return { sid: step && step.dataset.sid, lid: link && link.dataset.lid };
  }

  function onInput(e) {
    const t = e.target;
    if (t.tagName === 'SELECT') return;
    const { sid, lid } = ids(t);
    if (t.dataset.bind && sid) {
      setStep(sid, t.dataset.bind, t.value, true);
      // Keep other rows' step pickers in step with the new name without re-rendering.
      if (t.dataset.bind === 'title') {
        const name = M().stepTitle(M().stepById(app.sketch, sid));
        view.querySelectorAll('option[value="' + CSS.escape(sid) + '"]').forEach((o) => {
          o.textContent = o.textContent.replace(/^(\d+\. ).*$/, '$1') + name;
        });
      }
    } else if (t.dataset.lbind && lid) setLink(lid, t.dataset.lbind, t.value, true);
  }

  function onChange(e) {
    const t = e.target;
    if (t.tagName !== 'SELECT') return;
    const { sid, lid } = ids(t);
    if (t.dataset.act === 'connect') {
      if (t.value && sid) {
        const to = t.value;
        app.connect(sid, to, { select: false, from: 'outline' });
        FS.ui.announce('Connected to ' + M().stepTitle(M().stepById(app.sketch, to)));
      }
      return;
    }
    if (t.dataset.lbind && lid) setLink(lid, t.dataset.lbind, t.value, false);
    else if (t.dataset.bind && sid) setStep(sid, t.dataset.bind, t.value, false);
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const { sid, lid } = ids(b);
    switch (b.dataset.act) {
      case 'add-after': {
        const id = app.addStep({ after: sid, insert: true, select: false, from: 'outline' });
        focusTitle(id);
        break;
      }
      case 'add-end': {
        const ord = M().order(app.sketch);
        const last = ord[ord.length - 1];
        const connectFrom = last && !M().outgoing(app.sketch, last.id).length ? last.id : null;
        const id = app.addStep({ after: connectFrom, select: false, from: 'outline' });
        focusTitle(id);
        break;
      }
      case 'details': app.select({ type: 'step', id: sid }); break;
      case 'link-details': app.select({ type: 'link', id: lid }); break;
      case 'example': app.openExample('nda'); break;
    }
  }

  FS.outline = { init, render, focusTitle };
})();

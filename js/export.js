/* Flow Sketch: JSON backup, standalone SVG diagram and print layout. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});
  const esc = (v) => FS.ui.esc(v);

  const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  const PERF = {
    human: { bg: '#fcefdf', fg: '#b45309' },
    ai: { bg: '#efebfc', fg: '#6a4bd6' },
    automated: { bg: '#e2f3f0', fg: '#0f7a71' },
    undecided: { bg: '#f1f2f4', fg: '#8a919c' },
  };
  const EDGE = {
    undecided: { stroke: '#a3a9b3', dash: '2 4', label: '#dfe2e6' },
    manual: { stroke: '#59606b', dash: '', label: '#c9ced6' },
    workspace: { stroke: '#2f6fec', dash: '5 4', label: '#c6d6fa' },
    integration: { stroke: '#2f6fec', dash: '11 4', label: '#c6d6fa' },
  };

  let ctx = null;
  function measure(text, font) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
  }
  function truncate(text, maxW, font) {
    if (measure(text, font) <= maxW) return text;
    let t = text;
    while (t.length > 1 && measure(t + '…', font) > maxW) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }
  function wrap(text, maxW, font, maxLines) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    words.forEach((w) => {
      const test = cur ? cur + ' ' + w : w;
      if (measure(test, font) <= maxW) cur = test;
      else { if (cur) lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      const rest = lines.slice(maxLines - 1).join(' ');
      lines.length = maxLines - 1;
      lines.push(truncate(rest, maxW, font));
    }
    return lines.map((l) => truncate(l, maxW, font));
  }

  function iconSvg(name, x, y, size, color) {
    return '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" stroke="' + color +
      '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + FS.ICONS[name] + '</svg>';
  }

  const TITLE_FONT = '600 14px ' + FONT;
  const LABEL_FONT = '11.5px ' + FONT;
  const LABEL_BOLD = '600 11.5px ' + FONT;
  const BADGE_FONT = '11px ' + FONT;
  const LABEL_MAX = 148;

  /* Label pieces for a connection, shared with the canvas so both match. */
  function labelParts(l) {
    const cond = (l.condition || '').trim();
    const what = FS.model.linkWhat(l);
    const glyph = l.handoff !== 'undecided' ? l.handoff : null;
    return { cond, what, glyph };
  }

  /* Standalone SVG of the diagram. opts: { tools, header, idPrefix } */
  function svg(sk, opts) {
    opts = opts || {};
    const tools = !!opts.tools;
    const P = opts.idPrefix || 'fsx';
    const G = FS.geom, m = FS.model;
    const H = G.cardH(tools);
    const back = m.backEdges(sk);
    const rects = new Map(sk.steps.map((s) => [s.id, G.rect(s, tools)]));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x0, y0, x1, y1) => { minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1); };
    rects.forEach((r) => grow(r.x, r.y, r.r, r.b));

    const edges = [], labels = [];
    sk.links.forEach((l) => {
      const a = rects.get(l.from), b = rects.get(l.to);
      if (!a || !b) return;
      const rt = G.route(a, b, back.has(l.id));
      grow(rt.minX, rt.minY, rt.maxX, rt.maxY);
      const st = EDGE[l.handoff] || EDGE.undecided;
      edges.push('<path d="' + rt.d + '" fill="none" stroke="' + st.stroke + '" stroke-width="1.6"' +
        (st.dash ? ' stroke-dasharray="' + st.dash + '"' : '') + ' stroke-linecap="round" marker-end="url(#' + P + '-' + l.handoff + ')"/>');
      const lp = labelParts(l);
      if (!lp.cond && !lp.what && !lp.glyph) return;
      // Measure and fit the label text.
      const gw = lp.glyph ? 16 : 0;
      const room = (rt.loop ? 230 : LABEL_MAX) - 14 - gw;
      let condT = lp.cond, whatT = lp.what;
      const sep = condT && whatT ? ' · ' : '';
      let cw = condT ? measure(condT, LABEL_BOLD) : 0;
      if (cw > room) { condT = truncate(condT, room, LABEL_BOLD); cw = measure(condT, LABEL_BOLD); whatT = ''; }
      const sw = sep && whatT ? measure(sep, LABEL_FONT) : 0;
      if (whatT) whatT = truncate(whatT, Math.max(0, room - cw - sw), LABEL_FONT);
      if (whatT === '…') whatT = '';
      const ww = whatT ? measure(whatT, LABEL_FONT) : 0;
      const textW = cw + (whatT && condT ? sw : 0) + ww;
      const w = Math.round(14 + gw + textW + (gw && !textW ? -4 : 0));
      const h = 20;
      const x = rt.lx - w / 2, y = rt.ly - h / 2;
      grow(x, y, x + w, y + h);
      let tx = x + 7;
      let s = '<g><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + h + '" rx="10" fill="#ffffff" stroke="' + st.label + '"/>';
      if (lp.glyph) {
        s += iconSvg(lp.glyph, (tx).toFixed(1), (y + 4).toFixed(1), 12, l.handoff === 'manual' ? '#59606b' : '#2f6fec');
        tx += gw;
      }
      if (textW) {
        s += '<text x="' + tx.toFixed(1) + '" y="' + (y + 14).toFixed(1) + '" font-size="11.5" fill="#3a4049">';
        if (condT) s += '<tspan font-weight="600">' + esc(condT) + '</tspan>';
        if (condT && whatT) s += '<tspan>' + esc(sep) + '</tspan>';
        if (whatT) s += '<tspan>' + esc(whatT) + '</tspan>';
        s += '</text>';
      }
      labels.push(s + '</g>');
    });

    const cards = sk.steps.map((s) => {
      const r = rects.get(s.id);
      const pc = PERF[s.performer] || PERF.undecided;
      const titleText = s.title.trim() || 'Untitled step';
      const lines = wrap(titleText, G.W - 24 - 30, TITLE_FONT, 2);
      const titleTop = tools ? 14 : (H - lines.length * 18) / 2;
      const cy = titleTop + lines.length * 9;
      let out = '<g transform="translate(' + r.x + ',' + r.y + ')">' +
        '<rect width="' + G.W + '" height="' + H + '" rx="10" fill="#ffffff" stroke="#d5d9df"/>' +
        '<circle cx="23" cy="' + cy + '" r="11" fill="' + pc.bg + '"/>' +
        iconSvg(s.performer, 16, cy - 7, 14, pc.fg) +
        '<text font-size="14" font-weight="600" fill="' + (s.title.trim() ? '#1d2026' : '#8a919c') + '"' + (s.title.trim() ? '' : ' font-style="italic"') + '>' +
        lines.map((ln, i) => '<tspan x="42" y="' + (titleTop + 13.5 + i * 18) + '">' + esc(ln) + '</tspan>').join('') +
        '</text>';
      if (tools) {
        const badge = m.toolBadge(s.tool);
        const by = H - 28;
        if (badge) {
          const p = m.product(s.tool);
          const bt = truncate(badge, G.W - 24 - 22, BADGE_FONT);
          const bw = Math.round(measure(bt, BADGE_FONT) + 24);
          out += '<rect x="12" y="' + by + '" width="' + bw + '" height="18" rx="5" fill="#f2f3f5"/>' +
            '<circle cx="21" cy="' + (by + 9) + '" r="3" fill="' + p.color + '"/>' +
            '<text x="28" y="' + (by + 12.6) + '" font-size="11" fill="#4b525c">' + esc(bt) + '</text>';
        } else {
          out += '<text x="14" y="' + (by + 12.6) + '" font-size="11" fill="#a3a9b3">No tool yet</text>';
        }
      }
      return out + '</g>';
    });

    if (!sk.steps.length) { minX = 0; minY = 0; maxX = 320; maxY = 80; }
    const pad = 28;
    const headH = opts.header ? 58 : 0;
    const footH = opts.header ? 30 : 0;
    const x0 = Math.floor(minX - pad), y0 = Math.floor(minY - pad - headH);
    const w = Math.ceil(maxX - minX + pad * 2), h = Math.ceil(maxY - minY + pad * 2 + headH + footH);

    const markers = Object.keys(EDGE).map((k) =>
      '<marker id="' + P + '-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">' +
      '<path d="M0,1.2 L9,5 L0,8.8 z" fill="' + EDGE[k].stroke + '"/></marker>').join('');

    let head = '', foot = '';
    if (opts.header) {
      head = '<text x="' + (x0 + pad) + '" y="' + (y0 + pad + 6) + '" font-size="18" font-weight="600" fill="#1d2026">' + esc(sk.title) + '</text>' +
        '<text x="' + (x0 + pad) + '" y="' + (y0 + pad + 26) + '" font-size="12" fill="#6b7280">Flow Sketch · ' + esc(new Date().toLocaleDateString()) + '</text>';
      foot = '<text x="' + (x0 + pad) + '" y="' + (y0 + h - 14) + '" font-size="11" fill="#6b7280">Planning sketch, not a running automation. Tools and proposed handoffs are unverified candidates.</text>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="' + x0 + ' ' + y0 + ' ' + w + ' ' + h +
      '" font-family=\'' + FONT + '\' role="img" aria-label="' + esc(sk.title) + '">' +
      '<title>' + esc(sk.title) + '</title><defs>' + markers + '</defs>' +
      '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="#ffffff"/>' +
      head + edges.join('') + labels.join('') + cards.join('') + foot + '</svg>';
  }

  /* ---------- Text descriptions for the appendix ---------- */

  function handoffText(l) {
    const method = FS.find(FS.MANUAL_METHODS, l.method);
    switch (l.handoff) {
      case 'manual':
        return 'Manual transfer' + (method ? ', ' + method.name.toLowerCase() : '') + (l.who.trim() ? ', by ' + l.who.trim() : '');
      case 'workspace':
      case 'integration': {
        const n = l.handoff === 'workspace' ? 'Same-workspace handoff' : 'Automated integration';
        return n + ' (proposed, ' + (l.tested ? 'tested by the team' : 'not tested') + ')' + (l.how.trim() ? ': ' + l.how.trim() : '');
      }
      default:
        return 'Handoff undecided';
    }
  }

  function artifactText(a) {
    if (!a) return '';
    const type = FS.model.artifactName(a.type);
    const label = (a.label || '').trim();
    return type && label ? type + ' “' + label + '”' : label ? '“' + label + '”' : type;
  }

  function linkArtifactText(l) {
    return artifactText({ type: l.artifact, label: l.label }) || 'Nothing named yet';
  }

  function legendHtml() {
    const p = (id, name) => '<span class="lg-item"><span class="perf perf-' + id + '">' + FS.icon(id, 12) + '</span>' + esc(name) + '</span>';
    const e = (id, name) => '<span class="lg-item"><svg width="34" height="10" aria-hidden="true"><path d="M1 5h32" stroke="' + EDGE[id].stroke + '" stroke-width="1.6"' +
      (EDGE[id].dash ? ' stroke-dasharray="' + EDGE[id].dash + '"' : '') + ' stroke-linecap="round"/></svg>' +
      (id !== 'undecided' ? FS.icon(id, 12, 'lg-glyph lg-' + id) : '') + esc(name) + '</span>';
    return '<div class="legend">' +
      '<div class="lg-row">' + p('human', 'Human') + p('ai', 'AI-assisted') + p('automated', 'Automated') + p('undecided', 'Undecided') + '</div>' +
      '<div class="lg-row">' + e('undecided', 'Handoff undecided') + e('manual', 'Manual transfer') + e('workspace', 'Same workspace (proposed)') + e('integration', 'Automated integration (proposed)') + '</div>' +
      '</div>';
  }

  /* One page when the diagram stays legible at landscape width (about four
     columns); otherwise print adds an ordered appendix. */
  function fitsOnePage(sk, diagram) {
    const d = diagram || svg(sk, {});
    const natural = (/width="(\d+)"/.exec(d) || [])[1] | 0;
    return sk.steps.length <= 6 && natural <= 1400;
  }

  function printHtml(sk, opts) {
    const tools = !!opts.tools;
    const m = FS.model;
    const ord = m.order(sk);
    const num = new Map(ord.map((s, i) => [s.id, i + 1]));
    const diagram = svg(sk, { tools, idPrefix: 'fsp' });
    const small = fitsOnePage(sk, diagram);
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    let html = '<section class="p-page p-overview' + (small ? ' p-single' : '') + '">' +
      '<header class="p-head"><h1>' + esc(sk.title) + '</h1><p>Flow Sketch · ' + esc(date) + ' · ' +
      sk.steps.length + ' step' + (sk.steps.length === 1 ? '' : 's') + (small ? '' : ' · ordered list follows') + '</p></header>' +
      '<div class="p-diagram">' + diagram + '</div>' + legendHtml() +
      '<p class="p-note">A planning sketch, not a running automation. Tools and proposed handoffs are unverified candidates; confirm availability and test each route in your environment.</p>' +
      '</section>';

    if (!small) {
      const rows = ord.map((s) => {
        const perf = FS.find(FS.PERFORMERS, s.performer);
        const cat = FS.find(FS.CATEGORIES, s.category);
        const sub = [];
        if (cat) sub.push(cat.name);
        if (s.extIn) sub.push('Starts with ' + artifactText(s.extIn));
        if (s.extOut) sub.push('Produces ' + artifactText(s.extOut));
        const det = [];
        if (s.owner.trim()) det.push('<b>Owner:</b> ' + esc(s.owner.trim()));
        if (s.purpose.trim()) det.push('<b>Purpose:</b> ' + esc(s.purpose.trim()));
        if (s.notes.trim()) det.push('<b>Notes:</b> ' + esc(s.notes.trim()));
        if (s.evidence.trim()) det.push('<b>Evidence:</b> ' + esc(s.evidence.trim()));
        const outs = m.outgoing(sk, s.id).sort((a, b) => num.get(a.to) - num.get(b.to)).map((l) => {
          const to = m.stepById(sk, l.to);
          return '<li><b>→ ' + num.get(l.to) + '. ' + esc(m.stepTitle(to)) + '</b>' +
            (l.condition.trim() ? ' <span class="p-cond">when ' + esc(l.condition.trim()) + '</span>' : '') +
            '<br>' + esc(linkArtifactText(l)) + ' · ' + esc(handoffText(l)) + '</li>';
        }).join('');
        return '<tr>' +
          '<td class="p-num">' + num.get(s.id) + '</td>' +
          '<td><div class="p-step">' + esc(m.stepTitle(s)) + '</div>' +
          (sub.length ? '<div class="p-sub">' + esc(sub.join(' · ')) + '</div>' : '') +
          (det.length ? '<div class="p-det">' + det.join('<br>') + '</div>' : '') + '</td>' +
          '<td>' + esc(perf ? perf.name : '') + '</td>' +
          (tools ? '<td>' + esc(m.toolLong(s.tool) || 'None yet') + (s.tool && s.tool.product && s.tool.product !== 'human' ? '<div class="p-sub">' + (s.tool.confirmed ? 'Availability confirmed by team' : 'Candidate, not confirmed') + '</div>' : '') + '</td>' : '') +
          '<td>' + (outs ? '<ul class="p-outs">' + outs + '</ul>' : '<span class="p-sub">End of flow</span>') + '</td>' +
          '</tr>';
      }).join('');
      html += '<section class="p-page p-appendix"><h2>Steps and handoffs</h2>' +
        '<table class="p-table"><thead><tr><th>#</th><th>Step</th><th>Who</th>' + (tools ? '<th>Candidate tool</th>' : '') +
        '<th>Passes on</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
    }
    return html;
  }

  /* ---------- Actions ---------- */

  function backupText(sk) {
    const copy = JSON.parse(JSON.stringify(sk));
    copy.exported = new Date().toISOString();
    return JSON.stringify(copy, null, 2);
  }

  function downloadBackup(sk) {
    FS.ui.download('flow-sketch-' + FS.ui.slug(sk.title) + '-' + FS.ui.today() + '.json', 'application/json', backupText(sk));
  }

  function downloadSvg(sk, tools) {
    const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg(sk, { tools, header: true });
    FS.ui.download('flow-sketch-' + FS.ui.slug(sk.title) + '-' + FS.ui.today() + '.svg', 'image/svg+xml', text);
  }

  function print(sk, tools) {
    const root = document.getElementById('print-root');
    root.innerHTML = printHtml(sk, { tools });
    const cleanup = () => { root.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  FS.exporter = { svg, printHtml, fitsOnePage, backupText, downloadBackup, downloadSvg, print, labelParts, legendHtml, handoffText, artifactText, LABEL_MAX, EDGE };
})();

/* Flow Sketch: small UI helpers shared by every panel. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]); }
  function $(sel, root) { return (root || document).querySelector(sel); }

  function isTextTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  /* Re-render a container without losing keyboard focus or caret position. */
  function preserveFocus(container, render) {
    const a = document.activeElement;
    let key = null, start = null, end = null;
    if (a && container.contains(a) && a.dataset && a.dataset.fkey) {
      key = a.dataset.fkey;
      try { start = a.selectionStart; end = a.selectionEnd; } catch (e) { /* not a text field */ }
    }
    const scroll = container.scrollTop;
    render();
    container.scrollTop = scroll;
    if (key) {
      const el = container.querySelector('[data-fkey="' + CSS.escape(key) + '"]');
      if (el) {
        el.focus({ preventScroll: true });
        if (start !== null) { try { el.setSelectionRange(start, end); } catch (e) { /* ignore */ } }
      }
    }
  }

  /* ---------- Announcements and toasts ---------- */

  let announceTimer = null;
  function announce(msg) {
    const el = $('#announce');
    if (!el) return;
    el.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { el.textContent = msg; }, 30);
  }

  let toastTimer = null;
  function toast(msg, opts) {
    const el = $('#toast');
    opts = opts || {};
    clearTimeout(toastTimer);
    el.innerHTML = '<span>' + esc(msg) + '</span>' +
      (opts.action ? '<button type="button" class="toast-btn">' + esc(opts.action.label) + '</button>' : '');
    el.hidden = false;
    el.classList.toggle('warn', !!opts.warn);
    if (opts.action) {
      el.querySelector('.toast-btn').addEventListener('click', () => { hideToast(); opts.action.run(); });
    }
    toastTimer = setTimeout(hideToast, opts.duration || (opts.action ? 6000 : 3200));
  }
  function hideToast() { const el = $('#toast'); if (el) el.hidden = true; }

  /* ---------- Modal dialog ---------- */

  function dialog(opts) {
    return new Promise((resolve) => {
      const d = $('#dialog');
      d.className = 'dialog' + (opts.wide ? ' wide' : '');
      d.innerHTML =
        '<form method="dialog" class="dialog-inner">' +
        '<div class="dialog-head"><h2 id="dialog-title">' + esc(opts.title) + '</h2>' +
        '<button type="button" class="icon-btn" data-close aria-label="Close">' + FS.icon('close') + '</button></div>' +
        '<div class="dialog-body">' + (opts.html || '<p>' + esc(opts.body || '') + '</p>') + '</div>' +
        (opts.ok || opts.cancel ? '<div class="dialog-foot">' +
          (opts.cancel ? '<button type="button" class="btn" data-close>' + esc(opts.cancel) + '</button>' : '') +
          (opts.ok ? '<button type="submit" class="btn ' + (opts.danger ? 'danger-solid' : 'primary') + '" value="ok">' + esc(opts.ok) + '</button>' : '') +
          '</div>' : '') +
        '</form>';
      d.setAttribute('aria-labelledby', 'dialog-title');
      let result = false;
      const done = () => { d.removeEventListener('close', done); resolve(result); };
      d.addEventListener('close', done);
      d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
      d.querySelector('form').addEventListener('submit', () => { result = true; });
      d.onclick = (e) => { if (e.target === d) d.close(); };
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      const focusEl = d.querySelector('[value="ok"]') || d.querySelector('[data-close]');
      if (focusEl) focusEl.focus();
      if (opts.onOpen) opts.onOpen(d);
    });
  }

  /* ---------- Menus ---------- */

  let openMenu = null;
  function closeMenus() {
    if (!openMenu) return;
    openMenu.menu.hidden = true;
    openMenu.button.setAttribute('aria-expanded', 'false');
    const b = openMenu.button;
    openMenu = null;
    return b;
  }
  function toggleMenu(button, menu, build) {
    if (openMenu && openMenu.menu === menu) { closeMenus(); return; }
    closeMenus();
    menu.innerHTML = build();
    menu.hidden = false;
    // On phones the menu is pinned below the toolbar, whatever its height.
    const bar = button.closest('.topbar');
    menu.style.top = bar && window.matchMedia('(max-width: 720px)').matches ? Math.round(bar.getBoundingClientRect().bottom + 6) + 'px' : '';
    button.setAttribute('aria-expanded', 'true');
    openMenu = { button, menu };
    const first = menu.querySelector('[role="menuitem"]');
    if (first) first.focus();
  }
  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !openMenu.menu.contains(e.target) && !openMenu.button.contains(e.target)) closeMenus();
    const pop = $('#gloss-pop');
    if (pop && !pop.hidden && !pop.contains(e.target) && !e.target.closest('[data-gloss]')) pop.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (!openMenu) return;
    const items = Array.from(openMenu.menu.querySelectorAll('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const b = closeMenus(); if (b) b.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    else if (e.key === 'Tab') closeMenus();
  }, true);

  /* ---------- Glossary ---------- */

  function glossaryPop(id, anchor) {
    const g = FS.find(FS.GLOSSARY, id);
    const pop = $('#gloss-pop');
    if (!g || !pop) return;
    if (!pop.hidden && pop.dataset.term === id) { pop.hidden = true; return; }
    pop.dataset.term = id;
    pop.innerHTML = '<div class="gloss-term">' + esc(g.term) + '</div><p>' + esc(g.text) + '</p>' +
      '<button type="button" class="link-btn" data-all-terms>All terms</button>';
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.querySelector('[data-all-terms]').addEventListener('click', () => { pop.hidden = true; showHelp(); });
  }

  function glossBtn(id) {
    const g = FS.find(FS.GLOSSARY, id);
    return '<button type="button" class="gloss-btn" data-gloss="' + esc(id) + '" aria-label="Explain: ' + esc(g ? g.term : id) + '" title="What does this mean?">' +
      FS.icon('help', 14) + '</button>';
  }

  function showHelp() {
    const terms = FS.GLOSSARY.map((g) => '<dt>' + esc(g.term) + '</dt><dd>' + esc(g.text) + '</dd>').join('');
    const keys = [
      ['Undo / redo', 'Ctrl Z / Ctrl Shift Z'],
      ['Rename step', 'Enter or double-click'],
      ['Move step', 'Arrow keys (Shift for bigger steps)'],
      ['Duplicate', 'Ctrl D'],
      ['Delete', 'Delete'],
      ['Pan / zoom', 'Scroll / Ctrl + scroll'],
      ['Deselect or cancel', 'Esc'],
    ].map((k) => '<tr><th>' + esc(k[0]) + '</th><td>' + esc(k[1]) + '</td></tr>').join('');
    return dialog({
      title: 'Help',
      wide: true,
      html:
        '<section class="help-sec"><h3>Your data</h3><p>Flow Sketch runs entirely in this browser. Sketches are saved only here, on this device, and clearing browser data removes them. That is not a backup: use <b>Export → Backup</b> to keep a copy. Nothing is sent anywhere, and sharing an export is a separate choice. Leave confidential matter details out.</p></section>' +
        '<section class="help-sec"><h3>Glossary</h3><dl class="gloss-list">' + terms + '</dl></section>' +
        '<section class="help-sec"><h3>Keyboard</h3><table class="keys">' + keys + '</table><p class="muted">The Outline view lets you build and connect a whole sketch without dragging.</p></section>',
    });
  }

  /* ---------- Files ---------- */

  function slug(s) {
    return (s || 'sketch').toLowerCase().replace(/\(example\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'sketch';
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  function download(filename, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function timeAgo(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.round(s / 86400) + ' d ago';
    return new Date(t).toLocaleDateString();
  }

  FS.ui = {
    esc, $, isTextTarget, preserveFocus, announce, toast, hideToast, dialog,
    toggleMenu, closeMenus, glossaryPop, glossBtn, showHelp, slug, today, download, timeAgo,
  };
})();

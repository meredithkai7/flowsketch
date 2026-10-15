/* Flow Sketch: on-demand planning check. Finds missing details and
   uncertain handoffs; never runs on its own or decorates the canvas. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});
  const M = () => FS.model;

  function q(s) { return '“' + M().stepTitle(s) + '”'; }

  function run(sk, opts) {
    const tools = !!(opts && opts.tools);
    const m = M();
    const ord = m.order(sk);
    const num = new Map(ord.map((s, i) => [s.id, i + 1]));
    const byId = new Map(sk.steps.map((s) => [s.id, s]));
    const groups = { missing: [], handoffs: [], look: [], confirm: [] };
    const flagged = new Set();
    const add = (group, type, id, text, flag) => {
      groups[group].push({ type, id, text });
      if (flag !== false) flagged.add(id);
    };

    ord.forEach((s) => {
      const outs = m.outgoing(sk, s.id), ins = m.incoming(sk, s.id);
      if (!s.title.trim()) add('missing', 'step', s.id, 'Name step ' + num.get(s.id));
      if (s.performer === 'undecided') add('missing', 'step', s.id, 'Choose who does ' + q(s));
      if (sk.steps.length > 1 && !outs.length && !ins.length) add('missing', 'step', s.id, q(s) + ' is not connected');
      if (s.category === 'decide') {
        if (outs.length < 2) add('look', 'step', s.id, q(s) + ' has only ' + (outs.length ? 'one path' : 'no paths') + ' out');
        else if (outs.some((l) => !l.condition.trim())) add('missing', 'step', s.id, 'Label each path out of ' + q(s));
      }
      if (tools && (s.performer === 'ai' || s.performer === 'automated') && !(s.tool && s.tool.product)) {
        add('missing', 'step', s.id, 'Pick a candidate tool for ' + q(s));
      }
      if (tools && s.tool && s.tool.product && s.tool.product !== 'human' && !s.tool.confirmed) {
        add('confirm', 'step', s.id, 'Confirm ' + m.toolBadge(s.tool) + ' is available for ' + q(s), false);
      }
    });

    ord.forEach((s) => {
      m.outgoing(sk, s.id).forEach((l) => {
        const to = byId.get(l.to);
        const pair = q(s) + ' → ' + q(to);
        const h = FS.find(FS.HANDOFFS, l.handoff);
        if (l.handoff === 'undecided') add('handoffs', 'link', l.id, 'Choose a handoff: ' + pair);
        else if (h && h.proposed && !l.how.trim()) add('handoffs', 'link', l.id, 'Describe how it would work: ' + pair);
        if (!m.linkWhat(l)) add('missing', 'link', l.id, 'Say what moves: ' + pair);
        if (h && h.proposed && !l.tested) add('confirm', 'link', l.id, 'Test the proposed route: ' + pair, false);
      });
    });

    // An AI-assisted step whose output can reach a delivery without a person checking it.
    sk.steps.forEach((s) => {
      if (s.performer !== 'ai') return;
      const seen = new Set([s.id]);
      const queue = m.outgoing(sk, s.id).map((l) => l.to);
      let hit = null;
      while (queue.length && !hit) {
        const id = queue.shift();
        if (seen.has(id)) continue;
        seen.add(id);
        const t = byId.get(id);
        if (!t || t.performer === 'human') continue;
        const outs = m.outgoing(sk, id);
        if (t.category === 'deliver' || !outs.length) { hit = t; break; }
        outs.forEach((l) => queue.push(l.to));
      }
      if (hit) add('look', 'step', s.id, 'No person checks ' + q(s) + ' before ' + q(hit));
    });

    const count = (pred) => sk.links.filter(pred).length;
    const summary = {
      steps: sk.steps.length,
      links: sk.links.length,
      human: sk.steps.filter((s) => s.performer === 'human').length,
      manual: count((l) => l.handoff === 'manual'),
      proposed: count((l) => l.handoff === 'workspace' || l.handoff === 'integration'),
      undecided: count((l) => l.handoff === 'undecided'),
    };
    const total = groups.missing.length + groups.handoffs.length + groups.look.length;
    return { groups, flagged, summary, total };
  }

  FS.check = { run };
})();

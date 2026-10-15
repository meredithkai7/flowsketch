/* Flow Sketch: two fictional examples. No real matters, people or data. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});

  function tool(product, surface, extra) {
    return Object.assign(FS.model.emptyTool(), { product, surface: surface || '' }, extra || {});
  }

  const EXAMPLES = [
    {
      id: 'nda',
      name: 'NDA intake and review',
      hint: '8 steps with a branch and a review loop',
      build() {
        const PX = FS.geom.PX, PY = FS.geom.PY;
        return {
          title: 'NDA intake and review (example)',
          steps: [
            { id: 'a1', title: 'Collect NDA requests', category: 'collect', performer: 'automated', x: 0, y: 0,
              owner: 'Legal operations', purpose: 'One place for business teams to send NDAs.',
              tool: tool('powerapps', 'canvas', { setupKind: 'App', setupName: 'NDA request form', resources: 'SharePoint list' }),
              extIn: { type: 'form', label: 'Request form' } },
            { id: 'a2', title: 'Extract key terms', category: 'transform', performer: 'ai', x: PX, y: 0,
              owner: 'Paralegal', purpose: 'Pull term, governing law, parties and unusual clauses into a table.',
              tool: tool('claude', 'web', { setupKind: 'Project', setupName: 'NDA intake' }) },
            { id: 'a3', title: 'Compare to playbook', category: 'review', performer: 'ai', x: 2 * PX, y: 0,
              purpose: 'Flag where the draft departs from our standard positions.',
              tool: tool('legora', 'web', { setupKind: 'Workflow', setupName: 'NDA playbook check' }) },
            { id: 'a4', title: 'Route by risk', category: 'decide', performer: 'human', x: 3 * PX, y: 0,
              owner: 'Contracts attorney', purpose: 'Decide whether the NDA can be approved as is.',
              tool: tool('human', '', { setupName: 'Contracts attorney' }) },
            { id: 'a5', title: 'Draft redlines', category: 'transform', performer: 'ai', x: 3 * PX, y: PY,
              tool: tool('legora', 'word') },
            { id: 'a6', title: 'Verify redlines', category: 'review', performer: 'human', x: 2 * PX, y: PY,
              owner: 'Contracts attorney', purpose: 'Check every change before it goes out.',
              tool: tool('human', '', { setupName: 'Contracts attorney' }) },
            { id: 'a7', title: 'Send response', category: 'deliver', performer: 'human', x: PX, y: PY,
              owner: 'Contracts attorney' },
            { id: 'a8', title: 'Log outcome', category: 'deliver', performer: 'automated', x: 0, y: PY,
              tool: tool('powerautomate', 'cloud', { setupKind: 'Flow', setupName: 'Update NDA tracker', resources: 'Outlook and SharePoint connectors' }),
              extOut: { type: 'table', label: 'NDA tracker' } },
          ],
          links: [
            { from: 'a1', to: 'a2', artifact: 'document', label: 'Counterparty NDA', handoff: 'integration',
              how: 'A flow saves the uploaded NDA to a review folder' },
            { from: 'a2', to: 'a3', artifact: 'table', label: 'Key terms', handoff: 'manual', method: 'copy', who: 'Paralegal' },
            { from: 'a3', to: 'a4', artifact: 'markup', label: 'Deviation report', handoff: 'workspace',
              how: 'Attorney reads the report in Legora' },
            { from: 'a4', to: 'a5', condition: 'Non-standard', artifact: 'document', label: 'NDA', handoff: 'manual',
              method: 'download', who: 'Contracts attorney' },
            { from: 'a4', to: 'a7', condition: 'Standard', artifact: 'document', label: 'NDA' },
            { from: 'a5', to: 'a6', artifact: 'markup', label: 'Redlined NDA', handoff: 'workspace',
              how: 'Same Word file with tracked changes' },
            { from: 'a6', to: 'a5', condition: 'Needs changes', artifact: 'text', label: 'Comments', handoff: 'workspace',
              how: 'Comments left in the Word file' },
            { from: 'a6', to: 'a7', condition: 'Approved', artifact: 'document', label: 'Final NDA', handoff: 'manual',
              method: 'drag', who: 'Contracts attorney' },
            { from: 'a7', to: 'a8', artifact: 'email', label: 'Sent reply', handoff: 'integration',
              how: 'A flow watches the shared mailbox and updates the tracker' },
          ],
        };
      },
    },
    {
      id: 'digest',
      name: 'Weekly regulatory digest',
      hint: '4 steps with a correction loop',
      build() {
        const PX = FS.geom.PX;
        return {
          title: 'Weekly regulatory digest (example)',
          steps: [
            { id: 'b1', title: 'Find new guidance', category: 'find', performer: 'ai', x: 0, y: 0,
              owner: 'Knowledge team', purpose: 'Find guidance published this week on our watch topics.',
              tool: tool('chatgpt', 'agent'),
              extIn: { type: 'sources', label: 'Regulator websites' } },
            { id: 'b2', title: 'Summarize changes', category: 'transform', performer: 'ai', x: PX, y: 0,
              tool: tool('claude', 'web', { setupKind: 'Skill', setupName: 'Digest format' }) },
            { id: 'b3', title: 'Verify claims', category: 'review', performer: 'human', x: 2 * PX, y: 0,
              owner: 'Practice lead', purpose: 'Check each summary against its source.',
              tool: tool('human', '', { setupName: 'Practice lead' }) },
            { id: 'b4', title: 'Send update', category: 'deliver', performer: 'automated', x: 3 * PX, y: 0,
              tool: tool('powerautomate', 'cloud', { setupKind: 'Flow', setupName: 'Send weekly digest', resources: 'Outlook connector' }),
              extOut: { type: 'email', label: 'Weekly digest' } },
          ],
          links: [
            { from: 'b1', to: 'b2', artifact: 'sources', label: 'Source links', handoff: 'manual', method: 'copy', who: 'Knowledge team' },
            { from: 'b2', to: 'b3', artifact: 'document', label: 'Draft digest', handoff: 'manual', method: 'download', who: 'Knowledge team' },
            { from: 'b3', to: 'b2', condition: 'Needs fixes', artifact: 'markup', label: 'Corrections', handoff: 'manual', method: 'copy', who: 'Practice lead' },
            { from: 'b3', to: 'b4', condition: 'Verified', artifact: 'document', label: 'Final digest', handoff: 'integration',
              how: 'A flow sends the file from the team folder to the list' },
          ],
        };
      },
    },
  ];

  FS.examples = {
    list: EXAMPLES.map((e) => ({ id: e.id, name: e.name, hint: e.hint })),
    /* A fresh, independent sketch built from the example. */
    create(id) {
      const ex = EXAMPLES.find((e) => e.id === id);
      if (!ex) return null;
      const data = ex.build();
      const sk = FS.model.newSketch(data.title);
      data.steps.forEach((s) => sk.steps.push(FS.model.newStep(sk, s)));
      data.links.forEach((l) => sk.links.push(FS.model.newLink(sk, l.from, l.to, l)));
      // Run through the same validation as an import.
      const res = FS.model.normalize(sk);
      res.sketch.id = sk.id;
      return res.sketch;
    },
  };
})();

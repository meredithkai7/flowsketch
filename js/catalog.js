/* Flow Sketch: vocabulary, candidate toolbox, glossary and icons.
   Organizers can edit PRODUCTS to match their own tool inventory. */
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});

  FS.CATEGORIES = [
    { id: 'collect', name: 'Collect', verb: 'Collect', hint: 'Gather requests or inputs' },
    { id: 'find', name: 'Find', verb: 'Find', hint: 'Search for sources or facts' },
    { id: 'transform', name: 'Transform', verb: 'Draft', hint: 'Draft, summarize, extract or convert' },
    { id: 'decide', name: 'Decide', verb: 'Decide', hint: 'Choose between paths' },
    { id: 'review', name: 'Review', verb: 'Review', hint: 'Check, verify or approve' },
    { id: 'deliver', name: 'Deliver', verb: 'Send', hint: 'Send, file or publish' },
  ];

  FS.PERFORMERS = [
    { id: 'human', name: 'Human', hint: 'A person does this work' },
    { id: 'ai', name: 'AI-assisted', hint: 'AI does part of it; a person directs and checks' },
    { id: 'automated', name: 'Automated', hint: 'Software does it without a person' },
    { id: 'undecided', name: 'Undecided', hint: 'Not chosen yet' },
  ];

  FS.ARTIFACTS = [
    { id: 'form', name: 'Form submission' },
    { id: 'text', name: 'Text' },
    { id: 'table', name: 'Table' },
    { id: 'email', name: 'Email' },
    { id: 'notification', name: 'Notification' },
    { id: 'document', name: 'Document' },
    { id: 'markup', name: 'Marked-up document' },
    { id: 'sources', name: 'Source collection' },
    { id: 'other', name: 'Other' },
  ];

  FS.HANDOFFS = [
    { id: 'undecided', name: 'Undecided', short: 'Undecided', hint: 'Not chosen yet', proposed: false },
    { id: 'manual', name: 'Manual transfer', short: 'Manual', hint: 'A person moves it unchanged', proposed: false },
    { id: 'workspace', name: 'Same workspace', short: 'Same workspace', hint: 'Already there in the next tool', proposed: true },
    { id: 'integration', name: 'Automated integration', short: 'Integration', hint: 'Software moves it', proposed: true },
  ];

  FS.MANUAL_METHODS = [
    { id: 'copy', name: 'Copy and paste' },
    { id: 'download', name: 'Download and upload' },
    { id: 'drag', name: 'Drag and drop' },
    { id: 'reenter', name: 'Re-enter information' },
    { id: 'other', name: 'Other' },
  ];

  /* Candidate toolbox. These are planning choices, not verified capability
     or integration claims. `badge` overrides the "Product · Surface" badge. */
  FS.PRODUCTS = [
    {
      id: 'human', name: 'Human expertise', short: 'Human', color: '#b45309',
      surfaces: [], setupKinds: [], roleField: true,
    },
    {
      id: 'chatgpt', name: 'ChatGPT', short: 'ChatGPT', color: '#0f8a6a',
      surfaces: [
        { id: 'web', name: 'Web app', short: 'Web' },
        { id: 'desktop', name: 'Desktop app', short: 'Desktop' },
        { id: 'mobile', name: 'Mobile app', short: 'Mobile' },
        { id: 'agent', name: 'Agent mode', short: 'Agent' },
        { id: 'codex', name: 'Codex (coding harness)', short: 'Codex', badge: 'Codex' },
      ],
      setupKinds: ['Custom GPT', 'Project', 'Saved prompt'],
      resourcesHint: 'e.g. a connector or app',
    },
    {
      id: 'claude', name: 'Claude', short: 'Claude', color: '#c2643f',
      surfaces: [
        { id: 'web', name: 'Web app', short: 'Web' },
        { id: 'desktop', name: 'Desktop app', short: 'Desktop' },
        { id: 'mobile', name: 'Mobile app', short: 'Mobile' },
        { id: 'code', name: 'Claude Code (coding harness)', short: 'Code', badge: 'Claude Code' },
        { id: 'chrome', name: 'Claude in Chrome (browser extension)', short: 'Chrome', badge: 'Claude in Chrome' },
        { id: 'excel', name: 'Claude for Excel (add-in)', short: 'Excel' },
      ],
      setupKinds: ['Project', 'Skill', 'Agent', 'Saved prompt'],
      resourcesHint: 'e.g. a connector or plugin',
    },
    {
      id: 'legora', name: 'Legora', short: 'Legora', color: '#3f4a5a',
      surfaces: [
        { id: 'web', name: 'Web app', short: 'Web' },
        { id: 'word', name: 'Word add-in', short: 'Word' },
      ],
      setupKinds: ['Workflow', 'Tabular review', 'Saved prompt'],
      resourcesHint: 'e.g. a document source',
    },
    {
      id: 'powerapps', name: 'Power Apps', short: 'Power Apps', color: '#8e3fb5',
      surfaces: [
        { id: 'canvas', name: 'Canvas app', short: 'Canvas app' },
        { id: 'model', name: 'Model-driven app', short: 'Model-driven' },
      ],
      setupKinds: ['App'],
      resourcesHint: 'e.g. a SharePoint list or Dataverse table',
    },
    {
      id: 'powerautomate', name: 'Power Automate', short: 'Power Automate', color: '#2563c9',
      surfaces: [
        { id: 'cloud', name: 'Cloud flow', short: 'Cloud flow' },
        { id: 'desktop', name: 'Desktop flow', short: 'Desktop flow' },
      ],
      setupKinds: ['Flow'],
      resourcesHint: 'e.g. an Outlook or SharePoint connector',
    },
    {
      id: 'other', name: 'Other tool', short: 'Other', color: '#7a828e',
      surfaces: [], setupKinds: ['Saved setup'], nameField: true,
    },
  ];

  FS.GLOSSARY = [
    { id: 'agent', term: 'Agent', text: 'An AI setup that works toward a goal over several steps, deciding what to do next: searching, reading files, using tools and checking its work. It still needs clear instructions and human review.' },
    { id: 'skill', term: 'Skill', text: 'A reusable package of instructions, sometimes with files or scripts, that teaches an AI tool to do one task the same way each time.' },
    { id: 'plugin', term: 'Plugin', text: 'An add-on bundle that extends a product, often packaging skills, commands or connectors together. It supports a product; it is not the product.' },
    { id: 'connector', term: 'Connector', text: 'A permissioned link that lets a tool read from or act in another system, such as SharePoint or Outlook. What is available depends on your organization.' },
    { id: 'harness', term: 'Harness', text: 'The program that runs an AI model and gives it tools and a place to work. A coding harness, such as Claude Code or Codex, lets the model read files and run commands.' },
    { id: 'surface', term: 'Surface', text: 'Where you use a product: its web app, desktop app, Word add-in, browser extension or coding harness. One product can behave differently on each.' },
    { id: 'setup', term: 'Reusable setup', text: 'Saved configuration you can use again, such as a project, custom GPT, skill, agent, saved workflow or flow.' },
    { id: 'resources', term: 'Supporting resources', text: 'Plugins, connectors, extensions or data sources a tool relies on for this step. They support the tool; list them so the team can confirm access.' },
    { id: 'artifact', term: 'Artifact', text: 'The information that moves between steps: a form submission, email, table, document or set of sources.' },
    { id: 'handoff', term: 'Handoff', text: 'How an artifact gets from one step to the next. Every connection starts undecided; drawing an arrow never means an integration exists.' },
    { id: 'manual', term: 'Manual transfer', text: 'A person moves the information unchanged: copy and paste, download and upload, drag and drop, or re-entering it.' },
    { id: 'workspace', term: 'Same-workspace handoff', text: 'Both steps happen in the same tool or shared space, so the information is already there. Proposed until you test it.' },
    { id: 'integration', term: 'Automated integration', text: 'Software moves the information without a person, for example a Power Automate flow. Proposed until it is built and tested.' },
    { id: 'human', term: 'Human expertise', text: 'Work that needs a person: prompting, interpreting, judging, verifying or approving. Give it its own step so it stays visible.' },
    { id: 'ai', term: 'AI-assisted', text: 'An AI tool does part of the work while a person directs it and checks the result.' },
    { id: 'automated', term: 'Automated', text: 'Software does the step without a person once it is set up.' },
  ];

  /* 16×16 stroke icons. Paths only, so they work in HTML and exported SVG. */
  FS.ICONS = {
    human: '<circle cx="8" cy="5.3" r="2.6"/><path d="M3.2 13.6c.5-2.7 2.4-4.3 4.8-4.3s4.3 1.6 4.8 4.3"/>',
    ai: '<path d="M7 2.2l1.2 3.1 3.1 1.2-3.1 1.2L7 10.8 5.8 7.7 2.7 6.5l3.1-1.2z"/><path d="M12 9.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/>',
    automated: '<circle cx="8" cy="8" r="5.4" stroke-width="2" stroke-dasharray="2.1 2.14"/><circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="1.4"/>',
    undecided: '<circle cx="8" cy="8" r="5.2" stroke-dasharray="2.2 2.3"/>',
    collect: '<path d="M2.5 9h3.2l.9 1.8h2.8l.9-1.8h3.2"/><path d="M4.3 3.5h7.4l1.8 5.5v3.5h-11V9z"/>',
    find: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.3 3.3"/>',
    transform: '<path d="M10.6 2.6l2.8 2.8-7.7 7.7-3.4.6.6-3.4z"/><path d="M9.2 4l2.8 2.8"/>',
    decide: '<path d="M8 1.8l6.2 6.2L8 14.2 1.8 8z"/>',
    review: '<circle cx="8" cy="8" r="5.8"/><path d="M5.4 8.2l1.8 1.8 3.5-3.7"/>',
    deliver: '<path d="M13.8 2.2L2.2 7.1l4.6 2.1 2.1 4.6z"/><path d="M13.8 2.2L6.8 9.2"/>',
    step: '<rect x="2.2" y="3.8" width="11.6" height="8.4" rx="2"/>',
    manual: '<path d="M5.4 8.4V4.1a1 1 0 0 1 2 0v3.5"/><path d="M7.4 7.3V3a1 1 0 0 1 2 0v4.3"/><path d="M9.4 7.4V4.2a1 1 0 0 1 2 0v4.6"/><path d="M11.4 6.6a1 1 0 0 1 2 0v3.2c0 2.4-1.7 4-4.1 4-1.6 0-2.7-.6-3.6-1.9L3.5 9.4a1 1 0 0 1 1.6-1.1l.3.3"/>',
    workspace: '<rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.6"/><path d="M6.2 13.8h5.6a2 2 0 0 0 2-2V6.2"/>',
    integration: '<path d="M9.2 1.8L3.6 9.1h4.1l-1 5.1 5.7-7.3H8.3z"/>',
    undo: '<path d="M5.2 3.8L2.4 6.6l2.8 2.8"/><path d="M2.6 6.6h7a3.8 3.8 0 0 1 0 7.6H7.4"/>',
    redo: '<path d="M10.8 3.8l2.8 2.8-2.8 2.8"/><path d="M13.4 6.6h-7a3.8 3.8 0 0 0 0 7.6h2.2"/>',
    plus: '<path d="M8 3.2v9.6M3.2 8h9.6"/>',
    minus: '<path d="M3.2 8h9.6"/>',
    fit: '<path d="M2.6 6V2.6H6M10 2.6h3.4V6M13.4 10v3.4H10M6 13.4H2.6V10"/>',
    tidy: '<rect x="1.8" y="2.8" width="5" height="3.6" rx="1"/><rect x="9.2" y="2.8" width="5" height="3.6" rx="1"/><rect x="9.2" y="9.6" width="5" height="3.6" rx="1"/><path d="M6.8 4.6h2.4M11.7 6.4v3.2"/>',
    close: '<path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/>',
    chevronLeft: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
    chevronRight: '<path d="M6 3.5L10.5 8 6 12.5"/>',
    chevronDown: '<path d="M3.5 6l4.5 4.5L12.5 6"/>',
    more: '<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>',
    trash: '<path d="M2.8 4.4h10.4M6.4 4.4V2.8h3.2v1.6M4.2 4.4l.6 8.8h6.4l.6-8.8"/>',
    copy: '<rect x="5.4" y="5.4" width="8" height="8" rx="1.6"/><path d="M3.2 10.4V3.8a1 1 0 0 1 1-1h6.6"/>',
    arrowRight: '<path d="M2.8 8h10.4M9.6 4.4L13.2 8l-3.6 3.6"/>',
    help: '<circle cx="8" cy="8" r="6"/><path d="M6.3 6.2a1.8 1.8 0 0 1 3.5.6c0 1.2-1.8 1.5-1.8 2.6"/><circle cx="8" cy="11.6" r=".5"/>',
    check: '<path d="M3.2 8.4l3 3 6.6-6.8"/>',
    download: '<path d="M8 2.6v7.6M4.8 7.2L8 10.4l3.2-3.2M2.8 12.8h10.4"/>',
    upload: '<path d="M8 10.4V2.8M4.8 6L8 2.8 11.2 6M2.8 12.8h10.4"/>',
    printer: '<path d="M4.4 6V2.6h7.2V6"/><rect x="2.2" y="6" width="11.6" height="5" rx="1.4"/><path d="M4.4 9.4h7.2v4H4.4z"/>',
    image: '<rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.8"/><path d="M2.6 11.2l3.4-3.4 2.6 2.6 1.8-1.8 3 3"/><circle cx="10.6" cy="5.8" r="1"/>',
    file: '<path d="M4 2.2h5l3 3v8.6H4z"/><path d="M9 2.2v3h3"/>',
    key: '<rect x="2.2" y="3" width="11.6" height="10" rx="1.8"/><path d="M5 6.2h1.4M5 9.8h1.4M8.4 6.2h3M8.4 9.8h3"/>',
    sparkle: '<path d="M8 2.4l1.4 4.2 4.2 1.4-4.2 1.4L8 13.6l-1.4-4.2L2.4 8l4.2-1.4z"/>',
  };

  FS.icon = function (name, size, cls) {
    const s = size || 16;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s +
      '" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (FS.ICONS[name] || '') + '</svg>';
  };

  FS.find = function (list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
})();

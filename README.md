# Flow Sketch

A lightweight visual planning tool for the OGC Agent Builder event. Teams map a
process, mark where AI or automation might help, and show the human work that
connects the steps. The output is a workflow sketch, not a running automation.

## Run it

It is a static site with no build step and no dependencies.

- **Quickest:** open `index.html` in a browser.
- **Local server:** `python -m http.server 8765`, then visit http://localhost:8765.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository (the files at the repository root).
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main`
   and `/ (root)`, and save.
4. The site appears at `https://<org-or-user>.github.io/<repo>/` within a minute or two.

## What's in it

- **Canvas** with a collapsible palette (Collect, Find, Transform, Decide,
  Review, Deliver). Click a palette item to add a step after the selected one,
  or drag it onto the canvas. Drag the dot on a card's right edge to connect,
  or click the dot and then click the target. The **+** beside a selected
  card adds the next step.
- **Outline** view: the same sketch as an ordered list. Add, name, connect and
  set handoffs with ordinary form controls, without dragging. Phones open here.
- **Details panel** for the selected step or connection. Essential fields
  come first; tool, outside inputs/outputs and notes fold away.
- **Handoffs** start *Undecided*. Teams can mark a *Manual transfer* (copy and
  paste, download and upload, drag and drop, re-entering) or a *proposed*
  same-workspace handoff or automated integration. Proposed handoffs are always
  labeled as proposed and unverified.
- **Tools** toggle shows one compact candidate-tool badge per card. Assigning
  or changing a tool never changes the process.
- **Check** lists missing details and uncertain handoffs on demand and
  highlights them on the canvas only while it is open.
- **Undo/redo**, duplicate, delete, keyboard moves, **Tidy** layout.
- **Sketches** menu: new sketch, two fictional examples, sketches saved in this
  browser, and backup import.
- **Export** menu: editable JSON backup, scalable SVG diagram, and print. Small
  sketches print on one page; larger ones add an ordered step-and-handoff
  appendix.

## Editing the candidate toolbox

The products, surfaces, setup kinds and glossary live in
[`js/catalog.js`](js/catalog.js). The default list (Human expertise, ChatGPT,
Claude, Legora, Power Apps, Power Automate, Other) is a starting point.
Organizers should adjust the surfaces to match what is actually licensed and
available at the event. Every choice is shown as a candidate, not a verified
capability.

## Data and privacy

- Everything runs in the browser. There are no accounts, servers, AI calls,
  connectors or analytics.
- Sketches are saved to this browser's local storage. **That is not a backup**:
  clearing browser data removes them. Use **Export → Backup** to keep a copy.
- Exports are files on the user's device; sharing them is a separate choice.
- The examples are fictional. Leave confidential matter details out of sketches.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | All styles, including phone and print layouts |
| `js/catalog.js` | Vocabulary, candidate toolbox, glossary, icons |
| `js/model.js` | Sketch data, geometry, flow order, layout, validation |
| `js/store.js` | Browser storage |
| `js/examples.js` | The two fictional examples |
| `js/check.js` | Planning check |
| `js/export.js` | JSON backup, SVG and print |
| `js/ui.js` | Toasts, dialogs, menus, glossary popover |
| `js/canvas.js` | Canvas view |
| `js/side.js` | Details panel and Check results |
| `js/outline.js` | Outline view |
| `js/app.js` | State, undo history, saving, toolbar, palette, shortcuts |

## Backup format

A backup is the sketch as readable JSON:

```json
{
  "format": "flowsketch",
  "version": 1,
  "title": "Weekly regulatory digest",
  "steps": [
    { "id": "s1", "title": "Find sources", "category": "find", "performer": "ai", "x": 0, "y": 0 },
    { "id": "s2", "title": "Summarize changes", "category": "transform", "performer": "ai", "x": 344, "y": 0 }
  ],
  "links": [
    { "from": "s1", "to": "s2", "artifact": "sources", "label": "Source links", "handoff": "manual", "method": "copy" }
  ]
}
```

Imports are validated before anything changes. Unknown values fall back to
safe defaults, broken connections are skipped and reported, and a file that
cannot be read leaves the current sketch untouched. Every import opens as a new
sketch. Steps without positions are laid out automatically.

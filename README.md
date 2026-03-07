# eoi-metadata-editor

EOI metadata editor is a lightweight web tool for managing asset metadata via editable table rows. It runs as a static page served by Vite during development and talks to the Squiz Matrix backend in production.

The editor supports:

- **Inline text editing** for attributes and metadata (click a field → textarea appears)
- **Single‑select and multi‑select dropdowns**, with a custom display div and **Save/Cancel buttons** for deliberate commits
- **Bootstrap datepicker** fields (configured with autoclose, today button, and linked behavior) that provide Save/Cancel actions
- Automatic coercion of multi‑select values to semicolon‑delimited strings before submission

All interactive logic lives in `src/editor.js`; when you need to adjust behavior (e.g. add a new field type, tweak datepicker options, or change how a control submits), edit that file and rebuild. The datepicker initialization specifically lives around line 256 and can be customized via its options object.

For datepicker tweaks:
1. `autoclose` – set to `true` to close after a selection.
2. `todayBtn` – values `true` (view navigation) or `"linked"` (select today and close).
3. `todayHighlight` – highlights today's date in the calendar.
4. Other standard bootstrap-datepicker options are available; see library docs for details.

These comments help future developers and coding agents quickly understand where to look and what to change.

### Quick start

```bash
npm install        # only needed once
npm run dev        # start Vite and open the dev page
```

Navigate to `http://localhost:5173/EOI%20metadata%20editor%20_%20NTG%20Central.html` and use the table exactly as production would.

The rest of the README focuses on high‑level architecture; see **Developer Notes** for build and sanitisation details.

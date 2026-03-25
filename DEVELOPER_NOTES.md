# EOI Metadata Editor — Developer Notes

## Overview

This tool is a browser-based inline editor for Squiz Matrix asset metadata and attributes. It is developed locally using Vite as a dev server, serving a saved copy of the production page (`EOI metadata editor _ NTG Central.html`) with local asset files.

Changes to interaction logic are made in `src/editor.js`, then deployed to the NTG Central Squiz Matrix instance. The HTML page itself is periodically re-saved from production and sanitised using the checklist below.

---

## Table of Contents

- [References](#references)
- [File Structure](#file-structure)
- [Local Dev Environment](#local-dev-environment)
- [HTML Sanitisation Checklist](#html-sanitisation-checklist) — run after every production re-save
- [Architecture](#architecture) — jQuery triple-load problem, IIFE, JS API, JS API methods, locking, HTML structure, edit controls, saving
- [Metadata & Attribute Field Reference](#metadata-field-id-reference)
- [DataTables Integration](#datatables-integration-march-2026) — init config, render functions, row invalidation, column filters
- [Interaction Behaviour & Editing Guidelines](#interaction-behaviour-and-editing-guidelines) — makeEditable, datepicker, dropdowns
- [Accessibility](#accessibility-and-interaction-behaviour) — keyboard nav, focus traps
- [Hover Edit Tooltip](#hover-edit-tooltip)
- [Status Column Colour System](#status-column-colour-system)
- [Agency–Advertise Cross-Field Rule](#agency-and-advertise-behaviour-2026-updates)
- [Event Delegation Pattern](#event-delegation-pattern-required-for-datatables-interactivity)
- [Squiz Matrix Template Reference](#squiz-matrix-asset-listing-template)
- [Squiz Matrix JS API Field Value Formats](#squiz-matrix-js-api--setmetadata-field-value-formats)
- [Quick Start & Decision Guide](#quick-start-developers-and-coding-agents)
- [Tooling Configuration](#tooling-configuration)
- [Change History](#2026-03-08-hover-edit-tooltip-system)

---

## References

- Squiz Matrix JavaScript API: https://docs.squiz.net/matrix/version/latest/api/javascript-api/index.html
- Bootstrap Datepicker: https://bootstrap-datepicker.readthedocs.io/

---

## File Structure

| File/Directory                                       | Role                                                                   | Editable?                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `EOI metadata editor _ NTG Central.html`             | Saved production page — the local dev entry point                      | Sanitise only (see checklist below) |
| `src/editor.js`                                      | Custom interaction logic — event handlers, API calls, UI feedback      | **Yes**                             |
| `src/update-metadata.js`                             | Squiz Matrix JS API library                                            | Read-only                           |
| `src/jquery-3.4.1.min.js`                            | jQuery 3.4.1                                                           | Read-only                           |
| `src/jquery.editable.js`                             | Jeditable inline-edit plugin — no longer used; kept as local copy only | Read-only                           |
| `src/datatables.lib.js`                              | DataTables library                                                     | Read-only                           |
| `src/bootstrap.min.css`                              | Bootstrap CSS (local copy)                                             | Read-only                           |
| `src/bootstrap-datepicker.*`                         | Bootstrap Datepicker JS and CSS                                        | Read-only                           |
| `src/eoi-metadata-editor.css`                        | Custom styles for this editor                                          | Yes                                 |
| `EOI metadata editor _ NTG Central_files/`           | Browser-saved production assets — gitignored; do not edit              | No (ignored)                        |
| `EOI metadata editor _ NTG Central_files/roboto.css` | Roboto font — replaced with Google Fonts `@import` to avoid CORS       | Read-only                           |
| `public/webfonts/`                                   | Font Awesome font files served by Vite at `/webfonts/`                 | Read-only                           |
| `public/cdn/userdata/`                               | Stub JSON responses for NTG Central user-profile API calls             | Yes (stubs)                         |
| `row-template.html`                                  | Squiz Matrix asset listing row template (source of truth for row HTML) | Yes                                 |
| `server-functions.html`                              | Squiz Matrix server-side helpers (`makeDropdown`, `makeMultiSelect`)   | Yes                                 |
| `vite.config.js`                                     | Vite configuration                                                     | Yes                                 |
| `package.json`                                       | npm scripts — `dev` starts Vite                                        | Yes                                 |
| `.prettierignore`                                    | Prevents Prettier from corrupting Squiz `%keyword%` syntax             | Yes                                 |
| `.vscode/settings.json`                              | Suppresses false VS Code HTML/JS errors in Squiz template files        | Yes                                 |

> **Rule:** Edit `row-template.html` and `server-functions.html` for template/field changes, and `editor.js` for interaction changes. Never modify `update-metadata.js`. The saved HTML page is re-fetched from production when rows change; apply the sanitisation checklist below after every refresh.

---

## Local Dev Environment

### Starting the dev server

```bash
npm run dev
```

Opens `http://localhost:5173/EOI%20metadata%20editor%20_%20NTG%20Central.html` in the browser.

### How it works

- Vite serves all files in the project root and `public/` as static assets.
- The saved HTML page references tracked assets from `./src/` and the remaining frame assets from `./EOI metadata editor _ NTG Central_files/` (gitignored, present only locally). Vite resolves both correctly.
- `public/webfonts/` contains local Font Awesome font files so `/webfonts/*.woff2` etc. resolve without a network request.
- `public/cdn/userdata/` contains stub JSON responses so NTG Central user-profile API calls (favourites, display name, user info) return valid empty data instead of 404-ing and throwing `SyntaxError`.
- `roboto.css` imports Roboto from Google Fonts (CORS-safe) instead of the NTG Central server.

### What doesn't work in local dev (expected)

| Error / Feature                             | Why                                                                                | Impact                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| Saving metadata changes                     | `js_api.setMetadata` calls the Squiz Matrix backend — not available at `localhost` | Can't test saves locally       |
| NTG Central profile/favourites API          | Backend calls to `/cdn/userdata/…` — stubs return empty data                       | Profile panel empty, no errors |
| `fa-light-300` icons render as solid weight | Font Awesome Light is Pro-only; stub copies the solid font file                    | Visual difference only         |

---

## Agency and advertise behaviour (2026 updates)

A special rule was introduced in March 2026: when a user saves a new Agency selection (`job.agency`, field ID `445640`), the Advertise field (`job.advertise`, field ID `446182`) is automatically recalculated and saved as `WoG;{agencyCode}` (or just `WoG` when Agency is blank). The linkage is implemented client-side in `editor.js` using the hardcoded field ID strings `"445640"` and `"446182"` — there are no named constants.

Key points for future developers:

- **Agency** uses the single-select dropdown popup (`.single-dropdown` — see _Edit control types_ in Architecture). The user opens it by clicking the display label, chooses from a native `<select>`, then clicks Save. The `.single-dropdown-actions [data-action='save']` handler calls `submit()` for Agency and then immediately derives `advertiseVals = newVal ? ["WoG", newVal] : ["WoG"]`, updates the Advertise `<select>` and its display label, and calls `submit()` for Advertise as well. There is no passive `change` listener.
- **Advertise** uses the checkbox multiselect popup (`.multiselect-dropdown`). When it opens, the handler reads the row's current Agency `<select>` value and renders checkboxes **only** for `WoG` plus that agency code (or `WoG` only when Agency is blank). NTG Central (WoG) is **not** force-checked — the user can uncheck it freely before saving.
- There is **no page-load normalization** of the Advertise field. Rows with extra agency codes in their saved advertise value will continue showing them until an Agency save triggers a resync.
- To add a new cross-field rule, follow the same pattern in `.single-dropdown-actions [data-action='save']`: after `submit(newVal, assetid, fieldid)`, derive the dependent value and call `submit(derivedVal, assetid, dependentFieldId)`, then update that field's hidden `<select>` and its `.metadata_option_display` text via `getOptionDisplayText`.

## DataTables customisations and UI features

Over the course of the project the vanilla DataTables integration has been
extensively modified to meet NTG Central’s UX requirements. Any developer or
coding agent touching `src/editor.js` should be familiar with these
customisations, since they are scattered between JS event handlers and the
accompanying CSS file.

### Filter/search bar with active pills

- Four column filters (`Status`, `Designation`, `Agency`, `Location`) are
  implemented via `filterConfigs` in `editor.js`. The `buildUniqueColValues`
  helper extracts values from the column data (splitting newline‑separated
  multi-value cells), and the dropdowns are populated with sorted unique
  options plus a contextually appropriate default label ("All status",
  "All agencies", etc.).
- Each `<select>` is hidden by default; `$filterBar` contains `<label>` and
  custom `<div>` wrappers for styling (`.dt-filter-item`,
  `.dt-filter-label`, `.dt-filter-select`) defined in
  `eoi-metadata-editor.css`.
- When a filter is chosen, `applyColumnFilter(cfg,val)` is called; it uses
  regex-based column search, with a special substring match for `multiVal`
  columns so that cells like `Angurugu\nDarwin` match "Darwin". Clearing a
  select removes the search.
- The search box generated by DataTables is moved into the same filter bar
  using `$filterBar.prepend(...)`, and `dtTable.on('search.dt', updateActiveFilters)`
  keeps the pills row in sync. A search term is displayed as a pill with an
  “×” remove button, just like column filters.
- `$activeFiltersRow` lies immediately below the filter bar and shows all
  active filters with `.dt-filter-pill` styling; pills are white with a
  dark blue border (`#102040`). Removing a pill resets the corresponding
  filter (or search) and redraws the table. A tertiary "Clear filters" button
  clears everything and is styled with `ntgc-btn--tertiary` and an
  override to suppress the default arrow icon.
- Horizontal padding utility classes (`ntgc-px-144` on bar and pills row,
  `ntgc-px-32` on `.dataTables_wrapper`) exist for consistent spacing and are
  defined in the CSS.

### Pagination and info row

- The default DataTables `dom` string is overridden to
  `<"dt-top-ctrl"lf><t><"dt-bottom-row"ip>` so we can flex items freely.
  The `dt-top-ctrl` container is hidden (since length+filter live in the
  custom bar). `dt-bottom-row` spans the full width and uses
  `margin-left:auto` to push `.dataTables_paginate` to the far right while
  `.dataTables_info` sits on the left.
- Pagination links use NTG blue (`#102040`), have no borders or background
  on hover, and active/disabled states are coloured appropriately. The CSS
  rules override Bootstrap/DataTables defaults.

### Sort icons and header interaction

- Native DataTables sort icons are suppressed. Instead the headers use
  `::after` pseudo‑elements that display a stacked muted chevron pair when
  unsorted, and a single coloured chevron for the sorted direction. The
  chevrons appear immediately adjacent to the column text (no extra padding
  is required). When the column is sorted ascending the chevron is nudged up
  6px for visual alignment.
- Sortable headers (`.sorting`, `.sorting_asc`, etc.) have `cursor: pointer`
  applied to indicate interactivity.

### Other notes

- The `.dt-filter-select` and the length `<select>` share a custom
  chevron-down SVG background; font-size, appearance and padding are
  normalised in CSS.
- `.dt-length-right` helper class (applied via JS) is used to push the
  length control to the right inside the flex row.
- When adding a new column filter, update `filterConfigs` and give the
  column index a corresponding `multiVal` boolean. The logic in
  `updateActiveFilters()` will automatically display pills for it.
- To clear the search programmatically, call
  `dtTable.search('').draw();` and update the input with jQuery as done in
  the clear‑button handler.

## Accessibility and interaction behaviour

A major 2026 update added **full keyboard accessibility** to every editable cell. Key points:

- All `.edit_area` and `.metadata_option_display` divs gain `tabindex="0"`, `role="button"` and an `aria-label` generated from `data-label`.
- Users can Tab through cells, press **Enter** to activate an inline editor or dropdown, and use **Escape** to cancel edits.
- During editing the code installs a focus trap that keeps **Tab**/ **Shift+Tab** within the current editor; moving past the last focusable element closes the editor and returns focus to the cell.
- Visual focus indicators (navy outlines) appear on hovered or focused cells; the existing hover tooltip also appears when a cell has keyboard focus.
- All dynamically created controls (textarea, save/cancel buttons, `<select>`, checkboxes, datepicker input) support standard focus outlines, so keyboard users can track focus during editing.

The implementation lives entirely in `src/editor.js` around the existing `makeEditable()` function and the dropdown/date logic. Any new field type should follow the same accessibility pattern: use `activateEdit()` helpers, call `attachFocusTrap()` if the UI has multiple focusable elements, and ensure focus returns to the origin cell on close.

## Status column colour system

In early 2026 the Status field was overhauled to provide lighter background colours for each value and apply them to the entire table cell rather than just the editable label. The feature uses a `data-status` attribute added to both the `<td>` and the `.metadata_option_display` div, with values

- `archive` (Archive)
- `under-construction` (Under Construction)
- `live` (Live)
- `safe-editing` (Safe Editing)

### HTML changes

The server-side row template (`row-template.html`) now computes the status slug and injects it twice. The `<td>` element itself receives the attribute so the colour can fill the full cell, while the inner display div preserves it for consistency. Example:

```html
<script runat="server">
  var currentstatus = "%asset_status_description%";
  var statusMapping = { '1': 'Archive', '2': 'Under Construction', '16': 'Live', '64': 'Safe Editing' };
  var statusCodeKey = '';
  var currentLower = String(currentstatus).toLowerCase().trim();

  Object.keys(statusMapping).forEach(function(code) {
    if (String(code).toLowerCase() === currentLower ||
        String(statusMapping[code]).toLowerCase() === currentLower) {
      statusCodeKey = String(statusMapping[code]).toLowerCase().replace(/ /g, '-');
    }
  });

  var dataStatus = statusCodeKey ? ' data-status="' + statusCodeKey + '"' : '';
  print('<td class="metadata-editor"' + dataStatus +
        ' style="background-color:%asset_status_colour%">');
</script>
<script runat="server">
  /* repeat mapping logic and then: */
  print('<div class="metadata_option_display" data-label="status"' +
        dataStatus + '>' + currentstatus + '</div>');
  print(makeStatusDropdown(currentstatus, 'status'));
</script>
</td>
```

The `%asset_status_colour%` inline style is left in place to provide a fallback when the CSS is not loaded (e.g. during sanitisation). It is safe to leave because our newer CSS rules use `!important` to override it.

### CSS rules

The corresponding styles live in `src/eoi-metadata-editor.css` and target the `td[data-status]` selector. Colours are defined in the NTG Central palette and must remain low‑contrast for readability:

```css
/* Status-specific background colours for entire cell */
td[data-status="archive"] {
  background-color: #e6d0c3 !important;
}
td[data-status="under-construction"] {
  background-color: #d3e8f6 !important;
}
td[data-status="live"] {
  background-color: #e4f1a5 !important;
}
td[data-status="safe-editing"] {
  background-color: #f9d4dd !important;
}
```

The same selectors also apply to `.metadata_option_display[data-status]` when the `<td>` is not present (e.g. in unit tests or isolated markup).

#### Why both td and div?

The `<td>` attribute ensures that the entire cell background is coloured, solving the complaint “the light background should apply to the cell as well, not just the editable”. The inner div is still annotated for two reasons:

1. the hover/tooltip styles reference the div directly via `edit_area`/`metadata_option_display` selectors, so having the attribute there avoids adding more specificity,
2. some legacy code reads `data-status` off the div when computing CSS classes for dropdown panels; duplicating the attribute avoids regressions.

### Adding new statuses

If new status values are added server-side, update `statusMapping` in both script blocks above and append the appropriate colour rules to the CSS file. The slug generation logic (`.toLowerCase().replace(/ /g, '-')`) should handle spaces automatically.

### Developer agent guidance

Coding agents looking to modify status behaviour can search for `data-status="` globally to find both HTML and CSS changes. The status‑pair updates are isolated and should not affect other features.

## Interaction behaviour and editing guidelines

Most logic that translates a user interaction into an API call lives in `src/editor.js`. When adding or modifying a field type, search for the following patterns:

- **Save/Cancel button style** – every editable control uses the same pair of buttons for consistency. The HTML is constructed in JavaScript, not hard‑coded in the HTML page. The convention is:

  ```js
  $('<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save">
      <span class="fal fa-save"></span> Save
    </button>');

  $('<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">
      Cancel
    </button>');
  ```

  - **Icon tags** always use `<span>` rather than `<i>` for FA5 compatibility.
  - The Save button has a pill-shaped border radius equal to its height; the cancel button has no icon and does not move on hover (the right-arrow pseudo‑element is suppressed by an override rule in `eoi-metadata-editor.css`).
  - Padding‑X is intentionally small (`0.5rem` on save, `0.25rem` on cancel) so the buttons don’t dominate narrow dropdown panels.
  - The surrounding action container has `display:flex` and `gap:4px` in both JS inline styles and CSS selectors (`.metadata_option_actions`, `.single-dropdown-actions`). Reducing the gap further is usually fine, but keep it symmetrical.
  - Event handlers look for `[data-action='save']` / `[data-action='cancel']` instead of Bootstrap classes, so the CSS can change without breaking logic.

- `makeEditable(...)` covers simple text/textarea cells. It injects a textarea plus the standard Save/Cancel buttons, and calls `onSave(value, $el)` when the user clicks Save.
- Dropdowns are always generated server‑side using `makeDropdown` or `makeMultiSelect` (see `server-functions.html`). On page load `editor.js` hides the `<select>`, prepends a clickable `<div class="metadata_option_display">` showing the current selection, and wires up:
  - click → open either the native `<select>` (single‑select) or a custom checkbox panel (multi‑select) and inject the standard buttons, recording the original value
  - Save → for multi‑selects the checkbox panel state is written back to the hidden `<select>`; `submit(...)` is then called and the `metadata_option_display` text refreshed. Multi‑select displays now use newline‑separated labels so each item appears on its own line.
  - Cancel or outside click → restore the original value and close without sending
  - the `submit` helper converts multiple selections to semicolon‑delimited strings as required by the API
- Date fields (`.edit_area[data-datepicker="true"]`) are wrapped in a `div` that launches a Bootstrap datepicker input when clicked. The picker now also uses explicit **Save/Cancel** buttons (previously blur/auto‑submit). The chosen date is converted to ISO format for server submission.

_New in 2026:_ multi‑select dropdowns use a checkbox panel instead of the native control. The panel is generated dynamically on each open and mirrors the `<option>` list. Developers can customise its CSS (`.multiselect-dropdown`, `.multiselect-list`) or modify the open/close logic in `editor.js` around line 190.

- Any new field type should follow the same UX: show a non‑editable label at rest and only commit when the user clicks Save.

> **Important:** dropdowns and datepickers previously auto‑saved on `change`; this behaviour was changed in 2026 to avoid accidental updates. The code in `editor.js` assumes no `change` handler submits automatically.

---

## HTML Sanitisation Checklist

Run this checklist from top to bottom every time the HTML page is re-saved from production. Steps can be automated with the provided PowerShell commands.

### 1. Remove `.download` extensions from asset filenames

**Why:** Browsers append `.download` to filenames when the server sends a `Content-Disposition: attachment` header. All references in the HTML must point to the correct local filenames.

**Find:** All occurrences of `.download` in the HTML file.

**Fix:**

- In the HTML, replace every `filename.ext.download` reference with `filename.ext`.
- In `EOI metadata editor _ NTG Central_files/`, rename any `*.download` files to the correct extension.
- If a `.download` file is a duplicate of an existing clean file, delete the `.download` version.
- If a file exists _only_ as `.download` (no clean version), rename it.

**Check:** `grep -c "\.download" "EOI metadata editor _ NTG Central.html"` should output `0`.

---

### 2. Remove the broken `JSON.parse('')` script

**Why:** The production page contains a Squiz Matrix template artefact that outputs an empty string into `JSON.parse()`. This throws `SyntaxError: Unexpected end of JSON input` in the browser console on every page load.

**Find and remove this exact tag** (appears once, in the page body):

```html
<script>
  console.log(JSON.parse(""));
</script>
```

**Check:** `grep "JSON.parse" "EOI metadata editor _ NTG Central.html"` should return no results.

---

### 3. Fix the Bootstrap CSS integrity attribute

**Why:** The `<link>` for `bootstrap.min.css` carries an `integrity` hash from the CDN version of the file. The local copy has a different hash, so the browser blocks it with a Subresource Integrity failure.

**Find** (approximately line 860):

```html
<link
  rel="stylesheet"
  href="./EOI metadata editor _ NTG Central_files/bootstrap.min.css"
  integrity="sha384-..."
  crossorigin="anonymous"
/>
```

**Fix:** Remove the `integrity` and `crossorigin` attributes:

```html
<link
  rel="stylesheet"
  href="./EOI metadata editor _ NTG Central_files/bootstrap.min.css"
/>
```

---

### 4. Fix the Font Awesome CSS link — remove integrity attribute

**Why:** The saved page carries an `integrity` hash on the local `all.css` link that will fail SRI verification (hash was generated from a different copy of the file).

**Find:**

```html
<link
  rel="stylesheet"
  href="./EOI metadata editor _ NTG Central_files/all.css"
  integrity="sha384-..."
  crossorigin="anonymous"
/>
```

**Fix:** Remove the `integrity` and `crossorigin` attributes:

```html
<link
  rel="stylesheet"
  href="./EOI metadata editor _ NTG Central_files/all.css"
/>
```

> `all.css` uses `../webfonts/` relative paths which resolve to `/webfonts/` at the dev server root. The font files live in `public/webfonts/` and are served by Vite from there.

---

### 5. Wrap `editor.js` in an IIFE

**Why:** The production HTML loads jQuery **three times**:

1. Line ~102 (`<head>`) — for early page scripts
2. Line ~2029 — immediately before `jquery.editable.js`, `bootstrap-datepicker.min.js`, and `editor.js`
3. Line ~2212 — with the NTG framework scripts (`auds.js`, `global-v2.js`, etc.)

The third load overwrites the global `$` and `jQuery` with a clean instance that has no plugins. Because `editor.js` uses `$(document).ready(...)`, by the time that callback fires `$` is the plugin-free jQuery#3, so `$.fn.editable` and `$.fn.datepicker` are undefined and all inline editing breaks.

**Fix in `editor.js`:** Wrap the entire file in an IIFE that captures the correct jQuery at script-evaluation time (when jQuery#2 is active and all plugins are registered):

```js
(function ($) {
  $(document).ready(function () {
    // ... all existing code unchanged ...
  });
})(jQuery);
```

**Check:** `head -1 "src/editor.js"` should output `(function ($) {`.

---

### 5.1 JavaScript API instantiation timing

**Why:** Another subtle script-order issue caused the `js_api.setAttribute is not a function` error. The NTG Central framework file `ntg-central-update-user-profile.js` (included after `editor.js` at line ~2216) re‑defines `window.Squiz_Matrix_API` with a pared‑down implementation that only exposes `setMetadata` and `setMetadataAllFields`. Any `Squiz_Matrix_API` instances created after that point will lack `setAttribute` and similar methods.

**Fix in `editor.js`:** instantiate the API object as soon as the IIFE runs, _before_ jQuery's ready handler, so it captures the full prototype supplied by `update-metadata.js`.

```js
(function ($) {
  // create before framework scripts run
  var apiOptions = new Array();
  apiOptions["key"] = "9772315187";
  var js_api = new Squiz_Matrix_API(apiOptions);

  $(document).ready(function () {
    // rest of the code may freely use js_api
  });
})(jQuery);
```

The earlier section on the IIFE already ensures the correct jQuery instance is used; this additional step guarantees the correct JS API instance.

---

### 6. Fix the deprecated `apple-mobile-web-app-capable` meta tag

**Why:** Generates a browser deprecation warning.

**Find:**

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
```

**Fix:**

```html
<meta name="mobile-web-app-capable" content="yes" />
```

---

### 7. Remove debug `console.log` statements

**Why:** The production page contains inline scripts that log debug information to the console (e.g. user asset IDs).

**Find and remove** any lines like:

```js
console.log(userAssetID + "uidtest");
```

**Check:** `grep "uidtest\|console\.log" "EOI metadata editor _ NTG Central.html"` — review each match and remove development-only logs.

---

### 8. Verify Roboto CSS is using Google Fonts

**Why:** The original `roboto.css` referenced fonts from `ntgcentral-dev.nt.gov.au`, which blocks cross-origin font requests in local dev. It has been replaced with a Google Fonts import, but a re-save from production may overwrite it.

**Check:** The first (and only) line of `EOI metadata editor _ NTG Central_files/roboto.css` should be:

```css
@import url("https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap");
```

**Fix (if overwritten):** Replace the entire file content with the single line above.

---

### 9. Restore `data-label` attributes

**Why:** The production server does not emit `data-label` attributes on any element. After re-saving the HTML, the hover edit tooltips will stop working (the tooltip pill will read just "Edit " with no column name).

**Fix:** Run this PowerShell block from the project root (adjust if field IDs change):

```powershell
$f = 'EOI metadata editor _ NTG Central.html'
$c = Get-Content $f -Raw -Encoding UTF8

# .edit_area divs
$c = $c -replace '(class="edit_area[^"]*" data-attributename="name")', '$1 data-label="file name"'
$c = $c -replace '(class="edit_area[^"]*" data-attributename="short_name")', '$1 data-label="title"'
$c = $c -replace '(class="edit_area[^"]*" data-attributename="title")', '$1 data-label="title"'
$c = $c -replace '(class="edit_area[^"]*" data-metadatafieldid="445504")', '$1 data-label="position title"'
$c = $c -replace '(class="edit_area[^"]*" data-metadatafieldid="445509"[^>]*data-datepicker="true")', '$1 data-label="close date"'
$c = $c -replace '(class="edit_area[^"]*" data-metadatafieldid="445506")', '$1 data-label="duration"'

# <select> elements
$c = $c -replace '(class="metadata_options"[^>]* data-metadatafieldid="445634")', '$1 data-label="designation"'
$c = $c -replace '(class="metadata_options"[^>]* data-metadatafieldid="445640")', '$1 data-label="agency"'
$c = $c -replace '(class="metadata_options"[^>]* data-metadatafieldid="445518")', '$1 data-label="location"'
$c = $c -replace '(class="metadata_options"[^>]* data-metadatafieldid="446182")', '$1 data-label="NTG Central / intranets"'

# remove any stale inline cursor style (editor.js now uses CSS)
$c = $c -replace '(class="metadata_option_display") style="cursor: pointer; min-height: 1em;"', '$1 style="min-height: 1em;"'

Set-Content $f $c -Encoding UTF8 -NoNewline
```

**Check:** `grep -c 'data-label=' "EOI metadata editor _ NTG Central.html"` — should report a non-zero count (approximately 9× number of rows, one per editable column per row).

---

### 10. Replace git_bridge URLs with local `./src/` paths

**Why:** When the HTML is re-saved from production it will contain absolute `https://ntgcentral.nt.gov.au/__data/assets/git_bridge/...?h=<hash>` URLs for every file in `src/`. These point to a specific committed version and bypass any local uncommitted edits; Vite cannot intercept them. Using `./src/` paths lets Vite serve the working copy so that local changes take effect immediately without a commit/push cycle.

**Find every git_bridge script/link** — there are typically 7 (3 CSS links + 4 JS scripts). `update-metadata.js` is loaded from a non-git-bridge production URL and must remain unchanged.

**Fix (PowerShell):**

```powershell
$f = 'EOI metadata editor _ NTG Central.html'
$c = Get-Content $f -Raw -Encoding UTF8
$c = $c -replace 'https://ntgcentral\.nt\.gov\.au/__data/assets/git_bridge/[^/]+/[^/]+/src/([^?]+)\?h=[a-f0-9]+', './src/$1'
Set-Content $f $c -Encoding UTF8 -NoNewline
```

**Check:** `grep -c "git_bridge" "EOI metadata editor _ NTG Central.html"` should output `0`.

---

### Post-sanitisation smoke test

After working through the checklist, start the dev server (`npm run dev`) and open the browser console. The following should be **absent**:

- `SyntaxError: Unexpected end of JSON input` (from `JSON.parse('')`)
- `ERR_BLOCKED_BY_SRI` or blocked stylesheet (Bootstrap / all.css integrity)
- `$(...).editable is not a function`
- 404s for `/webfonts/*.woff2` or `/webfonts/*.woff`
- CORS errors for `ntgcentral-dev.nt.gov.au` fonts
- The `uidtest` log line
- `SyntaxError` from `/cdn/userdata/` fetches

Hover over any editable cell — the **"✏ Edit [column name]"** tooltip should appear above the cell.

---

## Quick Start (Developers and Coding Agents)

Use this sequence for most changes to avoid regressions:

1. Identify whether the change is template, server helper, or interaction logic.
2. Edit only the source-of-truth file:
   - Template row markup → `row-template.html`
   - Select rendering helpers → `server-functions.html`
   - Browser interactions and API calls → `src/editor.js`
3. If a metadata field is a multi-select, ensure it is rendered with `makeMultiSelect()`.
4. Confirm `editor.js` submits multi-select values as `;`-joined strings.
5. Apply the updated template in Squiz Matrix and regenerate the listing output.
6. Re-save the HTML from production, run the sanitisation checklist, then validate.

### Fast Decision Guide

| Symptom                                             | File to change                                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Field displays wrong control type                   | `row-template.html`                                                                                                                                                |
| Options or selected state wrong for selects         | `server-functions.html`                                                                                                                                            |
| Saves duplicated or payload format wrong            | `editor.js`                                                                                                                                                        |
| Generated HTML looks stale                          | Re-publish/regenerate listing in Squiz Matrix                                                                                                                      |
| Console errors after re-saving HTML from production | Run the HTML Sanitisation Checklist above                                                                                                                          |
| Hover tooltip missing or shows wrong label          | Check `data-label` attribute (see step 9 of the sanitisation checklist); or update the label string in `row-template.html` / `makeDropdown`/`makeMultiSelect` call |
| Hover tooltip text or styling needs changing        | `src/eoi-metadata-editor.css` — `.edit_area:hover::before` / `::after` rules                                                                                       |
| File Name save fails on PROD but works on DEV       | The `name` attribute requires explicit `acquireLock` on the "details" screen; see _Locking for the `name` attribute_ in Architecture and the 2026-03-25 bug fix    |
| Inline editing broken                               | Check `editor.js` for event delegation (handlers must use `$(document).on()`, not direct jQuery binding); see Event Delegation section                             |
| Table sorting wrong on a column                     | Check `src/editor.js` DataTables init; if custom date format, add `columnDefs` entry with correct `targets` and sort-type render override                          |
| Changes not appearing in search / sort after edit   | Verify post-save callback calls `dtTable.row(tr).invalidate('dom').draw(false)`; see Row Invalidation in DataTables section                                        |
| Pagination controls not appearing                   | Verify DataTables initialization; check browser console for JS errors during `$('#myTable').DataTable({...})`                                                      |
| Filtering / global search not working               | Verify `searching: true` in DataTables config; test by typing in the search box above the table                                                                    |

---

## Metadata field ID reference

| Column             | Squiz field name   | Field ID | Type          | Notes                                                        |
| ------------------ | ------------------ | -------- | ------------- | ------------------------------------------------------------ |
| Position title     | `job.title`        | 445504   | Free text     | Inline textarea edit                                         |
| Designation        | `job.designation`  | 445634   | Multi-select  | All options unrestricted                                     |
| Close date         | `job.closing-date` | 445509   | Date          | Bootstrap datepicker; stored as ISO, displayed as DD/MM/YYYY |
| Vacancy duration   | `job.duration`     | 445506   | Free text     | Inline textarea edit                                         |
| Agency             | `job.agency`       | 445640   | Single-select | Saving also auto-saves Advertise (446182)                    |
| Location           | `job.location`     | 445518   | Multi-select  | All options unrestricted                                     |
| Where to advertise | `job.advertise`    | 446182   | Multi-select  | Options restricted to WoG + current Agency when editing      |

Attribute columns (not metadata — use `js_api.setAttribute`):

| Column    | `data-attributename` | Notes                                                                                                                         |
| --------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| File Name | `name`               | All asset types; requires explicit `acquireLock` on "details" screen (see _Locking for the `name` attribute_ in Architecture) |
| Title     | `title`              | File assets only (Word, PDF, etc.); server auto-locks "attributes" screen                                                     |
| Title     | `short_name`         | Non-file assets; `short_name→title` retry fallback active in `resultAttr()`; server auto-locks "attributes" screen            |

---

## Architecture

### HTML Structure

Each asset is a `<tr>` with the asset ID as its `id` attribute:

```html
<tr id="739076" data-status="Live"></tr>
```

Metadata fields are wrapped in `<td class="metadata-editor">`. There are two field types:

**Free-text field** — click-to-edit via the `makeEditable()` helper in `editor.js` (no external plugin):

```html
<td class="metadata-editor">
  <div class="edit_area" data-metadatafieldid="445504">Position Title Text</div>
</td>
```

**Select / Multi-select field** — uses a standard `<select>`:

```html
<td class="metadata-editor">
  <select
    multiple=""
    class="metadata_options"
    data-metadatafieldid="445634"
    data-current='["AO2"]'
  >
    <option value="AO2" selected="">Administrative Officer 2</option>
    ...
  </select>
</td>
```

- `data-metadatafieldid`: the Squiz Matrix metadata field ID to update
- `data-current`: JSON-encoded array of the pre-selected option value(s); used to restore the selection on page load
- `multiple=""`: present on multi-select fields; absent on single-select fields

Attribute fields (asset name, short name) use `<td class="attribute-editor">` with a `data-attributename` attribute, updated via `js_api.setAttribute`.

### jQuery triple-load problem

The production HTML loads jQuery 3.4.1 **three times**:

1. ~line 102 (`<head>`) — needed for early inline scripts in the page body
2. ~line 2029 — loaded immediately before the plugin scripts and `editor.js`
3. ~line 2212 — loaded with the NTG framework scripts (`auds.js`, `global-v2.js`, etc.)

Load #3 resets the global `$` and `jQuery` to a clean instance with no plugins. To prevent this from breaking `editor.js`, the **entire file is wrapped in an IIFE** that captures `jQuery` at evaluation time (when load #2 is current):

```js
(function ($) {
  $(document).ready(function () { ... });
}(jQuery));
```

This is a required invariant. If `editor.js` is ever rewritten without the IIFE wrapper, inline editing will silently break.

### JS API initialisation (`editor.js`)

```js
var apiOptions = new Array();
apiOptions["key"] = "9772315187";
var js_api = new Squiz_Matrix_API(apiOptions);
```

The API key must match the key configured on the JavaScript API asset in Squiz Matrix.

### JS API methods used by this editor

| Method           | Purpose                                              | Called from                | Notes                                                                                |
| ---------------- | ---------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `setMetadata`    | Save metadata field value                            | `submit()`                 | All metadata fields (position title, designation, agency, location, advertise, etc.) |
| `setAttribute`   | Save asset attribute value                           | `submitAttr()`             | `name`, `title`, `short_name`                                                        |
| `setAssetStatus` | Change asset status (Live, Under Construction, etc.) | `submitStatusAttribute()`  | Accepts numeric status code                                                          |
| `acquireLock`    | Acquire edit lock on an admin screen                 | `submitAttr()` (name only) | Required before `setAttribute('name', ...)` on PROD; `screen_name: "details"`        |
| `releaseLock`    | Release edit lock on an admin screen                 | `releaseDetailLock()`      | Called after `setAttribute('name', ...)` completes (success or failure)              |

> **Locking rule of thumb:** Custom attributes (`title`, `short_name`) auto-lock on the server. System attributes on the "details" screen (`name`) require explicit `acquireLock`/`releaseLock`. When in doubt, test on PROD — DEV auto-locks everything.

### Restoring pre-selected values on load

```js
$(".metadata_options").each(function () {
  var presetValue = $(this).attr("data-current");
  if ($(this).prop("multiple")) {
    try {
      $(this).val(JSON.parse(presetValue)); // e.g. ["AO2","SP1"]
    } catch (e) {
      $(this).val(presetValue); // fallback for plain strings
    }
  } else {
    $(this).val(presetValue); // single-select: plain string
  }
});
```

### Edit control types

All three control types use explicit **Save/Cancel buttons** — there is no auto-save on `blur` or `change`. Clicking Cancel or anywhere outside the open popup restores the original value without submitting.

| Control                        | CSS class                                | Used for                                         | DOM inserted by                             |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| Textarea + buttons             | _(inside `.edit_area`)_                  | Free-text metadata, attributes                   | `makeEditable()`                            |
| Native `<select>` + buttons    | `.single-dropdown`                       | Single-select (Agency 445640)                    | `.metadata_option_display` click handler    |
| Checkbox panel + buttons       | `.multiselect-dropdown`                  | Multi-select (Designation, Location, Advertise…) | `.metadata_option_display` click handler    |
| Datepicker `<input>` + buttons | _(inside `.edit_area[data-datepicker]`)_ | Close date (445509)                              | `.edit_area[data-datepicker]` click handler |

**Single-select popup DOM (`.single-dropdown`):**

```html
<!-- injected after .metadata_option_display, before the hidden <select> -->
<div class="single-dropdown">
  <select class="form-control single-dropdown-select">
    <option value=""></option>
    <option value="DET" selected>Department of Education</option>
    ...
  </select>
  <div class="single-dropdown-actions">
    <button
      type="button"
      class="ntgc-btn btn-sm ntgc-btn--secondary"
      data-action="save"
    >
      <span class="fal fa-save"></span> Save
    </button>
    <button
      type="button"
      class="ntgc-btn btn-sm ntgc-btn--tertiary"
      data-action="cancel"
    >
      Cancel
    </button>
  </div>
</div>
```

**Multiselect popup DOM (`.multiselect-dropdown`):**

```html
<!-- injected after .metadata_option_display, before the hidden <select> -->
<div class="multiselect-dropdown">
  <div class="multiselect-list">
    <label><input type="checkbox" value="WoG" /> NTG Central</label>
    <label><input type="checkbox" value="DET" /> Department of Education</label>
    ...
  </div>
  <div class="metadata_option_actions">
    <button
      type="button"
      class="ntgc-btn btn-sm ntgc-btn--secondary"
      data-action="save"
    >
      <span class="fal fa-save"></span> Save
    </button>
    <button
      type="button"
      class="ntgc-btn btn-sm ntgc-btn--tertiary"
      data-action="cancel"
    >
      Cancel
    </button>
  </div>
</div>
```

### Saving changes

All paths ultimately call:

```js
submit(value, assetid, fieldid);
```

- `value` for multi-select fields is a **semicolon-delimited string** (e.g. `"AO2; SP1"` with a space after the semicolon, as produced by `Array.join("; ")`). The Squiz Matrix API rejects arrays. Note: the Agency–Advertise sync path joins with `";"` (no space) — both forms are accepted by the server.
- Single-select and free-text fields pass a plain string.
- Date fields pass ISO format `YYYY-MM-DD`.

`submit()` calls:

```js
js_api.setMetadata({
  asset_id: assetID,
  field_id: fieldid,
  field_val: content,
  dataCallback: result,
  // Note: submit() currently has no errorCallback. API failures will be
  // silent. submitAttr() and submitStatusAttribute() both have explicit
  // errorCallbacks and should be used as the model if adding error handling
  // to submit() in future.
});
```

Attribute fields (name, title, short_name) use `submitAttr()` → `js_api.setAttribute()` instead.

**Locking for the `name` attribute:**

The `name` attribute is a system property that lives on the Squiz Matrix "details" admin screen. Unlike custom attributes (`title`, `short_name`) which live on the "attributes" screen, the server does **not** auto-acquire a lock for the "details" screen when `setAttribute` is called via the JS API. This causes `setAttribute('name', ...)` to fail on production with:

```
Attribute "name"(of type "text") could not be set to "…" for Asset "…" (#XXXXX)
```

`submitAttr()` handles this by wrapping the `setAttribute` call in an explicit `acquireLock` / `releaseLock` cycle when `attrName === "name"`:

```js
if (transaction.attrName === "name") {
  js_api.acquireLock({
    asset_id: transaction.assetid,
    screen_name: "details",
    dataCallback: function () {
      doSetAttribute();
    },
    errorCallback: function () {
      /* show error, remove pending */
    },
  });
} else {
  doSetAttribute();
}
```

`releaseLock` is called in all exit paths (success, error, and `errorCallback`) via the `releaseDetailLock()` helper to avoid orphaned locks. Other attributes (`title`, `short_name`) skip locking entirely — the server auto-locks the "attributes" screen for those.

> **DEV vs PROD:** The development Squiz instance (`ntgcentral-dev.nt.gov.au`) is more permissive and auto-locks the "details" screen, so `setAttribute('name', ...)` works without explicit locking there. Production (`ntgcentral.nt.gov.au`) does not — the explicit lock is required.

### Closing-date field with datepicker

The closing date (metadata field ID 445509) now uses a Bootstrap
datepicker instead of a plain textarea. This section helps future
developers replicate the pattern or troubleshoot issues.

1. **Template markup** — add `data-datepicker="true"` to the
   `.edit_area` div for the closing date and give it
   `datepicker-field` class for styling:
   ```html
   <td class="metadata-editor">
     <div
       class="edit_area datepicker-field"
       data-metadataFieldID="445509"
       data-datepicker="true"
     >
       %asset_metadata_job.closing-date%
     </div>
   </td>
   ```
2. **Library files** — include `bootstrap-datepicker.min.js` and
   `bootstrap-datepicker.min.css` alongside the existing local
   static assets, and reference them in the HTML page.
3. **Interaction logic** (in `editor.js`):
   - On page load convert any ISO date values to `DD/MM/YYYY` for
     display.
   - Add a click handler for `.edit_area[data-datepicker="true"]`
     that dynamically creates an `<input>` inside the div and
     initializes the Bootstrap datepicker on that input.
   - When a date is selected, convert the displayed Australian-format
     date back to ISO (`YYYY-MM-DD`), submit via
     `js_api.setMetadata`, then remove the input and restore text.
   - The datepicker input auto-opens on click and destroys itself on
     blur or after selection.
4. **Value formatting** — display is `DD/MM/YYYY` (Australian), but
   the server always receives `YYYY-MM-DD`. Conversions use helper
   functions `isoToAustralian` and `australianToIso` defined near the
   top of `editor.js`.
5. **Refresh handling** — when the AJAX callback updates the table
   cell, the code simply rewrites the text (no persistent datepicker
   exists), converting the payload back to display format if needed.

> Note: the datepicker works only on inputs; the original implementation
> attempted to initialize it on `<div>` elements which failed silently.
> The current pattern wraps an input only during editing, ensuring the
> picker appears correctly.

This solution keeps the general editing framework unchanged while
providing a polished calendar UI for dates.

---

## DataTables integration (March 2026)

The table now uses DataTables for client-side filtering, sorting, and pagination. This section explains the implementation so future developers can extend or troubleshoot it.

### Overview

DataTables is a jQuery plugin bundled in `src/datatables.lib.js`. It provides:

- **Filtering** via a global search box (auto-generated)
- **Sorting** by clicking any column header
- **Pagination** with Previous/Next controls (10 rows per page by default)

After any edit (metadata, attribute, or status), the affected row is re-rendered via `dtTable.row(tr).invalidate('dom').draw(false)` so pagination, search, and sort results stay current.

### Initialization and configuration

**Location:** `src/editor.js` around line 833.

```javascript
dtTable = $("#myTable").DataTable({
  paging: true,
  pageLength: 10,
  pagingType: "simple_numbers",
  ordering: true,
  order: [[0, "desc"]], // ID column descending by default
  searching: true,
  info: true,
  // Custom dom: dt-top-ctrl holds the length selector and search box, both
  // relocated by JS into the custom filter bar below the page heading.
  // dt-bottom-row holds info (left) and paginate (right) via flexbox.
  dom: '<"dt-top-ctrl"lf><t><"dt-bottom-row"ip>',
  columnDefs: [
    {
      // All columns: extract plain text from .metadata_option_display or
      // .edit_area for sort/filter; return raw HTML untouched for display.
      targets: "_all",
      render: function (data, type) {
        if (type === "display") return data;
        var tmp = document.createElement("div");
        tmp.innerHTML = data;
        var el =
          tmp.querySelector(".metadata_option_display") ||
          tmp.querySelector(".edit_area");
        return el ? el.textContent.trim() : tmp.textContent.trim();
      },
    },
    {
      // Close date (col 6): isoToAustralian() has already run, so DOM text is
      // DD/MM/YYYY. Lexicographic sort is wrong; convert to YYYYMMDD string
      // for sort/type so rows order chronologically. Keep DD/MM/YYYY for filter
      // so users can search by partial date string (e.g. "06/2025").
      targets: 6,
      render: function (data, type) {
        if (type === "display") return data;
        var tmp = document.createElement("div");
        tmp.innerHTML = data;
        var el = tmp.querySelector(".edit_area");
        var text = el ? el.textContent.trim() : tmp.textContent.trim();
        if (type === "sort" || type === "type") {
          var parts = text.split("/");
          if (parts.length === 3) {
            return parts[2] + parts[1] + parts[0]; // e.g. "20250630"
          }
        }
        return text;
      },
    },
  ],
});
```

### Understanding the render function

The `render` function is called during DataTables initialization and after row invalidation. The `type` parameter indicates what the function is being called for:

- **`'display'`** – Return HTML to render (unchanged from the DOM).
- **`'sort'`** – Return a sortable key (string, numeric, ISO date, etc.).
- **`'filter'`** – Return text to match against search queries.
- **`'type'`** – Return a value for type detection (rare; defaults to text).

**Key pattern (actual implementation — uses native DOM, not jQuery):**

```javascript
render: function (data, type) {
  if (type === "display") return data; // pass raw HTML through unchanged

  // For sort/filter: strip HTML and return plain text
  var tmp = document.createElement("div");
  tmp.innerHTML = data;
  var el =
    tmp.querySelector(".metadata_option_display") ||
    tmp.querySelector(".edit_area");
  return el ? el.textContent.trim() : tmp.textContent.trim();
}
```

### Column-specific rendering

**Column 6 (Close Date):**

The Close Date column displays dates in `DD/MM/YYYY` format (Australian) for human readability. Without special handling, DataTables would sort these lexicographically, yielding incorrect results:

- Lexicographic: `"01/08/2025" < "25/12/2020"` ✗
- Chronological: `"25/12/2020" < "01/08/2025"` ✓

**Solution:** The second `columnDefs` entry (targets column 6) overrides the render function for sort/filter types:

```javascript
// Convert DD/MM/YYYY to YYYYMMDD for correct date ordering
var parts = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
if (parts) {
  return parts[3] + parts[2] + parts[1]; // YYYYMMDD (e.g., "20250201")
}
```

This yields numeric-like strings that sort correctly while display remains `DD/MM/YYYY`. Search still works on the visible `DD/MM/YYYY` format (e.g., searching "12/2025" finds all December 2025 dates).

**All other columns:**

The first `columnDefs` entry (targets `'_all'`) extracts visible text for sort/filter. For dropdowns, this is the `.metadata_option_display` text (e.g., "Department of Children and Families"); for text fields, it's the `.edit_area` text. This makes sorting intuitive — users see alphabetical, not coded.

### Row invalidation after saves

When a cell is edited, the new value must be passed through the render function again so DataTables' internal cache is updated. This is done via:

```javascript
dtTable.row(tr).invalidate("dom").draw(false);
```

Where:

- `tr` is the table row DOM element — **always looked up by asset ID** (`$('tr[id="' + assetid + '"]')[0]`), never via `$cell.closest("tr")`. The metadata save callback only has the asset ID, not the cell reference.
- `'dom'` flag tells DataTables to re-read the row's HTML from the DOM
- `draw(false)` redraws without resetting to page 1 or clearing sort order

**Calls that invalidate:**

1. **`refreshTableCell()`** — called after `submit()` succeeds (inline text or datepicker save)

   ```javascript
   var $row = $('tr[id="' + updatedData.assetid + '"]');
   dtTable.row($row[0]).invalidate("dom").draw(false);
   ```

2. **`refreshTableCellsAttr()`** — called after `submitAttr()` succeeds (attribute save)

   ```javascript
   dtTable
     .row($('tr[id="' + transaction.assetid + '"]')[0])
     .invalidate("dom")
     .draw(false);
   ```

3. **`resultStatusAttribute()`** — called after status dropdown save

   ```javascript
   var $row = $('tr[id="' + statusTransaction.assetid + '"]');
   dtTable.row($row[0]).invalidate("dom").draw(false);
   ```

If you add a new editable field type, add the invalidation call in the appropriate success callback.

### Extending DataTables

**Change page length:**
Replace `pageLength: 10` in the initialization.

**Add search delay** (e.g., search as user types with a 500ms debounce):
Add `searchDelay: 500` to the config.

**Change pagination style:**
Replace `pagingType: 'simple_numbers'` with one of:

- `'full'` — First, Previous, Next, Last buttons
- `'full_numbers'` — First, Previous, 1 2 3 …, Next, Last
- `'simple'` — Previous, Next only

**Disable sorting or searching:**
Set `ordering: false` or `searching: false`.

See [DataTables documentation](https://datatables.net/reference/option/) for all available options.

### Common issues and debugging

| Symptom                                 | Cause                                                              | Fix                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Sorting is wrong (especially on dates)  | Render function not overriding sort type for that column           | Add a `columnDefs` entry with correct `targets` and return `YYYYMMDD` string             |
| Search returns no results after editing | Row not invalidated after save                                     | Add `dtTable.row(tr).invalidate('dom').draw(false)` in post-save callback                |
| Inline editing broken after update      | Event handlers not using delegation (see Event Delegation section) | Ensure all handlers use `$(document).on(event, selector, handler)` pattern               |
| Pagination controls missing             | DataTables not initialized                                         | Check browser console for errors during init; verify HTML table structure has correct ID |

---

## Event delegation pattern (required for DataTables interactivity)

Inline editors and datepickers must use event delegation to survive DataTables' DOM rewrites. This section explains the pattern and why it matters.

### The problem: direct binding breaks with DataTables

When you bind event handlers directly to table cells before DataTables initialization:

```javascript
// ❌ BROKEN
var $cells = $(".edit_area");
$cells.on("click", function () {
  /* edit logic */
});
```

DataTables' render function rewrites cell HTML internally during initialization:

```javascript
// Inside DataTables (simplified)
cell.innerHTML = renderedHTML; // new DOM nodes created
```

The new DOM nodes have no event handlers attached — they inherited from the old nodes cost extra memory and are lost when jQuery replaces the node reference.

**Result:** Clicking edit areas no longer works.

### The solution: event delegation

Use document-level target delegation with a CSS selector:

```javascript
// ✅ CORRECT
$(document).on("click", ".edit_area", function () {
  /* edit logic */
});
```

Now when any `.edit_area` is clicked, the handler on `document` catches the bubbling click event and executes the callback. When DataTables rewrites HTML, the _handler still lives on `document`_, unaffected. The new `.edit_area` elements will bubble clicks to the persistent handler.

### Implementation in this codebase

**Free-text and datepicker editing** — `makeEditable(selector, onSave)`:

Located around line 410 in `src/editor.js`. The function takes a **CSS selector string**, not a jQuery object. Only the **activation** click is delegated; Save/Cancel buttons created inside the editor are bound directly (they are freshly created nodes that DataTables will never replace):

```javascript
function makeEditable(selector, onSave) {
  var activateEdit = function ($el) {
    var savedText = $el.text().trim();
    var $textarea = $('<textarea class="form-control" rows="2">').val(
      savedText,
    );
    var $saveBtn = $('<button type="button" ...></button>');
    var $cancelBtn = $('<button type="button" ...></button>');
    $el.empty().append($textarea, $("...").append($saveBtn, $cancelBtn));

    // Direct binding — these nodes are new; DataTables won't replace them
    $cancelBtn.on("click", function (e) {
      e.stopPropagation();
      $el.empty().text(savedText);
    });
    $saveBtn.on("click", function (e) {
      e.stopPropagation();
      onSave($textarea.val(), $el);
    });
  };

  // Delegated: activation survives DataTables DOM rewrite
  $(document).on("click.inlineEdit", selector, function () {
    activateEdit($(this));
  });
  $(document).on("keydown.inlineEdit", selector, function (e) {
    if (e.keyCode === 13) activateEdit($(this));
  });
}

// Usage:
makeEditable(
  ".metadata-editor .edit_area:not([data-datepicker='true'])",
  onSaveCallback,
);
```

**Datepicker** — `activateDatepicker($field)`:

Located around line 509 in `src/editor.js`. The **opening** click is delegated so it survives DataTables DOM rewrites. Inside `activateDatepicker`, Save/Cancel buttons are bound directly (freshly created nodes):

```javascript
var activateDatepicker = function ($field) {
  // Create input + Save/Cancel buttons, initialise Bootstrap datepicker...

  // Direct binding — freshly created nodes; DataTables won't rewrite these
  $cancelBtn.on("click", function (e) {
    e.stopPropagation();
    closeDate();
  });
  $saveBtn.on("click", function (e) {
    e.stopPropagation(); /* submit ISO date */
  });
  $input.on("keydown.datepickerEsc", function (e) {
    if (e.keyCode === 27) closeDate(); // Escape
  });
};

// Delegated: opening the picker survives DataTables DOM rewrite
$(document).on(
  "click.datepicker",
  ".edit_area[data-datepicker='true']",
  function () {
    activateDatepicker($(this));
  },
);
$(document).on(
  "keydown.datepicker",
  ".edit_area[data-datepicker='true']",
  function (e) {
    if (e.keyCode === 13) activateDatepicker($(this)); // Enter
  },
);
```

**Dropdown selects** — all handlers are delegated:

Both single-select and multi-select dropdowns use delegated handlers. There is **no `change` listener** — all saves go through an explicit Save button:

```javascript
// Open dropdown (single-select or multi-select)
$(document).on("click", ".metadata_option_display", function () {
  /* build popup */
});

// Multi-select: Save / Cancel
$(document).on(
  "click",
  ".metadata_option_actions [data-action='save']",
  handler,
);
$(document).on(
  "click",
  ".metadata_option_actions [data-action='cancel']",
  handler,
);

// Single-select: Save / Cancel
$(document).on(
  "click",
  ".single-dropdown-actions [data-action='save']",
  handler,
);
$(document).on(
  "click",
  ".single-dropdown-actions [data-action='cancel']",
  handler,
);

// Outside-click closes open dropdown without saving
$(document).on("click", function (e) {
  if (
    !$(e.target).closest(
      ".metadata_option_display, .multiselect-dropdown, .single-dropdown",
    ).length
  ) {
    // restore original value, remove popup
  }
});
```

### Rule for new interactive elements

If you add a new field type that requires JavaScript interaction:

1. **Never bind to individual cells directly** — even if you bind after DataTables init, future table re-renders will break the handlers.
2. **Always use delegation:** `$(document).on(eventType, 'newSelector', handler)`.
3. **Test with DataTables:** After the table sorts, searches, or paginates, verify that clicking the control still works.
4. **Invalidate after save:** Call `dtTable.row(tr).invalidate('dom').draw(false)` so the updated value appears in search/sort immediately.

### Why document-level delegation?

Could we delegate off the table instead — e.g., `$('#myTable').on(...)`?

Yes, but **document is safer** because:

- If the entire table is re-rendered, `$('#myTable')` still refers to the old table
- Document-level handlers work regardless of where the event originates
- This pattern matches the existing dropdown handlers
- It's the most resilient to future HTML restructuring

---

## Squiz Matrix JS API — `setMetadata` field value formats

> Reference: https://docs.squiz.net/matrix/version/latest/api/javascript-api/index.html

| Field type              | Expected `field_val` format             | Example                          |
| ----------------------- | --------------------------------------- | -------------------------------- |
| Text                    | Plain string                            | `"Assessment Consultant"`        |
| Select (single)         | Option key string                       | `"AO2"`                          |
| Select (multi)          | Option keys separated by **semicolons** | `"AO2;SP1"`                      |
| Multiple Text           | Strings separated by semicolons         | `"Squiz;Content Management"`     |
| Date                    | `yyyy-MM-dd hh:mm:ss`                   | `"2025-06-30 23:45:26"`          |
| Hierarchy               | Option keys separated by semicolons     | `"a;a1;b2"`                      |
| WYSIWYG                 | HTML string                             | `"<strong>lorem ipsum</strong>"` |
| Thesaurus               | Term name                               | `"Content Management"`           |
| Null (reset to default) | `null`                                  | `null`                           |

---

## Bug fixes applied — 2026-03-08

### Bug 3: `Attribute "short_name" does not exist` for file assets

**Symptom:** Editing the Title cell on a Word document (`.docx`) row triggers: `Attribute "short_name" does not exist for Asset "…" (#XXXXX)` in the result bar.

**Root cause:** File-type assets in Squiz Matrix do not have a `short_name` attribute. Their title is stored as `title` (accessed via `%asset_attribute_title%`). The row template was unconditionally using `data-attributename="short_name"` for all asset types.

**Fix — `row-template.html`:** Replace the static Title `<div>` with a `<script runat="server">` block that checks `%asset_type_code%` and emits the correct `data-attributename` — `title` for file assets, `short_name` for all others. See _File asset vs. page asset attributes_ above for the full code.

**Fix — `editor.js` (fallback for already-rendered pages):** `resultAttr` detects the "does not exist" error, retries with `setAttribute('title', …)`, and patches the DOM cell's `data-attributename` attribute. See the fallback code in _File asset vs. page asset attributes_ above.

---

### Bug 4: Cancel button re-opens the inline edit immediately

**Symptom:** Clicking Cancel inside an inline `.edit_area` editor dismisses the textarea and restores the saved text, but immediately re-opens the edit.

**Root cause:** The Cancel (and Save) `<button>` elements are children of the `.edit_area` `<div>`. Clicking either button bubbled the `click` event up to `.edit_area`, which triggered the `click.inlineEdit` handler again, re-entering the editing state.

**Fix — `editor.js`:** Add `e.stopPropagation()` to both button click handlers inside `makeEditable`:

```js
$cancelBtn.on("click", function (e) {
  e.stopPropagation();
  $el.empty().text(savedText);
});

$saveBtn.on("click", function (e) {
  e.stopPropagation();
  onSave($textarea.val(), $el);
});
```

---

## Bug fixes applied — 2025-03-07

### Bug 1: Double POST on every multi-select change

**Symptom:** Every select change triggered two identical API POSTs.  
Console showed `"I changed"` printed twice per interaction.

**Root cause:** The event delegation selector was `$(".metadata-editor")`. This matched:

- `<body class="metadata-editor">` (the page body)
- every `<td class="metadata-editor">` (one per metadata cell)

jQuery attached a `change` listener to every matched element. When a `<select>` fired `change`, the event bubbled up through the `<td>` (handler fires → POST #1) and continued to `<body>` (handler fires again → POST #2).

**Fix:** Changed both the `blur` and `change` delegated listeners to use `$(document)` instead of `$(".metadata-editor")`:

```js
// Before (broken)
$(".metadata-editor").on("change", ".metadata_options", function () { ... });
$(".metadata-editor").on("blur", ".edit_area textarea", function () { ... });

// After (fixed)
$(document).on("change", ".metadata_options", function () { ... });
$(document).on("blur", ".edit_area textarea", function () { ... });
```

`$(document)` has exactly one instance, so the handler fires exactly once per event regardless of how many `.metadata-editor` elements exist in the DOM.

---

### Bug 2: Multi-select POST returning HTTP 500

**Symptom:** Every POST to `update-metadata.js` returned `500 Internal Server Error` when a multi-select field was changed.

**Root cause:** `$(this).val()` on a `<select multiple>` returns a **JavaScript array** (e.g. `["AO2", "SP1"]`). This array was passed directly to `setMetadata` as `field_val`. Inside `update-metadata.js`, parameters are serialised via `JSON.stringify`, so the server received:

```json
{ "field_val": ["AO2", "SP1"] }
```

The Squiz Matrix backend does not accept a JSON array for `field_val`. It expects a **semicolon-separated string**.

**Fix:** Join the array with `";"` before passing to the API:

```js
// Before (broken)
var value = $(this).prop("multiple")
  ? $(this).val() // returns ["AO2", "SP1"]
  : $(this).find(":selected").val();

// After (fixed)
var value = $(this).prop("multiple")
  ? $(this).val().join(";") // returns "AO2;SP1"
  : $(this).find(":selected").val();
```

Single-select fields were unaffected — `$(this).find(":selected").val()` already returns a plain string.

---

## Hover edit tooltip

Every editable cell shows a **"✏ Edit [column name]"** tooltip above it when hovered, so users know the cell is clickable without text instructions.

### How it works

The tooltip is built entirely from CSS using `::before` and `::after` pseudo-elements on `.edit_area` and `.metadata_option_display`. No extra HTML is needed at runtime.

```
[::before]  FA pen-to-square icon (z-index 11, absolutely positioned above cell)
[::after]   Dark pill label          (z-index 10, absolutely positioned above cell)
```

Both pseudo-elements use `position: absolute; bottom: 100%` so they float immediately above the cell div without overlapping the cell's text content. `pointer-events: none` on both prevents them from interfering with click events.

**CSS rules (in `eoi-metadata-editor.css`):**

```css
/* position context for pseudo-elements */
.edit_area,
.metadata_option_display {
  position: relative;
}

/* icon — FA Light pen-to-square (U+F044) */
.edit_area:hover::before,
.metadata_option_display:hover::before {
  content: "\f044";
  font-family: "Font Awesome 5 Pro", sans-serif;
  font-weight: 300;
  position: absolute;
  bottom: 100%;
  left: 7px; /* aligns with pill's inner left padding */
  color: #fff;
  font-size: 0.72em;
  line-height: 1.8;
  pointer-events: none;
  z-index: 11;
  transform: translateY(-4px);
}

/* label pill */
.edit_area:hover::after,
.metadata_option_display:hover::after {
  content: "Edit " attr(data-label); /* dynamic column name from data-label */
  position: absolute;
  bottom: 100%;
  left: 0;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 0.72em;
  padding: 2px 7px 2px 22px; /* left padding makes room for the icon */
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
```

The icon and label are in separate pseudo-elements intentionally — mixing Font Awesome glyphs and plain text in a single `content:` string causes the FA font to misrender the first character of the text that follows the icon.

### The `data-label` attribute

The tooltip text is driven by `data-label` attributes on each editable element. The CSS `attr(data-label)` function reads this at paint time.

**Where labels come from:**

| Element                              | How `data-label` is set                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `.edit_area` (free-text, datepicker) | Set directly in `row-template.html`, e.g. `data-label="file name"`                                                        |
| `<select class="metadata_options">`  | `makeDropdown(…, label)` / `makeMultiSelect(…, label)` in `server-functions.html` emit `data-label="…"` on the `<select>` |
| `.metadata_option_display`           | Copied from the adjacent `<select data-label>` by `editor.js` on page load                                                |

The `.metadata_option_display` div is injected by `editor.js` and does not exist in the server-rendered HTML, so it cannot get `data-label` from the template. `editor.js` copies it from the hidden `<select>` at initialisation time:

```js
$("select.metadata_options").each(function () {
  var $select = $(this);
  var $display = $('<div class="metadata_option_display"></div>')
    .attr("data-label", $select.attr("data-label") || "")
    ...
});
```

If the rendered HTML was saved with display divs already in the DOM (from a previous page load), the existing div is patched rather than recreated:

```js
$existing.attr("data-label", $select.attr("data-label") || "");
```

### Adding or changing a label

1. **Free-text / datepicker cells** — update `data-label="…"` on the `.edit_area` div in `row-template.html`, then also update the rendered HTML (find the corresponding `data-attributename` or `data-metadatafieldid` — use find/replace across the file).
2. **Select cells** — update the string passed as the third argument to `makeDropdown(…, 'label')` or `makeMultiSelect(…, 'label')` in `row-template.html`. Update `server-functions.html` function signatures if their label param name or default changes. Then update `data-label="…"` on every matching `<select class="metadata_options" data-metadatafieldid="…">` in the rendered HTML.
3. **Label convention** — use lowercase (e.g. `"file name"`, `"position title"`, `"NTG Central / intranets"`). The CSS `::after` prefixes `"Edit "` so the result is `"Edit file name"` — sentence case with no extra capitalisation needed.

> **Coding agents:** when re-saving the HTML from production, run a find/replace pass to restore all `data-label` attributes — the production server does not emit them. See the bulk PowerShell replacement commands used in the initial setup as a reference pattern.

---

### 2026-03-25: Explicit locking for `name` attribute (File Name column)

- **Symptom:** Editing the File Name column on production (`ntgcentral.nt.gov.au`) always failed with `Attribute "name"(of type "text") could not be set to "…" for Asset "…" (#XXXXX)`. The same edit worked on DEV (`ntgcentral-dev.nt.gov.au`). Both servers run the same Squiz Matrix version.
- **Root cause:** The `name` attribute is a system property stored on the Squiz Matrix "details" admin screen. The JS API `setAttribute` function relies on the server to auto-acquire a write lock, but the production server does **not** auto-lock the "details" screen (only the "attributes" screen). DEV is more permissive and auto-locks both screens. Other attributes (`title`, `short_name`) live on the "attributes" screen and were unaffected.
- **Fix in `editor.js`:** `submitAttr()` now detects `attrName === "name"` and wraps the `setAttribute` call in `js_api.acquireLock({ screen_name: "details" })` → `setAttribute` → `js_api.releaseLock({ screen_name: "details" })`. A new `releaseDetailLock()` helper is called in all exit paths (success, data error, and network error) to prevent orphaned locks. Non-`name` attributes skip locking entirely.
- **Files changed:** `src/editor.js` — `submitAttr()` function and new `releaseDetailLock()` helper.
- **Lesson:** When adding editing support for a new Squiz system attribute, test on both DEV and PROD. If the attribute lives on a screen other than "attributes", explicit `acquireLock`/`releaseLock` calls may be required.

### 2026-03-08: Hover edit tooltip system

- Added `::before` (FA pen-to-square icon, `\f044`) and `::after` (dark semi-transparent pill label) pseudo-elements to `.edit_area:hover` and `.metadata_option_display:hover` in `eoi-metadata-editor.css`. Tooltip floats above the cell via `position: absolute; bottom: 100%` and never overlaps cell text.
- Icon and label are in separate pseudo-elements so Font Awesome's private-use glyph doesn't corrupt adjacent plain-text characters.
- Label text is driven by `content: "Edit " attr(data-label)` — no extra DOM nodes required.
- Added `data-label` attributes (lowercase, sentence-case values) to all `.edit_area` divs in `row-template.html`.
- Added optional `label` third parameter to `makeDropdown()` and `makeMultiSelect()` in `server-functions.html`; emitted as `data-label` on the rendered `<select>`.
- `editor.js` now copies `data-label` from the hidden `<select>` onto the injected `.metadata_option_display` div on page load (both new-div and pre-existing-div code paths).
- Bulk-updated `data-label` attributes and removed stale `cursor: pointer` inline styles across all rows in the rendered HTML via PowerShell `Set-Content` replacements.
- Cursor (`pointer`) is now managed entirely by CSS on hover; removed all JS inline-style assignments of `cursor: pointer` for `.metadata_option_display` divs.

### 2026-03-08: DataTables filtering, sorting, and pagination

- Initialized DataTables in `editor.js` (around line 833) with paging (10 rows), simple_numbers pagination, global search, column sorting, and `order: [[0, 'desc']]` (ID descending) enabled.
- Added two `columnDefs` entries:
  - `targets: '_all'` – render function extracts visible text (from `.metadata_option_display` for dropdowns, `.edit_area` for text) for sort/filter, returns full HTML for display.
  - `targets: 6` (Close Date) – override to convert `DD/MM/YYYY` → `YYYYMMDD` string for sort/filter types, ensuring chronological ordering while display remains `DD/MM/YYYY`.
- Added row invalidation calls in three post-save callbacks:
  - `refreshTableCell()` – after inline text save: `dtTable.row(tr).invalidate('dom').draw(false)`
  - `refreshTableCellsAttr()` – after attribute save: same invalidation
  - `resultStatusAttribute()` – after status dropdown save (via result callback): same invalidation
- Converted `makeEditable()` from direct jQuery binding to parameter-driven selector-based delegation: `makeEditable(selector_string, onSave)` now uses `$(document).on()` instead of `$(jqueryObject).on()`.
- Extracted `activateDatepicker($field)` to a standalone function (was embedded in `.each()` loop); parametrized to accept the field element and moved all click/keydown handlers to delegated document-level bindings.
- Updated two `makeEditable()` call sites to pass selector strings instead of jQuery objects.
- Tested: sorting (including close-date chronological order), filtering, pagination, inline editing, datepicker all working.

### 2026-03-08: Consistent cell hover styles

- Added `.metadata_option_display:hover` alongside `.edit_area:hover` so dropdown/multiselect cells get the same `#e5e5e5` background highlight on hover as File Name and Title.
- Hover background and cursor are now on a single shared rule; both cell types behave identically at rest and on hover.

### 2026-03-07: Local dev environment setup and HTML sanitisation

- Re-saved the production page as `EOI metadata editor _ NTG Central.html` (replacing `eoi-metadata-editor.htm`).
- Removed all `.download` suffix references from the HTML and renamed/deleted `.download` files in the assets directory.
- Updated `package.json` `dev` script to serve the new HTML filename via Vite.
- Removed broken `JSON.parse('')` Squiz template artefact from the HTML.
- Removed `integrity`/`crossorigin` attributes from `bootstrap.min.css` and `all.css` links (local copies don't match CDN hashes).
- Wrapped `editor.js` in an IIFE to capture jQuery#2 (with plugins) before jQuery#3 overwrites the global.
- Replaced `roboto.css` with a Google Fonts `@import` to fix Roboto CORS errors.
- Added `public/webfonts/` with `fa-solid-900` font files (downloaded from jsDelivr) and `fa-light-300` stubs.
- Added `public/cdn/userdata/` stub JSON files to silence NTG Central userdata API errors.
- Fixed duplicate Designation display div bug in `editor.js` (HTML was saved after editor.js had already injected display divs; re-running created doubles).
- Replaced deprecated `apple-mobile-web-app-capable` meta tag with `mobile-web-app-capable`.
- Removed debug `console.log(userAssetID + 'uidtest')` from inline script.

### 2026-03-08: File asset `short_name` / `title` attribute fix

- Added `<script runat="server">` conditional block to the Title cell in `row-template.html`; file-type assets now emit `data-attributename="title"` using `%asset_attribute_title%` rather than `short_name`.
- Added `word_doc` to the `fileTypes` array in `row-template.html` (confirmed type code from production asset #739076).
- Added silent `short_name → title` retry fallback in `resultAttr` in `editor.js` for pages rendered before the template fix was deployed.
- Fixed Cancel and Save buttons re-opening the inline edit: added `e.stopPropagation()` to both click handlers in `makeEditable` in `editor.js`.

### 2026-03-07: NTG Central / intranets switched to multi-select

- Updated the NTG Central and/or agency intranets column in `row-template.html` to use `makeMultiSelect()`.
- Field mapping remains `%asset_metadata_job.advertise%` with field ID `446182`.
- No `editor.js` changes required because multi-select submission/restoration is already generic.

---

## Squiz Matrix asset listing template

The `.htm` file is **not a static file** — it is generated by a Squiz Matrix asset listing asset. Its row template runs server-side JavaScript (via `runat="server"`) before the page is delivered to the browser. Understanding this is essential before making changes to the HTML.

### Server-side helper functions

Two helper functions are defined in a `<script runat="server">` block at the top of the asset listing's body design. They are shared across every row.

#### `makeDropdown(data, currentvalue)`

Generates a single-select `<select class="metadata_options">` from a metadata field's option list.

- `data` — the full asset data object for the metadata field asset, injected via `%globals_asset_assetid:<fieldid>^as_asset:asset_data%`
- `currentvalue` — the current metadata value for the row's asset, injected via `%asset_metadata_<fieldname>%`
- Matching is **case-insensitive** and checks both option keys and labels
- Emits `data-current="<matchedKey>"` (a plain string) and `data-metadataFieldid="<fieldid>"`

#### `makeMultiSelect(data, currentvalues)`

Generates a `<select multiple class="metadata_options">` from a metadata field's option list.

- `currentvalues` — accepts either an array or a semicolon-delimited string; both are normalised to an array internally
- Matching is **case-insensitive** against both option keys and labels
- Emits `data-current="<JSON array of matched keys>"` (HTML-encoded), e.g. `data-current="[&quot;AO2&quot;]"`
- Option keys and labels are HTML-entity-escaped before output

> Both functions return an empty string `''` if the metadata field asset data is unavailable (e.g. field not found), so rows degrade gracefully.

### Row template

Each row is a `<tr>` with Squiz Matrix keyword replacements:

```html
<tr id="%asset_assetid%" data-status="%asset_status_description%"></tr>
```

#### Field columns and their field IDs

| Column                  | Type                      | Field ID / attribute                         | Template                                                 |
| ----------------------- | ------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| ID                      | Link                      | —                                            | `%asset_assetid%`                                        |
| Status                  | Attribute (single-select) | `status` (asset attribute)                   | `makeStatusDropdown(%asset_asset_status%, 'status')`     |
| File Name               | Attribute (free-text)     | `name`                                       | `%asset_name%`                                           |
| Title                   | Attribute (free-text)     | `short_name` (pages) / `title` (file assets) | see _File asset vs. page asset attributes_ below         |
| Position title          | Metadata (free-text)      | `445504`                                     | `%asset_metadata_job.title%`                             |
| Designation             | Metadata (multi-select)   | `445634`                                     | `makeMultiSelect()` + `%asset_metadata_job.designation%` |
| Close date              | Metadata (free-text)      | `445509`                                     | `%asset_metadata_job.closing-date%`                      |
| Vacancy duration        | Metadata (free-text)      | `445506`                                     | `%asset_metadata_job.duration%`                          |
| Agency                  | Metadata (single-select)  | `445640`                                     | `makeDropdown()` + `%asset_metadata_job.agency%`         |
| Location                | Metadata (multi-select)   | `445518`                                     | `makeMultiSelect()` + `%asset_metadata_job.location%`    |
| NTG Central / intranets | Metadata (multi-select)   | `446182`                                     | `makeMultiSelect()` + `%asset_metadata_job.advertise%`   |

#### Status attribute dropdown

The `status` field is an **asset attribute** rather than metadata. In the Matrix
backend it stores a numeric code; editors only need four values:

- 1 — Archive
- 2 — Under Construction
- 16 — Live
- 64 — Safe Editing

A new server-side helper `makeStatusDropdown(currentStatusValue, label)` emits a
`<select>` with these four options and the correct `data-current` value. This
function is called from `row-template.html` in place of the old read-only
`%asset_status_description%` output.

On the client side, `src/editor.js` distinguishes attribute-based fields by
checking for a `data-attributename` attribute on the display element (see the
click handler around line 131). When saving such a field the code now calls
`submitStatusAttribute(assetid, value)` instead of the generic `submit()`
function. This helper converts the string value into a numeric code and uses
`js_api.setAttribute()` rather than `setMetadata()`.

The server response also contains a numeric code; the `resultStatusAttribute`
handler maps it back to a human-readable label using the `statusCodeToLabel`
object (see around line 626 of `src/editor.js`). Keeping the mapping in one
place simplifies maintenance if the set of valid statuses ever changes.

If you add a new attribute dropdown type in future, follow this pattern:

- Add a server-side helper similar to `makeStatusDropdown`
- Include `data-attributename` on the generated `<select>`
- In `editor.js` extend the click/save logic to call the appropriate submit
  helper and response handler.

#### File asset vs. page asset attributes

Squiz Matrix file-type assets (Word documents, PDFs, Excel files, etc.) do **not** have a `short_name` attribute. Their display title is stored as the `title` attribute, exposed in templates as `%asset_attribute_title%`. Attempting to call `setAttribute('short_name', ...)` on a file asset returns:

```
Attribute "short_name" does not exist for Asset "filename.docx" (#XXXXX)
```

The Title cell in `row-template.html` uses a server-side `<script runat="server">` block to emit the correct attribute name based on `%asset_type_code%`:

```html
<td class="attribute-editor">
  <script runat="server">
    var typeCode = "%asset_type_code%";
    var fileTypes = [
      "file",
      "word_doc",
      "ms_word_doc",
      "ms_word_doc2007",
      "pdf_file",
      "ms_excel",
      "ms_excel2007",
      "ms_powerpoint",
      "ms_powerpoint2007",
      "text_file",
    ];
    if (fileTypes.indexOf(typeCode) !== -1) {
      print(
        '<div class="edit_area" data-attributename="title">%asset_attribute_title%</div>',
      );
    } else {
      print(
        '<div class="edit_area" data-attributename="short_name">%asset_short_name%</div>',
      );
    }
  </script>
</td>
```

`editor.js` reads `data-attributename` at click time, so it submits the correct attribute name without any conditional logic of its own.

**Known Squiz Matrix file-type type codes**

| Asset type             | `%asset_type_code%` |
| ---------------------- | ------------------- |
| Generic File           | `file`              |
| MS Word (legacy)       | `ms_word_doc`       |
| MS Word 2007+          | `word_doc`          |
| MS Word 2007+ (alt)    | `ms_word_doc2007`   |
| PDF                    | `pdf_file`          |
| MS Excel (legacy)      | `ms_excel`          |
| MS Excel 2007+         | `ms_excel2007`      |
| MS PowerPoint (legacy) | `ms_powerpoint`     |
| MS PowerPoint 2007+    | `ms_powerpoint2007` |
| Text File              | `text_file`         |

> If you encounter a file-type asset that is still hitting the `short_name` error, inspect `%asset_type_code%` for that asset and add its type code to the `fileTypes` array in `row-template.html`.

**Fallback in `editor.js`**

For pages that were saved from production before the `row-template.html` fix was deployed, `resultAttr` silently retries with `title` when it receives a "does not exist" error for `short_name`, and patches `data-attributename` on the cell in the DOM so subsequent edits in the same session also use the correct attribute:

```js
if (
  transaction.attrName === "short_name" &&
  msg.indexOf("does not exist") !== -1
) {
  $('tr[id="' + transaction.assetid + '"]')
    .find('.edit_area[data-attributename="short_name"]')
    .attr("data-attributename", "title");
  transaction.attrName = "title";
  submitAttr(transaction);
  return;
}
```

This is a **safety net only** — the row template fix is the primary solution.

---

#### Select/multi-select column pattern

Each select column uses this server-side pattern:

```html
<td class="metadata-editor">
  <script runat="server">
    // SET THESE TWO VARIABLES
    var metadatafield = %globals_asset_assetid:445518^as_asset:asset_data%;
    var currentvalue  = "%asset_metadata_job.location%";

    // makeMultiSelect or makeDropdown — see global function in the page design
    print( makeMultiSelect(metadatafield, currentvalue) );
    print( `<span class="d-none">${currentvalue}</span>` );
  </script>
</td>
```

- `%globals_asset_assetid:<id>^as_asset:asset_data%` — resolves to the full asset data object of the metadata field asset; provides the option list via `.attributes.select_options.value`
- The `<span class="d-none">` echoes the raw current value for debugging; it is hidden from users

#### Adding a new select column

1. Get the metadata field asset ID from Squiz Matrix.
2. Get the metadata keyword name (e.g. `job.newfield`).
3. Decide whether it is single-select (`makeDropdown`) or multi-select (`makeMultiSelect`).
4. Copy the pattern above, substituting the field ID and keyword.
5. Add the corresponding `<th>` to the table header.
6. No changes to `editor.js` are needed — the generic `change` handler picks up any `<select class="metadata_options">` automatically.

---

## Tooling configuration

### The Squiz keyword corruption problem

Squiz Matrix uses `%keyword%` expressions for server-side value injection, and `^` / `:` modifiers inside them, e.g.:

```js
var metadatafield = %globals_asset_assetid:445634^as_asset:asset_data%;
```

Prettier (and some other formatters) treat `%`, `^`, and `:` as JavaScript operators inside `<script>` blocks within HTML files. On format, it adds spaces around them, corrupting the keyword:

```js
// Corrupted by Prettier:
var metadatafield = % globals_asset_assetid:445634 ^ as_asset: asset_data %;
```

This silently breaks the template — the Squiz Matrix server-side evaluator will no longer recognise the expression.

### `.prettierignore`

The three files containing Squiz keyword syntax are excluded from Prettier entirely:

```
row-template.html
server-functions.html
eoi-metadata-editor.htm
```

**Never remove these entries.** If you add new Squiz template files to the project, add them here too.

### `.vscode/settings.json`

Suppresses false VS Code editor diagnostics caused by `%keyword%` expressions:

- `html.validate.scripts: false` — stops the HTML language server attempting to validate `%keyword%` as JavaScript inside `<script runat="server">` blocks
- `html.validate.styles: false` — same for style blocks
- `[html]: editor.formatOnSave: false` — belt-and-suspenders guard so no formatter runs on save for HTML files, even if Prettier is not explicitly configured as the formatter
- `css.lint.unknownAtRules: ignore` — suppresses CSS warnings from `%keyword%` in style attributes

---

## Key constraints for future development

1. **Do not modify `update-metadata.js`** — this is a Squiz Matrix API library asset. Changes must be made in `editor.js` only.
2. **Event delegation must use `$(document)`** — never use `$(".metadata-editor")` as the delegation root because the class appears on both the `<body>` and individual table cells.
3. **Multi-select values must be semicolon-joined** before being passed to `setMetadata` — jQuery's `.val()` returns an array for multi-selects; the Squiz Matrix API requires a `;`-delimited string.
4. **`data-current` stores a JSON array** for multi-select fields — use `JSON.parse()` to restore selections on page load, with a plain-string fallback for single-select fields.
5. **The nonce token** is read from `<input type="hidden" id="token">` on the page — this is injected by Squiz Matrix and required for all API write operations.
6. **The HTML page is a saved production page** — edit `row-template.html` and `server-functions.html` (and apply changes in the Squiz Matrix asset listing), not the saved HTML directly. The `makeDropdown` and `makeMultiSelect` helper functions live in the page design of asset `#911527`. After re-saving from production, run the HTML Sanitisation Checklist.
7. **Never format Squiz template files** — `row-template.html`, `server-functions.html` are in `.prettierignore` for a reason. Formatting them will corrupt `%keyword^modifier:param%` expressions.
8. **File assets use `title`, not `short_name`** — never hardcode `data-attributename="short_name"` unconditionally in the row template. Always use the `%asset_type_code%` conditional (see _File asset vs. page asset attributes_) so file-type assets receive the correct attribute name.
9. **`e.stopPropagation()` is required on inline edit buttons** — Cancel and Save buttons are children of the clickable `.edit_area` div. Without `stopPropagation`, clicks bubble to the parent and immediately re-open the editor.
10. **The `name` attribute requires explicit locking** — Unlike `title`/`short_name`, the `name` attribute lives on the Squiz "details" screen, which does not auto-lock on production. `submitAttr()` handles this with `acquireLock`/`releaseLock` when `attrName === "name"`. If a new system attribute from the "details" screen needs editing in future, follow the same pattern.

---

## Verification Checklist

Run this after any metadata field or select-control change:

1. Open the editor page and confirm the changed field renders with the expected control type.
2. Change the field value and verify exactly one success message appears.
3. For multi-select fields, choose multiple options and confirm values persist after reload.
4. Confirm network payload sends `field_val` as a semicolon-delimited string for multi-select values.
5. Confirm no accidental formatting changes were introduced in Squiz keyword lines (`%...%`, `^`, `:`).

## Common Pitfalls

- Editing the saved HTML page directly: content changes will be overwritten when next re-saved from production. Only sanitisation changes (see checklist) are appropriate.
- Using `makeDropdown()` for a multi-select field: preselection and payload behavior will be incorrect.
- Formatting template files with generic formatters: Squiz keywords become invalid.
- Attaching delegated handlers to `.metadata-editor` instead of `$(document)`: causes duplicate submissions.
- Using `data-attributename="short_name"` unconditionally for the Title column: file-type assets (Word, PDF, etc.) will fail with `Attribute "short_name" does not exist`. Use the `%asset_type_code%` conditional in `row-template.html` and verify the type code list includes all file types in the listing.
- Omitting `e.stopPropagation()` on inline edit action buttons: click events bubble to the `.edit_area` parent and immediately re-trigger the edit handler.
- Calling `setAttribute('name', ...)` without acquiring a lock first: works on DEV but fails on PROD with `Attribute "name"(of type "text") could not be set`. The `name` attribute lives on the "details" screen which requires explicit locking on production. See `submitAttr()` in `editor.js`.

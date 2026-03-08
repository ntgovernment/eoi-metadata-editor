# EOI Metadata Editor — Developer Notes

## Overview

This tool is a browser-based inline editor for Squiz Matrix asset metadata and attributes. It is developed locally using Vite as a dev server, serving a saved copy of the production page (`EOI metadata editor _ NTG Central.html`) with local asset files.

Changes to interaction logic are made in `editor.js`, then deployed to the NTG Central Squiz Matrix instance. The HTML page itself is periodically re-saved from production and sanitised using the checklist below.

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

- **Agency** uses the single-select dropdown popup (`.single-dropdown` — see _Edit control types_ in Architecture). The user opens it by clicking the display label, chooses from a native `<select>`, then clicks Save. The `.single-dropdown-actions .btn-primary` handler calls `submit()` for Agency and then immediately derives `advertiseVals = newVal ? ["WoG", newVal] : ["WoG"]`, updates the Advertise `<select>` and its display label, and calls `submit()` for Advertise as well. There is no passive `change` listener.
- **Advertise** uses the checkbox multiselect popup (`.multiselect-dropdown`). When it opens, the handler reads the row's current Agency `<select>` value and renders checkboxes **only** for `WoG` plus that agency code (or `WoG` only when Agency is blank). NTG Central (WoG) is **not** force-checked — the user can uncheck it freely before saving.
- There is **no page-load normalization** of the Advertise field. Rows with extra agency codes in their saved advertise value will continue showing them until an Agency save triggers a resync.
- To add a new cross-field rule, follow the same pattern in `.single-dropdown-actions .btn-primary`: after `submit(newVal, assetid, fieldid)`, derive the dependent value and call `submit(derivedVal, assetid, dependentFieldId)`, then update that field's hidden `<select>` and its `.metadata_option_display` text via `getOptionDisplayText`.

## Interaction behaviour and editing guidelines

Most logic that translates a user interaction into an API call lives in `src/editor.js`. When adding or modifying a field type, search for the following patterns:

- `makeEditable(...)` covers simple text/textarea cells. It injects a textarea plus **Save/Cancel** buttons, and calls `onSave(value, $el)` when the user clicks Save.
- Dropdowns are always generated server‑side using `makeDropdown` or `makeMultiSelect` (see `server-functions.html`). On page load `editor.js` hides the `<select>`, prepends a clickable `<div class="metadata_option_display">` showing the current selection, and wires up:
  - click → open either the native `<select>` (single‑select) or a custom checkbox panel (multi‑select) and inject **Save**/**Cancel** buttons, recording the original value
  - Save → for multi‑selects the checkbox panel state is written back to the hidden `<select>`; `submit(...)` is then called and the `metadata_option_display` text refreshed. Multi‑select displays now use newline‑separated labels so each item appears on its own line.
  - Cancel or outside click → restore the original value and close without sending
  - the `submit` helper converts multiple selections to semicolon‑delimited strings as required by the API
- Date fields (`.edit_area[data-datepicker="true"]`) are wrapped in a `div` that launches a Bootstrap datepicker input when clicked. The picker now also uses explicit **Save/Cancel** buttons (previously blur/auto‑submit). The chosen date is converted to ISO format for server submission.

_New in 2026:_ multi‑select dropdowns use a checkbox panel instead of the native control. The panel is generated dynamically on each open and mirrors the `<option>` list. Developers can customise its CSS (`.multiselect-dropdown`, `.multiselect-list`) or modify the open/close logic in `editor.js` around line 70.

- Any new field type should follow the same UX: show a non‑editable label at rest and only commit when the user clicks Save.

> **Important:** dropdowns and datepickers previously auto‑saved on `change`; this behaviour was changed in 2026 to avoid accidental updates. The code in `editor.js` assumes no `change` handler submits automatically.

## The rest of this file continues with the HTML sanitisation checklist and other setup instructions.

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

**Check:** `head -1 "EOI metadata editor _ NTG Central_files/editor.js"` should output `(function ($) {`.

---

### 5.1 JavaScript API instantiation timing

**Why:** Another subtle script-order issue caused the `js_api.setAttribute is not a function` error. The NTG Central framework file `ntg-central-update-user-profile.js` (included after `editor.js` at line ~2216) re‑defines `window.Squiz_Matrix_API` with a pared‑down implementation that only exposes `setMetadata` and `setMetadataAllFields`. Any `Squiz_Matrix_API` instances created after that point will lack `setAttribute` and similar methods.

**Fix in `editor.js`:** instantiate the API object as soon as the IIFE runs, _before_ jQuery's ready handler, so it captures the full prototype supplied by `update-metadata.js`.

```js
(function ($) {
  // create before framework scripts run
  var apiOptions = [];
  apiOptions.key = "9772315187";
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
   - Browser interactions and API calls → `EOI metadata editor _ NTG Central_files/editor.js`
3. If a metadata field is a multi-select, ensure it is rendered with `makeMultiSelect()`.
4. Confirm `editor.js` submits multi-select values as `;`-joined strings.
5. Apply the updated template in Squiz Matrix and regenerate the listing output.
6. Re-save the HTML from production, run the sanitisation checklist, then validate.

### Fast Decision Guide

| Symptom                                             | File to change                                |
| --------------------------------------------------- | --------------------------------------------- |
| Field displays wrong control type                   | `row-template.html`                           |
| Options or selected state wrong for selects         | `server-functions.html`                       |
| Saves duplicated or payload format wrong            | `editor.js`                                   |
| Generated HTML looks stale                          | Re-publish/regenerate listing in Squiz Matrix |
| Console errors after re-saving HTML from production | Run the HTML Sanitisation Checklist above     |
| Hover tooltip missing or shows wrong label          | Check `data-label` attribute (see step 9 of the sanitisation checklist); or update the label string in `row-template.html` / `makeDropdown`/`makeMultiSelect` call |
| Hover tooltip text or styling needs changing        | `src/eoi-metadata-editor.css` — `.edit_area:hover::before` / `::after` rules |

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

| Column    | `data-attributename` | Notes                                                                       |
| --------- | -------------------- | --------------------------------------------------------------------------- |
| File Name | `name`               | All asset types                                                             |
| Title     | `title`              | File assets only (Word, PDF, etc.)                                          |
| Title     | `short_name`         | Non-file assets; `short_name→title` retry fallback active in `resultAttr()` |

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
var options = new Array();
options["key"] = "9772315187";
var js_api = new Squiz_Matrix_API(options);
```

The API key must match the key configured on the JavaScript API asset in Squiz Matrix.

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
    <button class="btn btn-sm btn-primary">Save</button>
    <button class="btn btn-sm btn-secondary">Cancel</button>
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
    <button class="btn btn-sm btn-primary">Save</button>
    <button class="btn btn-sm btn-secondary">Cancel</button>
  </div>
</div>
```

### Saving changes

All paths ultimately call:

```js
submit(value, assetid, fieldid);
```

- `value` for multi-select fields must be a **semicolon-delimited string** (e.g. `"AO2;SP1"`), not an array — the Squiz Matrix API rejects arrays.
- Single-select and free-text fields pass a plain string.
- Date fields pass ISO format `YYYY-MM-DD`.

`submit()` calls:

```js
js_api.setMetadata({
  asset_id: assetID,
  field_id: fieldid,
  field_val: content,
  dataCallback: result,
});
```

Attribute fields (name, title, short_name) use `submitAttr()` → `js_api.setAttribute()` instead.

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
   static assets, and reference them in `eoi-metadata-editor.htm`.
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
  left: 7px;          /* aligns with pill's inner left padding */
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
  content: "Edit " attr(data-label);  /* dynamic column name from data-label */
  position: absolute;
  bottom: 100%;
  left: 0;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 0.72em;
  padding: 2px 7px 2px 22px;  /* left padding makes room for the icon */
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
```

The icon and label are in separate pseudo-elements intentionally — mixing Font Awesome glyphs and plain text in a single `content:` string causes the FA font to misrender the first character of the text that follows the icon.

### The `data-label` attribute

The tooltip text is driven by `data-label` attributes on each editable element. The CSS `attr(data-label)` function reads this at paint time.

**Where labels come from:**

| Element | How `data-label` is set |
|---|---|
| `.edit_area` (free-text, datepicker) | Set directly in `row-template.html`, e.g. `data-label="file name"` |
| `<select class="metadata_options">` | `makeDropdown(…, label)` / `makeMultiSelect(…, label)` in `server-functions.html` emit `data-label="…"` on the `<select>` |
| `.metadata_option_display` | Copied from the adjacent `<select data-label>` by `editor.js` on page load |

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



### 2026-03-08: Hover edit tooltip system

- Added `::before` (FA pen-to-square icon, `\f044`) and `::after` (dark semi-transparent pill label) pseudo-elements to `.edit_area:hover` and `.metadata_option_display:hover` in `eoi-metadata-editor.css`. Tooltip floats above the cell via `position: absolute; bottom: 100%` and never overlaps cell text.
- Icon and label are in separate pseudo-elements so Font Awesome's private-use glyph doesn't corrupt adjacent plain-text characters.
- Label text is driven by `content: "Edit " attr(data-label)` — no extra DOM nodes required.
- Added `data-label` attributes (lowercase, sentence-case values) to all `.edit_area` divs in `row-template.html`.
- Added optional `label` third parameter to `makeDropdown()` and `makeMultiSelect()` in `server-functions.html`; emitted as `data-label` on the rendered `<select>`.
- `editor.js` now copies `data-label` from the hidden `<select>` onto the injected `.metadata_option_display` div on page load (both new-div and pre-existing-div code paths).
- Bulk-updated `data-label` attributes and removed stale `cursor: pointer` inline styles across all rows in the rendered HTML via PowerShell `Set-Content` replacements.
- Cursor (`pointer`) is now managed entirely by CSS on hover; removed all JS inline-style assignments of `cursor: pointer` for `.metadata_option_display` divs.

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

| Column                  | Type                     | Field ID / attribute                         | Template                                                 |
| ----------------------- | ------------------------ | -------------------------------------------- | -------------------------------------------------------- |
| ID                      | Link                     | —                                            | `%asset_assetid%`                                        |
| Status                  | Display                  | —                                            | `%asset_status_description%`                             |
| File Name               | Attribute (free-text)    | `name`                                       | `%asset_name%`                                           |
| Title                   | Attribute (free-text)    | `short_name` (pages) / `title` (file assets) | see _File asset vs. page asset attributes_ below         |
| Position title          | Metadata (free-text)     | `445504`                                     | `%asset_metadata_job.title%`                             |
| Designation             | Metadata (multi-select)  | `445634`                                     | `makeMultiSelect()` + `%asset_metadata_job.designation%` |
| Close date              | Metadata (free-text)     | `445509`                                     | `%asset_metadata_job.closing-date%`                      |
| Vacancy duration        | Metadata (free-text)     | `445506`                                     | `%asset_metadata_job.duration%`                          |
| Agency                  | Metadata (single-select) | `445640`                                     | `makeDropdown()` + `%asset_metadata_job.agency%`         |
| Location                | Metadata (multi-select)  | `445518`                                     | `makeMultiSelect()` + `%asset_metadata_job.location%`    |
| NTG Central / intranets | Metadata (multi-select)  | `446182`                                     | `makeMultiSelect()` + `%asset_metadata_job.advertise%`   |

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
7. **Never format Squiz template files** — `row-template.html`, `server-functions.html`, and `eoi-metadata-editor.htm` are in `.prettierignore` for a reason. Formatting them will corrupt `%keyword^modifier:param%` expressions.
8. **File assets use `title`, not `short_name`** — never hardcode `data-attributename="short_name"` unconditionally in the row template. Always use the `%asset_type_code%` conditional (see _File asset vs. page asset attributes_) so file-type assets receive the correct attribute name.
9. **`e.stopPropagation()` is required on inline edit buttons** — Cancel and Save buttons are children of the clickable `.edit_area` div. Without `stopPropagation`, clicks bubble to the parent and immediately re-open the editor.

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

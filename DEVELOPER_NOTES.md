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

| File/Directory                                                    | Role                                                                   | Editable?                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `EOI metadata editor _ NTG Central.html`                          | Saved production page — the local dev entry point                      | Sanitise only (see checklist below) |
| `EOI metadata editor _ NTG Central_files/editor.js`               | Custom interaction logic — event handlers, API calls, UI feedback      | **Yes**                             |
| `EOI metadata editor _ NTG Central_files/update-metadata.js`      | Squiz Matrix JS API library                                            | Read-only                           |
| `EOI metadata editor _ NTG Central_files/jquery-3.4.1.min.js`     | jQuery 3.4.1                                                           | Read-only                           |
| `EOI metadata editor _ NTG Central_files/jquery.editable.js`      | Jeditable inline-edit plugin — no longer used; kept as local copy only | Read-only                           |
| `EOI metadata editor _ NTG Central_files/datatables.lib.js`       | DataTables library                                                     | Read-only                           |
| `EOI metadata editor _ NTG Central_files/bootstrap.min.css`       | Bootstrap CSS (local copy)                                             | Read-only                           |
| `EOI metadata editor _ NTG Central_files/bootstrap-datepicker.*`  | Bootstrap Datepicker JS and CSS                                        | Read-only                           |
| `EOI metadata editor _ NTG Central_files/eoi-metadata-editor.css` | Custom styles for this editor                                          | Yes                                 |
| `EOI metadata editor _ NTG Central_files/roboto.css`              | Roboto font — replaced with Google Fonts `@import` to avoid CORS       | Read-only                           |
| `EOI metadata editor _ NTG Central_files/all.css`                 | Font Awesome Pro 5.15.4 CSS (local copy)                               | Read-only                           |
| `public/webfonts/`                                                | Font Awesome font files served by Vite at `/webfonts/`                 | Read-only                           |
| `public/cdn/userdata/`                                            | Stub JSON responses for NTG Central user-profile API calls             | Yes (stubs)                         |
| `row-template.html`                                               | Squiz Matrix asset listing row template (source of truth for row HTML) | Yes                                 |
| `server-functions.html`                                           | Squiz Matrix server-side helpers (`makeDropdown`, `makeMultiSelect`)   | Yes                                 |
| `vite.config.js`                                                  | Vite configuration                                                     | Yes                                 |
| `package.json`                                                    | npm scripts — `dev` starts Vite                                        | Yes                                 |
| `.prettierignore`                                                 | Prevents Prettier from corrupting Squiz `%keyword%` syntax             | Yes                                 |
| `.vscode/settings.json`                                           | Suppresses false VS Code HTML/JS errors in Squiz template files        | Yes                                 |

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
- The saved HTML page references all assets with relative paths (`./EOI metadata editor _ NTG Central_files/...`), which Vite resolves correctly.
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

## HTML Sanitisation Checklist

**When to run this:** Every time the HTML file is re-saved from production (e.g. when new EOI rows are added).

The saved page embeds several things that must be cleaned up before the local dev environment works correctly. Work through each item below in order.

---

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

### Post-sanitisation smoke test

After working through the checklist, start the dev server (`npm run dev`) and open the browser console. The following should be **absent**:

- `SyntaxError: Unexpected end of JSON input` (from `JSON.parse('')`)
- `ERR_BLOCKED_BY_SRI` or blocked stylesheet (Bootstrap / all.css integrity)
- `$(...).editable is not a function`
- 404s for `/webfonts/*.woff2` or `/webfonts/*.woff`
- CORS errors for `ntgcentral-dev.nt.gov.au` fonts
- The `uidtest` log line
- `SyntaxError` from `/cdn/userdata/` fetches

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

### Saving changes

**Free-text fields** — saved on `blur` of the textarea created by Jeditable:

```js
$(document).on("blur", ".edit_area textarea", function () { ... });
```

**Select / Multi-select fields** — saved on `change`:

```js
$(document).on("change", ".metadata_options", function () { ... });
```

Both call `submit(value, assetid, fieldid)` which calls:

```js
js_api.setMetadata({
  asset_id: assetID,
  field_id: fieldid,
  field_val: content,
  dataCallback: result,
});
```

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

## Change log

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

| Column                  | Type                     | Field ID / attribute | Template                                                 |
| ----------------------- | ------------------------ | -------------------- | -------------------------------------------------------- |
| ID                      | Link                     | —                    | `%asset_assetid%`                                        |
| Status                  | Display                  | —                    | `%asset_status_description%`                             |
| File Name               | Attribute (free-text)    | `name`               | `%asset_name%`                                           |
| Title                   | Attribute (free-text)    | `short_name`         | `%asset_short_name%`                                     |
| Position title          | Metadata (free-text)     | `445504`             | `%asset_metadata_job.title%`                             |
| Designation             | Metadata (multi-select)  | `445634`             | `makeMultiSelect()` + `%asset_metadata_job.designation%` |
| Close date              | Metadata (free-text)     | `445509`             | `%asset_metadata_job.closing-date%`                      |
| Vacancy duration        | Metadata (free-text)     | `445506`             | `%asset_metadata_job.duration%`                          |
| Agency                  | Metadata (single-select) | `445640`             | `makeDropdown()` + `%asset_metadata_job.agency%`         |
| Location                | Metadata (multi-select)  | `445518`             | `makeMultiSelect()` + `%asset_metadata_job.location%`    |
| NTG Central / intranets | Metadata (multi-select)  | `446182`             | `makeMultiSelect()` + `%asset_metadata_job.advertise%`   |

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

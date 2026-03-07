# EOI Metadata Editor — Developer Notes

## Overview

This tool is a browser-based inline editor for Squiz Matrix asset metadata and attributes. It loads as a saved page (`eoi-metadata-editor.htm`) and communicates with the Squiz Matrix backend via the [Squiz Matrix JavaScript API](https://docs.squiz.net/matrix/version/latest/api/javascript-api/index.html).

---

## File Structure

| File                                            | Role                                                                          | Editable?              |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| `eoi-metadata-editor.htm`                       | Generated output page — pre-populated with asset rows and field values        | Avoid (see note below) |
| `row-template.html`                             | Squiz Matrix asset listing row template (source of truth for row HTML)        | Yes                    |
| `server-functions.html`                         | Squiz Matrix server-side helper functions (`makeDropdown`, `makeMultiSelect`) | Yes                    |
| `eoi-metadata-editor_files/editor.js`           | Custom interaction logic — event handlers, API calls, UI feedback             | Yes                    |
| `eoi-metadata-editor_files/update-metadata.js`  | Squiz Matrix JS API library (minified-style)                                  | **Read-only**          |
| `eoi-metadata-editor_files/jquery-3.4.1.min.js` | jQuery                                                                        | Read-only              |
| `eoi-metadata-editor_files/jquery.editable.js`  | Jeditable inline-edit plugin                                                  | Read-only              |
| `eoi-metadata-editor_files/datatables.lib.js`   | DataTables library                                                            | Read-only              |
| `eoi-metadata-editor_files/bootstrap.min.css`   | Bootstrap CSS                                                                 | Read-only              |
| `.prettierignore`                               | Prevents Prettier from corrupting Squiz keyword syntax                        | Yes                    |
| `.vscode/settings.json`                         | Suppresses false VS Code HTML/JS errors in template files                     | Yes                    |

> **Rule:** Edit `row-template.html` and `server-functions.html` for template changes, and `editor.js` for interaction changes. Never modify `update-metadata.js`. Avoid editing `eoi-metadata-editor.htm` directly — it is generated output from the Squiz Matrix asset listing.

---

## Architecture

### HTML Structure

Each asset is a `<tr>` with the asset ID as its `id` attribute:

```html
<tr id="739076" data-status="Live"></tr>
```

Metadata fields are wrapped in `<td class="metadata-editor">`. There are two field types:

**Free-text field** — uses `jquery.editable.js` for inline editing:

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

Attribute fields (asset name, short name) use `<td class="attribute-editor">` and follow the same `edit_area` + `data-attributename` pattern, updated via `js_api.setAttribute`.

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
| NTG Central / intranets | Metadata (single-select) | `446182`             | `makeDropdown()` + `%asset_metadata_job.advertise%`      |

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
6. **The `.htm` file is generated output** — edit `row-template.html` and `server-functions.html` (and apply changes in the Squiz Matrix asset listing), not the saved `.htm` file. The `makeDropdown` and `makeMultiSelect` helper functions live in the page design of asset `#911527`.
7. **Never format Squiz template files** — `row-template.html`, `server-functions.html`, and `eoi-metadata-editor.htm` are in `.prettierignore` for a reason. Formatting them will corrupt `%keyword^modifier:param%` expressions.

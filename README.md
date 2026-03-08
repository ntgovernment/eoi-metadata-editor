# eoi-metadata-editor

EOI metadata editor is a lightweight web tool for managing asset metadata via editable table rows. It runs as a static page served by Vite during development and talks to the Squiz Matrix backend in production.

The editor supports:

- **Inline text editing** for attributes and metadata (click a field → textarea appears)
- **Single‑select dropdowns and enhanced multi‑selects**. Multi‑selects no longer use the native `<select multiple>` control; instead clicking the value display opens a floating checkbox panel. Each item toggles with a click (no Ctrl/Cmd key required). Save/Cancel buttons commit or revert the change. Values in the display box are shown one per line.
- **Attribute‑based dropdowns with numeric codes**. Certain asset attributes such as Status are rendered via the server helper `makeStatusDropdown` and store one of four numeric values (1 = Archive, 2 = Under Construction, 16 = Live, 64 = Safe Editing). Client logic calls `js_api.setAttribute` instead of `setMetadata` for these fields.
- **Bootstrap datepicker** fields (configured with autoclose, today button, and linked behavior) that provide Save/Cancel actions
- Automatic coercion of multi‑select values to semicolon‑delimited strings before submission

- **Full keyboard and screen‑reader accessibility** – all editable cells are now focusable via Tab, activatable with Enter, and navigable with keyboard controls (Escape cancels, Tab/Shift+Tab exits, etc.). ARIA roles/labels are injected automatically, and visual focus indicators highlight hovered or focused cells.

- **DataTables filtering, sorting, and pagination** (March 2026) – the table now displays up to 10 rows per page with pagination controls. Click any column header to sort ascending/descending; the global search box filters across all columns. Sorting keys are extracted from visible text, and the Close Date column uses a special YYYYMMDD key for correct chronological ordering. After any edit, the affected row is redrawn automatically so search and sort results stay in sync.

All interactive logic lives in `src/editor.js`; when you need to adjust behavior (e.g. add a new field type, tweak datepicker options, or change how a control submits), edit that file and rebuild. The datepicker initialization specifically lives around line 256 and can be customized via its options object.

For datepicker tweaks:

1. `autoclose` – set to `true` to close after a selection.
2. `todayBtn` – values `true` (view navigation) or `"linked"` (select today and close).
3. `todayHighlight` – highlights today's date in the calendar.
4. Other standard bootstrap-datepicker options are available; see library docs for details.

These comments help future developers and coding agents quickly understand where to look and what to change.

### DataTables configuration and behavior

**Overview:**
DataTables provides client-side table management: filtering, sorting across all columns, and pagination (10 rows per page by default). The library is bundled in `src/datatables.lib.js` and initialized during the jQuery ready callback in `src/editor.js`.

**Initialization:**
Located in `src/editor.js` around line 880:

```javascript
var dtTable = $("#myTable").DataTable({
  paging: true,
  pageLength: 10,
  ordering: true,
  searching: true,
  info: true,
  lengthChange: false,
  pagingType: "simple_numbers",
  columnDefs: [
    {
      targets: "_all",
      render: function (data, type, row, meta) {
        // Extract visible text from cell divs for sorting/filtering
        var $cell = $(row);
        var displayText =
          $cell.find(".metadata_option_display").text() ||
          $cell.find(".edit_area").text() ||
          $cell.text();
        return type === "display" ? $cell.html() : displayText;
      },
    },
    {
      targets: 6, // Close Date column
      render: function (data, type, row, meta) {
        if (type === "sort" || type === "filter") {
          // Convert DD/MM/YYYY to YYYYMMDD string for chronological sorting
          var text =
            $(row).find(".metadata_option_display").text() ||
            $(row).find(".edit_area").text() ||
            $(row).text();
          var parts = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (parts) {
            return parts[3] + parts[2] + parts[1]; // YYYYMMDD
          }
          return text;
        }
        return $(row).html(); // display unchanged
      },
    },
  ],
});
```

**How it works:**

1. **Render function** – Called during initialization and after row invalidation. The `type` parameter tells the function what it's being called for:
   - `'display'` – return HTML for rendering (unchanged)
   - `'sort'` – return a sortable key (string or numeric)
   - `'filter'` – return text for search matching
   - `'type'` – return a value for type detection
2. **Sort and filter extraction** – The first `columnDefs` entry uses `.metadata_option_display` for dropdowns (displays clean agency name) and `.edit_area` for text fields, falling back to cell text. This ensures sorting is based on human-readable values, not underlying codes.

3. **Close Date override** – Column 6 receives special handling: when called for sort/filter, it converts `DD/MM/YYYY` to `YYYYMMDD` (numeric-like string) for correct date ordering, even though display remains `DD/MM/YYYY`.

**Filtering (global search):**
DataTables generates a search box above the table. Type any text to filter rows; the render function provides the text that will be searched. For example, searching "DCF" matches rows with "Department of Children and Families" even though the underlying option code is "DCF".

**Sorting:**
Click any column header to toggle ascending/descending sort. The render function with `type === 'sort'` returns the key used for comparison. Most columns return visible text; Close Date returns YYYYMMDD to ensure chronological order.

**Pagination:**
By default 10 rows appear per page (`pageLength: 10`). Change this value in the initialization to show fewer or more rows. The controls show `Previous / 1 2 3 ... / Next` style. When you navigate pages, the sort and search are preserved.

**Row invalidation after edits:**
To keep search, sort, and pagination in sync after a user edits a cell, the render function must be re-called. This happens via:

```javascript
dtTable.row(tr).invalidate("dom").draw(false);
```

where `tr` is the table row DOM element. This is called in three post-save callbacks:

- `refreshTableCell()` – after inline text save
- `refreshTableCellsAttr()` – after attribute save
- `resultStatusAttribute()` – after status dropdown save

The `'dom'` flag tells DataTables to re-read the DOM; `false` passed to `draw()` prevents resetting to page 1 or losing the sort order.

**Extending:**
To modify search delay, pagination style, page length, or other options, edit the initialization object in `src/editor.js` near line 880. See the [DataTables options reference](https://datatables.net/reference/option/) for all available settings. Common tweaks:

- Change `pageLength: 10` to show more/fewer rows
- Add `searchDelay: 500` for delayed search as user types
- Change `pagingType: 'full_numbers'` to show all page numbers
- Set `ordering: false` to disable sorting (not recommended)

**Common issues:**

- **Sorting wrong on a new date column:** Ensure the `columnDefs` override includes the correct column `targets` number and returns `YYYYMMDD` format for sort/filter type.
- **Inline editing broken:** This usually means event handlers are not using delegation. All cell-click handlers must use `$(document).on(event, selector, handler)` pattern, not direct element `.on()` binding. See event-handling section below.
- **Changes don't appear in sort/search:** Verify you called `dtTable.row(tr).invalidate('dom').draw(false)` in the save callback for that field type.

### Quick start

```bash
npm install        # only needed once
npm run dev        # start Vite and open the dev page
```

Navigate to `http://localhost:5173/EOI%20metadata%20editor%20_%20NTG%20Central.html` and use the table exactly as production would.

### Event handling and delegation (critical for DataTables)

**The problem:**
DataTables renders the initial table by calling a `render` function for each cell. If you bind jQuery event handlers directly to table cells _before_ DataTables initialization is complete, those handlers may be orphaned when DataTables rewrites the cell HTML internally.

Example of what breaks:

```javascript
// ❌ BROKEN – handlers lost after DataTables init
var $cells = $(".edit_area");
$cells.on("click", function () {
  /* edit logic */
});
// Later: DataTables init calls render, which calls $cell.innerHTML = ...
// The new HTML has no handlers attached.
```

**The solution:**
Use **event delegation** via document-level handlers. This way, the handler stays in place even if the target element's HTML is replaced:

```javascript
// ✅ CORRECT – handler survives DOM rewrite
$(document).on("click", ".edit_area", function () {
  /* edit logic */
});
// Later: DataTables rewrites HTML, but the delegation handler is on document
// and still catches clicks on the new .edit_area elements.
```

**Implementation in this codebase:**

All interactive handlers use delegation:

1. **`makeEditable(selector, onSave)`** – Takes a CSS selector string (not a jQuery object), binds handlers via `$(document).on()` to catch clicks on that selector. See [src/editor.js](src/editor.js#L400) around line 400.

2. **`activateDatepicker($field)`** – Extracted as a standalone function; called for each datepicker field. The actual click/keydown handlers use delegation: `$(document).on('click', '.datepicker_container', ...)` and `$(document).on('keydown', '.datepicker_close', ...)`. See [src/editor.js](src/editor.js#L499) around line 499.

3. **Dropdown handlers** – Multi-select and status dropdowns already use delegation (`.metadata_multiselect_display`, `.metadata_select_value`, etc.), which is why they worked fine even after DataTables integration.

**Rule for new interactive elements:**

If you add a new field type that requires JavaScript interaction (text editing, date picking, dropdown, etc.):

1. **Do not bind handlers directly to individual cells** before or after DataTables initialization.
2. **Always use delegation:** `$(document).on('eventType', 'newSelector', handler)`.
3. **Test with DataTables:** Verify that clicking the control still works after the table re-renders (sort, paginate, search).
4. **Call row invalidation after save:** Use `dtTable.row(tr).invalidate('dom').draw(false)` so the updated value appears in sort/search immediately.

See [src/editor.js](src/editor.js#L400) for concrete examples of how `makeEditable`, datepicker, and dropdown handlers are implemented.

The rest of the README focuses on high‑level architecture; see **Developer Notes** for build and sanitisation details.

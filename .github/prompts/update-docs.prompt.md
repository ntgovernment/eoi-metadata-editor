---
description: "Update comprehensive documentation and copilot instructions to become helpful to other developers and coding agents."
agent: "agent"
---

# Update Docs — EOI Metadata Editor

Update all documentation to reflect the changes made in this session.

## Files to update

| File                                    | What to update                                                     |
| --------------------------------------- | ------------------------------------------------------------------ |
| `DEVELOPER_NOTES.md`                    | Update the relevant section(s) AND prepend a Change History entry. |
| `/memories/repo/eoi-metadata-editor.md` | Update concise bullet points when a key fact changes.              |
| `.github/prompts/*.prompt.md`           | Update if a workflow, pattern, or constraint changes.              |

---

## DEVELOPER_NOTES.md structure

The file has these major sections (in order). Update the section(s) that the change touches:

1. **Overview** — high-level description of the tool
2. **File Structure** — table of files and their roles/editability
3. **Local Dev Environment** — how to start Vite, what works/doesn't locally
4. **Agency–Advertise Cross-Field Rule** — sync logic between `job.agency` (445640) and `job.advertise` (446182)
5. **Auto Rename Button** — how the Auto button derives File Name and Document Title
6. **Accessibility and Interaction Behaviour** — keyboard nav, focus traps, save-result toast
7. **Status Column Colour System** — `data-status` attribute and CSS
8. **Architecture** — edit control types (makeEditable, single-select, multiselect, datepicker), HTML structure, jQuery triple-load, saving
9. **DataTables Integration** — init config, column indices, column filters
10. **Interaction Behaviour and Editing Guidelines** — field-specific UX rules
11. **Hover Edit Tooltip** — CSS/JS implementation
12. **Metadata Field ID Reference** — table of all field IDs and types
13. **Squiz Matrix Template Reference** — row-template.html and server-functions.html patterns
14. **Squiz Matrix JS API Field Value Formats** — what each field type expects from setMetadata
15. **HTML Sanitisation Checklist** — steps to run after every production re-save
16. **Quick Start and Decision Guide** — the fast path for developers and agents
17. **Troubleshooting** — common errors and their causes
18. **Tooling Configuration** — Vite, Prettier, VS Code settings
19. **Change History** — reverse-chronological log of all changes

---

## Change History entries

Prepend a new `### YYYY-MM-DD: <Short title>` entry at the **top** of the Change History section (before any existing entries). Each entry must include:

- **Problem / goal** — what was broken or what the user asked for
- **Solution** — what was changed and why
- **Files changed** — list each file with the function/line area affected

Use today's date. Example:

```markdown
### 2026-04-01: Agency save now syncs advertise field to backend

- **Problem:** When agency was changed, the "where to advertise" display updated correctly but nothing was saved to the metadata backend — the user had to manually open and save that field too.
- **Solution:** The `.single-dropdown-actions [data-action='save']` handler in `editor.js` now calls `submit()` for advertise (field 446182) immediately after saving agency (445640), using the preserve-WoG / replace-agency logic.
- **Files changed:** `src/editor.js` — agency save handler in `$(document).on("click", ".single-dropdown-actions [data-action='save']", ...)`.
```

---

## Repo memory (`/memories/repo/eoi-metadata-editor.md`)

Keep this file to **concise bullet points** — it is loaded automatically into the agent's context window on every conversation. Guidelines:

- One bullet per fact; max two lines each
- State what changed and what the old behaviour was if relevant
- Include field IDs for any metadata-related facts
- Do not copy full code blocks — just describe the pattern

---

## Cross-field rules section (Agency–Advertise)

When the agency/advertise sync logic changes, update **all three** of:

1. The prose description in `## Agency and advertise behaviour (2026 updates)`
2. The truth table (four rows: WoG+agency, agency-only, WoG-only, blank-agency)
3. The repo memory bullet

---

## What NOT to document

- Internal variable names that are obvious from the code
- Third-party library internals (`update-metadata.js`, DataTables, Bootstrap)
- Changes already enforced by linters or formatters
- The contents of `EOI metadata editor _ NTG Central.html` — this file is re-saved from production periodically; document the sanitisation checklist steps instead

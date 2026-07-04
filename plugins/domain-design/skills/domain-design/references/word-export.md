# Word export (`design/system-design-document.md` → client `.docx`)

> Child reference of `SKILL.md`. Companion to `sdd-sections.md` — this turns the assembled
> Markdown from `/deliver-docs` into a client-facing Word document with rendered diagram images.

## Why this exists
`/deliver-docs` assembles a single Markdown file with Mermaid diagrams as raw code blocks — good
for git-tracked artifacts, not for a client handoff. This pipeline renders the diagrams to images
and pours the content into a `.docx` built from a real Word template (styles, cover page, section
order all controlled by the template file, not by this script).

## Pieces (`assets/word-export/`)
- `sdd_template.docx` — the docxtpl (Jinja2-in-docx) template. Cover page, revision history,
  native Word TOC field, then the same 10 sections as `sdd-sections.md`, in order.
- `build_template.py` — regenerates `sdd_template.docx` from scratch (python-docx). Edit this
  when the template's layout/wording/section order needs to change; re-run it to rebuild.
- `render_sdd_docx.py` — parses a `system-design-document.md`, renders every ` ```mermaid ` block
  to PNG via `npx @mermaid-js/mermaid-cli` (needs Node.js; no local install required), and fills
  the template with docxtpl. Usage:
  ```
  python render_sdd_docx.py design/system-design-document.md out/SDD.docx --meta doc-meta.json
  ```
  `doc-meta.json` carries `project_name`, `client_name`, `doc_version`, `doc_date`, `author`,
  `revisions[]` — see `sample/doc-meta.json` for the shape.
- `sample/` — a worked example (Billing/Invoice/Payment domain, matching the canonical example
  used in `design-artifacts.md` + `mermaid-patterns.md`) with a pre-rendered `sample/output/`.
  Run it to sanity-check the pipeline after any template change.

## Adapting to an actual client-provided Word template
The template is a **generic** SDD layout, not any specific client's document. To match a real
client template exactly:
1. Take the client's `.docx` as the starting file (instead of `build_template.py`'s output).
2. Insert the same placeholder names at the matching spots, using docxtpl's three tag forms:
   - Plain text / images: `{{ field_name }}` (works for `InlineImage` too — it's run-level XML).
   - Multi-paragraph prose (variable length — bullets, multiple paragraphs): `{{p field_name }}`.
     A bare `{{ field_name }}` for a `Subdoc` is invalid — it nests `<w:p>` inside `<w:t>` and
     corrupts the XML. The `p` prefix strips the enclosing paragraph first (docxtpl's `patch_xml`).
   - Repeating table rows (Data Dictionary, Revision History, Roles): the `{%tr %}` marker
     **consumes the entire `<w:tr>` it sits in**, so `{%tr for row in dd_rows %}` and
     `{%tr endfor %}` must each be in their **own row**, separate from the data row with the
     real `{{ row.field }}` cells — putting the `for` tag in the same row as the data cells
     deletes that row's other cells (this bit the first draft of `sdd_template.docx`; see git
     history of this folder if it regresses).
3. Point `TEMPLATE_PATH` in `render_sdd_docx.py` at the new file (or pass it as an extra CLI arg
   if multiple client templates need to coexist).
4. Re-run against `sample/system-design-document.md` first to confirm nothing broke before using
   it on a real project's `design/system-design-document.md`.

## Known limits
- Markdown→subdoc conversion (`build_subdoc` in `render_sdd_docx.py`) handles paragraphs, `- `/`* `
  bullets, and `**bold**` only — not nested lists, tables inside prose, or links. Section 8/10
  tables are parsed properly (pipe-table parser), since the Data Dictionary is the one artifact
  that must stay exact.
- Requires Node.js on the machine running the render (for `npx @mermaid-js/mermaid-cli`) and the
  `docxtpl` + `docxcompose` + `python-docx` Python packages.

## `fda003/` — adaptation to a real client template

`assets/word-export/fda003/` targets an actual client-provided Word template found at
`docs/template/F-DA-003_FunctionalSpec.docx` (a Functional Specification form, not a
ScenarioForge-authored one) instead of the generic `sdd_template.docx` above. Two scripts:

- `patch_fda003_template.py` — one-time: reads the real `.docx` from `docs/template/`, inserts
  docxtpl tags at the right spots, writes `fda003_template.docx` here. Re-run if the source file
  or the mapping changes (it hardcodes table/paragraph positions found by document-order
  traversal — see the script's docstring for the full section list).
- `render_fda003_docx.py` — fills that template from a `system-design-document.md`, same CLI
  shape as `render_sdd_docx.py`:
  ```
  python render_fda003_docx.py design/system-design-document.md out/spec.docx --meta doc-meta.json
  ```
  (`doc-meta.json`: `client_company_name`, `project_code`, `project_name`, `revisions[]` — see
  `sample-meta.json`.) Try `sample-output/` first: `python render_fda003_docx.py ../sample/system-design-document.md sample-output/F-DA-003_Billing.docx --meta sample-meta.json`.

**F-DA-003 is only partly feedable from domain-design's own artifacts.** Auto-filled:
- Doc control (company/project code/name), Revision History — from `doc-meta.json`.
- System Diagram — DFD Level 0 used as a stand-in (domain-design has no dedicated "system/infra
  diagram"; it's the closest available artifact, not a true deployment/network diagram).
- Sequence Diagram — only if the assembled markdown actually has a `sequenceDiagram` mermaid
  block (optional per `mermaid-patterns.md`; most STANDARD-scale runs won't have one, and the
  section is just left with its heading and no image when absent).
- ER Diagram — Section 7, straightforward.
- **Database Specification** (one heading + field table per entity) and **Database
  Normalization** (one row per entity) — both driven by grouping the Data Dictionary (Section 8)
  by `Entity`. `DB Name` defaults to the entity name (EF-Core-style convention, per `SKILL.md`'s
  own analogy); `Description`/`Server Name UAT`/`Server Name Production` are left blank — no such
  data exists in the DD. Normalization defaults every entity to "New" + 1NF/2NF/3NF checked
  (a methodological inference from domain-design's own modeling rules, not an invented business
  fact) and leaves BCNF unchecked for manual review.

**Left blank, structure intact, for a human to fill in** — domain-design does not produce this
data at all: Screen / Process / Document / Job function-spec tables (Screens are `ui-mockup`'s
own artifact, outside domain-design's boundary; Process/Document/Job have no ScenarioForge file
to read from — see `design-artifacts.md`'s disk layout, there's no persisted use-case file), and
every NON-FUNCTIONAL infra table (Server Detail, DB-env detail, API-env detail, Security,
Performance, Reliability) — these need real server names/IPs/SLA numbers no design tool should
invent. The stale literal `{{xxx}}` / `{{Low, Medium, High}}` / `{{number}}` markers that were in
the original file are stripped out of these tables so they don't break Jinja parsing, but the
row/column structure is untouched.

### The gotchas that bit this implementation (don't repeat them)
- **`{%tr %}` consumes the *entire* `<w:tr>` it sits in.** The for/endfor markers must be their
  own dedicated rows, never sharing a row with real data cells (see the `sdd_template.docx`
  section above — same rule, this template just has more tables that needed it).
- **Row-index shift after insertion.** `wrap_row_as_tr_loop()` in `patch_fda003_template.py`
  exists because the first draft called `table.add_row_before(table, table.rows[2])` *after*
  already inserting a row — by then `rows[2]` had silently become the data row itself (not the
  row after it), so the ENDFOR marker landed *before* the data row instead of after it, and the
  cleanup step that deletes trailing filler rows then deleted the data row too. Symptom was
  silent — no exception, just an empty table. Always capture the "row after" reference *before*
  any insertion, or use `wrap_row_as_tr_loop()`.
- **Paragraph/element identity across `doc.paragraphs` calls.** python-docx wraps the same
  underlying XML element in a *new* `Paragraph` object every time you access `.paragraphs`, so
  `paragraph_a is paragraph_b` is always `False` even for the same element fetched twice — compare
  `paragraph_a._p is paragraph_b._p` instead (see `find_paragraph`/`next_blank_paragraph`).
- Before wiring any data into an edited (not freshly-authored) template, do the sanitize-then-
  trivial-`render({})` check the way `patch_fda003_template.py` does — invalid leftover
  `{{...}}` text (there's plenty in real-world client templates) throws `TemplateSyntaxError`
  and you want that failure isolated from data-mapping bugs.

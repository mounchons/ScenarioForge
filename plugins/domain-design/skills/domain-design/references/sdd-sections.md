# System Design Document — 10 sections & cross-validation

> Child reference of `SKILL.md` (domain-design). Used by the `/deliver-docs` command to assemble the
> full deliverable. During normal development you produce a subset (see scale table in SKILL.md); this
> file is for the **complete handoff document**.

## Assembly rule
`/deliver-docs` ASSEMBLES from artifacts already in `design/` + `scenarios.json`. It does not invent new
content. If a section's source artifact is missing for an in-scope scenario, report the gap and stop —
do not fabricate to fill the template.

## The 10 sections

1. **Introduction & Overview** — system name, purpose, scope, stakeholders, high-level architecture.
   Source: scenarios `business.business_value` + module meta.
2. **System Requirements** — Functional (from scenario goals/use cases), Non-Functional, business rules,
   constraints. Source: `business{}` + use cases.
3. **Module Overview** — module list, responsibilities, inter-module relationships. Source: `meta.module`
   grouping + entity ownership.
4. **Data Model** — conceptual + logical model narrative tying entities together. Source: `design/entities/`.
5. **Data Flow Diagram** — Level 0 then Level 1 (Mermaid). Source: process decomposition of use cases.
6. **Flow Diagrams** — per significant use case / business process (Mermaid flowchart). Source: use case main_flow.
7. **ER Diagram** — Mermaid erDiagram. Source: entities + relationships. MUST mirror the Data Dictionary.
8. **Data Dictionary** — the full field table. Source: `design/data-dictionary.md`. The canonical contract.
9. **Sitemap** — navigation tree for has_ui scenarios. Source: `design/sitemap.md`.
10. **User Roles & Permissions** — role list + permission matrix + access rules. Source: scenario
    `business.actor` set + sitemap `roles`.

## Cross-validation (HARD GATE — run before assembling)

All four must pass; on any failure, output the specific mismatch and stop.

1. **ER ↔ DD bidirectional** — every entity and attribute in the ER Diagram appears in the Data
   Dictionary, and every DD row maps to an ER entity. No orphans either direction.
2. **DFD L0 ↔ L1** — every external entity and data store in Level 0 reappears in Level 1; no Level 1
   process references a store/entity absent from Level 0.
3. **Sitemap ↔ Roles** — every page in the sitemap is reachable by at least one role in Section 10;
   every role has at least one reachable page.
4. **FK type match** — every FK field's type equals the type of the PK it references (read from DD).

## Output
Single Markdown file `design/system-design-document.md` with the 10 sections in order, Mermaid embedded.
Record it in `registry.json` as `kind: "sdd"`, `scenario_ref: ["*"]` (or the in-scope subset).

## Scale note
- STANDARD development normally yields sections 7, 8, plus API contracts + sitemap — enough to drive
  ui-mockup and implement.
- ENTERPRISE (or any `/deliver-docs` call) produces all 10 with the cross-validation gate enforced.

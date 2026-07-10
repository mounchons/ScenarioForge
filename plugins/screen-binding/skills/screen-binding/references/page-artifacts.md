# Page Artifacts — shapes & how PG-* trace back

> Child reference of `SKILL.md` (screen-binding). Every page artifact lives under `mockups/` and carries a
> `scenario_ref` + `sitemap_path` so the spine can be walked in both directions. This worker never
> invents data — every field maps to a domain-design Data Dictionary row. The shell (theme/master page) is
> built first; see `references/master-shell.md`.

## Disk layout produced by this worker
```
mockups/
├── shell/                          # the THEME/MASTER PAGE — built first (references/master-shell.md)
│   ├── _layout.html  theme.css  nav.js  index.html
├── pages/
│   ├── PG-<module>-<name>.json     # one binding artifact per page (always)
│   └── PG-<module>-<name>.html     # the HTML mockup, when fidelity = html
├── wireframes/                     # when fidelity = wireframe
│   └── PG-<module>-<name>.html     # low-fi placeholder generated from the DD
├── prompts/                        # when source = claude-design-pending (prompt-out)
│   └── PG-<module>-<name>.md        # the Claude Design brief for that screen
└── design-bundle/                  # when source = claude-design (imported bundle)
    └── ...                         # real HTML/CSS/JS + tokens from claude.ai/design
```
The design registry (owned by domain-design at `design/registry.json`) gains `kind:"page"` + a `kind:"shell"`
row; do not create a second registry.

## PG-* page artifact (the binding record)
```jsonc
{
  "id": "PG-billing-checkout",
  "scenario_ref": ["SC-billing-001"],     // which scenario(s) this screen serves
  "sitemap_path": "/billing/checkout",    // the node from domain-design's sitemap.md
  "label": "Checkout",
  "actor": "subscriber",                   // from business.actor
  "roles": ["subscriber"],                 // who may see it (sitemap node roles)
  "extends_shell": "mockups/shell/_layout.html",  // every page extends the master page
  "fidelity": "html",                      // wireframe | html | prompt
  "source": "in-house",                    // in-house | wireframe | claude-design | claude-design-pending
  "design_ref": "mockups/pages/PG-billing-checkout.html",  // pointer to the real file (never inlined)
  "fields": [                              // every field maps to a Data Dictionary row
    { "name": "AmountDue",  "dd_ref": "Invoice.AmountDue",  "control": "readonly-text", "io": "display" },
    { "name": "CardToken",  "dd_ref": "Payment.CardToken",  "control": "secure-input",  "io": "capture" }
  ],
  "structure": {                           // the page's container layout — REQUIRED when the page has any
    "tabs": ["summary", "card", "history"], // tabs/sections/modals; [] or omitted for a flat page.
    "default_tab": "summary",               // Downstream readers (feature-builder manifests, scenario-verify
    "modals": ["confirm-payment"],          // tab-activation) take structure facts FROM HERE — a tab count
    "sections": []                          // restated from memory in a later phase goes stale (field case:
  },                                        // a task said "5 tabs" over a page that had 8).
  // ENTERPRISE only:
  "design_tokens": { "ref": "mockups/shell/theme.css" },  // brand from the shell; or bundle tokens on import
  "intent": "Let a subscriber confirm the card on file and pay the open invoice in one step.",
  "states": ["default", "empty", "loading", "error:declined"]
}
```

Hard rules:
- `fidelity`, `source`, and `design_ref` are mandatory. A binding with no design pointer is invalid.
- `extends_shell` must point at the shell — every page shares the master page / theme / nav.
- `structure` is mandatory for any page with tabs/sections/modals and MUST match the mockup file (same tab
  ids/count). It is the single source of truth for page layout facts downstream — feature-builder's UI
  Control Manifests note which tab/modal hosts each control, and scenario-verify activates tabs from it.
  When the mockup's structure changes, this block changes in the same edit.
- Every `fields[].dd_ref` MUST resolve to an existing Data Dictionary row (Entity.Field). No DD row → it is
  a **gap**, reported back to domain-design — never silently added here.
- `io` is explicit: `display` (read) vs `capture` (write). Helps qa-* later derive field-level checks.
- `control` vocabulary is intent-level: text, readonly-text, secure-input, select, multiselect, checkbox,
  radio, date, number, textarea, file, table. Concrete Bootstrap 5 components are chosen in the html
  mockup (`references/html-mockup.md`); framework wiring belongs to implement.

## fidelity ↔ source ↔ file (how the four paths land)
| fidelity | source | design_ref points at | reference |
|---|---|---|---|
| wireframe | wireframe | `mockups/wireframes/PG-*.html` | wireframe-rules.md |
| html | in-house | `mockups/pages/PG-*.html` | html-mockup.md |
| prompt | claude-design-pending | `mockups/prompts/PG-*.md` | claude-design-bridge.md (Direction 1) |
| html | claude-design | `mockups/design-bundle/...` | claude-design-bridge.md (Direction 2) |

Upgrading is in place: a `prompt`/`wireframe` PG-* becomes `html`+`claude-design` on import — scenario_ref,
sitemap_path, extends_shell unchanged.

## Design-token map (ENTERPRISE)
Brand normally comes from the shell `theme.css` (one source per project). On Claude Design import, the
bundle may carry its own tokens; point `design_tokens.ref` at them and reconcile with the shell — never
silently fork the palette. Self-generated wireframes omit tokens (the shell supplies look).
```jsonc
{
  "ref": "mockups/shell/theme.css",   // or the imported bundle's token file
  "normalized": {
    "color": { "primary": "var(--bs-primary)", "accent": "var(--app-accent)" },
    "type":  { "font-base": "var(--app-font-sans)" },
    "space": ["4","8","12","16","24","32"]
  }
}
```

## Writing back to scenarios.json (traces_down.pages — the ONLY field this worker writes)
```jsonc
"traces_down": {
  // entities / use_cases / apis already written by domain-design — DO NOT TOUCH
  "pages": ["PG-billing-checkout"]        // this worker appends only here
  // features: left for solution-arch / implement
}
```
Preserve all other scenario fields exactly. Never write `pages` on a `has_ui == false` scenario. Never
clobber a `locked` scenario's pages.

## registry rows (append to design/registry.json)
```jsonc
{ "id": "shell", "kind": "shell", "file": "mockups/shell/_layout.html",
  "theme": "mockups/shell/theme.css", "scenario_ref": ["*"] },
{ "id": "PG-billing-checkout", "kind": "page", "file": "mockups/pages/PG-billing-checkout.json",
  "design_ref": "mockups/pages/PG-billing-checkout.html", "fidelity": "html", "source": "in-house",
  "scenario_ref": ["SC-billing-001"] }
```

## Trace, both directions
- Down: open `SC-billing-001` → `traces_down.pages` → `PG-billing-checkout` → `design_ref` (real screen),
  which extends the shell (theme/nav).
- Up: open a `PG-*` → `scenario_ref` → the business goal it serves; → each `fields[].dd_ref` → the Data
  Dictionary row (and thus the entity) it shows. This is what lets qa-* and implement know exactly which
  scenario + which fields a screen is accountable for.

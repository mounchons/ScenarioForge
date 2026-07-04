"""
Renders design/system-design-document.md into a copy of the real F-DA-003 Functional
Specification template (fda003_template.docx), auto-filling only what's genuinely derivable
from domain-design's artifacts and leaving everything else as a clean, structurally-intact
table for a human to complete. See references/word-export.md for the full section-by-section
rationale (what's auto-filled vs manual, and why).

Usage:
    python render_fda003_docx.py <path/design/system-design-document.md> <output.docx> --meta doc-meta.json

Auto-filled: doc control, revision history, System/ER diagram images (+ Sequence Diagram if the
markdown has one), Database Specification per entity (from the Data Dictionary, grouped by
Entity), Database Normalization rows (one per entity).

Left blank/manual (domain-design does not produce this data -- Screens are ui-mockup's own
territory, Documents/Jobs have no ScenarioForge artifact, and all Server/DB-env/API-env/
Security/Performance/Reliability tables need real infrastructure detail no design tool can
invent): Screen/Process/Document/Job function-spec tables, all NON-FUNCTIONAL infra tables.
"""
import argparse
import json
import sys
from pathlib import Path

from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm

sys.path.insert(0, str(Path(__file__).parent.parent))
from render_sdd_docx import (  # noqa: E402
    split_sections, extract_mermaid_blocks, extract_subheadings,
    parse_dd_table, render_mermaid_to_png,
)

TEMPLATE_PATH = Path(__file__).parent / "fda003_template.docx"


def group_dd_by_entity(dd_rows):
    entities = {}
    order = []
    for r in dd_rows:
        name = r.get("entity", "").strip()
        if not name:
            continue
        if name not in entities:
            entities[name] = []
            order.append(name)
        entities[name].append({
            "field": r.get("field", ""),
            "type": r.get("type", ""),
            "description": r.get("description", ""),
        })
    return [{"name": name, "fields": entities[name]} for name in order]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sdd_markdown", type=Path)
    ap.add_argument("output_docx", type=Path)
    ap.add_argument("--meta", type=Path, default=None,
                     help="JSON with client_company_name/project_code/project_name/revisions[]")
    args = ap.parse_args()

    md_text = args.sdd_markdown.read_text(encoding="utf-8")
    sections = split_sections(md_text)

    meta = {
        "client_company_name": "ชื่อลูกค้า (Client Company Name)",
        "project_code": "P20xx-xxx",
        "project_name": "ชื่อโครงการ (Project Name)",
        "revisions": [{"version": "1.0", "date": "", "author": "", "description": "First release"}],
    }
    if args.meta and args.meta.exists():
        meta.update(json.loads(args.meta.read_text(encoding="utf-8")))

    diagrams_dir = args.output_docx.with_name(args.output_docx.stem + "_diagrams")
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    ctx = dict(meta)

    # System Diagram <- DFD Level 0 (closest available proxy; not a true infra diagram)
    dfd_subs = extract_subheadings(sections.get(5, ""))
    l0_png = None
    for title, body in dfd_subs:
        _, blocks = extract_mermaid_blocks(body)
        if blocks:
            l0_png = diagrams_dir / "system_diagram.png"
            render_mermaid_to_png(blocks[0], l0_png)
            break
    ctx["s_system_diagram_img"] = InlineImage(tpl, str(l0_png), width=Mm(150)) if l0_png else ""

    # Sequence Diagram: optional -- domain-design only emits one if the SDD markdown has a
    # `sequenceDiagram` mermaid block; most STANDARD-scale projects won't have one.
    seq_png = None
    for section_num in (5, 6):
        for title, body in extract_subheadings(sections.get(section_num, "")):
            _, blocks = extract_mermaid_blocks(body)
            for b in blocks:
                if b.strip().startswith("sequenceDiagram"):
                    seq_png = diagrams_dir / "sequence_diagram.png"
                    render_mermaid_to_png(b, seq_png)
                    break
            if seq_png:
                break
        if seq_png:
            break
    ctx["s_sequence_diagram_img"] = InlineImage(tpl, str(seq_png), width=Mm(150)) if seq_png else ""

    # ER Diagram <- Section 7
    _, er_blocks = extract_mermaid_blocks(sections.get(7, ""))
    if er_blocks:
        er_png = diagrams_dir / "er_diagram.png"
        render_mermaid_to_png(er_blocks[0], er_png)
        ctx["s_er_diagram_img"] = InlineImage(tpl, str(er_png), width=Mm(160))
    else:
        ctx["s_er_diagram_img"] = ""

    # Database Specification + Database Normalization <- Data Dictionary, grouped by entity
    dd_rows = parse_dd_table(sections.get(8, ""))
    entities = group_dd_by_entity(dd_rows)
    if not entities:
        entities = [{"name": "(no Data Dictionary rows found)", "fields": []}]
    ctx["entities"] = entities

    tpl.render(ctx)
    args.output_docx.parent.mkdir(parents=True, exist_ok=True)
    tpl.save(str(args.output_docx))
    print(f"Wrote {args.output_docx}")
    print(f"Auto-filled: doc control, revision history, {len(entities)} entities "
          f"(Database Specification + Normalization), diagrams "
          f"(system={bool(l0_png)}, sequence={bool(seq_png)}, er={bool(er_blocks)}).")
    print("Manual-fill sections (unchanged from the real F-DA-003 template, structure kept): "
          "Screen/Process/Document/Job specs, Server/DB-env/API-env/Security/Performance/"
          "Reliability tables.")


if __name__ == "__main__":
    main()

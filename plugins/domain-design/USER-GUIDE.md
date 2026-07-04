# คู่มือใช้งาน Skill: `domain-design`

> ScenarioForge — Phase 2 (Planning) | Tier 1 Workflow Worker
> หน้าที่: อ่าน `scenarios.json` → สร้าง domain model (entities, Data Dictionary, use cases, API contracts, sitemap) → เขียน `traces_down` กลับ scenario

---

## 1. skill นี้ทำอะไร (เข้าใจก่อนเขียน prompt)

```
scenario-discovery (Phase 1)          domain-design (Phase 2)              ถัดไป
─────────────────────────             ──────────────────────              ─────
scenarios.json   ─── อ่าน business{} + domain_concepts ──►  entities + DD  ──► screen-binding (pages)
(business intent)                                            use_cases       ──► solution-arch (features)
                  ◄── เขียนกลับ traces_down (entities/use_cases/apis) ───
```

**อ่านอะไร:** `business{}` (actor, goal, pre/postconditions, has_ui) + `domain_concepts[]` ของแต่ละ scenario
**ผลิตอะไร:** ไฟล์ใน `design/` (entities, `data-dictionary.md`, `api/`, `sitemap.md`, `registry.json`)
**เขียนกลับอะไร:** `traces_down.entities / use_cases / apis` ในแต่ละ scenario
**ไม่ทำ:** ไม่สร้าง scenario (Phase 1), ไม่ออกแบบหน้าจอ/`pages` (screen-binding), ไม่ทำ `features`/โค้ด/เทสต์

> **เงื่อนไขสำคัญ:** ต้องมี `scenarios.json` อยู่ก่อน ถ้ายังไม่มี skill จะหยุดและบอกให้รัน `scenario-discovery` ก่อน

---

## 2. การติดตั้ง / เรียกใช้ใน Claude Code

```bash
# เพิ่ม marketplace (ครั้งแรกครั้งเดียว)
/plugin marketplace add D:\ProjectClaude\ScenarioForge

# ติดตั้ง plugin
/plugin install domain-design@scenarioforge
```

**เรียก skill 2 แบบ:**
- **Implicit** (แนะนำ) — พิมพ์ภาษาธรรมชาติที่ตรง trigger keyword แล้ว Claude route ให้เอง
- **Explicit** — `/domain-design:domain-design` (ใช้เมื่อ route ไม่ติด)

**Trigger keywords ที่ทำให้ skill activate:** `domain-design`, `domain model`, `data dictionary`, `ER diagram`, `entity design`, `API contract`, `sitemap`, `system design document`, `SDD`, `Phase 2`, `deliver docs`

---

## 3. วิธีเขียน prompt (พร้อมตัวอย่าง)

หลักการ: **ระบุ 3 อย่าง** = (1) ทำกับ scenario ไหน/module ไหน (2) ต้องการ artifact อะไร (3) scale ระดับไหน
ถ้าไม่ระบุ scale → skill อ่าน `meta.effort_scale` จาก `scenarios.json` เอง

### 3.1 Prompt มาตรฐาน — วาง domain model ทั้ง module

```
ออกแบบ domain model จาก scenarios.json ของ module billing ให้หน่อย
```
ผลลัพธ์: skill อ่านทุก scenario ที่ validated → สร้าง entities + Data Dictionary + use cases + API + sitemap
ตาม scale ที่ตั้งไว้ แล้วเขียน `traces_down` กลับให้

### 3.2 เจาะ artifact เฉพาะอย่าง

| ต้องการ | ตัวอย่าง prompt |
|---|---|
| ER + Data Dictionary | `"สร้าง ER diagram กับ data dictionary จาก scenarios ของ module billing"` |
| เฉพาะ API contract | `"ออกแบบ API contract จาก use case ของ SC-billing-001"` |
| เฉพาะ sitemap | `"ทำ sitemap จาก scenario ที่ has_ui ใน module billing"` |
| เจาะ scenario เดียว | `"วาง entity + DD เฉพาะ SC-billing-002"` |

### 3.3 ระบุ scale เอง (override ค่าใน meta)

```
ออกแบบ domain ของ module billing แบบ STANDARD พอ (เอาแค่ DD + ER + API + sitemap)
```

ระดับ scale และสิ่งที่ได้:

| Scale | ได้อะไร | ใช้เมื่อ |
|---|---|---|
| **QUICK** | ข้าม Phase นี้ (ไป implement ตรง) | งาน CRUD เล็ก ๆ — ต้องสั่งชัดถึงจะทำ |
| **STANDARD** | Data Dictionary + ER + API + Sitemap (4 อย่าง) | งานพัฒนาปกติ — เร็ว ไม่บวม (ค่า default) |
| **ENTERPRISE** | ครบ 10 sections + cross-validation | ส่งมอบ / domain ใหญ่ / งาน regulated |

### 3.4 Reverse engineer จาก codebase เดิม (ASP.NET Core + EF Core)

```
อ่าน codebase ที่ D:\GitHub\MyApp แล้ว reverse เป็น domain model
(entities, DD, API, sitemap) ผูกกลับ scenario ให้ด้วย
```
skill จะดึง: `DbSet<T>` → entity, navigation property → relationship, data annotation/Fluent API → คอลัมน์ DD,
`[Authorize(Roles=...)]` → role/permission แล้ว map กลับ `scenario_ref`
> ถ้าเจอโค้ดที่ไม่มี scenario รองรับ จะ flag เป็น gap ใน `reverse-notes.md` ไม่เดา business intent ให้เอง

### 3.4.1 คำถามที่เจอบ่อย: "มี codebase เก่าอยู่แล้ว อยากแปลงเป็นเอกสาร/spec เพื่อพัฒนาต่อ ได้ไหม?"

**มี** — แต่ต้องเข้าใจขอบเขตก่อนใช้: สิ่งที่ domain-design reverse-engineer ให้อัตโนมัติคือ
**Phase 2 (design) เท่านั้น** — entities, Data Dictionary, API contract, sitemap จากโค้ดจริง
ส่วน **Phase 1 (business intent — ทำไมต้องมี feature นี้ ใครใช้ คุ้มค่าตรงไหน)** ต้องให้คนยืนยันผ่าน
`scenario-discovery` เสมอ *by design* — กัน AI เดา business intent จากโค้ดเก่าที่อาจ outdated/มี
dead code ปนอยู่ (หลักการข้อ 1 ของ scenario-discovery: "business intent มาจากผู้ใช้เท่านั้น ห้ามเดา")

**วิธีที่ 1 — ผ่าน orchestrator (แนะนำ ถ้าสุดท้ายจะพัฒนาต่อเป็นโค้ดจริงด้วย)**

orchestrator รู้จัก workflow นี้แล้ว (เพิ่มเป็น "Phase 0 — Bootstrap" ที่ trigger อัตโนมัติเมื่อยังไม่มี
`scenarios.json` แต่ target ที่สั่งเป็น path codebase จริง — ดู `orchestrator` USER-GUIDE หัวข้อ 2D):

```
/orchestrator:build D:\GitHub\LegacyApp
```

orchestrator จะไล่ให้เอง: Phase 0 (domain-design reverse) → Phase 1 (scenario-discovery ถามยืนยัน
business intent จาก `reverse-notes.md`) → Phase 2 (domain-design ผูก traces_down กลับ) → Phase 2u/3/4/4q
ต่อจนถึงโค้ดจริงถ้าต้องการ (หรือดูแผนก่อนด้วย `/orchestrator:plan D:\GitHub\LegacyApp`) เอกสาร/Word เป็น
ขั้นตอนแยกที่สั่งเพิ่มได้ทีหลัง (ข้อ 4-5 ด้านล่าง) เพราะไม่ใช่ ledger phase ของ orchestrator

**วิธีที่ 2 — เรียกเองทีละขั้น (คุมเองละเอียด หรือแค่อยากได้เอกสาร ไม่ได้จะ build ต่อทันที)**

```
1. (ทางเลือก) รัน scenario-discovery คุยกับคนที่รู้ business ก่อน scaffold scenarios.json คร่าวๆ
   — ถ้ายังไม่มีเวลาคุยตอนนี้ ข้ามไปข้อ 2 ได้เลย (domain-design จะ flag gap ให้ backfill ทีหลัง)

2. สั่ง reverse-engineer (ตัวอย่าง prompt ด้านบน 3.4) — ได้ design/ ครบ
   (entities, data-dictionary.md, api/, sitemap.md) + reverse-notes.md

3. เปิด reverse-notes.md — ดูว่าโค้ดส่วนไหน "ไม่มี scenario รองรับ" บ้าง แล้วตัดสินใจ:
   รัน scenario-discovery เพิ่มเพื่อ backfill Phase 1 เฉพาะจุดสำคัญ หรือรับรู้ไว้เป็น known gap
   (ไม่ทุกเคสต้อง backfill ถ้าแค่จะทำเอกสารอ้างอิงคร่าวๆ)

4. สั่ง /deliver-docs ประกอบเอกสาร 10 บท (ต้องผ่าน cross-validation 4 ข้อ — ดู 4.3)

5. แปลงเป็น Word:
   - ยังไม่มี template ลูกค้า → ใช้ word-export/render_sdd_docx.py (ดู 4.5)
   - มี template ลูกค้าจริงแล้ว → ปรับตามแนวทาง fda003/ (ดู 4.5.1)
```

**ตัวอย่าง prompt เพิ่มเติม (สถานการณ์ต่างๆ):**

```
# ทั้ง repo รวดเดียว (repo เล็ก/กลาง)
อ่าน codebase ที่ D:\GitHub\LegacyApp แล้ว reverse เป็น domain model ผูกกลับ scenario ให้ด้วย

# เจาะเฉพาะ module เดียวจาก codebase ใหญ่ (แนะนำถ้า repo ใหญ่มาก — แม่นกว่า, ตรวจ
# cross-validation ง่ายกว่าด้วย ดูข้อจำกัดข้อ 3 ด้านล่าง)
อ่านเฉพาะโฟลเดอร์ Modules/Billing ใน D:\GitHub\LegacyApp แล้ว reverse เป็น domain model
เฉพาะส่วน billing ผูกกลับ scenario ให้ด้วย

# มี scenarios.json อยู่แล้วบางส่วน อยาก reverse เพิ่มจากโค้ดที่เหลือ (UPDATE mode)
อ่าน codebase ที่ D:\GitHub\LegacyApp ส่วนที่ยังไม่มี scenario รองรับ แล้ว reverse
เป็น domain model เพิ่ม โดยไม่แตะ scenario เดิมที่ locked ไว้

# ต้องการแค่รายงาน gap ก่อน ยังไม่อยากให้ generate design เต็ม
อ่าน codebase ที่ D:\GitHub\LegacyApp แล้วบอกว่ามี entity/route ไหนบ้างที่ไม่มี
scenario รองรับ (ยังไม่ต้อง generate design เต็ม แค่สรุป gap มาก่อน)

# แบบเต็มสาย จบที่ Word (ไม่ผ่าน orchestrator — คุมเองทุกขั้น)
อ่าน codebase ที่ D:\GitHub\LegacyApp แล้ว reverse เป็น domain model ผูกกลับ scenario ให้ด้วย
# (เช็ค reverse-notes.md, backfill scenario-discovery ถ้าจำเป็น)
/deliver-docs
python render_sdd_docx.py <path/design/system-design-document.md> <output.docx> --meta doc-meta.json
```

**ข้อจำกัดที่ต้องรู้ก่อนใช้กับ codebase เก่า:**
- **รองรับเต็มที่เฉพาะ ASP.NET Core + EF Core** ตอนนี้ (ดู mapping ละเอียดที่
  `references/codebase-analysis.md`) — ดึง `DbSet<T>`/migration/`[Authorize]`/controller ได้ตรงๆ
  ถ้า stack อื่น (Node/Django/Laravel ฯลฯ) หลักการเดียวกันยังใช้ได้ (Model→entity, Controller→API,
  Service→use case, Route→sitemap) แต่ต้องปรับ mapping เอง — ยังไม่มี reference สำเร็จรูปให้
- **ไม่เดา business intent จากโค้ดเด็ดขาด** — endpoint/entity ที่ไม่รู้ว่าทำไมมันมีอยู่ (เช่นอาจเป็น
  dead code ในระบบเก่า) จะถูก flag เป็น gap ไม่ใช่แต่งเรื่องให้เอง ต้องมีคนยืนยันเสมอ
- **codebase ใหญ่มาก** ให้ระบุ module/ขอบเขตให้ทำทีละส่วน (เหมือนแนวทาง 3.1-3.2) แทนสั่ง reverse
  ทั้ง repo รวดเดียว — ผลลัพธ์จะแม่นกว่าและตรวจ cross-validation ได้ง่ายกว่า

### 3.5 โหมดเพิ่ม/แก้ (UPDATE) — เพิ่ม scenario ใหม่บนระบบที่ design ไปแล้ว

```
มี scenario ใหม่ SC-billing-004 เพิ่มเข้ามา ช่วยออกแบบ domain เฉพาะตัวนี้
โดยไม่แตะ design ของตัวเดิม
```
skill จะ append เฉพาะของใหม่ ไม่ทับของเก่า และไม่แก้ scenario ที่ `status=locked`

---

## 4. การสร้างเอกสารเพิ่มเติม (`/deliver-docs`)

ระหว่างพัฒนา skill ทำ artifact แบบ **subset** (เร็ว ไม่บวม) แต่ตอน **ส่งมอบงาน** ลูกค้า/ผู้ว่าจ้างมักต้องการ
**เอกสารชุดเต็ม 10 บท** → ใช้ command นี้

### 4.1 วิธีสั่ง

```
/deliver-docs
```
หรือพิมพ์ภาษาธรรมชาติ:
```
assemble เอกสาร system design document ชุดเต็มของ module billing เพื่อส่งมอบงาน
```

### 4.2 ได้เอกสาร 10 บท (ไฟล์เดียว `design/system-design-document.md`)

1. Introduction & Overview — ชื่อระบบ, วัตถุประสงค์, ขอบเขต, stakeholders, architecture
2. System Requirements — Functional / Non-Functional / business rules / constraints
3. Module Overview — รายการ module + ความสัมพันธ์
4. Data Model — โมเดลเชิงแนวคิด/ตรรกะ
5. Data Flow Diagram — Level 0 → Level 1
6. Flow Diagrams — ราย use case
7. ER Diagram (Mermaid)
8. Data Dictionary — ตาราง field เต็ม (artifact หลัก)
9. Sitemap
10. User Roles & Permissions — role + permission matrix

### 4.3 สิ่งที่ต้องรู้ก่อนสั่ง

- **`/deliver-docs` เป็นตัว "ประกอบ" ไม่ใช่ "สร้างใหม่"** — มันดึงจาก artifact ที่มีอยู่ใน `design/` + `scenarios.json`
  ถ้า artifact ของ scenario ที่อยู่ในขอบเขตยังขาด → จะรายงาน gap แล้วหยุด ไม่แต่งเติมให้
- **ต้องผ่าน cross-validation 4 ข้อก่อน assemble (hard gate)** ถ้าข้อใดไม่ผ่าน จะบอกจุดที่ไม่ตรงแล้วหยุด:
  1. ER ↔ DD ตรงกันสองทาง (ทุก entity/attribute มีทั้งสองฝั่ง)
  2. DFD Level 0 ↔ Level 1 สอดคล้องกัน
  3. Sitemap ↔ Roles (ทุกหน้ามี role เข้าถึงได้ ≥1)
  4. FK type ตรงกับ PK ที่อ้างถึง

> เพราะฉะนั้นถ้าสั่งแล้วมันหยุดพร้อมรายงาน mismatch — แปลว่า design ยังไม่ครบ/ไม่ตรง ให้กลับไปเติม
> artifact ที่ขาดก่อน (เช่น สั่งสร้าง DD/ER เพิ่ม) แล้วค่อยสั่ง `/deliver-docs` ใหม่

---

## 4.5 แปลงเป็น Word (.docx) เพื่อส่งมอบลูกค้า

`/deliver-docs` ได้ไฟล์ Markdown เดียว (`design/system-design-document.md`) ซึ่ง diagram ยังเป็นโค้ด
Mermaid ดิบ — ถ้าต้องส่งเป็น Word ให้ลูกค้า ใช้ pipeline ที่ `skills/domain-design/assets/word-export/`
(สร้างไว้แล้ว: python-docx + docxtpl + mermaid-cli, ทดสอบผ่านกับตัวอย่าง Billing module)

### วิธีใช้

```bash
cd plugins/domain-design/skills/domain-design/assets/word-export
python render_sdd_docx.py <path/design/system-design-document.md> <output.docx> \
    --meta doc-meta.json [--screens screens.json]
```

`doc-meta.json` ใส่ชื่อโครงการ/ลูกค้า/เวอร์ชัน/วันที่/ผู้จัดทำ/ประวัติแก้ไข — ดูตัวอย่างที่
`sample/doc-meta.json`. ลอง `sample/` ก่อนได้เลย (`python render_sdd_docx.py sample/system-design-document.md sample/output/out.docx --meta sample/doc-meta.json --screens sample/screens.json`)
ได้ผลลัพธ์เป็น `.docx` พร้อม diagram เป็นรูปจริง (render จาก Mermaid ด้วย mermaid-cli)

### สิ่งที่เอกสารส่งลูกค้าได้จากตัวไหน (ภาพรวม)

| เนื้อหาในเอกสาร | มาจาก | อัตโนมัติ? |
|---|---|---|
| หัวข้อ 1-10 (Intro, Requirements, DFD, Flow, ER, **Data Dictionary**, Sitemap, Roles) | `design/system-design-document.md` (จาก `/deliver-docs`) | ✅ อัตโนมัติ |
| Diagram ทุกตัว (ER/DFD/Flow/Sitemap) เป็นรูปภาพ | Mermaid ใน markdown → render ด้วย mermaid-cli | ✅ อัตโนมัติ |
| ข้อมูล doc control / ประวัติแก้ไข | `doc-meta.json` | ✅ จาก JSON |
| **ตารางอธิบายการทำงานของหน้าจอ** (Input/Output/Validation/Message/Security ต่อหน้าจอ) | `screens.json` (คนเขียนเนื้อหา) | 🟡 จาก JSON ที่คนเติม |
| **รูปหน้าจอ (screenshot) + คำบรรยายใต้รูป** | ไฟล์ PNG ที่ระบุ path ใน `screens.json` | 🟡 จาก JSON ที่คนเติม |
| **ตารางฟิลด์ต่อหน้าจอ** (Field/Type/Control/Description) | `screens.json#fields[]` | 🟡 จาก JSON ที่คนเติม |
| ตาราง Process (batch/job ที่ไม่มีหน้าจอ) | `screens.json#processes[]` | 🟡 จาก JSON ที่คนเติม |

### 4.5.0 ใส่หน้าจอ + รูป screenshot ลงเอกสาร (`--screens screens.json`)

เอกสารส่งลูกค้าจริงมักต้องมี "spec ต่อหน้าจอ" — หน้าจอนี้ทำอะไร รับอะไรเข้า ออกอะไร validate
อย่างไร ข้อความ error ว่าอะไร ใครเข้าถึงได้ พร้อมรูปหน้าจอประกอบ ข้อมูลพวกนี้**เป็นเนื้อหาที่คนต้องเขียน**
(ScenarioForge มีแค่โครง: sitemap บอกว่ามีหน้าไหน, DD บอก field, use case บอก postcondition —
แต่ไม่มี prose อธิบายและไม่มีรูป) จึงรับผ่านไฟล์ `screens.json`:

```jsonc
{
  "screens": [{
    "id": "F_SCR_001",              // รหัสหน้าจอตาม convention ลูกค้า
    "ref": "SC-billing-001",        // ผูกกลับ scenario
    "title": "Checkout — ชำระ invoice",
    "severity": "High", "priority": "High",
    "name": "...", "description": "...", "input": "...", "output": "...",
    "feature": "...", "validation": "...", "message": "...", "security": "...", "remark": "...",
    "screenshot": "screenshots/checkout.png",   // path relative กับ screens.json — ไม่มีรูปก็เว้นได้
    "screenshot_caption": "รูปที่ 1: หน้าจอ Checkout",
    "fields": [ { "field": "InvoiceId", "type": "uuid", "control": "dropdown", "description": "..." } ]
  }],
  "processes": [ { "id": "F_PRO_001", "title": "...", "description": "..." } ]  // batch/job ไม่มีหน้าจอ
}
```

- **template ทั่วไป**: ได้ **หัวข้อ 11 "รายละเอียดหน้าจอ"** — ต่อหน้าจอ: หัวข้อ + คำอธิบาย +
  ตาราง spec + ตารางฟิลด์ + รูป screenshot พร้อมคำบรรยายใต้รูป (ไม่ส่ง `--screens` = ไม่มีหัวข้อ 11 เลย
  เอกสารจบที่หัวข้อ 10 เหมือนเดิม)
- **fda003 (template จริงลูกค้า)**: เติมลงหัวข้อ 3.1 SCREEN / 3.2 PROCESS ของ template ตรงตำแหน่ง —
  หนึ่ง block ต่อหน้าจอ รูปแทรกใต้ตาราง spec (ไม่ส่ง `--screens` = คงเป็นตารางเปล่าให้กรอกมือ
  เหมือน template ต้นฉบับเป๊ะ)
- **รูปหน้าจอเอามาจากไหน**: (1) screenshot จาก mockups ที่ screen-binding สร้าง (เปิดใน browser
  แล้วจับภาพ หรือใช้ Playwright screenshot) (2) จับจากระบบจริงที่พัฒนาเสร็จ (3) ถ้ายังไม่มี ปล่อยว่าง
  ได้ — block จะออกมาไม่มีรูป (แค่ warning ไม่ fail)
- **ทางลัด**: ให้ Claude ช่วย scaffold `screens.json` จาก `design/sitemap.md` + `data-dictionary.md`
  + use cases ก่อน (id/title/fields/validation เบื้องต้นจะถูกเติมให้) แล้วคนเข้าไปเกลา prose +
  ใส่รูป — **อย่าให้ AI แต่ง validation/security rule ที่ไม่รู้จริง** เว้นว่างไว้ให้คน review ดีกว่า
- ดูตัวอย่างเต็มที่ `sample/screens.json` + `sample/screenshots/`

### สิ่งที่ต้องรู้

- **`sdd_template.docx` เป็น template ตัวอย่างทั่วไป** จัดหัวข้อตาม 10 sections ของ `/deliver-docs`
  เอง — **ไม่ใช่ template จริงของลูกค้ารายใดรายหนึ่ง** (ตอนสร้างครั้งแรกลองค้นหา template จาก
  โปรเจกต์ EStampHub ใน brain แล้ว แต่ brain มีแค่ note เชิงเทคนิค/สถาปัตยกรรม ไม่มีไฟล์ template
  เอกสารส่งมอบจริงเก็บไว้ — ถ้ามีไฟล์ `.docx` ของลูกค้าจริง ส่งมาได้ จะแก้ template ให้ตรงเป๊ะ)
- ถ้ามี template จริงของลูกค้า: เอาไฟล์นั้นมาใส่ placeholder แบบเดียวกัน (`{{ }}`, `{{p }}`,
  `{%tr %}`) แล้วชี้ `TEMPLATE_PATH` ใน `render_sdd_docx.py` ไปที่ไฟล์นั้นแทน — ราย ละเอียด/กติกา
  การวาง tag ให้ดู `references/word-export.md`
- ต้องมี Node.js (สำหรับ `npx @mermaid-js/mermaid-cli` render diagram) และ python package
  `python-docx` + `docxtpl` + `docxcompose`
- หน้าสารบัญ (Table of Contents) เปิดมาจะเห็นข้อความ "Right-click here and choose 'Update Field'"
  แทนสารบัญจริง — เป็นเรื่องปกติของ Word field ที่สร้างผ่านโค้ด ให้เปิดไฟล์ใน Word แล้วกด
  Ctrl+A จากนั้น F9 (หรือคลิกขวาที่ข้อความ → Update Field) ครั้งเดียวก่อนส่งลูกค้า

### 4.5.1 มี template จริงของลูกค้าอยู่แล้ว? ใช้ `fda003/` แทน

ถ้ามีไฟล์ template `.docx` จริงของลูกค้า (ไม่ใช่ template ทั่วไป) ให้ดูตัวอย่างที่
`assets/word-export/fda003/` — เป็นการปรับ pipeline ให้เข้ากับไฟล์ `docs/template/F-DA-003_FunctionalSpec.docx`
จริงที่มีอยู่ในโปรเจกต์นี้ (Functional Specification form พร้อม 16 ตาราง) เป็นตัวอย่างว่าทำอย่างไร

```bash
cd plugins/domain-design/skills/domain-design/assets/word-export/fda003
python render_fda003_docx.py <path/design/system-design-document.md> <output.docx> \
    --meta doc-meta.json [--screens ../sample/screens.json]
```

**สิ่งที่ auto-fill ได้จริงจาก domain-design**: doc control, revision history, System/ER diagram
(+ Sequence ถ้ามี), Database Specification + Database Normalization (ต่อ entity จาก Data
Dictionary)
**สิ่งที่เติมผ่าน `--screens screens.json`** (เนื้อหาคนเขียน — ดู 4.5.0): หัวข้อ 3.1 SCREEN
(spec ต่อหน้าจอ + รูป screenshot ใต้ตาราง) และ 3.2 PROCESS (batch/job)
**ส่วนที่เหลือ (Document/Job spec, ตาราง Server/DB/API/Security/Performance/Reliability)
ต้องกรอกเองเพราะไม่มีข้อมูลนี้ใน ScenarioForge จริงๆ** (infra/server ต้องมาจากคนเท่านั้น) —
โครงสร้างตาราง/หัวข้อยังอยู่ครบ พร้อมให้กรอกมือ รายละเอียดทั้งหมดอยู่ที่ `references/word-export.md`

ถ้ามี template อื่นที่ไม่ใช่ F-DA-003 ให้ทำตามแนวทางเดียวกัน (ดู pattern ใน
`patch_fda003_template.py`): หา table/heading ที่ต้องการด้วย document-order traversal, ใส่ tag
`{{ }}` / `{{p }}` / `{%tr %}` ตรงตำแหน่ง แล้วเขียน render script คู่กันแบบเดียวกับ `fda003/`

---

## 5. ลำดับการทำงานที่แนะนำ (workflow ทั่วไป)

```
1. รัน scenario-discovery จน scenarios.json พร้อม (ready_for_next_phase)
2. "ออกแบบ domain model ของ module X"          → ได้ DD/ER/API/sitemap (STANDARD)
3. ตรวจ Data Dictionary ให้ตรงใจ (มันคือสะพานหลัก ผิดแล้วปลายน้ำ drift หมด)
4. ส่งต่อ screen-binding (สำหรับ scenario ที่ has_ui) / solution-arch
5. ตอนจะส่งมอบงาน → /deliver-docs เพื่อได้เอกสาร 10 บทครบ
```

---

## 6. Checklist ตรวจผลลัพธ์ (skill รันให้อัตโนมัติ แต่พี่ปูเช็กซ้ำได้)

- [ ] ทุก scenario ที่ plan มี `traces_down.entities` ไม่ว่าง (+ use_cases/apis ตามเหมาะ)
- [ ] ทุก entity ใน ER อยู่ใน Data Dictionary และกลับกัน (ไม่มี orphan)
- [ ] FK type ตรงกับ PK ที่อ้างถึง
- [ ] use case trace กลับ scenario goal ได้ / postcondition วัดผลได้
- [ ] ไม่มีการออกแบบหน้าจอ (มีแค่ sitemap node — หน้าจอเป็นงาน screen-binding)
- [ ] `business{}` / `analysis{}` ของทุก scenario ไม่ถูกแก้ / ไม่แตะ locked
- [ ] `scenarios.json` ยัง parse ได้ / ref ชี้ไปไฟล์ที่มีอยู่จริงใน `design/`

---

## 7. Quick Reference — prompt ที่ใช้บ่อย

```
# วาง domain ทั้ง module
ออกแบบ domain model จาก scenarios.json ของ module <ชื่อ>

# เจาะ artifact
สร้าง ER + data dictionary จาก scenarios ของ module <ชื่อ>
ออกแบบ API contract จาก SC-<module>-<nnn>
ทำ sitemap จาก scenario ที่ has_ui

# reverse จาก code
อ่าน codebase ที่ <path> แล้ว reverse เป็น domain model ผูกกลับ scenario

# ส่งมอบเอกสารเต็ม
/deliver-docs

# codebase เก่า → Word พร้อมส่งมอบ (ดู 3.4.1 สำหรับ workflow เต็ม)
อ่าน codebase ที่ <path> แล้ว reverse เป็น domain model ผูกกลับ scenario
/deliver-docs
cd plugins/domain-design/skills/domain-design/assets/word-export
python render_sdd_docx.py <path/design/system-design-document.md> <output.docx> --meta doc-meta.json
```

# ScenarioForge — คู่มือการใช้งานรวม (ทุก plugin)

> คู่มือฉบับผู้ใช้ ครอบคลุม plugin ทั้ง 7 ตัว: แต่ละตัวทำอะไร เตรียมอะไรก่อน และสั่งงานอย่างไร
> ฉบับลงลึกรายตัวดูที่ `plugins/<ชื่อ>/USER-GUIDE.md` (scenario-discovery ใช้ `USAGE.md`)
> อัปเดตล่าสุด: 2026-07-10 (field-test hardening จาก run จริง end-to-end รอบแรก — scenario-verify v0.2.0
> ได้ spec-authoring contract + per-spec run evidence, feature-builder v0.3.0 ได้ SQL script conventions +
> engine-wiring gate, orchestrator v0.2.0 ได้ AMEND / ops-bootstrap / cap-raise contracts, domain-design
> v0.2.0 ได้ design-notes.md contract, solution-arch v0.2.0 ได้ scripts/verify-features.mjs,
> screen-binding v0.3.0 ได้ structure block — ผู้ใช้เดิมต้อง update/reinstall plugin เพื่อรับ version ใหม่)

---

## 1. ภาพรวม — ScenarioForge คืออะไร

ScenarioForge คือชุด plugin สำหรับ Claude Code ที่พาไอเดีย/requirement วิ่งครบสายจนเป็น
โค้ดที่ผ่านเทสต์ ตามแนว BMAD 4 เฟส โดยมีแกนกลางคือ **Scenario Spine**: ทุกสิ่งในระบบ
(entity, หน้าจอ, feature, โค้ด, เทสต์) ต้อง trace กลับไปหา business scenario (`SC-<module>-<nnn>`)
ใน `scenarios.json` ได้เสมอ — เปิด scenario หนึ่งตัวแล้วเห็นได้ว่ามันกลายเป็นตาราง/หน้าจอ/โค้ด/เทสต์ตัวไหน

```text
คุณ ──คุยกับ──► orchestrator (Tier 0 — คนกลาง สั่งที่เดียว)
                    │ delegate ทีละ phase + ตรวจ gate คั่นทุกรอยต่อ
                    ▼
Phase 0  Bootstrap*      domain-design (rev)  อ่าน codebase เก่า → design/ + reverse-notes.md (เฉพาะ brownfield)
Phase 1  Analysis        scenario-discovery   เก็บ requirement → scenarios.json (spine)
         (beat 1.5)      ideation panel       multi-persona เสนอสิ่งที่ลืม (+ external AI ได้)
         (beat 2)        scenario-critic      จับผิด/หา gap → วนถามจนครบ
Phase 2  Planning        domain-design        entities + Data Dictionary + API + sitemap
Phase 2u Planning/UI     screen-binding       master shell + mockup หน้าจอ (เฉพาะ has_ui)
Phase 3  Solutioning     solution-arch        features.json (FE + layering + ลำดับ build)
Phase 4  Implementation  feature-builder      เขียนโค้ดจริง วน build→fix จนเขียว (Opus/Sonnet routing)
Phase 4q QA              scenario-verify      E2E Playwright + Gate 4 coverage → spine เขียวทั้งเส้น
```

\* Phase 0 รันเฉพาะกรณี **brownfield**: ยังไม่มี `scenarios.json` และ target ที่สั่งเป็น path ของ
codebase เดิม (ดู orchestrator USER-GUIDE หัวข้อ 2D) — เคสปกติเริ่มที่ Phase 1 เหมือนเดิม

หลักการที่ใช้ทั้งชุด:

- **Business intent มาจากคุณเท่านั้น** — AI ถาม ไม่เดา; ตอบไม่ได้ = `null` ไว้ให้รอบวิเคราะห์ตามเก็บ
- **AI เสนอได้ commit ไม่ได้** — ข้อเสนอทุกตัวเกิดเป็น `pending` รอคุณ accept/reject
- **Artifact หาย = หยุดแล้วบอก** ไม่มี worker ตัวไหนปั้นของที่ขาดขึ้นเอง (บันทึกเป็น gap ส่งกลับต้นน้ำ)
- **Scale-adaptive** — QUICK / STANDARD / ENTERPRISE ตัดสินว่ารัน phase ไหน เข้มแค่ไหน

---

## 2. ติดตั้ง

```text
# ครั้งแรกครั้งเดียว
/plugin marketplace add D:\ProjectClaude\ScenarioForge

# ติดตั้งตามที่ใช้ (แนะนำครบชุด)
/plugin install scenario-discovery@scenarioforge
/plugin install domain-design@scenarioforge
/plugin install screen-binding@scenarioforge
/plugin install solution-arch@scenarioforge
/plugin install feature-builder@scenarioforge
/plugin install scenario-verify@scenarioforge
/plugin install orchestrator@scenarioforge
```

เรียกใช้ได้ 2 แบบเสมอ:

- **Implicit** (แนะนำ) — พิมพ์ภาษาธรรมชาติที่ตรง trigger keyword แล้ว Claude route ให้เอง
- **Explicit** — `/ชื่อplugin:ชื่อคำสั่ง` เมื่อ route ไม่ติด เช่น `/scenario-discovery:scenario-discovery`

---

## 3. Quick Start — 4 สถานการณ์ที่เจอบ่อย

### A. สร้าง module ใหม่ตั้งแต่ศูนย์จนจบสาย

```text
# 1) เก็บ requirement (Phase 1 — ตัวเดียวที่ต้องเรียกเอง เพราะมัน Q&A กับคุณ)
discover scenarios สำหรับโมดูล billing, scale STANDARD
requirement: ลูกค้าชำระรายเดือน, ดูประวัติ, ยกเลิก subscription

# 2) ที่เหลือปล่อยให้คนกลางลากจนจบ
/orchestrator:build billing
```

### B. อยากเห็นแผนก่อน ไม่ให้รันทันที

```text
/orchestrator:plan billing        # read-only — โชว์ลำดับ phase + worker
/orchestrator:next                # พอใจแล้วเดินทีละ phase (รัน 1 phase แล้วหยุด)
```

### C. เพิ่มของเล็กๆ บนระบบที่พัฒนาไปแล้ว (APPEND + QUICK)

```text
เพิ่ม scenario ใหม่ลง billing: ลูกค้าขอ refund ภายใน 7 วัน
/orchestrator:build SC-billing-005 --quick
```

### D. งานค้างจาก session ก่อน

```text
/orchestrator:resume billing      # ข้าม phase ที่ gate เขียวแล้ว รันต่อจากจุดค้าง
```

---

## 4. ตารางสรุป — ใครทำอะไร สั่งด้วยอะไร

| Plugin | Phase | ทำอะไร (ย่อ) | คำสั่งหลัก |
| --- | --- | --- | --- |
| **orchestrator** | ทุก phase | คนกลาง: วางแผน → delegate → ตรวจ gate → รายงาน | `/orchestrator:build` `/plan` `/next` `/status` `/gate` `/resume` `/scale` `/help` |
| **scenario-discovery** | 1 | Q&A เก็บ requirement → `scenarios.json` | implicit ("discover scenarios ...") หรือ `/scenario-discovery:scenario-discovery` |
| **domain-design** | 2 | entities + Data Dictionary + use cases + API + sitemap | implicit ("ออกแบบ domain model ...") + `/domain-design:deliver-docs` |
| **screen-binding** | 2u | theme/master shell + mockup หน้าจอ + ผูก `pages` | `/screen-binding:theme` `/design-prompt` `/import-design` |
| **solution-arch** | 3 | แตก FE + layering + `depends_on` → `features.json` | implicit ("แตก features ...") หรือ `/solution-arch:solution-arch` |
| **feature-builder** | 4 | เขียนโค้ดจริง + 8-gate verification + model routing | `/feature-builder:implement` `/route` `/continue` `/status` `/verify` `/retry` `/gaps` `/help` |
| **scenario-verify** | 4q | E2E Playwright + Gate 4 control coverage | `/scenario-verify:generate` `/run` `/route` `/continue` `/retest` `/status` `/coverage` `/edit` `/gaps` `/help` |

---

## 5. orchestrator — คนกลางของทั้งสาย (Tier 0)

**ทำอะไร:** เป็นตัวเดียวที่คุณสั่งงานโดยตรง มันอ่าน spine → ตัดสิน scale → วางลำดับ phase →
delegate ให้ worker ทีละตัว → ตรวจ **verify gate** คั่นทุก phase (gate แดง = หยุดสาย ไม่ปล่อยของเสีย
ไหลต่อ) → รายงานผล ตัวมันเขียนไฟล์เดียวคือ `.scenarioforge/run-ledger.json` (บันทึกการ run)

**เตรียมอะไรก่อน:** ปกติต้องมี `scenarios.json` แล้ว (เริ่ม module ใหม่ = เรียก scenario-discovery ก่อน)
— ยกเว้นเคส **brownfield**: ถ้ายังไม่มี spine แต่สั่งด้วย path codebase เดิม (เช่น
`\orchestrator:build D:\GitHub\LegacyApp`) orchestrator จะแทรก Phase 0 (reverse-engineer) ให้เอง

| คำสั่ง | ทำอะไร |
| --- | --- |
| `/orchestrator:build [scope] [--scale]` | รันทั้ง pipeline จนจบ (scope = module / SC-id / ว่าง) |
| `/orchestrator:plan [scope]` | โชว์แผนเฉยๆ ไม่รัน (read-only) |
| `/orchestrator:next` | รัน 1 phase แล้วหยุด — เหมาะช่วงยังไม่ไว้ใจ |
| `/orchestrator:status [scope]` | สถานะรวมทุก phase |
| `/orchestrator:gate [phase-id]` | ตรวจ gate ของ phase ที่เสร็จแล้วซ้ำ |
| `/orchestrator:resume [scope]` | รันต่อจากที่ค้าง (ข้าม phase เขียว) |
| `/orchestrator:scale [level]` | ดู/ตั้ง effort scale |

**ผล gate:** PASS → phase ถัดไป · FAIL เพราะ worker พลาด → delegate ซ้ำ 1 ครั้ง ·
FAIL เพราะของต้นน้ำขาด → หยุด บอกว่าใครต้องแก้ (ไม่เดาเติมเอง)
**Circuit breaker:** จำกัด delegation ต่อ run — QUICK 4 / STANDARD 11 / ENTERPRISE 15

---

## 6. scenario-discovery — เก็บ requirement (Phase 1)

**ทำอะไร:** ถาม-ตอบเก็บ business intent → เขียน `scenarios.json` โดยแต่ละ scenario มี id
`SC-<module>-<nnn>` เป็นแกนที่ทุก phase อ้างกลับ หลักคือ **ถามไม่เดา** — ตอบไม่ได้ใส่ `null`
ให้รอบวิเคราะห์ตามจับ

**สั่งยังไง (implicit):**

```text
discover scenarios สำหรับโมดูล billing, scale STANDARD
requirement: <พิมพ์เอง หรือชี้ path เอกสาร .md/.txt>
```

prompt ที่ดีควรมี: ชื่อ module · scale (QUICK/STANDARD/ENTERPRISE) · requirement ดิบ · mode
(สร้างใหม่/เพิ่มของเดิม) — ไม่ครบก็ได้ skill จะถามเอง

**จะถูกถามเป็นกลุ่ม A–E (ทีละกลุ่ม):**
A. ใครทำ + ต้องการอะไรสำเร็จ (ห้ามเว้น) · B. เริ่มเมื่อไหร่ + ต้องมีอะไรก่อน ·
C. เสร็จแล้วสถานะอะไรเปลี่ยน (**ต้องวัดได้** เช่น `invoice=paid` — QA derive เทสต์จากตรงนี้) ·
D. คุณค่าธุรกิจ + priority + **มีหน้าจอไหม (has_ui)** · E. แตะ domain concept อะไรบ้าง

**Event-first elicitation (ทางเลือกใหม่):** ถ้า requirement คลุมเครือ ให้เล่าเป็น "เหตุการณ์ที่เกิดขึ้นแล้ว"
(past tense เช่น "invoice ถูกจ่ายแล้ว") — skill จะไล่ตามลำดับ Event Storming: events → ใครสั่ง →
เงื่อนไข → policy → domain concepts ซึ่ง map เข้า schema ให้อัตโนมัติ (postconditions วัดได้มาฟรี)

**APPEND mode:** มี `scenarios.json` อยู่แล้ว → ต่อเลข id จาก max, ไม่ทับของเดิม, ไม่แตะ scenario
ที่ `locked`, เจอความซ้ำ/ขัดแย้งจะถามก่อนไม่ทำเงียบ

**ได้อะไร:** `scenarios.json` (status: draft) → จากนั้น orchestrator รัน beat 1.5 (panel) +
beat 2 (critic) วน validate จน `ready_for_next_phase = true`

### 👁 ดู scenarios.json แบบมองเห็น (Viewer) — **เปิดยังไง**

`scenarios.json` เป็น JSON ซ้อนหลายชั้น อ่านด้วยตายาก — plugin มี **viewer** ให้เปิดดูแบบ
human-readable (พับ/กาง node ทุกชั้น, filter/ค้นหา, ดู rollup) โดยไม่ต้องเปิดไฟล์ดิบ

**ต้องมีก่อน:** โปรเจกต์มี `scenarios.json` แล้ว · ติดตั้ง plugin `scenario-discovery` · เครื่องมี **Node ≥ 18**

**สั่งเปิด (2 โหมด):**

```text
/scenario-discovery:view            # โหมด LIVE — เปิดใน browser, แก้แล้วเขียนกลับไฟล์ได้
/scenario-discovery:view snapshot   # โหมด SNAPSHOT — สร้างไฟล์ HTML เดียวจบ (read-only) ส่งลูกค้า
```

| | LIVE (`/view`) | SNAPSHOT (`/view snapshot`) |
| --- | --- | --- |
| เปิดยังไง | รัน local server แล้วเด้ง browser ที่ `http://127.0.0.1:<port>/` | ได้ไฟล์ `scenarios-report.html` เปิดจาก `file://` ได้เลย |
| แก้ค่าได้ไหม | ✅ กด accept/reject suggestion + ติ๊ก `human_validated` → **เขียนกลับ `scenarios.json`** ให้เอง + คำนวณ rollup ใหม่ | ❌ อ่านอย่างเดียว (ตัดโค้ด network ทิ้งหมด — ปลอดภัยส่งออกนอก) |
| ต้องรัน server ไหม | ต้อง (เปิดค้างไว้) | ไม่ต้อง — ไฟล์เดียวจบ |
| เหมาะกับ | คุณ review เองตอนพัฒนา | ส่งให้ลูกค้า/คนนอกเปิดดู |

> LIVE ผูกแค่ `127.0.0.1` (มี DNS-rebinding guard) เขียนไฟล์แบบ atomic — ปิดเมื่อเลิกใช้ด้วย `Ctrl+C`
> ที่ terminal หรือปิดหน้าต่างที่รัน server (มันรันค้าง background). SNAPSHOT วางไฟล์ `scenarios-report.html`
> ไว้ข้างๆ `scenarios.json` เสมอ

**ถ้า `/scenario-discovery:view` ไม่ทำงาน (route ไม่ติด/ยังไม่ได้ติดตั้ง plugin)** — รัน node ตรงได้:

```powershell
# LIVE (เปิด browser ให้ด้วย)
node "D:\ProjectClaude\ScenarioForge\plugins\scenario-discovery\assets\viewer\server.mjs" --file "<path\to\scenarios.json>" --open

# SNAPSHOT (ได้ scenarios-report.html ข้างไฟล์ต้นทาง)
node "D:\ProjectClaude\ScenarioForge\plugins\scenario-discovery\assets\viewer\server.mjs" --file "<path\to\scenarios.json>" --snapshot
```

**เจอปัญหา:**

- **`node` ไม่รู้จัก** → ยังไม่ได้ติดตั้ง Node.js (ต้อง ≥ 18) — ติดตั้งจาก nodejs.org แล้วเปิด terminal ใหม่
- **บอกว่าไม่มี `scenarios.json`** → โปรเจกต์ยังไม่ผ่าน Phase 1 — รัน scenario-discovery เก็บ requirement ก่อน
- **มีหลาย `scenarios.json`** → `/view` จะถามให้เลือกไฟล์ · ถ้ารัน node เอง ให้ชี้ `--file` ตรงตัว
- **JSON พัง/parse ไม่ได้** → ไม่ต้องแก้ก่อน viewer โชว์ error แบบอ่านง่ายให้เอง

---

## 7. Ideation Panel (beat 1.5) — multi-persona + external AI ⭐ ใหม่ v0.2.0

หลังเก็บ requirement เสร็จ orchestrator จะ delegate **persona panel** — ทีม role จำลองที่ช่วยเสนอ
"สิ่งที่คุณยังไม่ได้พูด" (มุมเสนอ — ต่างจาก critic ที่เป็นมุมจับผิด) ทุกข้อเสนอเป็น `pending`
รอคุณตัดสินเสมอ ครบวง 5 บทบาทสไตล์ BMAD โดยไม่ต้องคุยเองทีละ role:

| บทบาท | อยู่ beat | มองหา |
| --- | --- | --- |
| domain-expert | 1.5 | event/กติกา/ศัพท์ domain ที่ตกหล่น |
| developer | 1.5 | ข้อจำกัดทางเทคนิค, จุดเชื่อมต่อ, state ที่ happy path มองข้าม |
| product-owner | 1.5 | scope creep, การตัด MVP, priority ขัดกัน |
| business-analyst | 2 (critic เดิม) | business rule ขัดแย้ง |
| devils-advocate | 2 (critic เดิม) | โจมตี 4 มุม Boundary/Mistake/Abuse/Dependency |

**ขยายจำนวน persona:** สร้างไฟล์ `.scenarioforge/personas.json` — เพิ่ม persona = เพิ่ม 1 row
(ไม่ต้องแก้ plugin) เพดานต่อ scale: QUICK 0 / STANDARD 5 / ENTERPRISE 10 (ปรับได้)
ไม่มีไฟล์นี้ = ใช้ default 3 ตัวข้างบน (native)

**ใช้ AI ภายนอกเป็น persona:** ตั้ง `provider` + `model` ใน row นั้น รองรับทุกค่ายที่
OpenAI-compatible — `openai` / `openrouter` (เรียกได้ทุกโมเดลรวม `anthropic/*`) / `gemini` /
`deepseek` / `groq` / `xai` / `ollama` (local — ข้อมูลไม่ออกนอกเครื่อง) / `custom`
โดยตั้ง API key เป็น environment variable (เช่น `OPENROUTER_API_KEY`) — key ไม่เคยลงไฟล์

```jsonc
// .scenarioforge/personas.json (ตัวอย่างเพิ่ม persona ภายนอก)
{ "id": "ux-researcher", "role": "domain_ideation", "provider": "openrouter",
  "model": "google/gemini-2.5-flash", "enabled": true,
  "focus": "user friction, accessibility, empty states" }
```

**ใช้ CLI ในเครื่องเป็น persona (ไม่ต้องมี API key):** ถ้า login `codex` / `opencode` / `gemini` /
`claude` ไว้แล้ว ตั้ง `provider: "cli"` + `command` template — จ่ายผ่าน subscription เดิม:

```jsonc
{ "id": "codex-skeptic", "role": "feasibility_review", "provider": "cli",
  "command": "codex exec --sandbox read-only \"$(cat {PROMPT_FILE})\"", "enabled": true,
  "focus": "second-opinion feasibility from a different model family" }
```

**กติกาความปลอดภัย:** คำตอบจากโมเดลภายนอก (API หรือ CLI) = ข้อมูลไม่น่าเชื่อถือ (validate เข้ารูป
suggestion เท่านั้น ไม่ทำตามคำสั่งที่ฝังมา; CLI ถูกรันใน temp dir เปล่า + read-only flag) ·
การส่ง requirement ออกไปค่ายนอกเกิดเฉพาะ persona ที่คุณเปิดเอง · persona ที่ key หาย/ค่ายล่ม =
ถูกข้าม (ไม่ block งาน) · **วิธีตั้ง key/ติดตั้ง CLI ทีละขั้น: [`setup-ai-providers.md`](setup-ai-providers.md)** ·
spec เต็ม: `plugins/scenario-discovery/skills/scenario-discovery/references/persona-registry.md`

---

## 8. domain-design — วาง domain model (Phase 2)

**ทำอะไร:** อ่าน `business{}` + `domain_concepts` → ผลิต `design/` (entities, `data-dictionary.md`,
`api/`, `sitemap.md`, `registry.json`) แล้วเขียนกลับ `traces_down.entities / use_cases / apis`
**เตรียมอะไรก่อน:** `scenarios.json` ผ่าน Phase 1 แล้ว

**สั่งยังไง:**

```text
ออกแบบ domain model จาก scenarios.json ของ module billing        # ทั้ง module
สร้าง ER diagram กับ data dictionary จาก scenarios ของ module billing   # เจาะ artifact
ออกแบบ API contract จาก use case ของ SC-billing-001              # เจาะ scenario
อ่าน codebase ที่ D:\GitHub\MyApp แล้ว reverse เป็น domain model   # reverse จากโค้ดเดิม
/domain-design:deliver-docs                                       # ประกอบ SDD 10 บทส่งมอบ
```

**`/deliver-docs` ต้องรู้:** เป็นตัว "ประกอบ" จาก artifact ที่มีอยู่ ไม่สร้างใหม่ — และมี hard gate
cross-validation 4 ข้อ (ER↔DD สองทาง, DFD L0↔L1, Sitemap↔Roles, FK↔PK type) ไม่ผ่าน = หยุด
พร้อมบอกจุด ให้กลับไปเติมก่อน

**Scale:** QUICK ข้าม (ใช้ design เดิม) · STANDARD = DD+ER+API+Sitemap · ENTERPRISE = 10 บท + cross-validation

---

## 9. screen-binding — หน้าจอ + theme (Phase 2u — เฉพาะ scenario ที่ has_ui)

**ทำอะไร:** สร้าง **shell ก่อนเสมอ** (master page `_layout.html` + `theme.css` + navbar จาก sitemap
— Bootstrap 5 ล้วน แปลงเป็น `_Layout.cshtml` ได้ตรงๆ) แล้วค่อย mockup รายหน้า เลือก fidelity ได้:
`wireframe` (โครงเร็ว) หรือ `html` (สวยจริงผ่าน frontend-design) เสร็จแล้วผูก `traces_down.pages`
**เตรียมอะไรก่อน:** `design/sitemap.md` + Data Dictionary จาก domain-design

| คำสั่ง | ทำอะไร |
| --- | --- |
| `/screen-binding:theme` | สร้าง/restyle shell (ทำครั้งเดียวต่อโปรเจกต์) |
| `/screen-binding:design-prompt [SC-id]` | เขียน brief ต่อหน้า เอาไปวางใน Claude Design (บอก field จาก DD ครบ) |
| `/screen-binding:import-design <path>` | import bundle จาก Claude Design กลับมาผูก spine |

```text
ทำ theme + master page จาก sitemap ก่อน แล้ว mockup หน้าจอ has_ui เป็น html ให้หน่อย
```

**กฎเด่น:** ไม่ invent field ที่ไม่มีใน Data Dictionary (ขาด = gap ส่งกลับ domain-design) ·
mockup คือ mockup ไม่เขียน logic จริง

---

## 10. solution-arch — แตก features (Phase 3)

**ทำอะไร:** อ่าน entities + apis + pages ที่ Phase 2 ผูกไว้ → แตกเป็น **FE-xxx** (vertical slice:
1 capability = 1 FE) พร้อม layering (Controller / Handler(MediatR) / Repository / DI / DTO),
`depends_on` (ลำดับ build), `acceptance_refs` → เขียน `features.json` + `traces_down.features`
**เส้นแบ่งจำง่าย:** domain-design = "มีอะไร" · solution-arch = "ประกอบยังไง" · ยังไม่เขียนโค้ด

```text
แตก features จาก scenario module billing                 # implicit
solution-arch QUICK: SC-billing-003 อย่างเดียว           # งานเล็ก FE เดียว
```

**Scale:** ENTERPRISE เพิ่มตรวจ dependency graph (ห้ามมี cycle) + cross-cutting (auth/transaction ต่อ FE)

---

## 11. feature-builder — เขียนโค้ดจริง (Phase 4, agentic)

**ทำอะไร:** หยิบ FE ที่ ready จาก `features.json` มาเขียนโค้ด (ASP.NET Core MVC + EF Core + DDD)
วน implement → build → fix จนเขียว — resumable (ledger `.scenarioforge/impl-progress.json`) +
bounded (circuit breaker) และเป็น **dispatcher แจกงานตามความยาก**: งานยาก/security/ข้ามหน้า → Opus,
กลุ่มงานง่ายหน้าตาซ้ำ → Opus ทำ exemplar 1 ตัวแล้ว Sonnet ทำที่เหลือตามแพทเทิร์น (ประหยัดโดยคุณภาพไม่ตก
— ทุกตัวผ่าน verification เท่ากัน, Sonnet ติดแดงครึ่ง cap = ดันขึ้น Opus อัตโนมัติ)

| คำสั่ง | ทำอะไร |
| --- | --- |
| `/feature-builder:route [module\|FE-id]` | ดูแผนแจก Opus/Sonnet ก่อน build (เช็ค cost, read-only) |
| `/feature-builder:implement [module\|FE-id] [--scale] [--model] [--no-replicate]` | เริ่ม build |
| `/feature-builder:continue [FE-id]` | ทำต่อจากที่ค้าง (จำ model tier เดิม) |
| `/feature-builder:status [FE-id]` | ความคืบหน้า + tier ต่อ feature |
| `/feature-builder:verify [FE-id\|--all]` | รัน 8-gate ซ้ำโดยไม่ implement ใหม่ |
| `/feature-builder:retry <FE-id>` | ลอง feature ที่ blocked ใหม่ |
| `/feature-builder:gaps` | design gap ที่ค้าง + ใครต้องแก้ |

**Feature จะ `done` ได้ต้องผ่าน 8 gate:** Build → Design Compliance (ตรง DD/ER) → CRUD →
API Integration → Test Coverage → Tech Audit → Config → **Scenario Trace Check** (ทุก postcondition
มีเทสต์ assert ≥1) และ feature ที่มี form control ต้อง emit **UI Control Manifest**
(`.scenarioforge/ui-controls/FE-*.json`) ให้ QA — โค้ดเปิดสิทธิ์กว้างกว่า mockup = BLOCK (security)

---

## 12. scenario-verify — พิสูจน์ปลายสาย (Phase 4q)

**ทำอะไร:** แปลง acceptance criteria + UI Control Manifest → test scenario (`TS-xxx`) ลง
`qa-tracker.json` แล้วรัน Playwright บน browser จริง วน run → debug → retry จนเขียว ทุก TS ถือ
`scenario_ref` — ตอบได้เสมอว่า "SC-billing-001 เขียวหรือยัง"

| คำสั่ง | ทำอะไร |
| --- | --- |
| `/scenario-verify:generate [module\|SC-id]` | derive TS (ยังไม่รัน) — 5 หมวดบังคับต่อ control |
| `/scenario-verify:run [module\|SC-id\|TS-id\|--all]` | รันจริง วนจนเขียว (Opus/Sonnet/Haiku ตามหมวด) |
| `/scenario-verify:route [module]` | preview แผนแจกงาน + cost (read-only) |
| `/scenario-verify:continue` | resume run ที่ค้าง |
| `/scenario-verify:retest <TS-id\|--failed\|--all>` | รันใหม่หลัง fix |
| `/scenario-verify:status` / `/coverage` | rollup + **Gate 4** (ทุก control × หมวดบังคับ ต้องเขียวก่อน release) |
| `/scenario-verify:edit <TS-id> \| --from-control-spec [FE-id]` | แก้ TS / re-sync เมื่อ manifest เปลี่ยน |
| `/scenario-verify:gaps` | gap + เจ้าของต้นน้ำ |

**5 หมวดบังคับต่อ control:** render-binding · api-binding · permission (ต่อ role) · validation
(ต่อ rule) · cascade-loading-error → ฟอร์ม 5 control ≈ 15–35 TS
**กฎเหล็ก:** แก้ test ไม่แก้แอป — bug จริง = file finding กลับ feature-builder · select ด้วย
`data-testid` เท่านั้น

**Flow แนะนำ:** `/route` → `/generate` → `/run` → `/status` → (gap → generate เพิ่ม / fail →
feature-builder แก้ → `/retest`) → `/coverage` ยืนยัน Gate 4 PASS

---

## 13. Scale — เลือกระดับความเข้มครั้งเดียว มีผลทั้งสาย

| | QUICK | STANDARD (default) | ENTERPRISE |
| --- | --- | --- | --- |
| เหมาะกับ | แก้เล็ก/CRUD บนระบบเดิม | งานพัฒนาปกติ 1 module | ส่งมอบ / regulated / ระบบใหญ่ |
| Phase ที่รัน | 1(append) → 4 → 4q | ครบสาย 1→2→2u→3→4→4q | ครบสาย + โหมดเข้มทุกตัว |
| Ideation panel | ข้าม | ≤5 personas | ≤10 personas + external AI |
| ของแถม ENTERPRISE | – | – | cross-validation + /deliver-docs, HTML fidelity, dependency-graph check, code-critic, qa-critic, Gate 4 บังคับ |

ตั้งใน `scenarios.json#meta.effort_scale` หรือ override ราย run: `--quick` / `--standard` / `--enterprise`

---

## 14. ไฟล์/artifact ที่ระบบสร้าง — อยู่ไหน ใครเขียน

| ไฟล์ | ใครเขียน | คืออะไร |
| --- | --- | --- |
| `scenarios.json` | scenario-discovery (+beats เขียน `analysis{}`) | spine — source of truth Phase 1 |
| `design/` (DD, ER, api/, sitemap, registry) | domain-design | domain model Phase 2 |
| `mockups/` (shell/, pages/, prompts/) | screen-binding | theme + หน้าจอ Phase 2u |
| `features.json` | solution-arch | แผน FE + layering Phase 3 |
| source code + `.scenarioforge/ui-controls/FE-*.json` | feature-builder | โค้ด + control manifest Phase 4 |
| `qa-tracker.json` + Playwright specs | scenario-verify | TS + ผลรัน + Gate 4 |
| `.scenarioforge/run-ledger.json` | orchestrator | บันทึกการ run (resume ได้) |
| `.scenarioforge/impl-progress.json` | feature-builder | ledger งาน build (resume ได้) |
| `.scenarioforge/personas.json` | คุณ (config) | registry ของ ideation panel |

---

## 15. Troubleshooting

- **Skill ไม่ activate จากภาษาธรรมชาติ** → เรียก explicit เช่น `/scenario-discovery:scenario-discovery`,
  `/feature-builder:implement`
- **orchestrator บอก "ไม่มี scenarios.json"** → ถูกแล้ว มันไม่ปั้น spine เอง — รัน scenario-discovery ก่อน
  (ยกเว้นมี codebase เดิมอยู่แล้ว: สั่งด้วย path codebase ตรงๆ ให้ Phase 0 bootstrap ทำงานแทน — ดูข้อ 4)
- **gate FAIL แบบ upstream gap** (เช่น field ไม่มีใน DD, entity ขาด) → อย่ารัน phase เดิมซ้ำ
  ไปเติมที่ worker ต้นน้ำที่ gate บอก แล้วค่อยเดินต่อ (`/orchestrator:next`)
- **`/deliver-docs` หยุดพร้อมรายงาน mismatch** → design ยังไม่ตรง/ไม่ครบ เติม artifact ที่ขาดก่อนแล้วสั่งใหม่
- **persona ภายนอกถูกข้าม (skipped)** → เช็ค env key ของ provider นั้น (เช่น `OPENROUTER_API_KEY`)
  — ข้ามไม่ถือว่า fail งานเดินต่อได้
- **session หลุดกลางทาง** → `/orchestrator:resume` (pipeline) · `/feature-builder:continue` (โค้ด) ·
  `/scenario-verify:continue` (เทสต์) — ledger เก็บสถานะไว้หมดแล้ว
- **อยากรู้ว่าจะเปลือง Opus แค่ไหนก่อนกดจริง** → `/feature-builder:route` และ `/scenario-verify:route`
  (read-only ทั้งคู่)

---

## 16. อ่านต่อ (ลงลึกรายตัว)

| เอกสาร | เนื้อหา |
| --- | --- |
| `plugins/orchestrator/USER-GUIDE.md` | verify gate ละเอียด, circuit breaker, เหตุผล sequential |
| `plugins/scenario-discovery/USAGE.md` | วิธีเขียน prompt เก็บ requirement + ตัวอย่างต่อสถานการณ์ |
| `docs/setup-ai-providers.md` | ตั้ง API key ทุกค่าย + ใช้ CLI (codex/opencode/gemini/claude) เป็น persona ทีละขั้น |
| `plugins/scenario-discovery/skills/.../references/persona-registry.md` | config panel + external AI/CLI ครบทุก field |
| `plugins/domain-design/USER-GUIDE.md` | prompt ราย artifact, reverse engineering, /deliver-docs |
| `plugins/screen-binding/USER-GUIDE.md` | theme-first, fidelity, Claude Design สองทาง |
| `plugins/solution-arch/USER-GUIDE.md` | vertical slice, boundary, gap handling |
| `plugins/feature-builder/USER-GUIDE.md` | model routing เต็ม, 8 gate, manifest, ledger |
| `plugins/scenario-verify/USER-GUIDE.md` | 5 หมวดเทสต์, Gate 4, flow ใช้งานจริง |

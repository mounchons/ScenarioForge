# scenario-verify — คู่มือใช้งาน (Phase 4 / QA)

> ScenarioForge plugin ตัวที่ 6 — **ตัวพิสูจน์ปลายสาย** ของ spine (เปลี่ยนชื่อจาก `qa-ui-test`)
> เนื้อหา skill ภายในเป็นภาษาอังกฤษเพื่อประหยัด token แต่คู่มือนี้และคำตอบถึงพี่ปูเป็นภาษาไทย

---

## 1. plugin นี้คืออะไร (อธิบายแบบสั้น)

scenario เปิดคำถามไว้ตั้งแต่ Phase 1 ว่า *"ระบบทำสิ่งนี้ให้ user ได้จริงไหม?"* ทุก phase ค่อย ๆ ตอบ:
domain-design เขียน acceptance criteria, feature-builder เทโค้ดจริง + ปัก intent ของแต่ละ control ลง
**UI Control Manifest**. **scenario-verify คือคนปิดวงให้ครบ** — แปลง AC + manifest เป็น test scenario
จริง (`TS-xxx`) รันบน browser จริง แล้วรายงานทีละตัวว่าเขียว/แดง โดยทุก TS โยงกลับไปที่ `SC-...` ที่มันพิสูจน์

**ทำงาน 2 โหมด = 2 tier:**
- **generate (Tier 1, deterministic):** อ่าน AC + manifest → derive `TS-xxx` ลง `qa-tracker.json` รอบเดียวจบ
  ไม่วน — นี่คือ **Layer 2** ของ two-layer fence (feature-builder เป็น Layer 1 = unit test ตอน build)
- **run (Tier 2, agentic):** รัน Playwright แล้ว **วน** run → อ่าน error → debug → retry จนเขียว หรือจน
  circuit breaker สั่งหยุด → resumable (ledger อยู่ใน qa-tracker) + bounded (cap หยุด scenario ที่ค้าง)

**เส้นแบ่งกับ feature-builder:** feature-builder ตอบ *"โค้ดรัน + unit fence เขียว"* (Layer 1) ·
scenario-verify ตอบ *"พฤติกรรมที่ scenario สัญญาไว้ พิสูจน์ได้จริงใน browser"* (Layer 2). ตัวนี้
**ไม่เขียนโค้ดแอป** และ **ไม่เขียน AC** — เจอ control ที่ไม่มี manifest หรือ scenario ที่ไม่มี AC ให้พิสูจน์
= **gap** บันทึกแล้วส่งกลับต้นน้ำ ไม่เดา

---

## 2. analogy (.NET / DDD) — เข้าใจเร็วในภาษาพี่ปู

feature-builder ส่งแอปที่ **unit test เขียว** มาให้ — แต่ unit test เขียวพิสูจน์แค่ชิ้นส่วนแยกเดี่ยว ส่วน
business scenario ถามว่า *เส้นทางทั้งเส้นที่ user เห็น* ทำงานไหม. scenario-verify คือ **QA lead ที่เขียน
integration/E2E suite แล้วรันกับ browser จริง**:

- เช็คที่แตะ security (manager เห็นบัตรของ tenant อื่นได้ไหม?) → **Opus** (senior)
- assert endpoint + validation rule → **Sonnet** (mid-level)
- "render + bind ถูกฟิลด์ไหม?" smoke check → **Haiku** (junior)

**UI Control Manifest** = spec sheet ที่ dev ปักไว้ทุก control → QA ไม่ต้องเดา intent.
**Gate 4** = release checklist (ไม่มี control ไหน ship โดยไม่มีเช็คบังคับเขียว) เหมือน required check ที่
กั้น merge. พอ test แดง QA lead ถามก่อนว่า *"test ฉันผิดเองไหม?"* (แก้ selector/wait = loop) ก่อนจะ **file
finding** ใส่โค้ด dev (ไม่เคย patch แอปเพื่อกลบ test แดง). **circuit breaker** = Polly policy — retry แล้ว
หยุด+escalate ไม่ทุบ build พังซ้ำ. ทุก `TS` ถือ `scenario_ref` = **traceability matrix** ชี้ที่
`SC-billing-001` แล้วพูดได้ว่า "สัญญาข้อนี้รักษาแล้ว" พร้อมเช็คเขียว

---

## 3. ที่ยืนใน pipeline

```
scenario-discovery (P1)  →  domain-design (P2)  →  screen-binding (P2 UI)
        →  solution-arch (P3)  →  feature-builder (P4)  →  scenario-verify (P4 QA)
```
เป็น worker ตัวสุดท้ายก่อน orchestrator รายงานว่า spine เขียวทั้งเส้น

---

## 4. อ่าน / เขียนอะไร

**อ่าน:**
- `scenarios.json` — `acceptance_criteria`, `postconditions`, `business.priority`, `traces_down.pages`
- **UI Control Manifests** `.scenarioforge/ui-controls/FE-<id>.json` — intent ของแต่ละ control
  (binding/validation/permission/cascade) + `data-testid` selectors
- `mockups/` — resolve URL · `features.json` — map control → FE → scenario
- `qa-tracker.json` ของตัวเอง — resume

**เขียน:**
- `qa-tracker.json` — TS ที่ derive + category + control_refs + model tier + ผลรัน
- Playwright specs (ใต้ test path ของโปรเจกต์, ผูกด้วย `data-testid`)
- `traces_down.test_scenarios[]` ในแต่ละ scenario (idempotent)
- **ไม่แตะ** `business{}` / `analysis{}` / AC / source code ของแอป

---

## 5. คำสั่ง / (10 ตัว — namespace `/scenario-verify:`)

| คำสั่ง | ทำอะไร | tier |
|---|---|---|
| `/generate [module\|SC-id] [--scale] [--category]` | derive TS จาก AC+manifest ลง qa-tracker.json (ยังไม่รัน) | 1 |
| `/run [module\|SC-id\|TS-id\|--all] [--category] [--model] [--no-escalate]` | รัน E2E วน run→debug→retry จนเขียว | 2 |
| `/route [module\|SC-id]` | preview แผนแจก Opus/Sonnet/Haiku + cost (read-only) | — |
| `/continue [module\|SC-id\|TS-id]` | resume run ที่ค้างจาก ledger | 2 |
| `/retest <TS-id\|--failed\|--all>` | รันใหม่หลัง fix (reset retry counter) | 2 |
| `/status [module\|SC-id\|TS-id]` | rollup + Gate 4 + findings (read-only) | — |
| `/coverage [module\|SC-id] [--include-controls] [--force-control-coverage]` | Gate 4 fence (read-only, override logged) | — |
| `/edit <TS-id> \| --from-control-spec [FE-id]` | แก้ TS หรือ re-sync เมื่อ manifest เปลี่ยน | 1 |
| `/gaps` | list gap + เจ้าของต้นน้ำ (read-only) | — |
| `/help` | สรุป (ตอบไทย) | — |

---

## 6. 5 mandatory test categories (หัวใจของ generate)

ทุก control ปั่นออกมาตาม field ใน manifest — ไม่เดา:

| Category | trigger | บังคับเสมอ? | พิสูจน์อะไร |
|---|---|---|---|
| `render-binding` | ทุก control | ✅ | control render + bind ถูกฟิลด์ (`data-testid` มี, โชว์ค่า/option ถูก) |
| `api-binding` | `binding.source == "api"` | เมื่อ trigger | โหลดจาก endpoint, value/display field map ถูก, verb/route ถูก |
| `permission` | `permission != null` | 1 ตัวต่อ role | แต่ละ role เห็น/ไม่เห็นถูก, unauthorized → fallback, data_scope ไม่ข้าม tenant |
| `validation` | มี rule | 1 ตัวต่อ rule | ค่าถูกผ่าน, ค่าผิดถูก reject, server_side เช็คซ้ำฝั่ง server |
| `cascade-loading-error` | `depends_on != null` หรือมี loading/error | เมื่อ trigger | parent เปลี่ยน → child reload ถูกลำดับ, loading state, error fallback (401/403/500/network) |

ได้ราว **3-7 scenario ต่อ control** → ฟอร์ม 5 control ≈ 15-35 TS

---

## 7. Gate 4 — รั้วปล่อย release (Layer 2)

> **ทุก control × ทุก mandatory category ที่ trigger ต้องมี scenario ที่ `passed`** ก่อน release

- `gap_control_ids` = control ที่มี category บังคับแต่ไม่มี scenario เลย
- `fail_control_ids` = มี scenario แต่ยังแดง
- ทั้งสอง list ว่าง → **Gate 4 PASS** · ไม่ว่าง → **BLOCKED** (รายงานเจาะจงว่า control ไหน category ไหน)
- `--force-control-coverage` ข้ามได้ แต่ **log เสมอ** + ถ้าข้าม `permission` = การตัดสินใจด้าน security ต้องระบุชัด

---

## 8. flow ใช้งานจริง (ทำงานถอยหลังจากเป้าหมาย)

**เป้าหมาย:** ทุก scenario เขียว + Gate 4 PASS + ทุก TS trace กลับ SC ได้

```
1) /route billing            → ดูก่อนว่าจะแจกงานยังไง กี่ TS กี่ Opus/Sonnet/Haiku (เช็ค cost)
2) /generate billing         → derive TS ลง qa-tracker.json (ยังไม่รัน)  [Tier 1]
3) /run billing              → รันจริง วนจนเขียว, แดงจริง→ file finding กลับ feature-builder  [Tier 2]
4) /status billing           → ดู rollup + Gate 4
5) ถ้า BLOCKED:
     - gap  → /generate (เติม category ที่ขาด)
     - fail → feature-builder แก้ finding → /retest <TS-id>
6) /coverage billing         → ยืนยัน Gate 4 PASS → spine เขียวทั้งเส้น
```

**ถ้า run ค้างกลางคัน** → `/scenario-verify:continue billing` (resume จาก ledger, ไม่รันซ้ำตัวที่เขียวแล้ว,
retry counter ไม่ reset)

**ถ้า build เปลี่ยน (manifest อัปเดต)** → `/scenario-verify:edit --from-control-spec FE-billing-pay`
(deprecate ตัวเก่าที่ถูกแทน, mint เฉพาะ delta, ไม่ renumber, ของเดิมที่ไม่เปลี่ยนคงไว้)

---

## 9. กฎเหล็ก (boundaries)

- **แก้ test ไม่แก้แอป** — test แดงเพราะ bug จริง → file finding กลับ feature-builder ไม่เคย patch โค้ดให้ test ผ่าน
- **ไม่ประดิษฐ์** control / AC / permission rule — ขาด = gap → `qa-notes.md` ส่งกลับต้นน้ำ
- **data-testid เท่านั้น** — ห้าม select ด้วย text/ตำแหน่ง/nth-child; control ไม่มี testid = gap
- **flat hierarchy** — dispatcher spawn subagent ต่อ category-batch (+ qa-critic บน ENTERPRISE); subagent ห้าม spawn ต่อ
- **ไม่แตะ locked scenario** / `business{}` / `analysis{}`
- **circuit breaker** — ครบ cap = หยุด+รายงาน ไม่วนต่อ; Haiku/Sonnet ค้างครึ่ง cap → escalate Opus ครั้งเดียว

---

## 10. scale-adaptive

| scale | generate | run | gate |
|---|---|---|---|
| QUICK | 1 control/scenario ที่สั่งตรง | รันเฉพาะชุดนั้น | รายงาน coverage control นั้น ข้าม sweep |
| STANDARD (default) | ครบ 5 category ทุก control ในโมดูล | รันหมด ตาม tier | บังคับ Gate 4 ทั้งโมดูล |
| ENTERPRISE | STANDARD + qa-critic gate (Opus ตรวจ edge case ก่อนรัน) | รวมตัวที่ critic เพิ่ม | + ทุก role/negative path ครบ ไม่ใช้ตัวแทน |

---

## 11. ของที่เขียนลง disk

```
.scenarioforge/
  qa-tracker.json            ← TS + ผลรัน + findings + coverage + rollup (source of truth Phase 4 QA)
  qa-notes.md                ← gaps + override log + probe/recalibration notes
  test-results/<spec>.json   ← ผลรัน Playwright แยกไฟล์ต่อ spec (หลักฐาน audit ย้อนหลัง — ห้ามเขียนทับรวมไฟล์เดียว)
  ui-controls/FE-*.json      ← (อ่านอย่างเดียว — feature-builder เขียน)
<test path>/                 ← Playwright specs ที่ generate (ผูก data-testid) + helpers/ (login, activateTab)
scenarios.json               ← เขียนกลับเฉพาะ traces_down.test_scenarios[] (idempotent)
```

> ข้อควรระวัง: ถ้าเจอ `qa-tracker.json` ที่ **repo root** (ของ plugin อื่น เช่น qa-ui-test เดิม) — เป็นคนละ ledger
> ห้ามอ่านเป็น state ห้ามเขียนทับ บันทึกไว้ใน qa-notes.md แล้วใช้ `.scenarioforge/qa-tracker.json` เท่านั้น

---

## 12. หมายเหตุชื่อเดิม

โน้ต/เอกสารเก่าบางที่ยังเรียก `qa-ui-test` — หมายถึง plugin ตัวนี้ (Phase 4 QA prover) ที่เปลี่ยนชื่อเป็น
`scenario-verify` แล้ว (2026-06-14) เหตุผลเดียวกับการเปลี่ยนชื่อก่อนหน้าในชุดนี้ (system-design-doc→
domain-design, ui-mockup→screen-binding, long-running→feature-builder): ชื่อต้องบอก **บทบาทใน spine**
("พิสูจน์ scenario") ไม่ใช่บอก output/พฤติกรรม ("ทดสอบ UI") — กันกับดัก description กว้างที่ทำให้ skill
ไม่ activate ชื่อใหม่ map ตรง artifact `qa-tracker.json` + บทบาท prover ปลายสาย

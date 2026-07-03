# คู่มือการใช้งาน: feature-builder — ScenarioForge Phase 4

> Plugin ตัวที่ 5 ของ ScenarioForge | Phase 4 (Implementation) | **Tier 2 — Agentic Worker**
> เวอร์ชัน 0.2.0 | สำหรับพี่ปู (Mounchon)
> **เปลี่ยนชื่อจาก `long-running` → `feature-builder`** (ชื่อใหม่บอกบทบาท "สร้าง feature เป็นโค้ดจริง" ตรงกับ artifact `features.json` ที่ solution-arch ผลิต — แทนชื่อเดิมที่บอกแค่ "รันนาน")

---

## 1. plugin นี้คืออะไร (อธิบายแบบ analogy)

ถ้าเทียบ ScenarioForge ทั้งสายเป็นการสร้างบ้าน:

| Phase | Plugin | เปรียบเป็น |
|---|---|---|
| 1 | scenario-discovery | คุยกับเจ้าของบ้านว่าจะอยู่ยังไง (ความต้องการ) |
| 2 | domain-design | เขียนแบบโครงสร้าง + รายการวัสดุ (entity/DD/API) |
| 2 UI | screen-binding | ออกแบบหน้าตาห้อง (mockup หน้าจอ) |
| 3 | solution-arch | แตกเป็นรายการงานช่าง ตั้งชื่อคาน-เสา-ห้อง แต่ยังไม่ลงมือ (FE-xxx + layering) |
| **4** | **feature-builder (ตัวนี้)** | **หัวหน้าช่าง ที่แจกงานให้ทีม + ลงมือเทปูนจริง แล้วกด F5 จนบ้านใช้งานได้** |
| 4 QA | qa-ui-test | ผู้ตรวจรับงาน ทดสอบทุกห้องก่อนส่งมอบ |

**จุดต่างของตัวนี้กับ Tier 1 อื่น:** ตัว Tier 1 ทำรอบเดียวจบเพราะ deterministic. แต่ feature-builder เป็น
**agentic** — วน implement → build → fix ไม่รู้กี่รอบจนกว่าจะ compile ผ่านและเทสต์เขียว เพราะฉะนั้นมันต้อง:
- **resumable** — ปิดเครื่องกลางทางแล้วเปิดมาทำต่อได้ (มี progress ledger เก็บสถานะ)
- **bounded** — มี circuit breaker จำกัดจำนวนรอบ ไม่ให้วนแก้ build พังไม่จบ

**+ v0.2.0 — เป็น "หัวหน้าช่างที่แจกงานตามความยาก" (model routing):** ไม่ได้เขียนโค้ดเองทุก feature ที่
model เดียว แต่ทำตัวเป็น **dispatcher** แจก subagent ต่อ FE → งานยาก/เชื่อมหลายหน้า/มี security ส่งให้
**Opus**, ส่วนงานง่ายที่หน้าตาเหมือนกันเยอะๆ ให้ **Opus ทำตัวอย่าง 1 ตัว แล้ว Sonnet ทำตามแพทเทิร์น** ที่เหลือ
(ดูข้อ 5)

**Analogy .NET:** solution-arch ส่ง folder ของ vertical slice มาให้ — `Controller`, MediatR
`IRequest`/`Handler`, `IRepository`, บรรทัด DI — **ตั้งชื่อครบแต่ body ว่าง**. ตัวนี้คือ **tech lead ที่แจก
slice + เขียน body + กด F5 จนเขียว**: slice ที่ยุ่ง/แตะ security/ข้าม aggregate → senior dev (**Opus**);
ส่วน CRUD admin page ที่หน้าตาซ้ำๆ → ให้ senior ทำ **exemplar 1 ตัว** สวยๆ แล้วส่งแพทเทิร์นให้ mid-level
(**Sonnet**) stamp ที่เหลือ. master `_Layout` คือ exemplar ตัวแรกที่ทุกหน้า build ตาม.

---

## 2. ติดตั้ง

```
/plugin marketplace add D:\ProjectClaude\ScenarioForge
/plugin install feature-builder@scenarioforge
```

> ถ้า skill ไม่ activate อัตโนมัติ ให้เรียกตรงด้วย `/feature-builder:implement` ได้เลย

---

## 3. คำสั่ง / (ลดการพิมพ์ — สิ่งที่พี่ปูขอ)

| คำสั่ง | ทำอะไร | argument |
|---|---|---|
| `/feature-builder:implement` | เริ่ม build feature ที่ ready | `[module\|FE-id] [--quick\|--standard\|--enterprise] [--model opus\|sonnet] [--no-replicate]` |
| `/feature-builder:route` | **ดูแผนแจกงาน Opus/Sonnet ก่อน build (เช็ก cost)** — อ่านอย่างเดียว | `[module\|FE-id]` |
| `/feature-builder:continue` | ทำต่อจากที่ค้างไว้ (resume จาก ledger) | `[FE-id]` |
| `/feature-builder:status` | ดูความคืบหน้า + model tier ของแต่ละ feature — อ่านอย่างเดียว | `[FE-id]` |
| `/feature-builder:verify` | รัน 8-step pipeline ซ้ำ โดยไม่ implement ใหม่ | `[FE-id\|--all]` |
| `/feature-builder:retry` | ลองทำ feature ที่ blocked ใหม่ | `<FE-id>` (บังคับ) |
| `/feature-builder:gaps` | ดู design gap ที่ค้าง + ใครต้องแก้ — อ่านอย่างเดียว | – |
| `/feature-builder:help` | สรุปคำสั่ง + ตำแหน่งใน pipeline | – |

### ตัวอย่างการใช้
```
/feature-builder:route billing                      # ดูก่อนว่าตัวไหน Opus ตัวไหน Sonnet (ยังไม่ build)
/feature-builder:implement billing --standard       # build ทุก feature ใน module billing (แจกงานอัตโนมัติ)
/feature-builder:implement FE-billing-pay --model opus   # บังคับ FE นี้ใช้ Opus
/feature-builder:status                             # งานไปถึงไหน + Opus กี่ตัว Sonnet กี่ตัว
/feature-builder:continue                           # เปิดเครื่องมาทำต่อ (จำ model tier เดิม)
/feature-builder:gaps                               # มีอะไรค้างรอ upstream แก้บ้าง
```

---

## 4. เริ่มจากปลายทาง (ทำงานถอยหลังจากเป้าหมาย — สไตล์พี่ปู)

**เป้าหมายสุดท้าย:** ทุก feature ที่เล็ง = **build ผ่าน + เขียว + trace กลับ scenario ได้** (compile, CRUD/API
ทำงาน, มีเทสต์ที่ fence ต้องการ, control มี manifest, postcondition ถูก assert ด้วยเทสต์ ≥1) พร้อม ledger
ที่ resume กลางทางได้

ไล่ถอยหลัง:
1. จะ done ต้องผ่าน **8 gate** → จึงมี verification pipeline
2. จะผ่าน gate ต้อง build เขียว → จึงมี loop implement → build → fix
3. loop อาจวนหลายรอบข้าม session → จึงมี **progress ledger** (resumable)
4. loop ต้องไม่วนไม่จบ → จึงมี **circuit breaker** (bounded)
5. ทุก feature ต้องอ้าง scenario ได้ → จึงมี **gate 8: Scenario Trace Check**
6. งานยาก vs ง่ายไม่ควรใช้ model เดียวกัน (เปลือง) → จึงมี **model routing** (ข้อ 5 ด้านล่าง)

---

## 5. ⭐ Model Routing — แจกงาน Opus / Sonnet ตามความยาก (สิ่งที่พี่ปูขอ)

feature-builder ทำตัวเป็น **per-feature dispatcher**: อ่านรูปร่างของแต่ละ FE จาก `features.json` แล้ว
spawn subagent ต่อ FE ตาม tier ที่เหมาะ (flat — subagent ทำ FE เดียวแล้ว return ไม่ spawn ต่อ)

### เกณฑ์ตัดสิน — อ่านจาก features.json (ตามที่พี่ปูเลือก)
ใช้ field ที่ solution-arch เขียนไว้แล้ว ไม่ต้องเดาใหม่: `effort` (S/M/L), `type`, `depends_on`, `traces_up`

**HARD → Opus ทำเอง (Mode A)** ถ้าเข้าข้อใดข้อหนึ่ง:
- `effort == L` หรือ
- `type` ∈ (command / integration / batch / report) — มี logic จริง/ต่อระบบนอก หรือ
- `depends_on` ≥ 2 (เชื่อมหลาย feature → ต้องคิดข้ามตัว) หรือ
- `traces_up.entities` ≥ 3 (แตะโดเมนกว้าง) หรือ
- control มี `permission` + `data_scope` ไม่ trivial (security — Opus คิดเรื่อง authorization boundary) หรือ
- `traces_up.pages` ≥ 2 (flow ข้ามหน้า)

**SIMPLE → exemplar + replica (Mode B)** ถ้าไม่เข้า HARD:
- งาน CRUD/query เล็กๆ ที่หน้าตาเหมือนกัน → จับกลุ่ม (replication group) ตาม `type` + layering คล้ายกัน
- **Opus ทำ exemplar 1 ตัว** ของกลุ่ม (= reference pattern ที่ดีที่สุด)
- **Sonnet ทำที่เหลือ** โดยรับ "ไฟล์ของ exemplar" เป็น context → copy แพทเทิร์น ไม่ต้องคิดใหม่ (เร็ว+ถูก+สม่ำเสมอ)
- **master page / shell = exemplar มาตรฐาน:** Opus ทำ master `_Layout` + หน้าง่ายตัวแรกบนมัน → Sonnet ทำ
  หน้าง่ายที่เหลือบน shell เดียวกัน

### การจับกลุ่ม (ตัวไหน replicate ด้วยกัน)
2 feature อยู่กลุ่มเดียวกันเมื่อ **type เดียวกัน + layering คล้ายกัน** (controller+handler+repo+view รูปร่างเดียว
ต่างที่ entity). ตัวอย่าง: "หน้า CRUD admin" (Product, Category, Supplier) → Opus ทำ Product เป็น exemplar,
Sonnet ทำที่เหลือ. หน้าที่แค่ใช้ master shell เหมือนกันแต่ behavior ต่าง = คนละกลุ่ม (เฉพาะ "ฝาแฝดเชิงโครงสร้าง"
ถึง replicate ได้สะอาด)

### ตารางสรุป tier
| สถานการณ์ | model | เพราะ |
|---|---|---|
| feature ยาก (Mode A) | **Opus** | reasoning / security / เชื่อมข้าม feature |
| กลุ่ม simple — exemplar | **Opus** | สร้าง reference pattern ที่ดีที่สุด 1 ครั้ง |
| กลุ่ม simple — ที่เหลือ | **Sonnet** | copy แพทเทิร์นที่พิสูจน์แล้ว (เร็ว ถูก สม่ำเสมอ) |
| master page / shell | **Opus** (exemplar) → **Sonnet** (หน้าบนมัน) | shell คือ exemplar มาตรฐาน |
| ENTERPRISE code-critic | **Opus** | งานวิจารณ์ใช้ judgment |

### สำคัญ: verification ไม่สนว่า model ไหนเขียน
routing ตัดสินแค่ "ใครเขียน" ไม่ใช่ "ตรวจไหม". **ทุก feature** (Opus/Sonnet, exemplar/replica) ผ่าน 8-step
pipeline + manifest gate เหมือนกันหมด. replica ที่ drift จาก exemplar หรือ fail gate → กลับเข้า loop เหมือนตัวอื่น

### Escalation: Sonnet ทำไม่ไหว → ดันขึ้น Opus
ถ้า Sonnet replica ยังแดงเมื่อถึง **ครึ่งหนึ่งของ iteration cap** → dispatcher **ดันขึ้น Opus ครั้งเดียว**
(re-dispatch Mode A, บันทึก `escalated_to: opus`, ตัวนับ iteration ไม่ reset). กัน feature ที่จับกลุ่มผิด
(ดูง่ายแต่จริงไม่ง่าย) ไม่ให้เผา cap ทิ้งบน model ถูก

### Flag ปรับ routing เอง
| Flag | ผล |
|---|---|
| `--model opus` / `--model sonnet` | บังคับ tier ของ FE ที่เล็ง ข้ามการ score |
| `--exemplar FE-<id>` | กำหนดให้ FE นี้เป็น exemplar ของกลุ่ม (Opus ทำก่อน) |
| `--no-replicate` | ทำทุก FE ตรงตาม tier ที่ score ได้ ข้ามการแบ่ง exemplar/replica |

> ใช้ `/feature-builder:route` ดูแผนแจกงานก่อน build ได้เสมอ (อ่านอย่างเดียว ไม่เขียนอะไร) เหมาะเช็ก cost

---

## 6. 8-Step Verification Pipeline (หัวใจของการ "done")

ทุก feature ต้องผ่านครบ 8 ก่อนเป็น `done`. gate แดง → กลับเข้า loop แก้ ไม่ mark done:

| Gate | ตรวจอะไร |
|---|---|
| 1. Build | `dotnet build` ผ่าน ไม่มี error |
| 2. Design Compliance | entity/field/type ตรง Data Dictionary + ER (ไม่ drift) |
| 3. CRUD | create/read/update/delete ของ aggregate ทำงาน |
| 4. API Integration | endpoint ตรง contract ใน `design/api/` |
| 5. Test Coverage | เทสต์ที่ fence ต้องการครบ + เขียว |
| 6. Tech Audit | async EF, ไม่มี N+1, DI ไม่ `new`, จัดการ nullable, เคารพ DDD boundary |
| 7. Config | connection string/options/migration ใน config ไม่ hard-code |
| 8. **Scenario Trace Check** ⭐ | `scenario_ref` valid + ทุก postcondition มีเทสต์ assert ≥1 ตัว |

> **gate 8 ใหม่ใน ScenarioForge** — ทำให้ "code นี้ทำให้ postcondition ธุรกิจเป็นจริง" เป็น gate ที่ทดสอบได้ →
> spine พิสูจน์ได้ตลอดสาย

---

## 7. UI Control Manifest (เฉพาะ feature ที่มี form control)

feature ที่แตะ input/select/combobox/radio/checkbox/data-bound จะ pin **เจตนาของ dev** ลงไฟล์ตอน implement
ที่ `.scenarioforge/ui-controls/FE-<id>.json` — กัน qa-ui-test ต้องเดา intent ทีหลัง

- **Two-layer fence:** Layer 1 (ตัวนี้, build-time) binding+validation test → ขาด=ไม่ผ่าน gate 5;
  Layer 2 (qa-ui-test) E2E — ตัวนี้แค่ emit manifest ให้ QA
- **Drift:** code เปิดสิทธิ์ **กว้างกว่า** mockup (`permission-wider`) = SECURITY RISK → **BLOCK**; แคบกว่า = warn

---

## 8. Resumable: progress ledger

`.scenarioforge/impl-progress.json` เก็บ: status (pending/in_progress/done/blocked) + **model_tier +
routing_mode + exemplar_ref + escalated_to** + iterations (คงค่าข้าม resume) + last_substep + 8 gate +
replication_groups

**เวลา resume (`/continue`):** ข้าม done, เปิดไฟล์ที่ touched, **re-dispatch ที่ model tier เดิม** (replica
ก็ยังได้ไฟล์ exemplar), build ซ้ำ 1 ครั้งยืนยัน, ทำต่อ. ไม่เริ่ม replica ถ้า exemplar ยังไม่ done

---

## 9. Scale-adaptive + Circuit breaker

| Scale | พฤติกรรม |
|---|---|
| **QUICK** | FE เดียว เรียกตรง ลด scope ไม่ลด verify |
| **STANDARD** | default. build ทุก ready_for_impl ตาม depends_on + routing |
| **ENTERPRISE** | + code-critic gate (Opus วิจารณ์ diff) + cross-cutting เข้ม |

> scale ตัดสิน "ทำ pipeline แค่ไหน" / routing ตัดสิน "model ไหนเขียน" — แยกแกนกัน

**Circuit breaker caps:**

| Cap | QUICK | STANDARD | ENTERPRISE |
|---|---|---|---|
| failed-build รอบ/feature | 8 | 12 | 15 |
| escalate Sonnet→Opus ที่ | 4 | 6 | 7 |
| critic รอบ/feature | – | – | 5 |
| feature/run ก่อน checkpoint | 3 | 20 | 20 |

ชน cap เต็ม → `blocked` + บันทึก ไม่วนต่อ. **ห้าม subagent spawn subagent** (flat)

---

## 10. ขอบเขต — สิ่งที่ตัวนี้ "ไม่ทำ"

- ❌ ไม่สร้าง/แก้ scenario (= scenario-discovery)
- ❌ ไม่ประดิษฐ์ entity/DD/API (= domain-design) → **ขาด = บันทึก gap หยุด ไม่เดา**
- ❌ ไม่ออกแบบ/แก้หน้าจอ (= screen-binding)
- ❌ ไม่ re-plan/renumber FE (= solution-arch)
- ❌ ไม่เขียน/รัน QA suite ทางการ (= qa-ui-test) → แค่ unit test ของ fence + emit manifest
- ❌ ไม่แตะ scenario `locked`
- ❌ subagent ไม่ spawn subagent ต่อ (flat hierarchy)

> **กฎทอง:** เจอของขาด = บันทึก gap ส่งกลับ upstream ไม่เดาเติมเอง

---

## 11. ตำแหน่งใน pipeline

```
scenario-discovery (P1) → domain-design (P2) → screen-binding (P2 UI)
   → solution-arch (P3) → [ feature-builder (P4) ←อยู่ตรงนี้ ] → qa-ui-test (P4 QA)
```

**อ่านเข้า:** `features.json` + entity/DD/API ใน `design/` + page ใน `mockups/` + `scenarios.json` (scenario_ref + postconditions)
**เขียนออก:** source code + `.scenarioforge/impl-progress.json` + `.scenarioforge/ui-controls/FE-*.json` + เขียนกลับ `traces_down.features[]`
**ส่งต่อ:** qa-ui-test อ่าน `acceptance_refs` + manifest → derive E2E test

---

## 12. ไฟล์ภายใน plugin

```
plugins\feature-builder\
├── .claude-plugin\plugin.json
├── commands\
│   ├── implement.md   continue.md   status.md   verify.md
│   ├── retry.md       gaps.md       help.md      route.md
├── skills\feature-builder\
│   ├── SKILL.md        (~210 บรรทัด ≤500, อังกฤษ)
│   └── references\
│       ├── progress-ledger.md          (ledger + lifecycle + routing fields + resume)
│       ├── verification-pipeline.md    (8 gate pass/fail)
│       ├── ui-control-manifest.md      (manifest + two-layer fence + drift)
│       ├── implementation-conventions.md (build ทีละ layer ตาม stack พี่ปู)
│       ├── scale-adaptive.md           (scale + circuit breaker + escalation + flags)
│       └── model-routing.md            (Opus/Sonnet routing + exemplar-replica + escalation)
└── USER-GUIDE.md       (ไฟล์นี้)
```

---

## 13. TODO ต่อ

- ทดสอบ `/plugin install feature-builder@scenarioforge` จริง — ถ้า activate ไม่ติด ลอง `/feature-builder:implement` ตรง
- ทดสอบ `/feature-builder:route` กับ features.json จริง → ตรวจว่าแบ่ง Opus/Sonnet สมเหตุผล (ปรับ threshold ใน model-routing.md ได้)
- ลองรัน implement จริง → ตรวจ subagent dispatch + ledger routing fields + escalation ทำงานถูก
- เหลือ 2 ตัวปิดชุด: **qa-ui-test (P4 QA)** + **orchestrator (Tier 0)**

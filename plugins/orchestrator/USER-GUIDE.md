# ScenarioForge — orchestrator คู่มือการใช้งาน

> Tier 0 — ตัวประสานงานของทั้ง pipeline | plugin ตัวที่ 7 (ปิดชุด)
> เวอร์ชัน 0.1.1 — รองรับ beat 1.5 ideation panel ของ scenario-discovery v0.2.0 (multi-persona + external AI)

---

## 1. orchestrator คืออะไร (อ่านอันนี้ก่อน)

ScenarioForge มี worker 6 ตัว ทำงานคนละ phase ตาม BMAD 4 เฟส:

```
Phase 1  Analysis        scenario-discovery   เก็บ requirement → scenarios.json (spine)
Phase 2  Planning        domain-design        entity + Data Dictionary + API + sitemap
Phase 2u Planning/UI     screen-binding       master shell + หน้าจอ (เฉพาะ has_ui)
Phase 3  Solutioning     solution-arch         features.json (FE + layering)
Phase 4  Implementation  feature-builder       เขียนโค้ดจริง วน build→fix จนเขียว
Phase 4q QA              scenario-verify       E2E test + Gate 4 coverage
```

ปัญหาเดิม: คุณต้องเรียก worker ทีละตัวเอง จำลำดับเอง เช็คเองว่า phase ก่อนเสร็จดีแล้วค่อยไปต่อ

**orchestrator แก้ตรงนี้** — เป็น plugin ตัวเดียวที่คุณสั่งงานโดยตรง แล้วมันจัดการให้:
1. อ่าน spine → รู้ว่าตอนนี้อยู่ตรงไหน เหลือ phase ไหน
2. ตัดสิน scale (QUICK / STANDARD / ENTERPRISE) → รู้ว่าต้องรัน phase ไหนบ้าง
3. วางลำดับ phase แล้ว delegate ให้ worker ทีละตัว
4. ตรวจ **verify gate** คั่นทุก phase — phase ก่อนผ่าน gate เขียว ถึงปล่อยให้ phase ถัดไปเริ่ม

**หัวใจ:** orchestrator ไม่ลงมือทำเอง มันแค่ route + delegate + verify เหมือน `IMediator` ใน .NET ที่
route request ไป handler ที่ถูกตัว ตัวมันเองไม่มี business logic

---

## 2. เริ่มใช้งาน — 3 สถานการณ์ที่เจอบ่อย

### A. สร้าง module ใหม่ตั้งแต่ต้นจนจบ
```
# 1. เก็บ requirement ก่อน (Phase 1 — ยังต้องเรียก scenario-discovery เอง เพราะมันคุย Q&A กับคุณ)
discover scenarios for billing module

# 2. จากนั้นปล่อยให้ orchestrator ลากต่อจนจบ
/orchestrator:build billing
```
orchestrator จะ: ตรวจ Phase 1 ผ่าน gate → delegate domain-design → gate → screen-binding (ถ้ามีหน้าจอ)
→ gate → solution-arch → gate → feature-builder → gate → scenario-verify → gate → รายงานผล

### B. อยากดูแผนก่อนว่าจะรันอะไรบ้าง (ไม่อยากให้รันเลยทันที)
```
/orchestrator:plan billing
```
แสดงลำดับ phase + worker + กิน/ผลิตอะไร โดยไม่ delegate อะไรเลย (read-only) เห็นแล้วค่อยสั่ง `/build`

### C. อยากเดินทีละก้าว ตรวจ handoff ทุก phase ก่อนไปต่อ
```
/orchestrator:next      # รัน phase เดียว (เช่น domain-design) แล้วหยุด
# ดู handoff... โอเค
/orchestrator:next      # รัน phase ถัดไป
```
เหมาะกับรอบแรกๆ ที่ยังไม่ไว้ใจ ให้ตรวจทุกจุด

---

## 3. คำสั่งทั้งหมด (`/orchestrator:`)

| คำสั่ง | ทำอะไร | เขียนไฟล์ไหม |
|---|---|---|
| `/build [scope] [--scale]` | รันทั้ง pipeline end-to-end | run-ledger เท่านั้น |
| `/plan [scope] [--scale]` | แสดงแผน phase เฉยๆ ยังไม่รัน | ไม่ (read-only) |
| `/next` | รัน 1 phase แล้วหยุด | run-ledger เท่านั้น |
| `/status [scope]` | สถานะรวมทุก phase | ไม่ (read-only) |
| `/gate [phase-id]` | ตรวจ verify gate ของ phase ที่เสร็จซ้ำ | gate result เท่านั้น |
| `/resume [scope]` | รันต่อจากที่ค้าง | run-ledger เท่านั้น |
| `/scale [level]` | ตั้ง/ดู effort scale | run-ledger เท่านั้น |
| `/help` | สรุป (ไทย) | ไม่ |

`scope` = ชื่อ module / `SC-id` ตัวเดียว / เว้นว่าง (= module ปัจจุบันใน `scenarios.json#meta.module`)

---

## 4. scale ทำงานยังไง

orchestrator อ่าน `meta.effort_scale` จาก scenarios.json (หรือใช้ flag `--quick/--standard/--enterprise`
override เฉพาะ run นี้) scale เปลี่ยน **ว่ารัน phase ไหน** และ **gate ไหนบล็อก** ไม่เปลี่ยนลำดับ

**QUICK** — งานเล็ก/CRUD แก้นิดเดียว
```
/orchestrator:build SC-billing-005 --quick
```
→ append 1 scenario → feature-builder ตัวเดียว (FE นั้น) → scenario-verify control นั้น
ข้าม Planning/Solutioning ถ้า design + features มีอยู่แล้ว (ถ้าจริงๆ ขาด artifact ที่ต้องใช้ gate จะ fail
แล้ว orchestrator แทรก phase ที่ขาดให้ — QUICK เป็นการลัด ไม่ใช่ข้ามของที่จำเป็นจริง)

**STANDARD** — ค่าเริ่มต้น เต็มสาย
```
/orchestrator:build billing
```
→ `1 → 2 → (2u ถ้ามี has_ui) → 3 → 4 → 4q` ทุก phase มี gate, worker รันโหมดปกติ

**ENTERPRISE** — เต็มสาย + โหมดเข้ม
```
/orchestrator:build billing --enterprise
```
→ เปิด: domain-design cross-validation (ER↔DD) + `/deliver-docs`, screen-binding HTML fidelity,
solution-arch dependency-graph validation, feature-builder code-critic, scenario-verify qa-critic
→ Gate 4 (coverage) **บังคับ**: control × category ไม่ครบเขียว = block release

ดูความต่างก่อนตัดสินใจ: `/orchestrator:scale enterprise`

---

## 5. verify gate — กลไกที่สำคัญที่สุด

gate คือด่านตรวจที่รัน**หลัง** worker คืน handoff และ**ก่อน** delegate phase ถัดไป มันเช็คว่าสิ่งที่ phase
ถัดไปต้องใช้ "มีจริงและถูกต้อง" ไหม (เหมือน `IPipelineBehavior` post-condition)

| Gate | หลัง phase | เช็คอะไร (ย่อ) |
|---|---|---|
| 1 | scenario-discovery | `rollup.ready_for_next_phase==true` (panel beat 1.5 + critic loop จบ) + ทุก scenario มี actor+goal |
| 2 | domain-design | ทุก scenario มี `traces_down.entities` + design/ มีจริง |
| 2u | screen-binding | shell มี + has_ui scenario มี `traces_down.pages` + field map กับ DD |
| 3 | solution-arch | ทุก scenario มี `traces_down.features` + `depends_on` ไม่มี cycle |
| 4 | feature-builder | feature `done` (8 gate เขียว) หรือ `blocked` มีเหตุผล + manifest ครบ |
| 4q | scenario-verify | **Gate 4 = PASS** (coverage ครบ) หรือ user ยอมรับ override ที่ log แล้ว |

**ผลของ gate:**
- 🟢 PASS → mark phase `done` → ไป phase ถัดไป
- 🔴 FAIL (worker พลาดเอง เช่น ลืม model 1 scenario) → delegate phase นั้นซ้ำ **1 ครั้ง** โดยระบุจุดที่ขาด
- 🔴 FAIL (upstream gap ที่ worker ถูกต้องที่ไม่เดา เช่น ขาด entity ที่ต้องมาจาก Phase 2) → **หยุดสาย
  ส่งให้ผู้ใช้ตัดสิน** บอกว่าต้องไปแก้ที่ worker ตัวไหน — รัน phase เดิมซ้ำไม่ช่วย เพราะรูอยู่ที่ต้นน้ำ

gate ไม่เคยแก้เอง มันแค่หยุดสายแล้ว route ว่าใครต้องแก้ (ถ้า orchestrator ไปเขียน entity ที่ขาดเองเพื่อให้
gate ผ่าน = ละเมิด boundary ที่ทั้งระบบห้ามไว้)

---

## 6. resume — รันต่อเมื่อค้างกลางทาง

run เต็มสายมี 6 phase ใช้เวลานาน session อาจจบกลางคัน orchestrator เก็บสถานะใน
`.scenarioforge/run-ledger.json` → เปิด session ใหม่สั่ง:
```
/orchestrator:resume billing
```
มันจะข้าม phase ที่ผ่าน gate เขียวแล้ว (ไม่รันซ้ำ) แล้วรันต่อจากจุดที่ค้าง worker แต่ละตัวก็ resume จาก
ledger ของตัวเอง (feature-builder = `impl-progress.json`, scenario-verify = `qa-tracker.json`) งานข้างใน
ไม่หาย counter ของ circuit breaker ก็ไม่ reset

---

## 7. กฎเหล็ก (boundary)

- **orchestrator เขียนไฟล์เดียว** = `.scenarioforge/run-ledger.json` (บันทึกการ run) ไม่เขียน spine,
  design, mockup, feature, code, test — ทั้งหมดนั้นเป็นงาน worker. ถ้า orchestrator จะเขียน artifact เมื่อไร
  = มันกำลังทำงานแทน worker → ต้องหยุดแล้ว delegate
- **artifact หาย = หยุดแล้วบอก** ไม่ปั้น stub ขึ้นมาเอง (เช่น ไม่มี scenarios.json → บอกให้รัน
  scenario-discovery ก่อน)
- **flat hierarchy** — orchestrator เรียก worker; worker ห้ามเรียก worker; orchestrator ห้ามซ้อน
  orchestrator. delegation มีชั้นเดียวเสมอ (subagent ภายในของ feature-builder/scenario-verify นับเป็น
  ชั้นเดียวใต้ orchestrator และมันเองก็ไม่ spawn ต่อ)
- **ทีละ phase** — ไม่ delegate 2 phase พร้อมกัน เพราะ pipeline เป็น sequential chain (phase หลังกินผล
  phase หน้า ยิงขนานไปก็ต้องรอกันอยู่ดี)
- **circuit breaker** — จำกัดจำนวน delegate ต่อ run (QUICK 4 / STANDARD 11 / ENTERPRISE 15 — เผื่อ
  analysis beats ของ Phase 1: ideation panel 1 ครั้ง + critic loop) + จำกัด gate-retry + 1 phase
  delegate ซ้ำได้ไม่เกิน 1 ครั้ง → ชนเพดานแล้วหยุดรายงาน ไม่วนไปเรื่อย

---

## 8. ทำไม sequential ไม่ใช่ parallel (เหตุผลสถาปัตยกรรม)

pipeline เป็น dependency chain: domain-design อ่าน scenario ที่ discovery เขียน; solution-arch อ่าน
entity+api+page ที่ planning เขียน; feature-builder อ่าน feature ที่ solution-arch เขียน; scenario-verify
อ่าน manifest ที่ feature-builder ปัก

เมื่อ B ต้องใช้ผลของ A การรัน "ขนาน" ก็แค่ทำให้ B รอ A อยู่ดี — เพิ่ม overhead เปล่าๆ ไม่เร็วขึ้น
Anthropic เตือนชัดว่า parallel subagent ช่วยเฉพาะตอน subtask อิสระจริง (เช่น research หลายหัวข้อพร้อมกัน)
งาน coding/pipeline ที่มี dependency แบบนี้ไม่เข้าเกณฑ์ → orchestrator จึง delegate ทีละ phase ตามลำดับ
gate คั่น ไม่ยิงขนาน

---

## 9. analogy (.NET / DDD) — สำหรับพี่ปู

orchestrator = **`IMediator` + request pipeline** นั่งหน้า handler 6 ตัว

- user "send request" (`/build billing`) → mediator ไม่ handle เอง แต่ **route** ไป handler (worker) ที่
  ถูก phase ทีละตัว ตามลำดับ
- `IPipelineBehavior` ที่ห่อแต่ละ handler = **verify gate** รันหลัง handler แล้ว short-circuit pipeline ได้
  ถ้า post-condition fail — เหมือน gate หยุดสายตอน handoff แดง
- **4-part contract** = `IRequest` แบบ strongly-typed ที่ส่งให้ handler: objective + รูป output + invariant
  ที่ห้ามแตะ + reference ที่อ่าน → handler ออกนอกงานตัวเองไม่ได้
- handler คุยกันผ่าน **aggregate ที่ persist** (`scenarios.json` คือ spine ที่ทุกตัวอ่าน/เขียน slice ของ
  ตัวเอง) ไม่เรียกกันตรงๆ — นั่นคือ flat hierarchy + artifact pattern
- **circuit breaker** = `Polly` policy บน mediator: cap retry + จำนวน dispatch แล้วหยุดรายงาน ไม่วน
- และเพราะ handler แต่ละตัวพึ่ง state ที่ตัวก่อน persist ไว้ → `await` **ทีละตัว** ยิงขนานก็แค่ให้แต่ละตัว
  `await` ตัวก่อนอยู่ดี ซึ่งคือเหตุผลทั้งหมดว่าทำไมมันเป็น sequential pipeline ไม่ใช่ parallel fan-out

---

## 10. ความสัมพันธ์กับ command ของ worker

orchestrator delegate ผ่าน skill หรือ `/` command ของ worker ที่มีอยู่จริง:
- feature-builder มี `/feature-builder:implement`, `/route`, `/continue`, ... (8 ตัว)
- scenario-verify มี `/scenario-verify:generate`, `/run`, `/coverage`, ... (10 ตัว)
- screen-binding มี `/screen-binding:theme`, `/import-design`, `/design-prompt`
- domain-design มี `/domain-design:deliver-docs`
- scenario-discovery / solution-arch ยังไม่มี `/` command → orchestrator เรียกผ่าน implicit skill invoke

คุณยังเรียก command พวกนี้เองตรงๆ ได้เมื่ออยากคุมเอง — orchestrator แค่เพิ่มทางเลือก "สั่งทีเดียวจบ"
ไม่ได้บังคับให้ทุกอย่างผ่านมัน

---
description: สรุปคำสั่งและการทำงานของ orchestrator (ตอบไทย)
allowed-tools: Read
---

# /help — orchestrator คืออะไร ใช้ยังไง (ตอบไทย)

ตอบผู้ใช้เป็นภาษาไทย สรุปสั้น กระชับ:

## orchestrator คืออะไร
ตัวประสานงาน (Tier 0) ของ ScenarioForge — เป็น plugin ตัวเดียวที่คุณสั่งงานโดยตรง มันไม่ลงมือทำ phase
เอง แต่ **route + delegate + verify**: อ่าน scenario spine (scenarios.json) → ตัดสิน scale → วางลำดับ
phase → ส่งงานให้ worker ทีละตัวด้วย 4-part contract → ตรวจ verify gate คั่นก่อนไป phase ถัดไป

คุณคุยกับ orchestrator ตัวเดียว มันเรียก worker ทั้ง 6 (scenario-discovery → domain-design →
screen-binding → solution-arch → feature-builder → scenario-verify) ให้เอง ตามลำดับ (sequential เพราะ
phase หลังกินผลของ phase หน้า) และ flat (orchestrator เรียก worker; worker ห้ามเรียก worker)

## คำสั่ง (namespace `/orchestrator:`)
- `/build [module|SC-id] [--scale]` — รันทั้ง pipeline end-to-end (วางแผน → delegate ทุก phase → gate)
- `/plan [module|SC-id] [--scale]` — แสดงแผน phase เฉยๆ ยังไม่รัน (read-only, เช็กก่อนว่าจะรันอะไรบ้าง)
- `/next` — รันทีละ phase แล้วหยุด (เดินทีละก้าว ตรวจ handoff ก่อนไปต่อ)
- `/status [module|SC-id]` — สถานะรวมทุก phase: อันไหน done/pending/blocked + gate result (read-only)
- `/gate [phase-id]` — ตรวจ verify gate ของ phase ที่เสร็จแล้วซ้ำ (read-only)
- `/resume [module|SC-id]` — รันต่อจากที่ค้าง ไม่รัน phase ที่ผ่าน gate เขียวแล้วซ้ำ
- `/scale [quick|standard|enterprise]` — ตั้ง/ดู effort scale ของ run นี้ + ดูว่าแผนเปลี่ยนยังไง
- `/help` — อันนี้

## 3 scale
- **QUICK** — งานเล็ก/CRUD: append 1 scenario → feature-builder ตัวเดียว → scenario-verify control นั้น
  (ข้าม planning/solutioning ถ้า artifact มีอยู่แล้ว)
- **STANDARD** — เต็มสาย `1 → 2 → (2u ถ้ามี has_ui) → 3 → 4 → 4q` แต่ละ phase มี gate
- **ENTERPRISE** — เต็มสาย + โหมดเข้ม (cross-validation, HTML fidelity, dependency-graph, code-critic,
  qa-critic) + Gate 4 บังคับ (coverage ไม่ครบ = block release)

## กฎเหล็ก
orchestrator เขียนไฟล์เดียว = `.scenarioforge/run-ledger.json` (บันทึก run) — **ไม่เขียน** spine, design,
feature, code, test (นั่นงาน worker). artifact หาย = หยุดแล้วบอกผู้ใช้ ไม่ปั้นขึ้นมาเอง. gate แดง = หยุด
สาย (worker พลาด → delegate ซ้ำ 1 ครั้ง / upstream gap → ส่งให้ผู้ใช้ตัดสิน). มี circuit breaker จำกัด
จำนวน delegate ต่อ run

## analogy (.NET)
orchestrator = `IMediator` + pipeline ที่นั่งหน้า handler 6 ตัว: route request (`/build`) ไป handler
(worker) ที่ถูก phase, `IPipelineBehavior` = verify gate คั่นแต่ละ handler, 4-part contract = `IRequest`
แบบ strongly-typed, handler คุยกันผ่าน aggregate ที่ persist (scenarios.json) ไม่เรียกกันตรงๆ, circuit
breaker = Polly policy. และเพราะ handler แต่ละตัวพึ่ง state ที่ตัวก่อน persist ไว้ → `await` ทีละตัว
ไม่ใช่ยิงขนาน

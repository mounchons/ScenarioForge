# scenario-discovery — คู่มือการใช้งาน & วิธีเขียน Prompt

> Phase 1 (Analysis) ของ ScenarioForge — เปลี่ยน requirement ดิบ → `scenarios.json` ที่ trace ได้
> คู่มือนี้บอก: skill ทำอะไร, เรียกยังไง, และ**เขียน prompt แบบไหนให้ได้ผลดี**

---

## 1. skill นี้ทำอะไร (สรุป 1 ย่อหน้า)

รับ requirement จากพี่ปู (พิมพ์เอง หรือชี้เอกสาร) → ถาม-ตอบเก็บ business intent →
เขียนออกมาเป็น `scenarios.json` โดยแต่ละ scenario มี id `SC-<module>-<nnn>` เป็นแกน
ที่ทุก phase ถัดไป (design/mockup/code/test) อ้างกลับ. skill **ถามไม่เดา** — business
intent มาจากพี่ปูเสมอ ส่วน AI critic มาช่วยหาช่องโหว่ทีหลัง (commit ไม่ได้ เสนอได้)

---

## 2. ติดตั้ง (ครั้งแรกครั้งเดียว)

```
/plugin marketplace add D:\ProjectClaude\ScenarioForge
/plugin install scenario-discovery@scenarioforge
```

---

## 3. เรียกใช้ 2 ทาง

**ทาง A — implicit (แนะนำ):** พิมพ์งานเป็นภาษาธรรมชาติ Claude route เองจาก trigger keyword
**ทาง B — explicit:** `/scenario-discovery:scenario-discovery`

---

## 4. หลักการเขียน prompt ให้ได้ผลดี (สำคัญสุด)

skill นี้ทำงานเป็น "ถาม-ตอบ" อยู่แล้ว พี่ปูไม่ต้องเขียน prompt ยาวสมบูรณ์ตั้งแต่แรก
**แต่** prompt เริ่มต้นที่ดีช่วยลดรอบถาม-ตอบ. ใส่ของพวกนี้ได้จะดี:

1. **ชื่อโมดูล** — เช่น "billing", "ระบบจองห้อง" → ไปเป็น `meta.module`
2. **effort scale** — QUICK (แก้/เพิ่มเล็ก) / STANDARD (1 โมดูล) / ENTERPRISE (ทั้งระบบ)
3. **requirement ดิบ** — พิมพ์มา หรือชี้ไฟล์/path
4. **mode** — สร้างใหม่ หรือ เพิ่มลงของเดิม (ถ้าไม่บอก skill จะ detect จากว่ามีไฟล์ไหม)

> ไม่รู้/ไม่มีครบก็ไม่เป็นไร — skill จะถามเอง. ที่ใส่มาแค่ช่วยให้เร็วขึ้น

---

## 5. Prompt ตามสถานการณ์ (คัดลอกไปใช้ได้)

### 5.1 เริ่มโมดูลใหม่จากศูนย์ (CREATE)
```
discover scenarios สำหรับโมดูล billing, scale STANDARD
requirement: ลูกค้าชำระค่าบริการรายเดือน, ดูประวัติการชำระ, ยกเลิก subscription
```
EN:
```
Discover scenarios for the "billing" module, STANDARD scale.
Requirements: customers pay monthly, view payment history, cancel subscription.
```

### 5.2 อ่าน requirement จากเอกสาร
```
scenario-discovery อ่านเอกสารที่ D:\Docs\billing-requirement.md
แล้วสร้าง scenarios.json โมดูล billing ให้
```
> .md / .txt อ่านตรงได้ / .docx / .pdf ถ้าอ่านไม่ออก Claude จะบอก ให้แปลงเป็น text หรือ paste เนื้อหามา

### 5.3 เพิ่ม scenario ลงระบบที่พัฒนาไปแล้ว (APPEND)
```
เพิ่ม scenario ใหม่ลง billing: ลูกค้าขอ refund ภายใน 7 วัน
(scenarios.json มีอยู่แล้วที่ <path>)
```
> skill จะ Read ไฟล์เดิม → ต่อ id จาก max → เช็ก conflict กับของเดิม → append ไม่ทับ
> ถ้าชนกับ scenario เดิม (ซ้ำ/ควร merge/ขัดกฎ) จะ**ถามพี่ปูก่อน** ไม่ทำเงียบ

### 5.4 ระบุ scenario เดียวแบบเจาะจง (QUICK)
```
เพิ่ม scenario เดียว scale QUICK: admin ระงับบัญชีลูกค้าที่ค้างชำระเกิน 30 วัน
```

### 5.5 มี requirement ปนหลาย goal (ให้ skill แตกให้)
```
discover scenarios โมดูล order:
"พนักงานสร้างใบสั่งซื้อและอนุมัติและส่งอีเมลแจ้งลูกค้า"
ช่วยแยกเป็น scenario ย่อยตาม goal ให้ด้วย
```
> skill จะแยก "สร้าง / อนุมัติ / แจ้งเตือน" เป็นคนละ scenario ถ้าเป็นคนละ goal

---

## 6. สิ่งที่จะถูกถามระหว่างทาง (เตรียมคำตอบไว้)

ถามทีละกลุ่ม ไม่ถ่มรวด:
- **A:** ใครทำ (actor) + ต้องการอะไรสำเร็จ (goal) — *ห้ามเว้น*
- **B:** เริ่มเมื่อไหร่ (trigger) + ต้องมีอะไรก่อน (preconditions)
- **C:** ทำเสร็จสถานะอะไรเปลี่ยน (postconditions) — *ต้องวัดได้ เช่น invoice=paid*
- **D:** สำคัญต่อธุรกิจยังไง (value) + priority + **มีหน้าจอไหม (has_ui)**
- **E:** scenario นี้พูดถึง domain อะไรบ้าง (domain_concepts)

> ตอบไม่ได้บาง field = ใส่ null ได้ skill จะ mark ไว้ให้ critic จับทีหลัง ไม่เดาแทน

---

## 7. ผลลัพธ์ที่ได้ + ขั้นต่อไป

ได้ `scenarios.json` (status: draft) + handoff pointer บอกขั้นถัดไป จากนั้น orchestrator
จะรัน **2 beats** ให้อัตโนมัติ แล้ววน validate จน `ready_for_next_phase = true`:
- **beat 1.5 — ideation panel** (v0.2.0): persona หลาย role เสนอ scenario/edge case/คำถาม
  ที่พี่ปูยังไม่ได้พูด — ขยายจำนวน persona ได้ผ่าน `.scenarioforge/personas.json` และให้
  persona วิ่งบน AI ภายนอก (OpenAI-compatible) ได้ ดู `references/persona-registry.md`
- **beat 2 — critic**: จับผิด/หา gap/edge case ตาม BMAD adversarial lens

ทุกข้อเสนอเป็น `pending` — พี่ปู accept/reject ผ่าน orchestrator เสมอ (`/orchestrator:build`
หรือ `/orchestrator:next` เป็นคนขับ loop นี้)

---

## 8. สิ่งที่ skill นี้ไม่ทำ (อย่าสั่ง)

- ออกแบบ entity/หน้าจอ/API → นั่น system-design-doc
- เขียนโค้ด → นั่น long-running/implement
- สร้าง test → นั่น qa-*
- ตัดสิน accept/reject ข้อเสนอ critic → สิทธิ์พี่ปู/orchestrator
- แก้ scenario ที่ status=locked → ต้องเป็น migration decision ไม่ใช่ append

---

## 9. ตัวอย่าง prompt ที่ "ไม่ดี" → ปรับเป็น "ดี"

| ไม่ดี | ทำไม | ปรับเป็น |
|---|---|---|
| "ทำ scenario ให้หน่อย" | ไม่บอกโมดูล/requirement | "discover scenarios โมดูล billing: <requirement>" |
| "เขียนโค้ด billing" | ผิด skill (นี่ Phase 1) | "discover scenarios โมดูล billing ก่อน" |
| "เพิ่ม scenario" (ทั้งที่ยังไม่มีไฟล์) | ไม่มีของเดิมให้ append | "discover scenarios โมดูล X" (CREATE) |

---

## ดู scenarios.json แบบ human-readable — `/scenario-discovery:view`

- `/scenario-discovery:view` — เปิด viewer ใน browser (live): ดู node ย่อยทุกชั้น, filter/ค้นหา,
  กดยอมรับ/ปฏิเสธ suggestion และติ๊ก human_validated ได้ — เขียนกลับเข้าไฟล์ให้เอง พร้อมคำนวณ rollup ใหม่
- `/scenario-discovery:view snapshot` — สร้าง `scenarios-report.html` ไฟล์เดียวจบ (read-only)
  ส่งให้ลูกค้าเปิดดูได้เลย ไม่ต้องติดตั้งอะไร

# คู่มือใช้งาน Skill: `domain-design`

> ScenarioForge — Phase 2 (Planning) | Tier 1 Workflow Worker
> หน้าที่: อ่าน `scenarios.json` → สร้าง domain model (entities, Data Dictionary, use cases, API contracts, sitemap) → เขียน `traces_down` กลับ scenario

---

## 1. skill นี้ทำอะไร (เข้าใจก่อนเขียน prompt)

```
scenario-discovery (Phase 1)          domain-design (Phase 2)              ถัดไป
─────────────────────────             ──────────────────────              ─────
scenarios.json   ─── อ่าน business{} + domain_concepts ──►  entities + DD  ──► ui-mockup (pages)
(business intent)                                            use_cases       ──► solution-arch (features)
                  ◄── เขียนกลับ traces_down (entities/use_cases/apis) ───
```

**อ่านอะไร:** `business{}` (actor, goal, pre/postconditions, has_ui) + `domain_concepts[]` ของแต่ละ scenario
**ผลิตอะไร:** ไฟล์ใน `design/` (entities, `data-dictionary.md`, `api/`, `sitemap.md`, `registry.json`)
**เขียนกลับอะไร:** `traces_down.entities / use_cases / apis` ในแต่ละ scenario
**ไม่ทำ:** ไม่สร้าง scenario (Phase 1), ไม่ออกแบบหน้าจอ/`pages` (ui-mockup), ไม่ทำ `features`/โค้ด/เทสต์

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

## 5. ลำดับการทำงานที่แนะนำ (workflow ทั่วไป)

```
1. รัน scenario-discovery จน scenarios.json พร้อม (ready_for_next_phase)
2. "ออกแบบ domain model ของ module X"          → ได้ DD/ER/API/sitemap (STANDARD)
3. ตรวจ Data Dictionary ให้ตรงใจ (มันคือสะพานหลัก ผิดแล้วปลายน้ำ drift หมด)
4. ส่งต่อ ui-mockup (สำหรับ scenario ที่ has_ui) / solution-arch
5. ตอนจะส่งมอบงาน → /deliver-docs เพื่อได้เอกสาร 10 บทครบ
```

---

## 6. Checklist ตรวจผลลัพธ์ (skill รันให้อัตโนมัติ แต่พี่ปูเช็กซ้ำได้)

- [ ] ทุก scenario ที่ plan มี `traces_down.entities` ไม่ว่าง (+ use_cases/apis ตามเหมาะ)
- [ ] ทุก entity ใน ER อยู่ใน Data Dictionary และกลับกัน (ไม่มี orphan)
- [ ] FK type ตรงกับ PK ที่อ้างถึง
- [ ] use case trace กลับ scenario goal ได้ / postcondition วัดผลได้
- [ ] ไม่มีการออกแบบหน้าจอ (มีแค่ sitemap node — หน้าจอเป็นงาน ui-mockup)
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
```

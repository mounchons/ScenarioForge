# solution-arch — คู่มือใช้งาน (ภาษาไทย)

> Phase 3 (Solutioning) / Tier 1 ของ ScenarioForge · v0.1.0
> เนื้อหา skill จริงเป็นภาษาอังกฤษเพื่อประหยัด token ส่วนคู่มือนี้เป็นไทย

## solution-arch ทำอะไร

แปลง "โดเมนที่ออกแบบไว้แล้ว" → **feature units (FE-xxx)** ที่ลงมือเขียนโค้ดต่อได้ทันที ลง `features.json`

- **อ่านจาก scenario:** `traces_down.entities` + `apis` (จาก domain-design) + `pages` (จาก screen-binding)
- **ผลิต:** `features.json` — รายการ FE พร้อม layering (controller / service-handler / repository / DI / DTO)
- **เขียนกลับ:** `traces_down.features[]` พร้อม `scenario_ref` ร้อย spine ต่อ

**เส้นแบ่งที่ต้องจำ:** `domain-design = "อะไร"` (entity/DD/api) · `solution-arch = "ประกอบยังไง"` (layering/feature)

**Analogy (.NET):** domain-design วาง Entity + EF mapping เสร็จ → solution-arch ตัดสินว่าแต่ละ feature มี
`Controller → Handler(MediatR)/IService → IRepository` ตัวไหน ผูก DI ยังไง แตก vertical slice เป็น FE ใด —
**แต่ยังไม่เขียน body จริง** (นั่นงาน implement)

## ติดตั้ง

```
/plugin marketplace add D:\ProjectClaude\ScenarioForge
/plugin install solution-arch@scenarioforge
```

## เรียกใช้งาน

แบบ implicit (Claude route จาก description):
```
แตก features จาก scenario module billing
```

แบบ explicit:
```
/solution-arch:solution-arch
```

ตัวอย่าง prompt ใช้งานจริง:
```
อ่าน scenarios.json + design/ ของ module billing
แตกทุก scenario ที่มี traces_down.entities แล้ว เป็น features.json
ระบุ layering ตาม stack ASP.NET Core MVC + MediatR
แล้วเขียน traces_down.features กลับ scenarios.json
```

QUICK (งานเล็ก แตก FE เดียว):
```
solution-arch QUICK: SC-billing-003 อย่างเดียว
```

## สิ่งที่มันจะทำ / ไม่ทำ

ทำ:
- แตก scenario → FE แบบ vertical slice (1 capability = 1 FE ไม่ใช่แยกตาม layer)
- วาง layering ของแต่ละ FE ตาม stack พี่ปู
- ตั้ง `depends_on` (ลำดับ build) + `acceptance_refs` (ผูก AC ให้ qa derive test)
- เขียน `features.json` + อัปเดต `traces_down.features`

ไม่ทำ (boundary):
- ไม่สร้าง/แก้ entity, Data Dictionary, API (ของ domain-design) — ถ้าขาด = บันทึก gap ใน `features-notes.md` แล้วหยุด **ไม่เดา**
- ไม่ออกแบบหน้าจอ (ของ screen-binding) — อ่าน page ได้ แต่ไม่แก้
- ไม่เขียนโค้ด/เทสต์จริง (ของ implement / qa-*)
- ไม่ re-plan scenario ที่ `status=locked` เงียบๆ

## Scale

| Scale | พฤติกรรม |
|---|---|
| QUICK | ปกติข้าม (ไป implement ตรง) — รันเฉพาะเมื่อสั่งชัด แตก FE เดียว |
| STANDARD | default — แตกทุก scenario ในโมดูล พร้อม layering + dependency |
| ENTERPRISE | + ตรวจ dependency graph (ไม่มี cycle) + cross-cutting (auth/transaction ต่อ FE) |

## ถ้าเจอ gap (design ขาด)

solution-arch จะ **ไม่เดา** — บันทึกลง `features-notes.md` พร้อม scenario_ref แล้วข้าม FE นั้น
ส่งกลับให้ domain-design เติม entity/api ที่ขาดก่อน นี่คือพฤติกรรมที่ถูกต้อง

## ลำดับงานในสาย ScenarioForge

```
scenario-discovery → domain-design → screen-binding → [solution-arch] → implement → qa-ui-test
```
หลัง solution-arch เสร็จ → implement หยิบ `features.json` ไปเขียนโค้ด (+ verification step 8: Scenario Trace Check)

## หลังแก้ skill นี้

อย่าลืม `save brain` เพื่อบันทึกโน้ต "ScenarioForge - solution-arch Plugin (Phase 3)" + อัปเดต TODO ใน Master Spec

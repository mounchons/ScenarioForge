# คู่มือใช้งาน — screen-binding (ScenarioForge Phase 2 / UI) — v0.2.0

> Plugin ตัวที่ 3 ของ ScenarioForge | Tier 1 Workflow Worker | เปลี่ยนชื่อมาจาก `ui-mockup`
> เนื้อหาภายใน skill เขียนเป็นภาษาอังกฤษ (ประหยัด token) — คู่มือนี้เป็นภาษาไทยสำหรับพี่ปู
> **v0.2.0:** เพิ่ม theme-first (master page เป็นงานหลัก) + HTML mockup (frontend-design) + คุยสองทางกับ Claude Design

---

## 1. ตัวนี้ทำอะไร (พูดสั้นๆ)

`screen-binding` = **ตัวสร้าง UI mockup + ผูกหน้าจอเข้า scenario spine**

- domain-design (Phase 2 ก่อนหน้า) ผลิต **sitemap** (นำทาง) + **Data Dictionary** (field)
- `screen-binding` เอามาสร้าง **UI ที่เห็นได้จริง** แล้วเขียน `traces_down.pages` กลับ scenarios.json
- ทำเฉพาะ scenario ที่ `business.has_ui == true`

**สำคัญสุด — ทำ theme/master page ก่อนเสมอ** แล้วค่อยทำหน้าจอ (ดูข้อ 2)

**Analogy (.NET):** shell = `_Layout.cshtml` + site.css + `_NavMenu` (ทำก่อนเพราะทุก View แขวนกับมัน) / แต่ละ PG-* = Razor View ที่ bind กับ ViewModel (field ผูก DD; field ที่ไม่มีใน DD = compile error → surface เป็น gap)

---

## 2. ⭐ Theme-first: ทำ master page / theme / navbar ก่อน (ข้อ 1)

ก่อนทำหน้าจอใดๆ ตัว skill จะสร้าง **shell** เป็น HTML ที่เปิดดูได้จริงก่อน:

```
mockups/shell/
├── _layout.html   ← master page (= _Layout.cshtml)
├── theme.css      ← brand ต่อโปรเจกต์ (= site.css)
├── nav.js         ← navbar + menu nav สร้างจาก sitemap (= _NavMenu partial)
└── index.html     ← หน้าตัวอย่างไว้เช็คว่า shell เปิดแล้วสวย
```

- **เทค: Bootstrap 5 ล้วน** — ตรง stack จริง (ASP.NET Core MVC + Bootstrap 5 + jQuery) → ตอน implement เอาไปเป็น `_Layout.cshtml` ได้ตรงๆ ไม่ต้องแปลง framework
- **theme: brand ต่อโปรเจกต์** — แต่ละงานเลือกสี/ฟอนต์เอง ผ่าน **frontend-design skill** (ไม่ใช้สไตล์สำเร็จรูปตายตัว) เก็บ brand ไว้ที่ `theme.css` ที่เดียว restyle ทีหลังแก้ไฟล์เดียว
- **navbar + menu nav** สร้างจาก sitemap → เมนูสะท้อนโครงหน้าจริง + role ที่เห็นได้

ใช้ command:
```
/theme        ← สร้าง (หรือ restyle) shell อย่างเดียว
```

---

## 3. แต่ละหน้าจอ — เลือก fidelity ได้ (ข้อ 2)

หลัง shell มีแล้ว ทุกหน้า `has_ui` extend shell แล้วเลือกความละเอียด 2 แบบ:

| fidelity | คือ | ใช้เมื่อ | reference |
|---|---|---|---|
| **wireframe** (low-fi) | placeholder โครงสร้างเร็วๆ จาก DD | ตกลงโครงช่วงแรก / เน้นเร็ว | wireframe-rules.md |
| **html** (hi-fi) | หน้า Bootstrap 5 จริง สไตล์ตาม theme | อยากเห็นของจริง / demo / ENTERPRISE | html-mockup.md |

**HTML mockup ใช้ frontend-design skill** ตามที่สั่ง — ทำ brand/design ตั้งใจ ไม่ template สำเร็จรูป
ทั้งสองแบบ binding (PG-*) เหมือนกัน ต่างแค่ field `fidelity` → สลับ wireframe→html ทีหลังได้โดยไม่ต้องผูกใหม่

---

## 4. ⭐ คุยกับ Claude Design ได้ "สองทาง" (ข้อ 3)

### ทาง OUT — เขียน prompt บอก Claude Design ว่าหน้าจอต้องมีอะไร (ใหม่)
```
/design-prompt              ← เขียน prompt ทุกหน้า has_ui
/design-prompt SC-billing-001   ← เฉพาะ scenario เดียว
```
ได้ไฟล์ `mockups/prompts/PG-*.md` — ในนั้นบอกครบ: purpose (จาก business.goal), **fields (จาก DD พร้อม type/required)**, actions (จาก use case), roles, states (empty/loading/error), theme tokens. พี่ปูก๊อปไปวางใน claude.ai/design ได้เลย → design ที่ได้ตรง contract ตั้งแต่แรก

### ทาง IN — import bundle กลับมาผูก spine (เดิม + ปรับ)
```
/import-design D:\...\handoff
```
Export จาก Claude Design (Handoff to Claude Code / .zip / standalone HTML) → map page→sitemap→scenario_ref + ดึง token + ผูก field เข้า DD → ชี้ไฟล์จริง (ไม่แปลงเป็นโค้ด production)

> **ปิด loop ได้:** spine → prompt → Claude Design → bundle → import → หน้าจอผูก scenario
> ถ้าเคยออก prompt ไว้ (claude-design-pending) พอ import จะ upgrade PG-* ตัวเดิมให้อัตโนมัติ

**Claude Design export ปัจจุบัน (เช็ก 2026-06-13):** zip / PDF / PPTX / Canva / standalone HTML / Handoff to Claude Code bundle — ไม่มี Figma, ไม่มี PNG. bundle = ดีสุด (มี design files + tokens + component + intent ต่อหน้า)

---

## 5. วิธีติดตั้ง + prompt ตัวอย่าง

```
/plugin marketplace add D:\ProjectClaude\ScenarioForge
/plugin install screen-binding@scenarioforge
```

**flow ทั่วไป (theme ก่อน → หน้าจอ):**
```
brain ScenarioForge screen-binding
ทำ theme + master page จาก sitemap ก่อน แล้ว mockup หน้าจอ has_ui เป็น html ให้หน่อย
```

**อยากเขียน prompt ส่ง Claude Design:**
```
brain ScenarioForge screen-binding
เขียน Claude Design prompt ให้ทุกหน้าที่มี UI
```

**มี design จาก Claude Design แล้ว:**
```
/import-design D:\ProjectClaude\MyApp\design-handoff
```

**เงื่อนไขก่อนรัน:** ต้องมี `scenarios.json` + `design/sitemap.md` (จาก domain-design) ก่อน

---

## 6. Trigger keywords

screen-binding, ui-mockup, master page, layout, navbar, menu, theme, css, Bootstrap, wireframe, html mockup,
Claude Design, design handoff, design prompt, bind screens, import Claude Design

---

## 7. ขอบเขต (สิ่งที่ตัวนี้ "ไม่ทำ")

- ❌ ไม่สร้าง scenario / ไม่แตะ `business{}` `analysis{}` (= scenario-discovery)
- ❌ ไม่เขียน `entities/use_cases/apis` (= domain-design) — ตัวนี้ **อ่าน/ใช้**
- ❌ ไม่เขียน `features` (= solution-arch/implement)
- ❌ **ไม่ invent field ที่ไม่มีใน Data Dictionary** — เจอ field ขาด = รายงาน gap ส่งกลับ domain-design
- ❌ mockup คือ mockup: Bootstrap 5 + JS เล็กน้อยเพื่อ look/flow เท่านั้น — ไม่เขียน data access / auth จริง / server logic (= implement อ่าน page ไปสร้างจริง)
- ❌ ไม่แปลง HTML จาก bundle เป็นโค้ด production
- ❌ ไม่แตะ shell / หน้าจอของ scenario ที่ `status=locked` ใน UPDATE mode
- ✅ เขียน `traces_down.pages[]` อย่างเดียว

---

## 8. scale-adaptive (อ่าน meta.effort_scale)

| Scale | ทำอะไร |
|---|---|
| QUICK | ปกติข้ามทั้ง Phase 2 (รันเฉพาะสั่งชัด) |
| STANDARD | shell (master page+theme+nav) + 1 หน้า/sitemap node (default = wireframe) |
| ENTERPRISE | + html fidelity + design-token map + intent ต่อหน้า + states + role-visibility |

shell สร้างครั้งเดียวต่อโปรเจกต์ (reuse/update ได้) / fidelity ราย screen ปรับตาม scale

---

## 9. ผลลัพธ์ + ส่งต่อใคร

ไฟล์ออกที่ `mockups/` (shell/ + pages/ + wireframes/ + prompts/ + design-bundle/) + เพิ่มแถว `kind:shell`/`kind:page` ใน registry เดิม + เขียน `traces_down.pages`

**ส่งต่อ:** solution-arch (ประกอบ features จาก entities+apis+pages) → implement (เปลี่ยน shell→`_Layout.cshtml`, pages→Views จริง)

---

## 10. ไฟล์ในตัว plugin

```
plugins\screen-binding\
├── .claude-plugin\plugin.json
├── skills\screen-binding\
│   ├── SKILL.md                         (process หลัก, อังกฤษ — theme-first 2 ระยะ + 4 paths)
│   └── references\
│       ├── master-shell.md              (⭐ข้อ1: Bootstrap 5 master page + theme + navbar จาก sitemap)
│       ├── html-mockup.md               (ข้อ2: hi-fi ผ่าน frontend-design skill, extend shell, ผูก DD)
│       ├── wireframe-rules.md           (ข้อ2: low-fi, extend shell, DD→control)
│       ├── claude-design-bridge.md      (⭐ข้อ3: prompt-out + import สองทาง)
│       └── page-artifacts.md            (shape PG-*: fidelity/source/design_ref + เขียน traces_down.pages)
└── USER-GUIDE.md                        (คู่มือนี้)
```

## คำสั่งสรุป
| Command | ทำอะไร |
|---|---|
| `/theme` | สร้าง/restyle shell (master page + theme + nav) |
| `/design-prompt [SC-id]` | เขียน Claude Design brief ต่อหน้า |
| `/import-design <path>` | import bundle จาก Claude Design มาผูก spine |

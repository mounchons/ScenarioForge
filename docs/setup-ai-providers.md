# ตั้งค่า AI Providers สำหรับ Ideation Panel — API keys และ CLI

> คู่มือเสริมของ [user-guide.md](user-guide.md) ข้อ 7 — วิธีทำให้ persona ใน beat 1.5
> วิ่งบนโมเดลภายนอกได้จริง มี 2 ทางเลือก: **API** (ตั้ง key) หรือ **CLI** (ใช้ login ที่มีอยู่แล้ว)
> spec ฝั่ง plugin: `plugins/scenario-discovery/skills/scenario-discovery/references/persona-registry.md`

---

## 1. เลือกทางไหนดี — API vs CLI

| | **API** (`provider: openrouter/openai/...`) | **CLI** (`provider: "cli"`) |
| --- | --- | --- |
| ต้องมี | API key (ตั้งเป็น env variable) | CLI ติดตั้ง + login แล้วในเครื่อง |
| คิดเงิน | ตามจริง per-token | เหมาผ่าน subscription เดิม (ChatGPT/Google/Claude ฯลฯ) |
| เลือกโมเดล | ระบุใน registry (`model`) — ยืดหยุ่นสุด | ตาม flag ของ CLI นั้น |
| ความนิ่งของ JSON | สูงกว่า (บาง endpoint บังคับ JSON ได้) | CLI อาจพ่น log ปน — runner ดึง JSON ก้อนสุดท้ายให้ |
| ข้อมูลออกนอกเครื่อง | ออก (ยกเว้น `ollama`) | ออกตามค่ายของ CLI นั้น |
| เหมาะกับ | คุมโมเดล/ราคาละเอียด, ollama แบบ local | มี subscription อยู่แล้ว ไม่อยากจ่าย API เพิ่ม |

ใช้ปนกันได้ — persona แต่ละ row เลือก provider ของตัวเอง

---

## 2. ทางที่ 1: ตั้ง API key (ตัวอย่าง OpenRouter)

### 2.1 ไปเอา key มาจากไหน

| Provider | สมัคร/สร้าง key ที่ | env variable ที่ต้องตั้ง |
| --- | --- | --- |
| OpenRouter (แนะนำ — key เดียวเรียกได้ทุกค่าย รวม `anthropic/*`, `google/*`) | `openrouter.ai` → Keys | `OPENROUTER_API_KEY` |
| OpenAI | `platform.openai.com` → API keys | `OPENAI_API_KEY` |
| Google Gemini | `aistudio.google.com` → Get API key | `GEMINI_API_KEY` |
| DeepSeek | `platform.deepseek.com` | `DEEPSEEK_API_KEY` |
| Groq | `console.groq.com` → API Keys | `GROQ_API_KEY` |
| xAI | `console.x.ai` | `XAI_API_KEY` |
| Ollama (local — ไม่ต้องมี key) | ติดตั้งจาก `ollama.com` แล้ว `ollama pull <model>` | — |
| Custom (เซิร์ฟเวอร์ OpenAI-compatible อื่น) | — | `PERSONA_BASE_URL` + `PERSONA_API_KEY` |

### 2.2 ตั้ง env variable บน Windows

**แบบถาวร (แนะนำ)** — PowerShell:

```powershell
setx OPENROUTER_API_KEY "sk-or-v1-xxxxxxxxxxxxxxxx"
```

> ⚠️ สำคัญ: `setx` มีผลกับ **process ใหม่เท่านั้น** — ต้องปิด terminal/Claude Code
> แล้วเปิดใหม่ก่อน key ถึงจะมองเห็น

หรือผ่าน GUI: `Win + R` → `sysdm.cpl` → Advanced → Environment Variables → New (User variables)

**แบบชั่วคราว (เฉพาะ session นี้)** — ใช้ทดลองก่อนตั้งจริง:

```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-xxxxxxxxxxxxxxxx"
```

**ตรวจว่าตั้งติดแล้ว:**

```powershell
$env:OPENROUTER_API_KEY          # ต้องพิมพ์ค่า key ออกมา
```

### 2.3 ตั้งบน macOS / Linux (เผื่อใช้ต่างเครื่อง)

```bash
echo 'export OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxx"' >> ~/.bashrc   # หรือ ~/.zshrc
source ~/.bashrc
echo "$OPENROUTER_API_KEY"       # ตรวจ
```

### 2.4 เพิ่ม persona แบบ API ลง registry

สร้าง/แก้ `.scenarioforge/personas.json` ที่ root ของ project ที่ใช้งาน:

```jsonc
{
  "version": 1,
  "script": "plugins/scenario-discovery/scripts/persona-call.sh",
  "panel": [
    { "id": "ux-researcher", "role": "domain_ideation", "provider": "openrouter",
      "model": "google/gemini-2.5-flash", "enabled": true,
      "focus": "user friction, accessibility, empty states" }
  ]
}
```

> ชื่อ `model` ในตัวอย่างเป็นแค่ illustrative — เช็ค catalog ปัจจุบันของค่ายก่อนใช้
> (OpenRouter ดูได้ที่หน้า Models ของเว็บ)

### 2.5 ทดสอบ key ตรงๆ ก่อนใช้จริง (ไม่ต้องรอ pipeline)

```bash
# สร้าง payload ทดสอบ แล้วยิงผ่าน script ของ plugin โดยตรง
cat > /tmp/test-payload.json <<'EOF'
{ "model": "google/gemini-2.5-flash",
  "messages": [ { "role": "user", "content": "reply with exactly: {\"ok\":true}" } ] }
EOF
bash plugins/scenario-discovery/scripts/persona-call.sh openrouter /tmp/test-payload.json 60
```

ได้ JSON response กลับมา = key ใช้ได้ · exit code `3` = key ยังไม่ถูกตั้ง/ยังไม่ได้เปิด terminal ใหม่

### 2.6 กติกาความปลอดภัยของ key

- key อยู่ใน **env variable เท่านั้น** — ห้ามใส่ใน `personas.json`, ห้าม commit ลง repo
- `personas.json` จึง commit ได้อย่างปลอดภัย (มีแต่ชื่อ persona/provider/model)
- script ไม่มีวัน print key ออก log
- อยากได้ความเป็นส่วนตัวสูงสุด (requirement ไม่ออกนอกเครื่อง) → ใช้ `provider: "ollama"`

---

## 3. ทางที่ 2: ใช้ CLI ในเครื่องเป็น persona (codex / opencode / gemini / claude)

ถ้าคุณ login CLI พวกนี้ไว้แล้ว persona วิ่งบนมันได้เลย **ไม่ต้องมี API key** —
ค่าใช้จ่ายไปกับ subscription เดิม และได้ context สดแยกขาดต่อการเรียก (isolation ดีเท่า API)

### 3.1 ติดตั้ง + login (ครั้งแรกครั้งเดียวต่อเครื่อง)

```text
# Codex CLI (OpenAI) — ใช้บัญชี ChatGPT
npm install -g @openai/codex
codex          # ครั้งแรกจะพา login

# OpenCode — เลือกต่อ provider ได้หลายค่าย
npm install -g opencode-ai
opencode auth login

# Gemini CLI (Google) — ตัวนี้คือทาง headless ของสาย Antigravity (โมเดลเดียวกัน)
npm install -g @google/gemini-cli
gemini         # ครั้งแรกจะพา login Google

# Claude Code — มีอยู่แล้วบนเครื่องนี้ (คำสั่ง claude)
```

> **หมายเหตุ Antigravity:** Antigravity เป็น IDE (agentic editor ของ Google) ไม่ใช่คำสั่ง headless —
> ตัวที่ใช้ในสคริปต์แบบ non-interactive คือ `gemini` CLI ซึ่งใช้โมเดลตระกูลเดียวกัน
> ถ้ารุ่นที่คุณใช้มีคำสั่ง CLI ของตัวเอง ใส่ template เพิ่มเองได้เลย (ข้อ 3.2 — field อิสระ)

### 3.2 เพิ่ม persona แบบ CLI ลง registry

ใช้ `provider: "cli"` + `command` เป็น template ที่มี `{PROMPT_FILE}` (ตำแหน่งไฟล์ prompt ที่ระบบจะแทนให้):

```jsonc
{
  "version": 1,
  "panel": [
    { "id": "codex-skeptic", "role": "feasibility_review", "provider": "cli",
      "command": "codex exec --sandbox read-only \"$(cat {PROMPT_FILE})\"",
      "enabled": true,
      "focus": "second-opinion feasibility from a different model family" },

    { "id": "opencode-po", "role": "scope_prioritization", "provider": "cli",
      "command": "opencode run \"$(cat {PROMPT_FILE})\"",
      "enabled": true,
      "focus": "MVP slicing and priority conflicts" },

    { "id": "gemini-domain", "role": "domain_ideation", "provider": "cli",
      "command": "gemini -p \"$(cat {PROMPT_FILE})\"",
      "enabled": true,
      "focus": "missing domain events and vocabulary" },

    { "id": "claude-fresh-eyes", "role": "domain_ideation", "provider": "cli",
      "command": "claude -p \"$(cat {PROMPT_FILE})\"",
      "enabled": false,
      "focus": "fresh-context review on Claude without any API key" }
  ]
}
```

Template ที่ทดสอบแล้วต่อ CLI:

| CLI | `command` template | หมายเหตุ |
| --- | --- | --- |
| Codex | `codex exec --sandbox read-only "$(cat {PROMPT_FILE})"` | คง `--sandbox read-only` ไว้เสมอ |
| OpenCode | `opencode run "$(cat {PROMPT_FILE})"` | เลือกโมเดล: เติม `--model <provider/model>` |
| Gemini | `gemini -p "$(cat {PROMPT_FILE})"` | login Google หรือใช้ `GEMINI_API_KEY` ก็ได้ |
| Claude | `claude -p "$(cat {PROMPT_FILE})"` | print mode — ไม่แตะไฟล์โดย default |

CLI อื่นก็ใช้ได้ ขอแค่รับ prompt แบบ non-interactive แล้วพิมพ์คำตอบออก stdout

### 3.3 ระบบกัน CLI ทำเกินหน้าที่ (สำคัญ)

CLI พวกนี้เป็น **agentic** — ปกติมันแก้ไฟล์/รันคำสั่งได้ ระบบจึงกันไว้ 3 ชั้น:

1. **Read-only flag** — template แนะนำใส่ flag จำกัดสิทธิ์ของ CLI นั้น (เช่น `--sandbox read-only`)
2. **Empty working directory** — `persona-cli-call.sh` รัน CLI ใน temp dir เปล่าเสมอ
   ต่อให้มันอยากใช้ file tools ก็ไม่มีอะไรให้อ่าน/เขียน
3. **Output = untrusted data** — คำตอบถูก validate เข้ารูป suggestion เท่านั้น
   คำสั่งใดๆ ที่ฝังมาในคำตอบถูกเพิกเฉย (กติกาเดียวกับ API)

### 3.4 ทดสอบ CLI persona ตรงๆ ก่อนใช้จริง

```bash
echo 'reply with exactly: {"ok":true}' > /tmp/test-prompt.txt
bash plugins/scenario-discovery/scripts/persona-cli-call.sh \
  'codex exec --sandbox read-only "$(cat {PROMPT_FILE})"' /tmp/test-prompt.txt 120
```

ได้ข้อความที่มี `{"ok":true}` กลับมา = พร้อมใช้ · exit `6` = ยังไม่ได้ติดตั้ง CLI ตัวนั้น

---

## 4. Troubleshooting

| อาการ | สาเหตุ/ทางแก้ |
| --- | --- |
| persona ถูก `skipped` + exit 3 | key ยังไม่ถูกตั้ง หรือ `setx` แล้วยังไม่เปิด terminal/Claude Code ใหม่ |
| exit 5 (API) | HTTP error — ดู stderr: 401=key ผิด, 402/429=เครดิต/rate limit, 404=ชื่อ `model` ผิด |
| exit 6 (CLI) | CLI ไม่อยู่บน PATH — ติดตั้งตามข้อ 3.1 แล้วเปิด terminal ใหม่ |
| exit 5 (CLI) | CLI พัง/timeout — ลองรันคำสั่งเดิมเองตรงๆ ดู error, เพิ่ม timeout เป็น arg ที่ 3 |
| CLI ตอบมามี log ปน JSON | ปกติ — runner ดึง JSON ก้อนสุดท้ายจาก stdout ให้เอง |
| อยากรู้ว่า persona ไหนรัน/ข้ามไปบ้าง | ดู handoff ของ panel (`skipped:` list) หรือ `analysis.contributors` ใน `scenarios.json` |

---

## 5. สรุปสั้น

1. **มี subscription CLI อยู่แล้ว** → ทาง CLI (ข้อ 3) เร็วสุด ไม่มีค่าใช้จ่ายเพิ่ม
2. **อยากคุมโมเดลละเอียด/หลายค่ายด้วย key เดียว** → OpenRouter (ข้อ 2) — `setx OPENROUTER_API_KEY "..."` แล้วเปิด terminal ใหม่
3. **ข้อมูลห้ามออกนอกเครื่อง** → `ollama` (API แบบ local, ไม่ต้องมี key)
4. ทดสอบด้วยคำสั่งในข้อ 2.5 / 3.4 ก่อนเสมอ — เร็วกว่ารอทั้ง pipeline แล้วค่อยรู้ว่า key ผิด

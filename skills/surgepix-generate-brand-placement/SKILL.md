---
name: surgepix-generate-brand-placement
description: >-
  Generate new campaign images with Logo and/or locked copy placed on a 9-grid via SurgePix. Use when the user says "品牌落位", "品牌落位文生图", "logo落位", "把logo放到右上角", "固定文案落位", "brand placement", or wants a new scene with a brand logo and/or fixed text anchored to a corner. Language: write --prompt and --fixed-text in the user's conversation language. Output rule: show ONLY the download URL from script stdout verbatim in a code block; single image = image URL, count>1 = ZIP URL; NEVER fabricate or retype URLs. Do NOT use for event posters (surgepix-generate-poster), logo-only (surgepix-generate-logo), general 改图 (surgepix-image-edit), or cropping a finished KV to channel sizes (surgepix-channel-crop).
---

# SurgePix Generate Brand Placement

Generate **new** scene images from a prompt, then constrain brand Logo and/or locked copy to independent 9-grid anchors. This is text-to-image with placement constraints — **not** photo edit, **not** pixel-perfect overlay.

## Language consistency

Match the **user's conversation language** for `--prompt` and `--fixed-text` — unless the user explicitly requests another language.

| User writes in | Write `--prompt` / `--fixed-text` in |
|----------------|--------------------------------------|
| English | English |
| 中文 | 中文 |
| 日本語 | 日本語 |

- Reply to the user in the same language they used in their request.
- `--fixed-text` is printed **verbatim** on the image — do not translate it unless the user asks.

## Skill router (read first)

| Use this skill | Use something else |
|----------------|-------------------|
| New scene + Logo / 固定文案 九宫格落位 | **surgepix-generate-poster** for 活动海报 (name / date / venue) |
| "把 logo 放到右上角，文案放左下" | **surgepix-generate-logo** for 只做标志 / 透明底 logo |
| 品牌落位文生图 / brand placement | **surgepix-image-edit** for 改已有图（无锁定落位） |
| | **surgepix-channel-crop** for 已定稿 KV 按渠道尺寸裁切 |

**Do NOT use this skill** to edit an existing photo, to crop a finished KV, or to generate a standalone logo.

## When to use

- User says "品牌落位", "品牌落位文生图", "logo落位", "固定文案落位", "brand placement"
- User wants a **new** campaign / product scene and specifies where the logo and/or locked copy should sit
- User provides a logo file/URL and/or exact on-image copy (hours, slogan, URL)

## Prerequisites

- Node.js >= 18
- `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` configured (see **surgepix-setup**)

---

## What the Skill Does

| Action | Description |
|--------|-------------|
| Generate scene | Create new images from `--prompt` with Logo / locked-copy anchors |
| Upload assets | Local `--logo` / `--reference` paths are uploaded automatically (API accepts URLs only) |
| Check task status | With `--nowait true`, resolve via **surgepix-query-task** |
| Download result | Return the `download` URL — 1 image = PNG URL; `count`>1 = ZIP |

> The script **always submits asynchronously** to the API (`noWait=true`). CLI `--nowait` controls local behavior:
> - `--nowait false` (default) — poll until `succeeded`/`failed` and return `download`
> - `--nowait true` — return `taskId` immediately; use **surgepix-query-task** later

---

## Setup

**Requirement:** Set `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` (see **surgepix-setup**). Do **not** ask the user to paste the API key into chat.

```bash
# project-root .env
SURGEPIX_API_KEY=your-token
SURGEPIX_BASE_URL=https://api.surgepix.ai/api
```

Script path: `<skills-dir>/surgepix-generate-brand-placement/scripts/generate_brand_placement.mjs`.

---

## Usage Examples

**Logo + locked copy (sync):**
```bash
node "<skills-dir>/surgepix-generate-brand-placement/scripts/generate_brand_placement.mjs" \
  --prompt "干净的夏日饮品海报，柔和日光" \
  --logo ./brand-logo.png \
  --fixed-text "OPEN FRI-SUN | 18:00-23:00" \
  --logo-anchor top-right \
  --text-anchor bottom-left \
  --size 1080x1350
# {"ok":true,"taskId":"task_xxx","sessionId":123,"progress":"succeeded","download":"<DOWNLOAD_URL>"}
# `<DOWNLOAD_URL>` 仅为文档占位；真实 HTTPS 下载地址以脚本 stdout 为准。
```

**Logo only, three variants:**
```bash
node "<skills-dir>/surgepix-generate-brand-placement/scripts/generate_brand_placement.mjs" \
  --prompt "Minimal cafe interior, morning light" \
  --logo <LOGO_URL> \
  --logo-anchor top-left \
  --count 3 \
  --size 1024x1024
```

**Async:**
```bash
node "<skills-dir>/surgepix-generate-brand-placement/scripts/generate_brand_placement.mjs" \
  --prompt "..." \
  --logo ./brand-logo.png \
  --nowait true
# Then: node "<skills-dir>/surgepix-query-task/scripts/query_task.mjs" <taskId>
```

---

## Workflow

### Step 0: Check environment

```bash
node "<skills-dir>/surgepix-setup/scripts/check_env.mjs"
```

- Exit 0 → continue
- Exit 1 → follow **surgepix-setup** (user writes `.env` themselves)

### Step 1: Collect inputs

- **Required:** scene description → `--prompt` (must **not** contradict anchors)
- **Required (at least one):** `--logo` and/or `--fixed-text`
- **Optional:** `--logo-anchor` / `--text-anchor` (default `top-right`; ignored if the matching asset is omitted)
- **Optional:** `--reference` (style only, 0–5; **not** a base image, does **not** change output count)
- **Optional:** `--count` (1–9, default 1), `--size` (default `1024x1024`), `--session-id`, `--nowait`

### Step 2: Run

```bash
node "<skills-dir>/surgepix-generate-brand-placement/scripts/generate_brand_placement.mjs" \
  --prompt "<text>" \
  [--logo <path-or-url>] \
  [--fixed-text "<text>"] \
  [--logo-anchor <anchor>] \
  [--text-anchor <anchor>] \
  [--reference <path-or-url> ...] \
  [--count <1-9>] \
  [--size <WxH>] \
  [--session-id <id>] \
  [--nowait <true|false>]
```

### Step 3: Present result

- Success: paste **only** the `download` value from script stdout **verbatim** inside a fenced code block. Do **not** retype the hostname; do **not** invent per-image URLs when the result is a ZIP.
- Always show `sessionId` (number) for retries.
- Async: show `taskId` + hint to use **surgepix-query-task**
- Never invent image URLs; never echo API keys

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--prompt` | Yes | — | Scene description; cannot override anchors |
| `--logo` | Conditional | — | Logo path or URL; at least one of `--logo` / `--fixed-text` |
| `--fixed-text` | Conditional | — | Locked copy printed verbatim |
| `--logo-anchor` | No | `top-right` | Logo 9-grid; ignored without `--logo` |
| `--text-anchor` | No | `top-right` | Copy 9-grid; ignored without `--fixed-text` |
| `--reference` | No | — | Style reference path or URL (repeatable, max 5; not a base image) |
| `--count` | No | `1` | Output images 1–9; `>1` returns a ZIP |
| `--size` | No | `1024x1024` | Target `WxH` → API `[width, height]` |
| `--session-id` | No | auto | Reuse session on iteration |
| `--nowait` | No | `false` | `true` = return `taskId` only |

### Anchor values

`top-left` / `top-center` / `top-right` / `middle-left` / `center` / `middle-right` / `bottom-left` / `bottom-center` / `bottom-right`

- Same anchor for both: one region, **Logo above, copy below**.
- Different anchors: each sits in its own cell.
- Placement is a model constraint, **not** pixel-perfect coordinates.

---

## Notes

- Calls `POST /tasks/generate-brand-placement` (backend task API), not `/skills/*`.
- `--reference` is **style only** (light / texture / mood). Do not treat it as a base image; output count is `--count`, not reference count.
- Backend accepts **URL-only** assets; **never** pass local paths in the API body — the script uploads them.
- Download links may expire; tell the user to save promptly.
- On missing env → **surgepix-setup**, do not collect secrets in chat.

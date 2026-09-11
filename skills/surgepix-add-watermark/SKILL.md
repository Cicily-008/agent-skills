---
name: surgepix-add-watermark
description: >-
  Overlay a full-bleed watermark on finished PNG artwork (contain + center). Use when the user says "素材叠加全幅水印", "叠加水印", "加水印", "全幅水印", "overlay watermark", "add watermark", or already has a photo plus a watermark PNG. REQUIRED next step: run scripts/add_watermark.mjs with --image and --watermark. NEVER Pillow/bash/composite/ImageMagick. Not add-logo (corner mark). Not generate-brand-placement. PNG only.
---

# SurgePix Add Watermark

Take **finished** PNG artwork (local path or URL) and overlay a **watermark PNG** as large as possible without overflowing, then center it. Pure geometry — no generative model, no restyle, no tile, no stretch.

## Required first action

When this skill applies, the **next tool call** is the script below — not Pillow, not `composite`, not ImageMagick:

```bash
node "<skills-dir>/surgepix-setup/scripts/check_env.mjs"
node "<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs" \
  --image "<USER_BASE_PNG>" \
  --watermark "<USER_WATERMARK_PNG>" \
  --opacity 0.25
```

Default opacity **`0.25`**. There is **no** 9-grid — the watermark is always contain-scaled and centered. One local file each is enough.

**Hard rule:** existing artwork + 叠加/加 + 全幅水印 / watermark → this script. Do **not** composite with Pillow, bash, ImageMagick, `composite`, OpenCV, or a one-off Python script.

## Language consistency

This skill has **no on-image copy**. Reply to the user in the same language they used.

## Skill router (read first)

| Use this skill | Use something else |
|----------------|-------------------|
| 已有底图 + 已有水印图 → 全幅居中半透明叠加 | **surgepix-add-logo** for 角落 / 九宫格 **角标 Logo** |
| 「给这张图加全幅水印」 | **surgepix-generate-brand-placement** to **generate a new scene** |
| 素材叠加全幅水印 / overlay watermark | **surgepix-image-edit** to redraw / restyle a photo |

**Do NOT use this skill** to place a small corner logo (use **surgepix-add-logo**), invent a new scene, or generate a logo.

**Do NOT send watermark jobs to add-logo or brand-placement, and do NOT composite locally.** 「这张图 + 水印图 + 全幅/居中」= this skill. 「把 logo 贴到右上角」= **surgepix-add-logo**.

## When to use

- User says "素材叠加全幅水印", "叠加水印", "加水印", "全幅水印", "overlay watermark", "add watermark", "stamp a watermark"
- User drops a base image **and** a watermark file and wants it across the frame
- User wants a semi-transparent full-frame brand / copyright mark (contain + center)
- User specifies opacity (e.g. 25%、半透明、0.3)

If the user only says 加水印 / add watermark without opacity, use `--opacity 0.25`. If they clearly mean a **small corner logo**, switch to **surgepix-add-logo**.

## Red flags — STOP, do not composite locally

| Excuse | Reality |
|--------|---------|
| "Just paste the watermark with Pillow / ImageMagick" | Local composite skips the skill API. Run `add_watermark.mjs`. |
| "I'll tile it / stretch it to fill" | API is contain + center only. No tile, no stretch, no crop of the watermark. |
| "Corner logo, I'll use watermark at top-right" | Corner / 9-grid mark = **surgepix-add-logo**. This skill has no anchor. |
| "JPG is fine, I'll convert locally" | API is PNG-only. Ask for PNG or upload a PNG; do not convert with Pillow. |

## Prerequisites

- Node.js >= 18
- `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` configured (see **surgepix-setup**)
- Base images and watermark must be **PNG**, each file ≤ 20MB

---

## What the Skill Does

| Action | Description |
|--------|-------------|
| Overlay watermark | `scale = min(baseW/wmW, baseH/wmH)`, then center; multiply watermark alpha by opacity |
| Upload assets | Local `--image` / `--watermark` paths are uploaded automatically (API accepts URLs only) |
| Check task status | With `--nowait true`, resolve via **surgepix-query-task** |
| Download result | Return the `download` URL — 1 output = PNG URL; 2+ = ZIP |

> The script **always submits asynchronously** to the API (`noWait=true`). CLI `--nowait` controls local behavior:
> - `--nowait false` (default) — poll until `succeeded`/`failed` and return `download`
> - `--nowait true` — return `taskId` immediately; use **surgepix-query-task** later

Output count = number of `--image` files (1–8). Same watermark is applied to each base image.

---

## Setup

**Requirement:** Set `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` (see **surgepix-setup**). Do **not** ask the user to paste the API key into chat.

```bash
# project-root .env
SURGEPIX_API_KEY=your-token
SURGEPIX_BASE_URL=https://api.surgepix.ai/api
```

Script path: `<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs`.

---

## Usage Examples

**Local files → 25% full-bleed watermark:**
```bash
node "<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs" \
  --image /path/to/poster.png \
  --watermark /path/to/wm.png \
  --opacity 0.25
```

**Three posters, lighter watermark:**
```bash
node "<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs" \
  --image ./a.png --image ./b.png --image ./c.png \
  --watermark ./copyright.png \
  --opacity 0.15
# {"ok":true,"taskId":"task_xxx","sessionId":123,"progress":"succeeded","download":"<DOWNLOAD_URL>"}
# `<DOWNLOAD_URL>` 仅为文档占位；真实 HTTPS 下载地址以脚本 stdout 为准。多张结果为 ZIP。
```

**Remote URLs:**
```bash
node "<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs" \
  --image <IMAGE_URL> \
  --watermark <WATERMARK_URL>
```

**Async:**
```bash
node "<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs" \
  --image ./poster.png \
  --watermark ./wm.png \
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

- **Required:** at least one `--image` (finished base PNG, local path or URL; max 8)
- **Required:** `--watermark` (watermark PNG; **not** listed in `--image`)
- **Optional:** `--opacity` (0–1, default `0.25`)
- **Optional:** `--session-id`, `--nowait`

If the user says 半透明 / 25% without a number, keep `0.25`. Map 更淡 / lighter toward `0.1`–`0.15` only when they ask.

### Step 2: Run

```bash
node "<skills-dir>/surgepix-add-watermark/scripts/add_watermark.mjs" \
  --image <path-or-url> [--image ...] \
  --watermark <path-or-url> \
  [--opacity <0-1>] \
  [--session-id <id>] \
  [--nowait <true|false>]
```

### Step 3: Present result

- Success: paste **only** the `download` value from script stdout **verbatim** inside a fenced code block. Multiple images → ZIP; do **not** invent per-image URLs.
- Always show `sessionId` (number) for retries.
- Async: show `taskId` + hint to use **surgepix-query-task**
- Never invent image URLs; never echo API keys

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--image` | Yes (≥1) | — | Base PNG path or URL (repeatable, 1–8; local path auto-uploaded) |
| `--watermark` | Yes | — | Watermark PNG path or URL (do **not** put this in `--image`) |
| `--opacity` | No | `0.25` | `0`–`1`; multiplied onto the watermark alpha → API `watermarkOpacity` |
| `--session-id` | No | auto | Reuse session on iteration |
| `--nowait` | No | `false` | `true` = return `taskId` only |

Sizing is always **contain**: `scale = min(baseWidth / watermarkWidth, baseHeight / watermarkHeight)`. The watermark stays proportional, does not exceed the base on either axis, touches at least one side, and is centered. No 9-grid, no tile, no stretch.

---

## Notes

- Calls `POST /tasks/add-watermark` (backend task API), not `/skills/*`.
- Overlay is **pixel-accurate geometry**. No generative inpaint, no restyle.
- Backend accepts **URL-only** assets; **never** pass local paths in the API body — the script uploads them.
- PNG only, ≤20MB per file.
- Download links may expire; tell the user to save promptly.
- On missing env → **surgepix-setup**, do not collect secrets in chat.

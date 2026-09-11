---
name: surgepix-add-logo
description: >-
  Overlay an existing logo onto finished PNG artwork (corner / 9-grid). Use when the user says "素材叠加logo", "叠加logo", "贴logo", "把logo贴到右上角", "overlay logo", "add logo to this image", or already has a photo plus a logo file. REQUIRED next step: run scripts/add_logo.mjs with --image and --logo. NEVER Pillow/bash/composite/ImageMagick. Not generate-brand-placement (that generates a new scene). Not generate-logo (that creates a logo). PNG only.
---

# SurgePix Add Logo

Take **finished** PNG artwork (local path or URL) and overlay a **logo PNG** at a 9-grid cell. Pure geometry — no generative model, no restyle, no redraw.

## Required first action

When this skill applies, the **next tool call** is the script below — not Pillow, not `composite`, not ImageMagick:

```bash
node "<skills-dir>/surgepix-setup/scripts/check_env.mjs"
node "<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs" \
  --image "<USER_BASE_PNG>" \
  --logo "<USER_LOGO_PNG>" \
  --logo-size 12% \
  --logo-anchor top-right
```

Default size **`12%`** (short-side of that base image). Default anchor **`top-right`**. One local file each is enough.

**Hard rule:** existing artwork + 叠加/贴/overlay + logo → this script. Do **not** composite with Pillow, bash, ImageMagick, `composite`, OpenCV, or a one-off Python script.

## Language consistency

This skill has **no on-image copy**. Reply to the user in the same language they used.

## Skill router (read first)

| Use this skill | Use something else |
|----------------|-------------------|
| 已有底图 + 已有 Logo → 贴到角落 / 九宫格 | **surgepix-generate-brand-placement** to **generate a new scene** with logo/copy anchors |
| 「把 logo 贴到这张图右上角」 | **surgepix-generate-logo** to **create** a logo from a brand name |
| 素材叠加 logo / overlay logo | **surgepix-add-watermark** for 全幅居中水印（无九宫格） |
| | **surgepix-image-edit** to redraw / restyle a photo |

**Do NOT use this skill** to invent a logo, generate a new campaign scene, or stamp a full-bleed watermark.

**Do NOT send overlay jobs to brand-placement, and do NOT composite locally.** 「这张图 + logo + 贴/叠加」= this skill. 「生成新海报并把 logo 落在右上角」= **surgepix-generate-brand-placement**.

## When to use

- User says "素材叠加logo", "叠加logo", "贴logo", "把logo贴上去", "把logo放到右上角", "overlay logo", "add logo to this image", "stamp the logo"
- User drops a base image **and** a logo file and asks to place it
- User already has finished KV / 海报 / 配图 and wants a brand mark in a corner
- User names a 9-grid cell (`top-right`, 右上角, 左下, center, …)

If the user only says 右上角 / top-right without a size, use `--logo-size 12%` and `--logo-anchor top-right`.

## Red flags — STOP, do not composite locally

| Excuse | Reality |
|--------|---------|
| "Just paste the logo with Pillow / ImageMagick" | Local composite skips the skill API. Run `add_logo.mjs`. |
| "logo落位 means brand-placement" | Brand-placement **generates a new scene**. Existing artwork + logo overlay = this skill. |
| "I'll generate a new logo first" | If they already have a logo file, overlay it. Use generate-logo only when they need a new mark. |
| "Full-page watermark, I'll use this too" | Full-bleed centered watermark = **surgepix-add-watermark**. |
| "JPG is fine, I'll convert locally" | API is PNG-only. Ask for PNG or upload a PNG; do not convert with Pillow. |

## Prerequisites

- Node.js >= 18
- `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` configured (see **surgepix-setup**)
- Base images and logo must be **PNG**, each file ≤ 20MB

---

## What the Skill Does

| Action | Description |
|--------|-------------|
| Overlay logo | Place logo center on the chosen 9-grid cell; clamp if it would overflow |
| Upload assets | Local `--image` / `--logo` paths are uploaded automatically (API accepts URLs only) |
| Check task status | With `--nowait true`, resolve via **surgepix-query-task** |
| Download result | Return the `download` URL — 1 output = PNG URL; 2+ = ZIP |

> The script **always submits asynchronously** to the API (`noWait=true`). CLI `--nowait` controls local behavior:
> - `--nowait false` (default) — poll until `succeeded`/`failed` and return `download`
> - `--nowait true` — return `taskId` immediately; use **surgepix-query-task** later

Output count = number of `--image` files (1–8). Same logo is applied to each base image.

---

## Setup

**Requirement:** Set `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` (see **surgepix-setup**). Do **not** ask the user to paste the API key into chat.

```bash
# project-root .env
SURGEPIX_API_KEY=your-token
SURGEPIX_BASE_URL=https://api.surgepix.ai/api
```

Script path: `<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs`.

---

## Usage Examples

**Local files → logo on top-right (12%):**
```bash
node "<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs" \
  --image /path/to/poster.png \
  --logo /path/to/brand-logo.png \
  --logo-size 12% \
  --logo-anchor top-right
```

**Three posters, same logo, bottom-left:**
```bash
node "<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs" \
  --image ./a.png --image ./b.png --image ./c.png \
  --logo ./logo.png \
  --logo-size 12% \
  --logo-anchor bottom-left
# {"ok":true,"taskId":"task_xxx","sessionId":123,"progress":"succeeded","download":"<DOWNLOAD_URL>"}
# `<DOWNLOAD_URL>` 仅为文档占位；真实 HTTPS 下载地址以脚本 stdout 为准。多张结果为 ZIP。
```

**Fixed pixel size:**
```bash
node "<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs" \
  --image <IMAGE_URL> \
  --logo <LOGO_URL> \
  --logo-size 120x60 \
  --logo-anchor top-left
```

**Async:**
```bash
node "<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs" \
  --image ./poster.png \
  --logo ./logo.png \
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
- **Required:** `--logo` (logo PNG; **not** listed in `--image`)
- **Optional:** `--logo-size` (`12%` or `120x60`, default `12%`)
- **Optional:** `--logo-anchor` (9-grid, default `top-right`)
- **Optional:** `--session-id`, `--nowait`

If the user names a corner but not pixels, map 右上/左上/右下/左下/居中 to the table below.

### Step 2: Run

```bash
node "<skills-dir>/surgepix-add-logo/scripts/add_logo.mjs" \
  --image <path-or-url> [--image ...] \
  --logo <path-or-url> \
  [--logo-size <12%|WxH>] \
  [--logo-anchor <anchor>] \
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
| `--logo` | Yes | — | Logo PNG path or URL (do **not** put this in `--image`) |
| `--logo-size` | No | `12%` | `12%` = scale by that base image's short side, keep logo aspect; `120x60` = exact pixels (may change aspect) |
| `--logo-anchor` | No | `top-right` | 9-grid cell; logo **center** aligns to that cell's geometric center |
| `--session-id` | No | auto | Reuse session on iteration |
| `--nowait` | No | `false` | `true` = return `taskId` only |

### Anchor table

| User says | `--logo-anchor` |
|-----------|-----------------|
| 左上 / top-left | `top-left` |
| 上中 / top-center | `top-center` |
| 右上 / top-right | `top-right` |
| 左中 / middle-left | `middle-left` |
| 居中 / center | `center` |
| 右中 / middle-right | `middle-right` |
| 左下 / bottom-left | `bottom-left` |
| 下中 / bottom-center | `bottom-center` |
| 右下 / bottom-right | `bottom-right` |

If the logo would overflow, it is clamped back onto the canvas. The base image size does not change.

---

## Notes

- Calls `POST /tasks/add-logo` (backend task API), not `/skills/*`.
- Overlay is **pixel-accurate geometry**. No generative inpaint, no restyle.
- Backend accepts **URL-only** assets; **never** pass local paths in the API body — the script uploads them.
- PNG only, ≤20MB per file.
- Download links may expire; tell the user to save promptly.
- On missing env → **surgepix-setup**, do not collect secrets in chat.

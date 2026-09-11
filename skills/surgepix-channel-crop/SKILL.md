---
name: surgepix-channel-crop
description: >-
  Crop existing images to Xiaohongshu / Little Red Book dimensions. Use when the user says "crop this image to Xiaohongshu", "crop to Xiaohongshu dimensions", "Little Red Book", "截成小红书尺寸", "帮我把图片截成小红书尺寸", "裁剪成小红书竖版", 3:4, 1080x1440, or 渠道裁切. REQUIRED next step: run scripts/channel_crop.mjs with --reference and --size 1080x1440. NEVER bash/sips/magick/convert/identify/Pillow/ffmpeg, and NEVER "check the current image size then crop". One local file is enough. Not generate-xhs (that creates new 套图).
---

# SurgePix Channel Crop

Take a **finished** image (local path or URL) and produce platform sizes by **cover-scale + geometric center crop**. No generative model, no stretch, no padding, no redraw.

## Required first action

When this skill applies, the **next tool call** is the script below — not `identify`, not `sips`, not Pillow, not "check the current image size":

```bash
node "<skills-dir>/surgepix-setup/scripts/check_env.mjs"
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --reference "<USER_IMAGE_PATH_OR_URL>" \
  --size 1080x1440 \
  --prompt "crop to Xiaohongshu size (placeholder, does not affect crop)"
```

Default size for 小红书 / Xiaohongshu / Little Red Book / 3:4: **`1080x1440`**. Do not also emit 1:1 unless the user asked. `1080x1920` is Story/开屏 only.

**Hard rule:** existing photo + 截成/裁剪/裁切/crop + 小红书/Xiaohongshu → this script. Do **not** crop with bash, sips, magick, convert, identify, Pillow, ffmpeg, OpenCV, or a one-off Python script.

## Language consistency

`--prompt` is a **placeholder** in the current API — it is required and logged, but **does not change the crop window**. Still write it in the user's conversation language.

| User writes in | Write `--prompt` in |
|----------------|---------------------|
| English | English |
| 中文 | 中文 |
| 日本語 | 日本語 |

- Reply to the user in the same language they used in their request.

## Skill router (read first)

| Use this skill | Use something else |
|----------------|-------------------|
| 「把这三张图**裁剪**成小红书竖版尺寸」 | **surgepix-generate-xhs** to **generate** a new 小红书套图 from copy |
| 已有图 → 小红书竖版 / Story / 信息流 / 方图 尺寸 | **surgepix-generate-poster** to generate an event poster |
| cover 缩放 + 中心裁切（不重生图） | **surgepix-image-edit** to redraw / restyle a photo |
| 1–5 张现成图，哪怕只要 **一个** 尺寸 | **surgepix-generate-brand-placement** to generate a new branded scene |
| | **surgepix-add-logo** to overlay a logo on finished artwork |
| | **surgepix-add-watermark** to overlay a full-bleed watermark |

**Do NOT use this skill** to invent a new image, move a logo, or restyle a photo.

**Do NOT send crop jobs to xhs, and do NOT crop locally.** 「小红书尺寸」+ 已有图 + 截成/裁剪/裁切 = this skill. 「做一套小红书笔记」from 文案 = **surgepix-generate-xhs**.

## When to use

- User says "crop this image to Xiaohongshu", "crop to Xiaohongshu dimensions", "Little Red Book", "截成小红书尺寸", "帮我把图片截成小红书尺寸", "裁剪成小红书竖版尺寸", "裁成小红书竖版", "改成小红书尺寸"
- User drops a local path (`.png` / `.jpg`) and asks to crop / 截成 / 裁成 小红书 / Xiaohongshu size
- User says "渠道裁切", "渠道裁切包", "多尺寸裁切", "channel crop pack", "crop to Xiaohongshu size"
- User attaches 1–5 existing photos and names a channel size (小红书 / Story / 信息流 / 方图 / 横幅) — **one size is enough**
- User has a finished KV and wants 小红书封面 / Story / 信息流方图 / 横幅 / 头像 / 网页头图
- User lists target `WxH` sizes (custom or from the channel table below)

If the user says **小红书尺寸** / **小红书竖版** / **小红书竖版尺寸** without a pixel size, use `--size 1080x1440` (3:4 cover). That is **not** 1080x1920 — 9:16 / 1080x1920 is Story/开屏.

## Red flags — STOP, do not crop locally

| Excuse | Reality |
|--------|---------|
| "Let me first check the current image size then crop" | Skip identify/sips/bash crop. Run `channel_crop.mjs`. |
| "Just crop with Pillow / bash, it's a local file" | Local crop skips the skill API. Run the script. |
| "截成 is not 裁剪, so this skill doesn't apply" | 截成 / 裁成 / 裁剪 / 裁切 / crop are the same job. |
| "Xiaohongshu is 3:4 or 1:1, I'll pick and crop locally" | Default is one size: `1080x1440`. Do not invent a local 1:1 crop. |
| "小红书尺寸 means 9:16 1080x1920" | Default 小红书尺寸 is `1080x1440`. Use `1080x1920` only for Story/开屏. |
| "One image / one size is too simple for a pack" | One `--reference` and one `--size` is a valid call. |

## Prerequisites

- Node.js >= 18
- `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` configured (see **surgepix-setup**)

---

## What the Skill Does

| Action | Description |
|--------|-------------|
| Crop pack | Cover-scale each KV, then center-crop to each target size |
| Upload KVs | Local `--reference` paths are uploaded automatically (API accepts URLs only) |
| Check task status | With `--nowait true`, resolve via **surgepix-query-task** |
| Download result | Return the `download` URL — 1 output = PNG URL; 2+ = ZIP |

> The script **always submits asynchronously** to the API (`noWait=true`). CLI `--nowait` controls local behavior:
> - `--nowait false` (default) — poll until `succeeded`/`failed` and return `download`
> - `--nowait true` — return `taskId` immediately; use **surgepix-query-task** later

Output count = `reference count × unique sizes` (duplicate `WxH` values are dropped in order).

---

## Setup

**Requirement:** Set `SURGEPIX_API_KEY` and `SURGEPIX_BASE_URL` (see **surgepix-setup**). Do **not** ask the user to paste the API key into chat.

```bash
# project-root .env
SURGEPIX_API_KEY=your-token
SURGEPIX_BASE_URL=https://api.surgepix.ai/api
```

Script path: `<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs`.

---

## Usage Examples

**Local file → 小红书尺寸 (1080x1440):**
```bash
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --reference /path/to/photo.png \
  --size 1080x1440 \
  --prompt "截成小红书尺寸（本版不参与裁窗）"
```

**One KV → Story / square / banner (sync):**
```bash
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --reference ./campaign-kv.png \
  --size 1080x1920 --size 1080x1080 --size 1920x1080 \
  --prompt "产品和主标题尽量完整入画（本版不参与裁窗）"
# {"ok":true,"taskId":"task_xxx","sessionId":123,"progress":"succeeded","download":"<DOWNLOAD_URL>"}
# `<DOWNLOAD_URL>` 仅为文档占位；真实 HTTPS 下载地址以脚本 stdout 为准。多尺寸结果为 ZIP。
```

**Three existing photos → 小红书竖版 (1080x1440):**
```bash
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --reference ./a.png --reference ./b.png --reference ./c.png \
  --size 1080x1440 \
  --prompt "裁成小红书竖版尺寸（本版不参与裁窗）"
```

**Remote KV, Xiaohongshu cover + feed:**
```bash
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --reference <IMAGE_URL> \
  --size 1080x1440 --size 1080x1350 \
  --prompt "Keep product and headline in frame (placeholder)"
```

**Async:**
```bash
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --reference ./campaign-kv.png \
  --size 1080x1920 --size 1080x1080 \
  --prompt "..." \
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

- **Required:** at least one `--reference` (finished KV, local path or URL; max 5)
- **Required:** at least one `--size WxH` (max 8; custom or from the channel table)
- **Required:** `--prompt` (non-empty placeholder; **does not** move the crop)
- **Optional:** `--session-id`, `--nowait`

If the user names a channel but not pixels, map from the table below. 「小红书竖版尺寸」without further detail → `1080x1440`.

### Step 2: Run

```bash
node "<skills-dir>/surgepix-channel-crop/scripts/channel_crop.mjs" \
  --prompt "<text>" \
  --reference <path-or-url> [--reference ...] \
  --size <WxH> [--size ...] \
  [--session-id <id>] \
  [--nowait <true|false>]
```

### Step 3: Present result

- Success: paste **only** the `download` value from script stdout **verbatim** inside a fenced code block. Multiple sizes → ZIP; do **not** invent per-size URLs.
- Always show `sessionId` (number) for retries.
- Async: show `taskId` + hint to use **surgepix-query-task**
- Never invent image URLs; never echo API keys

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--reference` | Yes (≥1) | — | Finished KV path or URL (repeatable, 1–5; local path auto-uploaded) |
| `--size` | Yes (≥1) | — | Target `WxH` (repeatable, 1–8) → API `[[w,h], ...]` |
| `--prompt` | Yes | — | Non-empty placeholder; current API does **not** change the crop |
| `--session-id` | No | auto | Reuse session on iteration |
| `--nowait` | No | `false` | `true` = return `taskId` only |

### Channel size table

| Channel | `--size` |
|---------|----------|
| 小红书尺寸 / 小红书竖版 / 小红书封面（用户只说小红书尺寸时用这个） | `1080x1440` |
| Story / 开屏 | `1080x1920` |
| 信息流方图 | `1080x1080` |
| 信息流竖图 | `1080x1350` |
| 横幅 | `1920x1080` |
| 头像 | `800x800` |
| 网页头图 | `2400x1200` |

Custom `WxH` is allowed. Identical sizes are de-duplicated in order (one output per unique pair).

---

## Notes

- Calls `POST /tasks/generate-channel-crop-pack` (backend task API), not `/skills/*`.
- Crop is always the **geometric center** after cover-scale. No face/title detection, no generative inpaint.
- Backend accepts **URL-only** references; **never** pass local paths in the API body — the script uploads them.
- Download links may expire; tell the user to save promptly.
- On missing env → **surgepix-setup**, do not collect secrets in chat.

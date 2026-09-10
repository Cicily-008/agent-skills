---
name: surgepix-generate-channel-crop-pack
description: >-
  Use when the user already has photo(s) and wants to 裁剪 / 裁切 / crop them to a platform size — including 「帮我把这三张图裁剪成小红书竖版尺寸」, 「把这几张图裁成小红书竖版」, 「裁成竖版尺寸」, 「改成小红书尺寸」, 「裁成Story/信息流/方图」, crop to Xiaohongshu/RED vertical size, 渠道裁切包, or exporting a finished KV. Works for 1–5 existing images and even a SINGLE size (not only multi-size packs). Prefer this over surgepix-generate-xhs whenever the job is crop/resize of existing photos (xhs GENERATES new 套图). Do NOT use for generating new posters/scenes or general 改图. Output: show ONLY the download URL from script stdout verbatim (one PNG or ZIP); NEVER fabricate per-image URLs.
---

# SurgePix Generate Channel Crop Pack

Take a **finished** key visual (campaign KV / hero) and produce multiple platform sizes by **cover-scale + geometric center crop**. No generative model, no stretch, no padding, no redraw.

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

**Do NOT use this skill** to invent a new image, move a logo, or restyle a photo.

**Do NOT send crop jobs to xhs.** 「小红书竖版」+ 已有图 + 裁剪/裁切/改尺寸 = this skill. 「做一套小红书笔记 / 竖版轮播」from 文案 = **surgepix-generate-xhs**.

## When to use

- User says "裁剪成小红书竖版尺寸", "裁成小红书竖版", "裁成竖版尺寸", "改成小红书尺寸", "把这几张图裁一下"
- User says "渠道裁切", "渠道裁切包", "多尺寸裁切", "channel crop pack", "crop to Xiaohongshu size"
- User attaches 1–5 existing photos and names a channel size (小红书竖版 / Story / 信息流 / 方图 / 横幅) — **one size is enough**
- User has a finished KV and wants 小红书封面 / Story / 信息流方图 / 横幅 / 头像 / 网页头图
- User lists target `WxH` sizes (custom or from the channel table below)

If the user says **小红书竖版** / **小红书竖版尺寸** without a pixel size, use `--size 1080x1440`.

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

Script path: `<skills-dir>/surgepix-generate-channel-crop-pack/scripts/generate_channel_crop_pack.mjs`.

---

## Usage Examples

**One KV → Story / square / banner (sync):**
```bash
node "<skills-dir>/surgepix-generate-channel-crop-pack/scripts/generate_channel_crop_pack.mjs" \
  --reference ./campaign-kv.png \
  --size 1080x1920 --size 1080x1080 --size 1920x1080 \
  --prompt "产品和主标题尽量完整入画（本版不参与裁窗）"
# {"ok":true,"taskId":"task_xxx","sessionId":123,"progress":"succeeded","download":"<DOWNLOAD_URL>"}
# `<DOWNLOAD_URL>` 仅为文档占位；真实 HTTPS 下载地址以脚本 stdout 为准。多尺寸结果为 ZIP。
```

**Three existing photos → 小红书竖版 (1080x1440):**
```bash
node "<skills-dir>/surgepix-generate-channel-crop-pack/scripts/generate_channel_crop_pack.mjs" \
  --reference ./a.png --reference ./b.png --reference ./c.png \
  --size 1080x1440 \
  --prompt "裁成小红书竖版尺寸（本版不参与裁窗）"
```

**Remote KV, Xiaohongshu cover + feed:**
```bash
node "<skills-dir>/surgepix-generate-channel-crop-pack/scripts/generate_channel_crop_pack.mjs" \
  --reference <IMAGE_URL> \
  --size 1080x1440 --size 1080x1350 \
  --prompt "Keep product and headline in frame (placeholder)"
```

**Async:**
```bash
node "<skills-dir>/surgepix-generate-channel-crop-pack/scripts/generate_channel_crop_pack.mjs" \
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
node "<skills-dir>/surgepix-generate-channel-crop-pack/scripts/generate_channel_crop_pack.mjs" \
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
| 小红书竖版 / 小红书封面（用户只说竖版尺寸时用这个） | `1080x1440` |
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

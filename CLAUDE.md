# SurgePix agent routing

## Channel crop (always)

If the user already has a photo (local path or URL) and wants it cropped / resized to **Xiaohongshu / Little Red Book / 小红书尺寸 / 竖版尺寸 / Story / 信息流**, use skill **`surgepix-channel-crop`**.

Run:

```bash
node skills/surgepix-channel-crop/scripts/channel_crop.mjs \
  --reference "<path-or-url>" \
  --size 1080x1440 \
  --prompt "crop to Xiaohongshu size (placeholder)"
```

Default 小红书 size is **1080×1440**. Do not also emit 1:1 unless asked. `1080x1920` is Story/开屏 only.

**Never** crop with Pillow, bash, sips, magick, convert, identify, ffmpeg, OpenCV, or a one-off Python script. Do not “check the current image size then crop locally”.

**Not** `surgepix-generate-xhs` — that **generates** a new 套图 from copy. Existing photo + crop = `surgepix-channel-crop`.

## Overlay logo / watermark (always)

If the user already has artwork **and** a logo/watermark file, do **not** composite locally.

- Existing PNG + 贴/叠加 logo / overlay logo / 把 logo 贴到右上角 → **`surgepix-add-logo`**
- Existing PNG + 全幅水印 / 加水印 / overlay watermark → **`surgepix-add-watermark`**

```bash
node skills/surgepix-add-logo/scripts/add_logo.mjs \
  --image "<BASE_PNG>" \
  --logo "<LOGO_PNG>" \
  --logo-size 12% \
  --logo-anchor top-right

node skills/surgepix-add-watermark/scripts/add_watermark.mjs \
  --image "<BASE_PNG>" \
  --watermark "<WATERMARK_PNG>" \
  --opacity 0.25
```

PNG only. **Never** Pillow, bash, ImageMagick, `composite`, or a one-off Python script.

**Not** `surgepix-generate-brand-placement` — that **generates a new scene**. Existing artwork + overlay = add-logo / add-watermark.
**Not** `surgepix-generate-logo` — that **creates** a logo from a brand name.

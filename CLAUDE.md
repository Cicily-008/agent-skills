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

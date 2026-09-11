#!/usr/bin/env node
/**
 * SurgePix 素材叠加全幅水印 CLI
 *
 * 流程:
 *   1. 本地底图 / 水印 → 上传拿到 URL（直接传 URL 则跳过）
 *   2. POST /tasks/add-watermark（始终异步提交：API noWait=true）
 *   3. 根据 --nowait 决定是否本地轮询 GET /tasks/{taskId}
 *
 * 用法:
 *   node add_watermark.mjs --image <path-or-url> [--image ...]
 *     --watermark <path-or-url>
 *     [--opacity <0-1>] [--session-id <id>] [--nowait <true|false>]
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAndLoadEnv, loadConfig } from "./env.mjs";

const { uploadFile, refreshConfig: refreshUploadConfig } = await import("./file_upload.mjs");

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600_000;
const MIN_IMAGE = 1;
const MAX_IMAGE = 8;
const DEFAULT_OPACITY = 0.25;
const DEFAULT_USER_AGENT =
  process.env.SURGEPIX_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let config = { baseUrl: "", folder: "files", apiKey: "" };

function initConfig() {
  config = loadConfig();
}

function buildHeaders() {
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (config.apiKey) {
    headers.Authorization = config.apiKey;
  }
  return headers;
}

async function apiRequest(method, urlPath, { body, timeout = 120_000 } = {}) {
  const url = `${config.baseUrl}${urlPath}`;
  const headers = { ...buildHeaders() };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status} ${urlPath}: ${text}`);
  }
  const payload = await resp.json();
  if (payload.code !== 0) {
    throw new Error(`API error ${urlPath}: ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

async function resolveAsset(ref, label) {
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return ref;
  }
  const resolved = path.resolve(ref);
  if (!existsSync(resolved)) {
    throw new Error(`${label} 文件不存在: ${resolved}`);
  }
  refreshUploadConfig();
  console.error(`[upload] uploading ${label} ${resolved}`);
  const result = await uploadFile(resolved);
  if (!result.url) {
    throw new Error(`上传成功但未返回 url: ${JSON.stringify(result)}`);
  }
  console.error(`[upload] url=${result.url}`);
  return result.url;
}

function parseOpacity(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`--opacity 必须是 0–1 的数字，收到: ${raw}`);
  }
  return n;
}

async function addWatermark(options) {
  const { image, watermark, watermarkOpacity, sessionId } = options;
  const body = {
    noWait: true,
    source: "skill",
    image,
    watermark,
    watermarkOpacity,
  };
  if (sessionId != null) body.sessionId = sessionId;
  console.error(
    `[add-watermark] images=${image.length} opacity=${watermarkOpacity}`,
  );
  return apiRequest("POST", "/tasks/add-watermark", { body });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollUntilDone(taskId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await apiRequest("GET", `/tasks/${taskId}`);
    const progress = data.progress;
    console.error(`[poll] taskId=${taskId} progress=${progress}`);
    if (progress === "succeeded" || progress === "failed") {
      return data;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`轮询超时 (${POLL_TIMEOUT_MS / 1000}s): taskId=${taskId}`);
}

function printResult(data) {
  console.log(
    JSON.stringify({
      ok: true,
      taskId: data.taskId,
      sessionId: data.sessionId,
      progress: data.progress,
      download: data.taskResult?.download ?? null,
    }),
  );
}

function printAsyncResult(data) {
  const taskId = data.taskId;
  console.log(
    JSON.stringify({
      ok: true,
      async: true,
      taskId,
      sessionId: data.sessionId ?? null,
      progress: data.progress ?? "processing",
      download: data.taskResult?.download ?? null,
      hint: `任务已异步提交，尚未完成。请稍后用 surgepix-query-task 技能查询任务状态，例如：node <skills-dir>/surgepix-query-task/scripts/query_task.mjs ${taskId}`,
    }),
  );
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function printHelp() {
  console.error("Usage: node add_watermark.mjs --image <path-or-url> [--image ...] \\");
  console.error("         --watermark <path-or-url> [--opacity <0-1>] \\");
  console.error("         [--session-id <id>] [--nowait <true|false>]");
  console.error("");
  console.error("  --image <path-or-url>       底图（必填 1–8，仅 PNG；本地路径自动上传）");
  console.error("  --watermark <path-or-url>   全幅水印（必填，仅 PNG；不要放进 --image）");
  console.error("  --opacity <0-1>             水印透明度，默认 0.25");
  console.error("  --session-id <id>           会话 ID，迭代调整时传入");
  console.error("  --nowait <true|false>       false(默认)=同步轮询；true=异步返回 taskId");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    image: [],
    watermark: null,
    opacity: DEFAULT_OPACITY,
    sessionId: null,
    nowait: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--nowait") {
      const next = args[i + 1];
      if (next === "true" || next === "false") {
        parsed.nowait = next === "true";
        i++;
      } else {
        parsed.nowait = true;
      }
    } else if (arg === "--image" && i + 1 < args.length) {
      parsed.image.push(args[++i]);
    } else if (arg === "--watermark" && i + 1 < args.length) {
      parsed.watermark = args[++i];
    } else if (arg === "--opacity" && i + 1 < args.length) {
      parsed.opacity = args[++i];
    } else if (arg === "--session-id" && i + 1 < args.length) {
      parsed.sessionId = Number(args[++i]);
    } else if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }
  return parsed;
}

async function main() {
  const parsed = parseArgs();
  initConfig();

  if (!config.apiKey) {
    const sources = discoverAndLoadEnv();
    fail(
      `SURGEPIX_API_KEY not found. Set it in .env or run surgepix-setup skill. sources=${JSON.stringify(sources)}`,
    );
  }
  if (!config.baseUrl) {
    const sources = discoverAndLoadEnv();
    fail(
      `SURGEPIX_BASE_URL not found. Set it in .env or the shell (see surgepix-setup skill). sources=${JSON.stringify(sources)}`,
    );
  }

  if (parsed.image.length < MIN_IMAGE || parsed.image.length > MAX_IMAGE) {
    fail(`--image 需要 ${MIN_IMAGE}–${MAX_IMAGE} 张，收到: ${parsed.image.length}`);
  }
  if (!parsed.watermark) {
    fail("缺少必填参数: --watermark");
  }

  let opacity;
  try {
    opacity = parseOpacity(parsed.opacity);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  try {
    const images = [];
    for (const img of parsed.image) {
      images.push(await resolveAsset(img, "image"));
    }
    const watermark = await resolveAsset(parsed.watermark, "watermark");

    const data = await addWatermark({
      image: images,
      watermark,
      watermarkOpacity: opacity,
      sessionId: parsed.sessionId,
    });

    const taskId = data.taskId;
    if (!taskId) {
      fail(`未返回 taskId: ${JSON.stringify(data)}`);
    }

    if (parsed.nowait) {
      console.error(`[nowait] 任务已提交，taskId=${taskId}，跳过轮询`);
      printAsyncResult(data);
      return;
    }

    console.error(`[sync] 开始轮询 taskId=${taskId}`);
    const final = await pollUntilDone(String(taskId));
    printResult(final);
    if (final.progress !== "succeeded") process.exit(1);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

export { addWatermark, parseOpacity, pollUntilDone };

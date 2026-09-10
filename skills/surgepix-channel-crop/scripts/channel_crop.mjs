#!/usr/bin/env node
/**
 * SurgePix 渠道裁切包 CLI
 *
 * 流程:
 *   1. 本地主视觉 → 上传拿到 URL（直接传 URL 则跳过）
 *   2. POST /tasks/generate-channel-crop-pack（始终异步提交：API noWait=true）
 *   3. 根据 --nowait 决定是否本地轮询 GET /tasks/{taskId}
 *
 * 用法:
 *   node channel_crop.mjs --prompt <text>
 *     --reference <path-or-url> [--reference ...]
 *     --size <WxH> [--size ...]
 *     [--session-id <id>] [--nowait <true|false>]
 *
 * Env (auto-loaded):
 *   SURGEPIX_API_KEY        必填
 *   SURGEPIX_BASE_URL       必填
 *   SURGEPIX_UPLOAD_FOLDER  可选，默认 files
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAndLoadEnv, loadConfig } from "./env.mjs";

const { uploadFile, refreshConfig: refreshUploadConfig } = await import("./file_upload.mjs");

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600_000;
const MIN_REFERENCE = 1;
const MAX_REFERENCE = 5;
const MIN_SIZE = 1;
const MAX_SIZE = 8;
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

async function resolveReference(ref) {
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return ref;
  }
  const resolved = path.resolve(ref);
  if (!existsSync(resolved)) {
    throw new Error(`主视觉文件不存在: ${resolved}`);
  }
  refreshUploadConfig();
  console.error(`[upload] uploading reference ${resolved}`);
  const result = await uploadFile(resolved);
  if (!result.url) {
    throw new Error(`上传成功但未返回 url: ${JSON.stringify(result)}`);
  }
  console.error(`[upload] url=${result.url}`);
  return result.url;
}

/** @param {string} raw @returns {[number, number]} */
function parseSize(raw) {
  const m = /^(\d+)x(\d+)$/i.exec(String(raw).trim());
  if (!m) {
    throw new Error(`--size 格式非法: ${raw}；应为 WxH，例如 1080x1920`);
  }
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`--size 宽高必须为正整数: ${raw}`);
  }
  return [width, height];
}

/** @param {string[]} rawList @returns {[number, number][]} */
function parseSizeList(rawList) {
  if (rawList.length < MIN_SIZE || rawList.length > MAX_SIZE) {
    throw new Error(`--size 需要 ${MIN_SIZE}–${MAX_SIZE} 个，收到: ${rawList.length}`);
  }
  const seen = new Set();
  const sizes = [];
  for (const raw of rawList) {
    const pair = parseSize(raw);
    const key = `${pair[0]}x${pair[1]}`;
    if (seen.has(key)) {
      console.error(`[size] skip duplicate ${key}`);
      continue;
    }
    seen.add(key);
    sizes.push(pair);
  }
  if (sizes.length < 1) {
    throw new Error("--size 去重后为空");
  }
  return sizes;
}

async function generateChannelCropPack(options) {
  const { reference, size, prompt, sessionId } = options;
  const body = {
    noWait: true,
    source: "skill",
    reference,
    size,
    prompt,
  };
  if (sessionId != null) body.sessionId = sessionId;
  console.error(
    `[generate-channel-crop-pack] refs=${reference.length} sizes=${size.map((s) => `${s[0]}x${s[1]}`).join(",")}`,
  );
  return apiRequest("POST", "/tasks/generate-channel-crop-pack", { body });
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
  console.error("Usage: node channel_crop.mjs --prompt <text> \\");
  console.error("         --reference <path-or-url> [--reference ...] \\");
  console.error("         --size <WxH> [--size ...] \\");
  console.error("         [--session-id <id>] [--nowait <true|false>]");
  console.error("");
  console.error("  --prompt <text>           构图占位（必填；当前版本不影响裁窗）");
  console.error("  --reference <path-or-url> 已定稿主视觉（必填 1–5；本地路径自动上传）");
  console.error("  --size <WxH>              目标宽高（必填 1–8，可重复；相同尺寸按序去重）");
  console.error("  --session-id <id>         会话 ID，迭代调整时传入");
  console.error("  --nowait <true|false>     false(默认)=同步轮询；true=异步返回 taskId");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    prompt: null,
    reference: [],
    size: [],
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
    } else if (arg === "--prompt" && i + 1 < args.length) {
      parsed.prompt = args[++i];
    } else if (arg === "--reference" && i + 1 < args.length) {
      parsed.reference.push(args[++i]);
    } else if (arg === "--size" && i + 1 < args.length) {
      parsed.size.push(args[++i]);
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

  if (!parsed.prompt || !String(parsed.prompt).trim()) {
    fail("缺少必填参数: --prompt（当前版本不影响裁窗，但不能为空）");
  }
  if (parsed.reference.length < MIN_REFERENCE || parsed.reference.length > MAX_REFERENCE) {
    fail(`--reference 需要 ${MIN_REFERENCE}–${MAX_REFERENCE} 张，收到: ${parsed.reference.length}`);
  }
  if (parsed.size.length < MIN_SIZE) {
    fail("缺少必填参数: 至少一个 --size（例如 1080x1920）");
  }

  let sizeList;
  try {
    sizeList = parseSizeList(parsed.size);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  try {
    const resolvedRefs = [];
    for (const ref of parsed.reference) {
      resolvedRefs.push(await resolveReference(ref));
    }

    const data = await generateChannelCropPack({
      reference: resolvedRefs,
      size: sizeList,
      prompt: parsed.prompt,
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

export { generateChannelCropPack, pollUntilDone, resolveReference, parseSize, parseSizeList };

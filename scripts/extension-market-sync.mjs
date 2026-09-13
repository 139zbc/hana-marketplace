#!/usr/bin/env node

// scripts/extension-market-sync.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// shared/extension-contract.ts
var EXTENSION_KINDS = Object.freeze([
  "app",
  "skill",
  "recipe",
  "connector",
  "role",
  "bundle"
]);
var EXTENSION_KIND_SET = new Set(EXTENSION_KINDS);
function isExtensionKind(v) {
  return typeof v === "string" && EXTENSION_KIND_SET.has(v);
}
function isSafeExtensionId(id) {
  if (typeof id !== "string") return false;
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)) return false;
  if (id.endsWith(".") || id.endsWith("-")) return false;
  if (id.includes("..") || id.includes("--")) return false;
  return true;
}
function isCapabilityName(value) {
  if (typeof value !== "string" || !value) return false;
  const slash = value.indexOf("/");
  return slash > 0 && slash === value.lastIndexOf("/") && slash < value.length - 1;
}

// shared/extension-market-index.ts
var MARKET_INDEX_SCHEMA_VERSION = 2;
var MAX_MARKET_ARCHIVE_BYTES = 50 * 1024 * 1024;
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isHttpsUrl(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
function isSha256Hex(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
function isParseableDate(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function describeArchive(archive, path2) {
  if (!isPlainObject(archive)) return `${path2} must be an object`;
  if (!isHttpsUrl(archive.url)) return `${path2}.url must be an https URL`;
  if (!isSha256Hex(archive.sha256)) return `${path2}.sha256 must be 64 lowercase hex characters`;
  if (!isPositiveInteger(archive.size)) return `${path2}.size must be a positive integer`;
  if (archive.size > MAX_MARKET_ARCHIVE_BYTES) {
    return `${path2}.size exceeds the ${MAX_MARKET_ARCHIVE_BYTES} byte limit`;
  }
  if (archive.format !== "zip") return `${path2}.format must be "zip"`;
  return null;
}
function describePermission(permission, path2) {
  if (!isPlainObject(permission)) return `${path2} must be an object`;
  if (!isCapabilityName(permission.capability)) {
    return `${path2}.capability must be a "<namespace>/<name>" string`;
  }
  if (permission.scope !== void 0 && !isPlainObject(permission.scope)) return `${path2}.scope must be an object`;
  if (permission.reason !== void 0 && typeof permission.reason !== "string") {
    return `${path2}.reason must be a string`;
  }
  return null;
}
function describeItemVersion(entry, path2) {
  if (!isPlainObject(entry)) return `${path2} must be an object`;
  if (!isNonEmptyString(entry.version)) return `${path2}.version must be a non-empty string`;
  if (entry.minAppVersion !== void 0 && !isNonEmptyString(entry.minAppVersion)) {
    return `${path2}.minAppVersion must be a non-empty string`;
  }
  return describeArchive(entry.archive, `${path2}.archive`);
}
function describeCompatibility(value, path2) {
  if (!isPlainObject(value)) return `${path2} must be an object`;
  if (value.minAppVersion !== void 0 && !isNonEmptyString(value.minAppVersion)) {
    return `${path2}.minAppVersion must be a non-empty string`;
  }
  if (value.formFactors !== void 0 && !isStringArray(value.formFactors)) {
    return `${path2}.formFactors must be an array of strings`;
  }
  return null;
}
function describeMarketItem(raw, path2) {
  if (!isPlainObject(raw)) return `${path2} must be an object`;
  if (!isExtensionKind(raw.kind)) {
    return `${path2}.kind must be one of ${EXTENSION_KINDS.join(", ")}`;
  }
  if (!isSafeExtensionId(raw.id)) return `${path2}.id is not a safe extension id`;
  if (!isNonEmptyString(raw.name)) return `${path2}.name must be a non-empty string`;
  if (!isNonEmptyString(raw.publisher)) return `${path2}.publisher must be a non-empty string`;
  if (typeof raw.description !== "string") return `${path2}.description must be a string`;
  if (!isNonEmptyString(raw.version)) return `${path2}.version must be a non-empty string`;
  const archiveError = describeArchive(raw.archive, `${path2}.archive`);
  if (archiveError) return archiveError;
  if (!Array.isArray(raw.permissions)) return `${path2}.permissions must be an array`;
  for (let index = 0; index < raw.permissions.length; index += 1) {
    const permissionError = describePermission(raw.permissions[index], `${path2}.permissions[${index}]`);
    if (permissionError) return permissionError;
  }
  if (raw.versions !== void 0) {
    if (!Array.isArray(raw.versions)) return `${path2}.versions must be an array`;
    for (let index = 0; index < raw.versions.length; index += 1) {
      const versionError = describeItemVersion(raw.versions[index], `${path2}.versions[${index}]`);
      if (versionError) return versionError;
    }
  }
  if (raw.compatibility !== void 0) {
    const compatibilityError = describeCompatibility(raw.compatibility, `${path2}.compatibility`);
    if (compatibilityError) return compatibilityError;
  }
  if (raw.homepage !== void 0 && typeof raw.homepage !== "string") return `${path2}.homepage must be a string`;
  if (raw.repository !== void 0 && typeof raw.repository !== "string") return `${path2}.repository must be a string`;
  if (raw.license !== void 0 && typeof raw.license !== "string") return `${path2}.license must be a string`;
  if (raw.icon !== void 0 && typeof raw.icon !== "string") return `${path2}.icon must be a string`;
  if (raw.categories !== void 0 && !isStringArray(raw.categories)) return `${path2}.categories must be an array of strings`;
  if (raw.keywords !== void 0 && !isStringArray(raw.keywords)) return `${path2}.keywords must be an array of strings`;
  if (raw.readmeUrl !== void 0 && typeof raw.readmeUrl !== "string") return `${path2}.readmeUrl must be a string`;
  return null;
}
function itemLabel(raw, index) {
  if (isPlainObject(raw) && typeof raw.id === "string" && raw.id) return raw.id;
  return `#${index}`;
}
function validateMarketIndexV2(raw) {
  if (!isPlainObject(raw)) return { errors: ["market index must be a JSON object"] };
  if (raw.schemaVersion !== MARKET_INDEX_SCHEMA_VERSION) {
    return { errors: [`unsupported market index schemaVersion: ${JSON.stringify(raw.schemaVersion)}`] };
  }
  if (!isNonEmptyString(raw.sourceId)) return { errors: ["sourceId must be a non-empty string"] };
  if (!isNonEmptyString(raw.name)) return { errors: ["name must be a non-empty string"] };
  if (!isParseableDate(raw.publishedAt)) return { errors: ["publishedAt must be a parseable date string"] };
  if (!Array.isArray(raw.items)) return { errors: ["items must be an array"] };
  const items = [];
  const warnings = [];
  raw.items.forEach((entry, index) => {
    const failureReason = describeMarketItem(entry, `items[${index}]`);
    if (failureReason) {
      warnings.push(`dropped market item ${itemLabel(entry, index)}: ${failureReason}`);
      return;
    }
    items.push(entry);
  });
  return {
    index: {
      schemaVersion: MARKET_INDEX_SCHEMA_VERSION,
      sourceId: raw.sourceId,
      name: raw.name,
      publishedAt: raw.publishedAt,
      items
    },
    warnings
  };
}

// shared/log-redactor.ts
var SECRET_KEY_PATTERN = "api[_-]?key|apikey|api-key|secret[_-]?key|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|client[_-]?secret|bot[_-]?token|server[_-]?token";
var SECRET_ASSIGN_RE = new RegExp(`\\b(${SECRET_KEY_PATTERN})\\b\\s*[:=]\\s*(?:"[^"]*"|'[^']*'|[^\\s,"'\\]}]+)`, "gi");

// lib/debug-log.ts
var DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
var DEFAULT_MAX_LINE_BYTES = 64 * 1024;
var _sink = null;
function route(type, module, msg) {
  const sink = _sink;
  if (!sink) return;
  sink.write(type, module || "unknown", String(msg));
}
function createModuleLogger(module) {
  const info = (msg) => {
    console.log(`[${module}] ${msg}`);
    route("info", module, msg);
  };
  return {
    log: info,
    info,
    warn(msg) {
      console.warn(`[${module}] ${msg}`);
      route("warn", module, msg);
    },
    error(msg) {
      console.error(`[${module}] ${msg}`);
      route("error", module, msg);
    }
  };
}

// lib/remote-data/bounded-fetch.ts
var moduleLog = createModuleLogger("remote-data/bounded-fetch");
var REDIRECT_STATUS_CODES = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
var BoundedFetchError = class extends Error {
  code;
  constructor(message, code) {
    super(message);
    this.name = "BoundedFetchError";
    this.code = code;
  }
};
function assertHttps(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new BoundedFetchError(`invalid URL: ${url}`, "NON_HTTPS");
  }
  if (parsed.protocol !== "https:") {
    throw new BoundedFetchError(`refusing non-HTTPS URL: ${url}`, "NON_HTTPS");
  }
  return parsed;
}
function headersToRecord(headers) {
  const out = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}
async function readBoundedBody(body, maxResponseBytes, abort, signal, onChunk) {
  if (!body) return { body: Buffer.alloc(0), bytes: 0 };
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => {
    });
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (; ; ) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        abort();
        throw new BoundedFetchError(
          `response exceeded maxResponseBytes (${maxResponseBytes})`,
          "RESPONSE_TOO_LARGE"
        );
      }
      if (onChunk) await onChunk(value);
      else chunks.push(value);
    }
  } catch (error) {
    abort();
    try {
      await reader.cancel(error);
    } catch {
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    try {
      reader.releaseLock();
    } catch {
    }
  }
  return { body: Buffer.concat(chunks), bytes: total };
}
async function requestBounded({
  url,
  maxRedirects,
  maxResponseBytes,
  timeoutMs,
  fetchImpl = fetch,
  signal
}, onChunk) {
  let currentUrl = url;
  let hop = 0;
  for (; ; ) {
    signal?.throwIfAborted();
    assertHttps(currentUrl);
    const controller = new AbortController();
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const requestSignal = AbortSignal.any([controller.signal, timeoutSignal, ...signal ? [signal] : []]);
    let res;
    try {
      res = await fetchImpl(currentUrl, { redirect: "manual", signal: requestSignal });
    } catch (err) {
      signal?.throwIfAborted();
      throw new BoundedFetchError(
        `network request failed for ${currentUrl}: ${err instanceof Error ? err.message : String(err)}`,
        "NETWORK_ERROR"
      );
    }
    if (REDIRECT_STATUS_CODES.has(res.status)) {
      try {
        await res.body?.cancel();
      } catch {
      }
      if (hop >= maxRedirects) {
        throw new BoundedFetchError(`too many redirects (max ${maxRedirects}) fetching ${url}`, "TOO_MANY_REDIRECTS");
      }
      const location = res.headers.get("location");
      if (!location) {
        throw new BoundedFetchError(`redirect response from ${currentUrl} carried no Location header`, "INVALID_REDIRECT");
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        throw new BoundedFetchError(`redirect Location header is not a valid URL: ${location}`, "INVALID_REDIRECT");
      }
      moduleLog.log(`following redirect ${hop + 1}/${maxRedirects}: ${currentUrl} -> ${nextUrl}`);
      currentUrl = nextUrl;
      hop += 1;
      continue;
    }
    const declaredLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
      try {
        await res.body?.cancel();
      } catch {
      }
      throw new BoundedFetchError(
        `declared Content-Length ${declaredLength} exceeds maxResponseBytes (${maxResponseBytes})`,
        "RESPONSE_TOO_LARGE"
      );
    }
    const { body, bytes } = await readBoundedBody(res.body, maxResponseBytes, () => controller.abort(), requestSignal, onChunk);
    return { status: res.status, body, bytes, headers: headersToRecord(res.headers), finalUrl: currentUrl };
  }
}
async function fetchBounded(options) {
  const { status, body, headers, finalUrl } = await requestBounded(options);
  return { status, body, headers, finalUrl };
}
async function fetchBoundedToSink(options, onChunk) {
  const { status, bytes, headers, finalUrl } = await requestBounded(options, onChunk);
  return { status, bytes, headers, finalUrl };
}

// lib/plugin-versioning.ts
function parseVersionPart(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function parsePluginVersion(version) {
  const text = String(version || "0.0.0").trim();
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text);
  if (!match) return null;
  return {
    major: parseVersionPart(match[1]),
    minor: parseVersionPart(match[2]),
    patch: parseVersionPart(match[3]),
    prerelease: match[4] || "",
    raw: text
  };
}
function comparePrerelease(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const left = a.split(".");
  const right = b.split(".");
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const l = left[i];
    const r = right[i];
    if (l === void 0) return -1;
    if (r === void 0) return 1;
    const ln = /^\d+$/.test(l) ? Number.parseInt(l, 10) : null;
    const rn = /^\d+$/.test(r) ? Number.parseInt(r, 10) : null;
    if (ln !== null && rn !== null && ln !== rn) return ln > rn ? 1 : -1;
    if (ln !== null && rn === null) return -1;
    if (ln === null && rn !== null) return 1;
    if (l !== r) return l > r ? 1 : -1;
  }
  return 0;
}
function comparePluginVersions(a, b) {
  const left = parsePluginVersion(a);
  const right = parsePluginVersion(b);
  if (!left && !right) return String(a || "").localeCompare(String(b || ""), void 0, { numeric: true });
  if (!left) return -1;
  if (!right) return 1;
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

// scripts/extension-market-sync.mjs
var MARKET_SOURCE_ID = "official-global";
var MARKET_NAME = "Hana Global Market";
var API_BASE = "https://api.github.com";
var MAX_ENTRY_BYTES = 512 * 1024;
var MAX_API_BYTES = 2 * 1024 * 1024;
var MAX_REDIRECTS = 5;
var TIMEOUT_MS = 2e4;
var REPOSITORY_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;
function isPlainObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, keys, label) {
  const extra = Object.keys(value).filter((key) => !keys.includes(key));
  if (extra.length) throw new Error(`${label} has unsupported field(s): ${extra.join(", ")}`);
}
function readRegistry(raw) {
  if (!isPlainObject2(raw)) throw new Error("registry must be a JSON object");
  exactKeys(raw, ["schemaVersion", "entries"], "registry");
  if (raw.schemaVersion !== 1) throw new Error("registry.schemaVersion must be 1");
  if (!Array.isArray(raw.entries)) throw new Error("registry.entries must be an array");
  const seen = /* @__PURE__ */ new Set();
  return raw.entries.map((entry, index) => {
    const label = `registry.entries[${index}]`;
    if (!isPlainObject2(entry)) throw new Error(`${label} must be an object`);
    exactKeys(entry, ["kind", "id", "repository", "publisher"], label);
    if (!isExtensionKind(entry.kind)) throw new Error(`${label}.kind must be one of ${EXTENSION_KINDS.join(", ")}`);
    if (!isSafeExtensionId(entry.id)) throw new Error(`${label}.id is not a safe extension id`);
    const [owner, repo] = typeof entry.repository === "string" ? entry.repository.split("/") : [];
    if (typeof entry.repository !== "string" || !REPOSITORY_RE.test(entry.repository) || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) || owner === "." || owner === ".." || repo === "." || repo === "..") {
      throw new Error(`${label}.repository must be a safe owner/repository name`);
    }
    if (typeof entry.publisher !== "string" || !entry.publisher.trim() || entry.publisher.length > 160) {
      throw new Error(`${label}.publisher must be a non-empty string no longer than 160 characters`);
    }
    const key = `${entry.kind}:${entry.id}`;
    if (seen.has(key)) throw new Error(`registry has duplicate enrollment ${key}`);
    seen.add(key);
    return { kind: entry.kind, id: entry.id, repository: entry.repository, publisher: entry.publisher.trim() };
  });
}
function parseJson(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}
function assertHttpSuccess(response, label) {
  if (response.status < 200 || response.status >= 300) {
    const rate = response.status === 403 ? " (check GitHub API rate limits or credentials)" : "";
    throw new Error(`${label}: GitHub API returned HTTP ${response.status}${rate}`);
  }
}
function releaseEntryFileName(registration) {
  return registration.kind === "skill" || registration.kind === "recipe" ? `${registration.kind}-${registration.id}.entry.json` : null;
}
function canonicalRepository(repository) {
  return `https://github.com/${repository}`;
}
function assertVersion(registration, version) {
  if (registration.kind !== "skill" && registration.kind !== "recipe" && !parsePluginVersion(version)) {
    throw new Error(`entry version ${JSON.stringify(version)} is not a semantic version`);
  }
}
function assetFileName(url) {
  if (typeof url !== "string" || !url.startsWith("{{BASE_URL}}/")) return null;
  const name = url.slice("{{BASE_URL}}/".length);
  return name && !name.includes("/") && !name.includes("\\") ? name : null;
}
function expectedEntryName(registration, version) {
  return releaseEntryFileName(registration) || `${registration.kind}-${registration.id}-${version}.entry.json`;
}
function validateRelease(release) {
  if (!isPlainObject2(release)) throw new Error("latest release payload must be an object");
  if (release.draft === true) throw new Error("latest release is a draft");
  if (release.prerelease === true) throw new Error("latest release is a prerelease");
  if (typeof release.tag_name !== "string" || !release.tag_name.trim()) throw new Error("latest release has no tag name");
  if (!Array.isArray(release.assets)) throw new Error("latest release has no assets array");
  return { assets: release.assets, tagName: release.tag_name };
}
function assertReleaseAsset(asset, repository, tagName, label) {
  if (!isPlainObject2(asset) || typeof asset.name !== "string" || !asset.name) throw new Error(`${label} asset is malformed`);
  if (typeof asset.browser_download_url !== "string") throw new Error(`${label} asset ${asset.name} has no browser download URL`);
  let url;
  try {
    url = new URL(asset.browser_download_url);
  } catch {
    throw new Error(`${label} asset ${asset.name} has an invalid download URL`);
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    throw new Error(`${label} asset ${asset.name} has an invalid encoded path`);
  }
  const expectedPath = `/${repository}/releases/download/${tagName}/${asset.name}`;
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || decodedPath !== expectedPath || url.search || url.hash) {
    throw new Error(`${label} asset ${asset.name} is not an exact HTTPS download for enrolled repository ${repository}`);
  }
  return asset;
}
function findOnlyAsset(assets, name, label, repository, tagName) {
  const matches = assets.filter((asset) => isPlainObject2(asset) && asset.name === name);
  if (matches.length === 0) throw new Error(`latest release is missing ${label} asset ${name}`);
  if (matches.length > 1) throw new Error(`latest release has ambiguous ${label} asset ${name}`);
  return assertReleaseAsset(matches[0], repository, tagName, label);
}
function validateEntry(entry, registration) {
  if (!isPlainObject2(entry)) throw new Error("entry metadata must be a JSON object");
  if (entry.kind !== registration.kind || entry.id !== registration.id) {
    throw new Error(`entry identity ${JSON.stringify(entry.kind)}:${JSON.stringify(entry.id)} does not match enrollment ${registration.kind}:${registration.id}`);
  }
  if (entry.publisher !== registration.publisher) throw new Error("entry publisher does not match reviewed enrollment");
  if (typeof entry.version !== "string" || !entry.version) throw new Error("entry version is missing");
  assertVersion(registration, entry.version);
  if ((registration.kind === "skill" || registration.kind === "recipe") && entry.version !== "0.0.0") {
    throw new Error("skill and recipe entries must use version 0.0.0");
  }
  if (!isPlainObject2(entry.archive)) throw new Error("entry archive must be an object");
  const zipName = assetFileName(entry.archive.url);
  if (!zipName || !zipName.endsWith(".zip")) throw new Error("entry archive.url must name a local {{BASE_URL}} ZIP asset");
  if (typeof entry.archive.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.archive.sha256)) {
    throw new Error("entry archive.sha256 must be 64 lowercase hexadecimal characters");
  }
  if (!Number.isInteger(entry.archive.size) || entry.archive.size <= 0 || entry.archive.size > MAX_MARKET_ARCHIVE_BYTES) {
    throw new Error(`entry archive.size must be a positive integer no larger than ${MAX_MARKET_ARCHIVE_BYTES}`);
  }
  if (entry.archive.format !== "zip") throw new Error("entry archive.format must be zip");
  return zipName;
}
function githubApiFetch(fetchImpl, token) {
  return async (input, init = {}) => {
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(rawUrl);
    const headers = new Headers(init.headers || {});
    headers.set("accept", "application/vnd.github+json");
    if (url.hostname !== "api.github.com") throw new Error(`refusing GitHub API request outside api.github.com: ${url.hostname}`);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetchImpl(input, { ...init, headers });
  };
}
async function readRelease(registration, { fetchImpl, token }) {
  const response = await fetchBounded({
    url: `${API_BASE}/repos/${registration.repository}/releases/latest`,
    maxRedirects: 2,
    maxResponseBytes: MAX_API_BYTES,
    timeoutMs: TIMEOUT_MS,
    fetchImpl: githubApiFetch(fetchImpl, token)
  });
  assertHttpSuccess(response, `${registration.kind}/${registration.id}`);
  return validateRelease(parseJson(response.body, "latest release metadata"));
}
async function readEntryAsset(asset, registration, options) {
  const response = await fetchBounded({
    url: asset.browser_download_url,
    maxRedirects: MAX_REDIRECTS,
    maxResponseBytes: MAX_ENTRY_BYTES,
    timeoutMs: TIMEOUT_MS,
    fetchImpl: options.fetchImpl
  });
  assertHttpSuccess(response, `${registration.kind}/${registration.id} entry`);
  return parseJson(response.body, "entry metadata");
}
async function verifyArchive(asset, entry, registration, options) {
  if (!Number.isInteger(asset.size) || asset.size <= 0) throw new Error("release ZIP asset is missing a valid byte size");
  if (asset.size !== entry.archive.size) throw new Error("release ZIP asset size does not match entry metadata");
  const sha256 = crypto.createHash("sha256");
  const response = await fetchBoundedToSink({
    url: asset.browser_download_url,
    maxRedirects: MAX_REDIRECTS,
    maxResponseBytes: MAX_MARKET_ARCHIVE_BYTES,
    timeoutMs: TIMEOUT_MS,
    fetchImpl: options.fetchImpl
  }, async (chunk) => {
    sha256.update(chunk);
  });
  assertHttpSuccess(response, `${registration.kind}/${registration.id} ZIP`);
  if (response.bytes !== entry.archive.size) throw new Error("downloaded ZIP byte count does not match entry metadata");
  const actual = sha256.digest("hex");
  if (actual !== entry.archive.sha256) throw new Error("downloaded ZIP sha256 does not match entry metadata");
}
function projectEntry(entry, registration, archiveUrl) {
  const projected = {
    ...entry,
    publisher: registration.publisher,
    repository: canonicalRepository(registration.repository),
    archive: { ...entry.archive, url: archiveUrl }
  };
  delete projected.versions;
  return projected;
}
function strictIndex(raw, label) {
  const result = validateMarketIndexV2(raw);
  if ("errors" in result) throw new Error(`${label} is invalid: ${result.errors.join("; ")}`);
  if (result.warnings.length) throw new Error(`${label} contains invalid item(s): ${result.warnings.join("; ")}`);
  if (result.index.sourceId !== MARKET_SOURCE_ID) throw new Error(`${label} sourceId must be ${MARKET_SOURCE_ID}`);
  return result.index;
}
function normalizeItem(item) {
  const index = strictIndex({
    schemaVersion: MARKET_INDEX_SCHEMA_VERSION,
    sourceId: MARKET_SOURCE_ID,
    name: MARKET_NAME,
    publishedAt: "2026-01-01T00:00:00.000Z",
    items: [item]
  }, "generated item");
  return index.items[0];
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sameArchive(a, b) {
  return a?.sha256 === b?.sha256 && a?.size === b?.size && a?.format === b?.format;
}
function historyFor(previous, candidate, registration) {
  if (!previous || previous.repository !== canonicalRepository(registration.repository)) return candidate;
  if (registration.kind === "skill" || registration.kind === "recipe") return candidate;
  const compared = comparePluginVersions(candidate.version, previous.version);
  if (compared < 0) throw new Error(`latest release version ${candidate.version} would downgrade published ${previous.version}`);
  if (compared === 0) {
    if (!sameArchive(candidate.archive, previous.archive)) throw new Error(`latest release version ${candidate.version} would replace an existing published ZIP`);
    return previous.versions?.length ? { ...candidate, versions: previous.versions } : candidate;
  }
  const records = [{ version: previous.version, ...previous.compatibility?.minAppVersion ? { minAppVersion: previous.compatibility.minAppVersion } : {}, archive: previous.archive }, ...previous.versions || []];
  const versions = records.sort((a, b) => comparePluginVersions(b.version, a.version));
  return { ...candidate, versions };
}
function deepEqual(a, b) {
  return stableJson(a) === stableJson(b);
}
async function synchronizeMarket({ registry, previousIndex = null, fetchImpl = fetch, token, now = () => /* @__PURE__ */ new Date() }) {
  const registrations = readRegistry(registry);
  const previous = previousIndex === null ? null : strictIndex(previousIndex, "previous index");
  const previousItems = new Map((previous?.items || []).map((item) => [`${item.kind}:${item.id}`, item]));
  const failures = [];
  const items = [];
  for (const registration of registrations) {
    try {
      const { assets, tagName } = await readRelease(registration, { fetchImpl, token });
      const fixedName = releaseEntryFileName(registration);
      const possibleEntries = fixedName ? [findOnlyAsset(assets, fixedName, "entry", registration.repository, tagName)] : assets.filter((asset) => isPlainObject2(asset) && typeof asset.name === "string" && asset.name.startsWith(`${registration.kind}-${registration.id}-`) && asset.name.endsWith(".entry.json"));
      if (!fixedName && possibleEntries.length !== 1) throw new Error(`latest release must contain exactly one entry metadata asset for ${registration.kind}-${registration.id}`);
      const entryAsset = assertReleaseAsset(possibleEntries[0], registration.repository, tagName, "entry");
      const entry = await readEntryAsset(entryAsset, registration, { fetchImpl, token });
      const expectedName = expectedEntryName(registration, entry.version);
      if (entryAsset.name !== expectedName) throw new Error(`entry asset must be named ${expectedName}`);
      const zipName = validateEntry(entry, registration);
      const zipAsset = findOnlyAsset(assets, zipName, "ZIP", registration.repository, tagName);
      await verifyArchive(zipAsset, entry, registration, { fetchImpl, token });
      const candidate = normalizeItem(projectEntry(entry, registration, zipAsset.browser_download_url));
      items.push(historyFor(previousItems.get(`${registration.kind}:${registration.id}`), candidate, registration));
    } catch (error) {
      failures.push(`${registration.kind}/${registration.id} (${registration.repository}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) throw new Error(`market synchronization failed for ${failures.length} enrollment(s):
${failures.map((failure) => `- ${failure}`).join("\n")}`);
  items.sort((a, b) => a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind));
  const draft = {
    schemaVersion: MARKET_INDEX_SCHEMA_VERSION,
    sourceId: MARKET_SOURCE_ID,
    name: MARKET_NAME,
    publishedAt: previous?.publishedAt || now().toISOString(),
    items
  };
  if (previous && !deepEqual({ ...draft, publishedAt: previous.publishedAt }, previous)) {
    const previousMs = Date.parse(previous.publishedAt);
    const requestedMs = now().getTime();
    draft.publishedAt = new Date(Math.max(requestedMs, previousMs + 1)).toISOString();
  }
  const index = strictIndex(draft, "generated index");
  const unchanged = Boolean(previous && deepEqual(index, previous));
  return { index, unchanged };
}
function writeIndexAtomically(outPath, index) {
  const directory = path.dirname(outPath);
  fs.mkdirSync(directory, { recursive: true });
  const pending = path.join(directory, `.${path.basename(outPath)}.${process.pid}.${crypto.randomUUID()}.pending`);
  try {
    fs.writeFileSync(pending, `${JSON.stringify(index, null, 2)}
`, "utf8");
    fs.renameSync(pending, outPath);
  } finally {
    fs.rmSync(pending, { force: true });
  }
}
function parseArgs(argv) {
  const args = { registry: null, previous: null, out: null, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--registry") args.registry = argv[++i];
    else if (arg === "--previous") args.previous = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--check") args.check = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!args.registry || !args.out) throw new Error("Usage: extension-market-sync --registry registry.json --previous index.v2.json --out index.v2.json [--check]");
  return args;
}
async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const outPath = path.resolve(args.out);
    const previousPath = path.resolve(args.previous || args.out);
    if (args.previous && !fs.existsSync(previousPath)) throw new Error(`--previous does not exist: ${previousPath}`);
    const registry = JSON.parse(fs.readFileSync(path.resolve(args.registry), "utf8"));
    const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, "utf8")) : null;
    const { index, unchanged } = await synchronizeMarket({ registry, previousIndex: previous, token: process.env.GITHUB_TOKEN });
    if (args.check) console.log(`extension-market-sync: ${unchanged ? "no changes" : "index would change"} (${index.items.length} item(s))`);
    else if (unchanged && outPath === previousPath) console.log(`extension-market-sync: no changes (${index.items.length} item(s))`);
    else {
      writeIndexAtomically(outPath, index);
      console.log(`extension-market-sync: ${unchanged ? "copied" : "wrote"} ${outPath} (${index.items.length} item(s))`);
    }
  } catch (error) {
    console.error(`extension-market-sync: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
export {
  MARKET_NAME,
  MARKET_SOURCE_ID,
  readRegistry,
  synchronizeMarket,
  writeIndexAtomically
};

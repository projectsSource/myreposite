export const config = {
  runtime: "edge",
};

/*
  این route الان روی Vercel ثابت شد که کار می‌کند.
  مقصد مستقیم داخل کد است و از .env نمی‌خواند.
*/
const TARGET_DOMAIN = normalizeTarget("https://free.multivit.store:2087");
const TARGET_PATH = normalizePath("/my-relay-path");

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const BLOCKED_REQUEST_HEADERS = new Set([
  "host",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-vercel-id",
  "x-vercel-forwarded-for",
  "x-matched-path",
  "x-now-id",
  "x-now-route-matches",
]);

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

export default async function handler(request) {
  try {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = buildUpstreamUrl(TARGET_DOMAIN, TARGET_PATH, incomingUrl);
    const upstreamHeaders = buildUpstreamHeaders(request.headers);

    return await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: NO_BODY_METHODS.has(request.method) ? undefined : request.body,
      redirect: "manual",
      duplex: "half",
    });
  } catch (error) {
    console.error("relay_error", {
      message: error?.message || String(error),
    });

    return new Response("Bad Gateway: Tunnel Failed", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}

function normalizeTarget(value) {
  if (!value) return "";

  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    url.hash = "";
    url.search = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizePath(value) {
  if (!value) return "/";

  let path = String(value).trim();

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  path = path.replace(/\/{2,}/g, "/");

  return path;
}

function buildUpstreamUrl(targetDomain, targetPath, incomingUrl) {
  const query = incomingUrl.searchParams.toString();
  return `${targetDomain}${targetPath}${query ? `?${query}` : ""}`;
}

function buildUpstreamHeaders(inputHeaders) {
  const output = new Headers();

  for (const [key, value] of inputHeaders.entries()) {
    const lowerKey = key.toLowerCase();

    if (HOP_BY_HOP_HEADERS.has(lowerKey)) continue;
    if (BLOCKED_REQUEST_HEADERS.has(lowerKey)) continue;
    if (lowerKey.startsWith("x-vercel-")) continue;
    if (lowerKey.startsWith("x-now-")) continue;

    output.set(key, value);
  }

  return output;
}

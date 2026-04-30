export const config = {
  runtime: "edge",
};

const TARGET_DOMAIN = normalizeTarget(process.env.TARGET_DOMAIN);

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
  if (!TARGET_DOMAIN) {
    return text("TARGET_DOMAIN is not configured.", 500);
  }

  if (!isAllowedMethod(request.method)) {
    return text("Method not allowed.", 405, {
      Allow: "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    });
  }

  try {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = buildUpstreamUrl(TARGET_DOMAIN, incomingUrl);
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

    return text("Bad Gateway: Tunnel Failed", 502);
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

function isAllowedMethod(method) {
  return ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(
    method
  );
}

function buildUpstreamUrl(targetDomain, incomingUrl) {
  /*
    دو حالت را پشتیبانی می‌کند:

    حالت ۱ - مدل قدیمی/کارکرده:
      Client: /my-relay-path
      Origin: TARGET_DOMAIN/my-relay-path

    حالت ۲ - مدل _path:
      Client: /api/relay?_path=/my-relay-path
      Origin: TARGET_DOMAIN/my-relay-path
  */

  const explicitPath = incomingUrl.searchParams.get("_path");

  if (explicitPath) {
    incomingUrl.searchParams.delete("_path");

    const cleanPath = sanitizePath(explicitPath);
    const query = incomingUrl.searchParams.toString();

    return `${targetDomain}${cleanPath}${query ? `?${query}` : ""}`;
  }

  const cleanPath = sanitizePath(incomingUrl.pathname);
  const query = incomingUrl.searchParams.toString();

  return `${targetDomain}${cleanPath}${query ? `?${query}` : ""}`;
}

function sanitizePath(path) {
  if (!path) return "/";

  let clean = String(path).trim();

  if (!clean.startsWith("/")) {
    clean = `/${clean}`;
  }

  clean = clean.replace(/\/{2,}/g, "/");

  return clean;
}

function buildUpstreamHeaders(inputHeaders) {
  const output = new Headers();
  let clientIp = "";

  for (const [key, value] of inputHeaders.entries()) {
    const lowerKey = key.toLowerCase();

    if (HOP_BY_HOP_HEADERS.has(lowerKey)) continue;
    if (BLOCKED_REQUEST_HEADERS.has(lowerKey)) continue;
    if (lowerKey.startsWith("x-vercel-")) continue;
    if (lowerKey.startsWith("x-now-")) continue;

    if (lowerKey === "x-real-ip") {
      clientIp = value;
      continue;
    }

    if (lowerKey === "x-forwarded-for") {
      if (!clientIp) {
        clientIp = value.split(",")[0].trim();
      }
      continue;
    }

    output.set(key, value);
  }

  if (clientIp) {
    output.set("x-forwarded-for", clientIp);
  }

  return output;
}

function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

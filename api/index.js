export const config = {
  runtime: "edge",
};

/*
  مقصد مستقیم داخل کد است.
  دیگر از .env یا Vercel Environment Variable نمی‌خواند.
*/
const MY_Target = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const HOP_BY_HOP_HEADERS = new Set([
   "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

 
//const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

export default async function handler(request) {
  if (!MY_Target) {
    return text("MY_Target is not configured.", 500);
  }

  try {
    const pathStart = request.url.indexOf("/", 8);
    const targetUrl =
      pathStart === -1 ? MY_Target + "/" : MY_Target + request.url.slice(pathStart);

    const out = new Headers();
    let clientIp = null;
    for (const [k, v] of request.headers) {
      if (HOP_BY_HOP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        clientIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }
      out.set(k, v);
    }
    if (clientIp) out.set("x-forwarded-for", clientIp);

    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return await fetch(targetUrl, {
      method,
      headers: out,
      body: hasBody ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    return new Response(
      "Bad Gateway: " + (err?.message || String(err)),
      {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
}

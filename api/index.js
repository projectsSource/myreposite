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

  if (!isAllowedMethod(request.method)) {
    return text("Method not allowed.", 405, {
      Allow: "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    });
  }

  try {
 try {
    const pathStart = req.url.indexOf("/", 8);
    const targetUrl =
      pathStart === -1 ? MY_Target + "/" : MY_Target + req.url.slice(pathStart);

    const out = new Headers();
    let clientIp = null;
    for (const [k, v] of req.headers) {
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

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return await fetch(targetUrl, {
      method,
      headers: out,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    console.error("relay error:", err);
    return new Response("Bad Gateway: Tunnel Failed", { status: 502 });
  }
}

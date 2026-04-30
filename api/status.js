export const config = {
  runtime: "edge",
};

const TARGET_URL = "https://free.multivit.store:2087/my-relay-path";

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const target = url.search ? `${TARGET_URL}${url.search}` : TARGET_URL;

    const headers = new Headers(request.headers);

    headers.delete("host");
    headers.delete("connection");
    headers.delete("keep-alive");
    headers.delete("transfer-encoding");
    headers.delete("upgrade");
    headers.delete("x-vercel-id");
    headers.delete("x-vercel-forwarded-for");
    headers.delete("x-matched-path");
    headers.delete("x-now-id");

    const method = request.method;
    const init = {
      method,
      headers,
      redirect: "manual",
    };

    if (method !== "GET" && method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half";
    }

    return await fetch(target, init);
  } catch (e) {
    return new Response("Bad Gateway: Tunnel Failed", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}

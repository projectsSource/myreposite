export const config = {
  runtime: "edge",
};

export default function handler() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "novaedge-service",
      runtime: "vercel-edge",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    }
  );
}

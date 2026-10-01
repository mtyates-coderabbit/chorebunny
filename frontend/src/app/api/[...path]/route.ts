import { requireLogin } from "@/lib/server-auth";

export const runtime = "nodejs";

/** Forward allowlisted API requests with server credentials after login and origin checks; preserve upstream status/body, return 401/403/404/503 for rejected requests, and convert forwarding failures to 502. */
async function forward(request: Request): Promise<Response> {
  const denied = requireLogin(request);
  if (denied) return denied;

  const url = new URL(request.url);
  if (!/^\/api\/(tasks(?:\/\d+(?:\/reorder)?)?|completions(?:\/toggle)?|summary(?:\/range)?|streaks|children(?:\/\d+)?|settings)$/.test(url.pathname)) {
    return new Response("Not found", { status: 404 });
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response("Forbidden", { status: 403 });
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    try {
      if (!origin || new URL(origin).host !== request.headers.get("host")) {
        return new Response("Forbidden", { status: 403 });
      }
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) return new Response("API is not configured", { status: 503 });

  try {
    const upstream = await fetch(new URL(url.pathname + url.search, process.env.API_URL ?? "http://localhost:8000"), {
      method: request.method,
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
      cache: "no-store",
      redirect: "error",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("API unavailable", { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE, forward as HEAD };

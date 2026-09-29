// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, PUT, DELETE } from "@/app/api/[...path]/route";
import { proxy } from "@/proxy";
import { fetchTasks } from "@/lib/api";

const authorization = `Basic ${Buffer.from("parent:test-password").toString("base64")}`;
const upstream = vi.fn();

function request(path = "/api/tasks", init: RequestInit = {}) {
  return new Request(`https://chores.example${path}`, {
    ...init,
    headers: { authorization, host: "chores.example", ...init.headers },
  });
}

beforeEach(() => {
  vi.stubEnv("APP_USERNAME", "parent");
  vi.stubEnv("APP_PASSWORD", "test-password");
  vi.stubEnv("API_KEY", "server-secret");
  vi.stubEnv("API_URL", "https://backend.example");
  vi.stubGlobal("fetch", upstream);
  upstream.mockResolvedValue(Response.json([]));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("authorized API proxy", () => {
  it.each(["", "Bearer token", "Basic invalid", `Basic ${Buffer.from("parent:wrong").toString("base64")}`])("rejects invalid login %s before forwarding", async (value) => {
    const response = await GET(request(undefined, { headers: { authorization: value } }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(["APP_USERNAME", "APP_PASSWORD", "API_KEY"])("fails closed without %s", async (name) => {
    vi.stubEnv(name, "");
    expect((await GET(request())).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards queries and only server credentials, with caching and redirects disabled", async () => {
    const response = await GET(request("/api/tasks?routine=morning", {
      headers: { "X-Api-Key": "attacker-key", cookie: "private-cookie" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    const [url, options] = upstream.mock.calls[0];
    expect(String(url)).toBe("https://backend.example/api/tasks?routine=morning");
    expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", "X-Api-Key": "server-secret" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-api-key")).toBeNull();
  });

  it.each([undefined, "null", "https://attacker.example"])("rejects writes with origin %s", async (origin) => {
    const headers: Record<string, string> = origin ? { origin } : {};
    expect((await POST(request(undefined, { method: "POST", headers, body: "{}" }))).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects cross-site reads", async () => {
    expect((await GET(request(undefined, { headers: { "sec-fetch-site": "cross-site" } }))).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([["POST", POST], ["PUT", PUT], ["DELETE", DELETE]] as const)("forwards authorized %s and preserves response status", async (method, handler) => {
    upstream.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await handler(request("/api/tasks/1", {
      method, body: "{}", headers: { origin: "https://chores.example" },
    }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(upstream.mock.calls[0][1]).toMatchObject({ method, body: "{}" });
  });

  it("preserves backend validation errors", async () => {
    upstream.mockResolvedValue(Response.json({ detail: "invalid" }, { status: 422 }));
    const response = await GET(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ detail: "invalid" });
  });

  it("forwards an authorized reorder request", async () => {
    upstream.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await POST(request("/api/tasks/1/reorder", {
      method: "POST", body: '{"direction":-1}', headers: { origin: "https://chores.example" },
    }));
    expect(response.status).toBe(204);
    expect(String(upstream.mock.calls[0][0])).toBe("https://backend.example/api/tasks/1/reorder");
    expect(upstream.mock.calls[0][1]).toMatchObject({ method: "POST", body: '{"direction":-1}' });
  });

  it("returns a generic upstream failure", async () => {
    upstream.mockRejectedValue(new Error("sensitive details"));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.text()).toBe("API unavailable");
  });

  it.each(["/api/unknown", "/api/tasks%2f..%2fadmin", "/api/tasks/1/extra", "/api/tasks/reorder", "/api/tasks/1/reorder/extra"])("rejects paths outside the API allowlist: %s", async (path) => {
    expect((await GET(request(path))).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});

it("challenges page navigation and permits the configured login", () => {
  expect(proxy(new NextRequest("https://chores.example/morning")).status).toBe(401);
  expect(proxy(new NextRequest("https://chores.example/morning", { headers: { authorization } })).status).toBe(200);
});

it("browser API calls use the same origin without a shared key", async () => {
  await fetchTasks("morning");
  expect(upstream).toHaveBeenCalledWith("/api/tasks?routine=morning&active_only=true", {
    headers: { "Content-Type": "application/json" },
  });
});

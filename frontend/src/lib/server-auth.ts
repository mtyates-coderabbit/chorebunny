import { createHash, timingSafeEqual } from "node:crypto";

export function requireLogin(request: Request): Response | undefined {
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if (!username || !password) {
    return new Response("Login is not configured", { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`${username}:${password}`).toString("base64");
  const supplied = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)?.[1] ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(expected))) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="ChoreBunny", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }
}

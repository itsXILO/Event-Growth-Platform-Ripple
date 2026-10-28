import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import app from "../src/index";

let server: Server;
let baseUrl: string;
const TEST_EVENT_SLUG = "nxtwave-ai-project-in-60-mins";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

describe("Step 10: Admin Authentication, Protected Analytics & CSV Export", () => {
  let adminCookie: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects unauthorized access to /api/admin/events/:slug/analytics with 401", async () => {
    const res = await fetch(`${baseUrl}/api/admin/events/${TEST_EVENT_SLUG}/analytics`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("checks auth status as unauthenticated when no cookie is sent", async () => {
    const res = await fetch(`${baseUrl}/api/admin/check`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(false);
  });

  it("rejects login with an invalid password", async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "incorrect-password" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("logs in successfully with the correct ADMIN_PASSWORD and sets an httpOnly cookie", async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("admin_token=");
    expect(setCookie?.toLowerCase()).toContain("httponly");

    // Extract cookie for subsequent calls
    adminCookie = (setCookie?.split(";")[0]) || "";
  });

  it("returns authenticated: true when valid admin cookie is provided", async () => {
    const res = await fetch(`${baseUrl}/api/admin/check`, {
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
  });

  it("returns full analytics (timeline, 500 goal conversion, colleges, sources) with admin cookie", async () => {
    const res = await fetch(`${baseUrl}/api/admin/events/${TEST_EVENT_SLUG}/analytics`, {
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.kpis).toBeDefined();
    expect(data.kpis.goal).toBe(500);
    expect(typeof data.kpis.totalRegistrations).toBe("number");
    expect(typeof data.kpis.goalPercent).toBe("number");
    expect(Array.isArray(data.timeline)).toBe(true);
    expect(Array.isArray(data.byCollege)).toBe(true);
    expect(Array.isArray(data.bySource)).toBe(true);
  });

  it("returns paginated recent registrations with admin cookie", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/events/${TEST_EVENT_SLUG}/registrations?limit=10&offset=0`,
      {
        headers: { Cookie: adminCookie },
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.registrations)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  it("exports registrations as a downloadable CSV with proper text/csv headers", async () => {
    const res = await fetch(`${baseUrl}/api/admin/events/${TEST_EVENT_SLUG}/export.csv`, {
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment; filename=");

    const csvText = await res.text();
    expect(csvText).toContain("ID,Name,Email,College,Semester,Branch,Source,Referral Code");
  });

  it("logs out and clears the admin session cookie", async () => {
    const res = await fetch(`${baseUrl}/api/admin/logout`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    // Cleared cookie has expired date or empty value
    expect(setCookie?.toLowerCase()).toMatch(/(expires=|max-age=0)/);
  });
});

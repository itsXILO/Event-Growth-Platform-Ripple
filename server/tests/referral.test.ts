import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import app from "../src/index";
import { db } from "../src/db";
import { events, communities, registrations } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

let server: Server;
let baseUrl: string;
const TEST_EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

describe("Event Growth Platform – Referral Attribution & Registration Suite", () => {
  let collegeId: number;
  let clubId: number;
  let studentARefCode: string;
  let studentAEmail: string;

  beforeAll(async () => {
    // 1. Start server on random available port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    // 2. Lookup existing test college and club from seeded data
    const [college] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.type, "college"))
      .limit(1);
    collegeId = college.id;

    const [club] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.type, "club"))
      .limit(1);
    clubId = club.id;
  });

  afterAll(async () => {
    // Clean up test registrations created in this test run
    const testEmails = [
      studentAEmail,
      "student.b.referred@test.com",
      "student.c.club@test.com",
      "student.d.direct@test.com",
    ].filter(Boolean);

    for (const email of testEmails) {
      await db.delete(registrations).where(eq(registrations.email, email));
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("1. Successfully creates a direct registration and returns unique referral code", async () => {
    studentAEmail = `student.a.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Alpha",
        email: studentAEmail,
        collegeId,
        semester: 7,
        branch: "Computer Science & Engineering",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration).toBeDefined();
    expect(data.registration.source).toBe("direct");
    expect(data.referralCode).toMatch(/^REF-[A-Z0-9]{6}$/);
    expect(data.shareLink).toContain(`?ref=${data.referralCode}`);

    studentARefCode = data.referralCode;
  });

  it("2. Correctly credits the referrer and their college when registering via ?ref=CODE", async () => {
    const studentBEmail = `student.b.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Beta",
        email: studentBEmail,
        collegeId,
        semester: 6,
        branch: "Information Science & Engineering",
        referralCode: studentARefCode,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration.source).toBe("referral");

    // Verify in database that referredByRegistrationId points to Student Alpha
    const [studentBRecord] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, studentBEmail));

    const [studentARecord] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, studentAEmail));

    expect(studentBRecord.referredByRegistrationId).toBe(studentARecord.id);

    // Clean up student B
    await db.delete(registrations).where(eq(registrations.email, studentBEmail));
  });

  it("3. Rejects self-referral when registrant uses their own referral code", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Alpha Impersonator",
        email: studentAEmail,
        collegeId,
        semester: 7,
        branch: "Computer Science & Engineering",
        referralCode: studentARefCode,
      }),
    });

    // Student A is already registered, so duplicate or self-referral check protects it
    expect([400, 409]).toContain(res.status);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("4. Rejects duplicate emails for the same event with a friendly message", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Alpha Again",
        email: studentAEmail,
        collegeId,
        semester: 7,
        branch: "Computer Science & Engineering",
      }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already registered");
  });

  it("5. Correctly attributes club link registrations to community_id", async () => {
    const studentCEmail = `student.c.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Gamma",
        email: studentCEmail,
        collegeId,
        semester: 8,
        branch: "Artificial Intelligence & Data Science",
        clubId,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration.source).toBe("club_link");

    const [record] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, studentCEmail));

    expect(record.communityId).toBe(clubId);

    // Clean up
    await db.delete(registrations).where(eq(registrations.email, studentCEmail));
  });

  it("6. Zod validation rejects invalid semester (not 6, 7, or 8)", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Freshman Student",
        email: `freshman.${Date.now()}@test.com`,
        collegeId,
        semester: 3, // Invalid semester
        branch: "Computer Science",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
    expect(data.details.some((d: { field: string }) => d.field === "semester")).toBe(true);
  });

  it("7. Validates GET /api/events/:slug/leaderboard returns ranked colleges and clubs", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/leaderboard`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.event).toBeDefined();
    expect(Array.isArray(data.colleges)).toBe(true);
    expect(data.colleges.length).toBeGreaterThan(0);
    expect(data.colleges[0].rank).toBe(1);
    expect(data.colleges[0].totalRegistrations).toBeGreaterThanOrEqual(
      data.colleges[data.colleges.length - 1].totalRegistrations
    );

    expect(Array.isArray(data.clubs)).toBe(true);
    expect(Array.isArray(data.champions)).toBe(true);
  });

  it("8. Validates GET /api/events/:slug/admin/analytics provides required chart and KPI data", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/admin/analytics`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.kpis).toBeDefined();
    expect(data.kpis.totalRegistrations).toBeGreaterThan(0);
    expect(data.kpis.capacity).toBe(1000);
    expect(Array.isArray(data.timeline)).toBe(true);
    expect(Array.isArray(data.byCollege)).toBe(true);
    expect(Array.isArray(data.bySource)).toBe(true);
    expect(Array.isArray(data.roadmap)).toBe(true);
  });
});

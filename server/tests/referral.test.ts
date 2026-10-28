import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import app from "../src/index";
import { db } from "../src/db";
import { communities, registrations } from "../src/db/schema";
import { eq } from "drizzle-orm";

let server: Server;
let baseUrl: string;
const TEST_EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

describe("Step 5: Referral Attribution & Registration Test Suite", () => {
  let collegeId: number;
  let clubId: number;
  let referrerCode: string;
  let referrerEmail: string;

  beforeAll(async () => {
    // 1. Start server on ephemeral port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    // 2. Fetch test college from database
    const [college] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.type, "college"))
      .limit(1);
    collegeId = college.id;

    // 3. Fetch test club from database
    const [club] = await db
      .select({ id: communities.id, name: communities.name })
      .from(communities)
      .where(eq(communities.type, "club"))
      .limit(1);
    clubId = club.id;

    // 4. Create an initial referrer registrant (Student Alpha)
    referrerEmail = `student.alpha.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Alpha",
        email: referrerEmail,
        collegeId,
        semester: 7,
        branch: "Computer Science & Engineering",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    referrerCode = json.referralCode;
  });

  afterAll(async () => {
    // Clean up test registrations created in this run
    if (referrerEmail) {
      await db.delete(registrations).where(eq(registrations.email, referrerEmail));
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // ── 1. Valid Referral ────────────────────────────────────────────────────────
  it("credits the referrer and sets source='referral' with valid referral code", async () => {
    const friendEmail = `friend.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Friend of Alpha",
        email: friendEmail,
        collegeId,
        semester: 6,
        branch: "Information Science & Engineering",
        referralCode: referrerCode,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration).toBeDefined();
    expect(data.registration.source).toBe("referral");

    // Verify DB foreign key relationship
    const [friendRecord] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, friendEmail));

    const [alphaRecord] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, referrerEmail));

    expect(friendRecord.referredByRegistrationId).toBe(alphaRecord.id);

    // Clean up
    await db.delete(registrations).where(eq(registrations.email, friendEmail));
  });

  // ── 2. Club Link ─────────────────────────────────────────────────────────────
  it("attributes registration to community_id and sets source='club_link' via club slug", async () => {
    const clubStudentEmail = `club.student.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Club Member",
        email: clubStudentEmail,
        collegeId,
        semester: 8,
        branch: "Artificial Intelligence & Data Science",
        clubSlug: "pes-open-source-community",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration.source).toBe("club_link");

    const [record] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, clubStudentEmail));

    expect(record.source).toBe("club_link");
    expect(record.communityId).toBeGreaterThan(0);
    expect(record.referredByRegistrationId).toBeNull();

    // Clean up
    await db.delete(registrations).where(eq(registrations.email, clubStudentEmail));
  });

  // ── 3. Unknown Code Fallback ──────────────────────────────────────────────────
  it("gracefully registers user as source='direct' when given an unknown referral code", async () => {
    const unknownRefEmail = `unknown.ref.${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unknown Code User",
        email: unknownRefEmail,
        collegeId,
        semester: 7,
        branch: "Mechanical Engineering",
        referralCode: "REF-INVALID99",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration.source).toBe("direct");

    const [record] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.email, unknownRefEmail));

    expect(record.source).toBe("direct");
    expect(record.referredByRegistrationId).toBeNull();

    // Clean up
    await db.delete(registrations).where(eq(registrations.email, unknownRefEmail));
  });

  // ── 4. Self-Referral Rejection ────────────────────────────────────────────────
  it("rejects self-referral with 400 Bad Request when user provides their own referral code", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Alpha Trying Self Referral",
        email: referrerEmail,
        collegeId,
        semester: 7,
        branch: "Computer Science & Engineering",
        referralCode: referrerCode,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Self-referral is not permitted");
  });

  // ── 5. Duplicate Email Rejection ──────────────────────────────────────────────
  it("rejects duplicate email registrations for the same event with 409 Conflict", async () => {
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Alpha Again",
        email: referrerEmail, // already in database from beforeAll
        collegeId,
        semester: 7,
        branch: "Computer Science & Engineering",
      }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already registered");
  });
});

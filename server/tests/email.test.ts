import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import app from "../src/index";
import { db } from "../src/db";
import { communities } from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  generateIcsCalendar,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from "../src/utils/calendar";
import { sendRegistrationConfirmationEmail } from "../src/utils/email";

let server: Server;
let baseUrl: string;
const TEST_EVENT_SLUG = "nxtwave-ai-project-in-60-mins";

describe("Step 11: Registration Confirmation Email, ICS Calendar & Add-To-Calendar Links", () => {
  let collegeId: number;

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

    const [college] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.type, "college"))
      .limit(1);
    collegeId = college.id;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("generates a compliant RFC 5545 .ics iCalendar string", () => {
    const eventTime = new Date("2026-11-07T18:00:00+05:30");
    const ics = generateIcsCalendar({
      title: "Build Your First AI Project in 60 Minutes",
      description: "Interactive AI Workshop by NxtWave",
      location: "Browser Cloud IDE",
      startsAt: eventTime,
      durationMinutes: 60,
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Build Your First AI Project in 60 Minutes");
    expect(ics).toContain("LOCATION:Browser Cloud IDE");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("generates functional 1-click Google and Outlook calendar URLs", () => {
    const eventTime = new Date("2026-11-07T18:00:00+05:30");
    const details = {
      title: "Build Your First AI Project in 60 Minutes",
      description: "NxtWave Live Workshop",
      location: "Online",
      startsAt: eventTime,
    };

    const googleUrl = getGoogleCalendarUrl(details);
    expect(googleUrl).toContain("https://calendar.google.com/calendar/render");
    expect(googleUrl).toContain("action=TEMPLATE");
    expect(googleUrl).toContain("Build+Your+First+AI+Project");

    const outlookUrl = getOutlookCalendarUrl(details);
    expect(outlookUrl).toContain("https://outlook.live.com/calendar/0/deeplink/compose");
    expect(outlookUrl).toContain("path=%2Fcalendar%2Faction%2Fcompose");
  });

  it("safely mocks and logs confirmation email when RESEND_API_KEY is not set", async () => {
    const result = await sendRegistrationConfirmationEmail({
      to: "student.test@example.com",
      name: "Student Test",
      eventTitle: "Build Your First AI Project in 60 Minutes",
      eventStartsAt: new Date(),
      eventSlug: TEST_EVENT_SLUG,
      referralCode: "REF-TEST123",
      shareLink: "http://localhost:5173/?ref=REF-TEST123",
      collegeName: "RV College of Engineering",
    });

    expect(result.success).toBe(true);
    expect(result.mock).toBe(true);
    expect(result.messageId).toContain("mock-");
  });

  it("completes registration with 201 Created non-blockingly and failure-safely", async () => {
    const testEmail = `student.emailtest.${Date.now()}@example.com`;
    const res = await fetch(`${baseUrl}/api/events/${TEST_EVENT_SLUG}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Email Test Student",
        email: testEmail,
        collegeId,
        semester: 6,
        branch: "Computer Science & Engineering",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.registration.email).toBe(testEmail);
    expect(data.referralCode).toBeDefined();
    expect(data.shareLink).toBeDefined();
  });
});

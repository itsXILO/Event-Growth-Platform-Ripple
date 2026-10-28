import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { events, communities, registrations } from "../db/schema";
import { generateReferralCode } from "../utils/referral";

const router = Router();

// ── Validation Schema ─────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  email: z
    .string({ required_error: "Email address is required" })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  collegeId: z.coerce
    .number({ required_error: "Please select your college" })
    .int("College ID must be an integer")
    .positive("Please select a valid college"),
  semester: z.coerce
    .number({ required_error: "Please select your current semester" })
    .int()
    .refine((val) => [6, 7, 8].includes(val), {
      message: "Target cohort is 6th, 7th, or 8th semester BE students",
    }),
  branch: z
    .string({ required_error: "Engineering branch is required" })
    .trim()
    .min(2, "Branch name must be at least 2 characters")
    .max(100, "Branch name cannot exceed 100 characters"),
  referralCode: z.string().trim().optional(),
  ref: z.string().trim().optional(), // alias for referralCode if passed from query/body
  clubId: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/events/:slug
 * Retrieve event details and summary stats
 */
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const [regCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrations)
      .where(eq(registrations.eventId, event.id));

    res.json({
      event: {
        ...event,
        totalRegistrations: regCount?.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/events/:slug/register
 * Register a student for the event with referral/club attribution
 */
router.post("/:slug/register", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // 1. Validate request body with Zod
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        error: "Validation failed",
        details: formattedErrors,
      });
    }

    const {
      name,
      email,
      collegeId,
      semester,
      branch,
      referralCode: explicitRefCode,
      ref,
      clubId,
    } = validationResult.data;

    const inputRefCode = (explicitRefCode || ref || "").trim().toUpperCase();

    // 2. Verify event exists
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // 3. Verify college exists and is of type 'college'
    const [college] = await db
      .select()
      .from(communities)
      .where(and(eq(communities.id, collegeId), eq(communities.type, "college")))
      .limit(1);

    if (!college) {
      return res.status(400).json({
        error: "Invalid college selected. Please pick a verified college from the list.",
      });
    }

    // 4. Reject duplicate registrations for this event + email
    const [duplicate] = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.eventId, event.id), eq(registrations.email, email)))
      .limit(1);

    if (duplicate) {
      return res.status(409).json({
        error: "You are already registered for this event with this email address! Check your inbox for confirmation details.",
      });
    }

    // 5. Handle referral attribution & self-referral rejection
    let source: "direct" | "referral" | "club_link" = "direct";
    let referredByRegistrationId: number | null = null;
    let communityId: number | null = null;

    if (inputRefCode) {
      // Find the referring registration for this event
      const [referrer] = await db
        .select({
          id: registrations.id,
          email: registrations.email,
        })
        .from(registrations)
        .where(
          and(
            eq(registrations.eventId, event.id),
            eq(registrations.referralCode, inputRefCode)
          )
        )
        .limit(1);

      if (referrer) {
        // Self-referral rejection rule
        if (referrer.email.toLowerCase() === email.toLowerCase()) {
          return res.status(400).json({
            error: "Self-referral is not permitted. You cannot register using your own referral code.",
          });
        }

        referredByRegistrationId = referrer.id;
        source = "referral";
      }
    }

    // 6. If not a referral, check if signed up via a club link
    if (!referredByRegistrationId && clubId) {
      const [club] = await db
        .select({ id: communities.id })
        .from(communities)
        .where(and(eq(communities.id, clubId), eq(communities.type, "club")))
        .limit(1);

      if (club) {
        communityId = club.id;
        source = "club_link";
      }
    }

    // 7. Generate a unique short referral code
    let uniqueReferralCode = "";
    let attempts = 0;
    while (!uniqueReferralCode && attempts < 10) {
      attempts++;
      const candidateCode = generateReferralCode("REF", 6);
      const [existing] = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.referralCode, candidateCode))
        .limit(1);

      if (!existing) {
        uniqueReferralCode = candidateCode;
      }
    }

    if (!uniqueReferralCode) {
      return res.status(500).json({ error: "Failed to generate a referral code. Please try again." });
    }

    // 8. Insert registration
    const [newRegistration] = await db
      .insert(registrations)
      .values({
        eventId: event.id,
        name,
        email,
        collegeId,
        communityId,
        semester,
        branch,
        referralCode: uniqueReferralCode,
        referredByRegistrationId,
        source,
      })
      .returning();

    // 9. Build share link
    const clientOrigin =
      process.env.CLIENT_ORIGIN ||
      req.headers.origin ||
      "http://localhost:5173";

    const shareLink = `${clientOrigin}/?ref=${newRegistration.referralCode}`;

    return res.status(201).json({
      message: "Registration successful! Welcome to the workshop.",
      registration: {
        id: newRegistration.id,
        name: newRegistration.name,
        email: newRegistration.email,
        collegeId: newRegistration.collegeId,
        semester: newRegistration.semester,
        branch: newRegistration.branch,
        referralCode: newRegistration.referralCode,
        source: newRegistration.source,
        createdAt: newRegistration.createdAt,
      },
      referralCode: newRegistration.referralCode,
      shareLink,
    });
  } catch (error: unknown) {
    // Catch unique constraint violation in case of concurrent requests
    const dbErr = error as { code?: string; constraint?: string };
    if (dbErr?.code === "23505" || dbErr?.constraint === "uq_registrations_event_email") {
      return res.status(409).json({
        error: "You are already registered for this event with this email address!",
      });
    }

    console.error("Registration error:", error);
    return res.status(500).json({ error: "An unexpected error occurred during registration" });
  }
});

/**
 * GET /api/events/:slug/referral-info?code=REF-XXXX
 * Looks up referrer details so the UI can display personal attribution greeting
 */
router.get("/:slug/referral-info", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const code = (req.query.code as string || "").trim().toUpperCase();

    if (!code) {
      return res.status(400).json({ error: "Referral code query parameter is required" });
    }

    const [event] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const [referrer] = await db
      .select({
        id: registrations.id,
        name: registrations.name,
        referralCode: registrations.referralCode,
        collegeId: registrations.collegeId,
        collegeName: communities.name,
      })
      .from(registrations)
      .innerJoin(communities, eq(registrations.collegeId, communities.id))
      .where(
        and(
          eq(registrations.eventId, event.id),
          eq(registrations.referralCode, code)
        )
      )
      .limit(1);

    if (!referrer) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    return res.json({
      valid: true,
      referrer: {
        name: referrer.name,
        collegeName: referrer.collegeName,
        code: referrer.referralCode,
      },
    });
  } catch (error) {
    console.error("Referral lookup error:", error);
    return res.status(500).json({ error: "Failed to look up referral code" });
  }
});

/**
 * GET /api/events/:slug/leaderboard
 * Live leaderboard rankings for colleges, clubs, and student champions
 */
router.get("/:slug/leaderboard", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // 1. College Leaderboard (Total registrations credited to each college)
    const collegeRows = await db
      .select({
        collegeId: communities.id,
        collegeName: communities.name,
        count: sql<number>`count(${registrations.id})::int`,
        directCount: sql<number>`count(case when ${registrations.source} = 'direct' then 1 end)::int`,
        referralCount: sql<number>`count(case when ${registrations.source} = 'referral' then 1 end)::int`,
        clubCount: sql<number>`count(case when ${registrations.source} = 'club_link' then 1 end)::int`,
      })
      .from(communities)
      .leftJoin(
        registrations,
        and(
          eq(registrations.collegeId, communities.id),
          eq(registrations.eventId, event.id)
        )
      )
      .where(eq(communities.type, "college"))
      .groupBy(communities.id, communities.name)
      .orderBy(sql`count(${registrations.id}) desc`, communities.name);

    const collegesLeaderboard = collegeRows.map((row, index) => ({
      rank: index + 1,
      id: row.collegeId,
      name: row.collegeName,
      totalRegistrations: row.count,
      breakdown: {
        direct: row.directCount,
        referral: row.referralCount,
        clubLink: row.clubCount,
      },
    }));

    // 2. Club Leaderboard (Registrations driven via club referral links)
    const clubRows = await db
      .select({
        clubId: communities.id,
        clubName: communities.name,
        parentCollegeId: communities.parentCollegeId,
        count: sql<number>`count(${registrations.id})::int`,
      })
      .from(communities)
      .leftJoin(
        registrations,
        and(
          eq(registrations.communityId, communities.id),
          eq(registrations.eventId, event.id)
        )
      )
      .where(eq(communities.type, "club"))
      .groupBy(communities.id, communities.name, communities.parentCollegeId)
      .orderBy(sql`count(${registrations.id}) desc`, communities.name);

    // Fetch parent college names for clubs
    const collegeNameLookup = new Map<number, string>();
    collegeRows.forEach((c) => collegeNameLookup.set(c.collegeId, c.collegeName));

    const clubsLeaderboard = clubRows.map((row, index) => ({
      rank: index + 1,
      id: row.clubId,
      name: row.clubName,
      parentCollegeName: row.parentCollegeId ? collegeNameLookup.get(row.parentCollegeId) || "Affiliated" : "Independent",
      totalRegistrations: row.count,
    }));

    // 3. Top Student Referrers (Individual Ambassadors)
    const topReferrers = await db
      .select({
        id: registrations.id,
        name: registrations.name,
        referralCode: registrations.referralCode,
        collegeId: registrations.collegeId,
        collegeName: communities.name,
        referralCount: sql<number>`count(sub.id)::int`,
      })
      .from(registrations)
      .innerJoin(communities, eq(registrations.collegeId, communities.id))
      .innerJoin(
        sql`registrations as sub`,
        sql`sub.referred_by_registration_id = ${registrations.id} and sub.event_id = ${event.id}`
      )
      .where(eq(registrations.eventId, event.id))
      .groupBy(registrations.id, registrations.name, registrations.referralCode, registrations.collegeId, communities.name)
      .orderBy(sql`count(sub.id) desc`)
      .limit(10);

    const championsLeaderboard = topReferrers.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      collegeName: row.collegeName,
      referralCode: row.referralCode,
      referralCount: row.referralCount,
    }));

    const [totalStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id));

    return res.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        capacity: event.capacity,
        totalRegistrations: totalStats?.total ?? 0,
      },
      colleges: collegesLeaderboard,
      clubs: clubsLeaderboard,
      champions: championsLeaderboard,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/**
 * GET /api/events/:slug/admin/analytics
 * Detailed administrative metrics: registrations over time, by college, by source, branches
 */
router.get("/:slug/admin/analytics", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // 1. Total registrations & sources breakdown
    const [overall] = await db
      .select({
        total: sql<number>`count(*)::int`,
        directCount: sql<number>`count(case when ${registrations.source} = 'direct' then 1 end)::int`,
        referralCount: sql<number>`count(case when ${registrations.source} = 'referral' then 1 end)::int`,
        clubCount: sql<number>`count(case when ${registrations.source} = 'club_link' then 1 end)::int`,
        uniqueColleges: sql<number>`count(distinct ${registrations.collegeId})::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id));

    // 2. Timeline (Registrations grouped by calendar day)
    const timelineRows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${registrations.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        direct: sql<number>`count(case when ${registrations.source} = 'direct' then 1 end)::int`,
        referral: sql<number>`count(case when ${registrations.source} = 'referral' then 1 end)::int`,
        club: sql<number>`count(case when ${registrations.source} = 'club_link' then 1 end)::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .groupBy(sql`date_trunc('day', ${registrations.createdAt})`)
      .orderBy(sql`date_trunc('day', ${registrations.createdAt}) asc`);

    // 3. Breakdown by College
    const collegeRows = await db
      .select({
        collegeId: communities.id,
        collegeName: communities.name,
        count: sql<number>`count(${registrations.id})::int`,
      })
      .from(communities)
      .innerJoin(
        registrations,
        and(
          eq(registrations.collegeId, communities.id),
          eq(registrations.eventId, event.id)
        )
      )
      .groupBy(communities.id, communities.name)
      .orderBy(sql`count(${registrations.id}) desc`);

    // 4. Breakdown by Semester
    const semesterRows = await db
      .select({
        semester: registrations.semester,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .groupBy(registrations.semester)
      .orderBy(registrations.semester);

    // 5. Breakdown by Engineering Branch
    const branchRows = await db
      .select({
        branch: registrations.branch,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .groupBy(registrations.branch)
      .orderBy(sql`count(*) desc`);

    // Viral Factor (K-Factor) Calculation
    const total = overall?.total ?? 0;
    const direct = overall?.directCount ?? 0;
    const referral = overall?.referralCount ?? 0;
    const viralMultiplier = direct > 0 ? Number((total / direct).toFixed(2)) : 1.0;

    return res.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        capacity: event.capacity ?? 1000,
        createdAt: event.createdAt,
      },
      kpis: {
        totalRegistrations: total,
        capacity: event.capacity ?? 1000,
        capacityPercentage: Math.min(100, Math.round((total / (event.capacity || 1000)) * 100)),
        directCount: direct,
        referralCount: referral,
        clubCount: overall?.clubCount ?? 0,
        referralPercentage: total > 0 ? Math.round((referral / total) * 100) : 0,
        uniqueCollegesCount: overall?.uniqueColleges ?? 0,
        viralMultiplier, // e.g. 2.14x growth through referrals & clubs
      },
      timeline: timelineRows,
      byCollege: collegeRows,
      bySource: [
        { source: "Direct", count: overall?.directCount ?? 0, key: "direct" },
        { source: "Student Referrals", count: overall?.referralCount ?? 0, key: "referral" },
        { source: "Club Links", count: overall?.clubCount ?? 0, key: "club_link" },
      ],
      bySemester: semesterRows,
      byBranch: branchRows,
      roadmap: [
        { feature: "Multi-tenant Organizer Accounts", status: "Planned for Phase 2" },
        { feature: "Dynamic Event Creation & Form Builder", status: "Planned for Phase 2" },
        { feature: "Ticketing & Payments (Stripe/Razorpay)", status: "Planned for Phase 3" },
        { feature: "QR Code Check-in at Venue", status: "Planned for Phase 3" },
        { feature: "Automated WhatsApp Notification Triggers", status: "Planned for Phase 4" },
      ],
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export default router;

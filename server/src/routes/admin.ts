import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, sql, desc, or, ilike, and } from "drizzle-orm";
import { db } from "../db";
import { events, registrations, communities } from "../db/schema";

const router = Router();

const COOKIE_NAME = "admin_token";

/**
 * Deterministic session token derived from the current ADMIN_PASSWORD
 */
function getExpectedToken(): string {
  const secret = process.env.ADMIN_PASSWORD || "admin123";
  return crypto.createHash("sha256").update(`${secret}:ripple_admin_salt`).digest("hex");
}

/**
 * Authentication middleware for admin-only routes
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || token !== getExpectedToken()) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please enter the admin password to access this resource.",
    });
  }
  return next();
}

/**
 * POST /api/admin/login
 * Verify admin password from environment variable and set httpOnly cookie
 */
router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body || {};
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (!password || typeof password !== "string" || password !== expectedPassword) {
    return res.status(401).json({
      success: false,
      error: "Invalid admin password. Please try again.",
    });
  }

  // Set httpOnly cookie valid for 24 hours
  res.cookie(COOKIE_NAME, getExpectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    message: "Admin authentication successful",
  });
});

/**
 * POST /api/admin/logout
 * Clear httpOnly admin cookie
 */
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res.json({ success: true, message: "Logged out successfully" });
});

/**
 * GET /api/admin/check
 * Check if the caller has a valid admin session cookie
 */
router.get("/check", (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  const isAuthenticated = Boolean(token && token === getExpectedToken());
  return res.json({ authenticated: isAuthenticated });
});

/**
 * GET /api/admin/events/:slug/analytics
 * Comprehensive administrative analytics:
 * - Registrations over time (daily timeline with cumulative sum for line charts)
 * - Registrations by college
 * - Registrations by source (direct vs referral vs club link)
 * - 500 Goal conversion metrics
 */
router.get("/events/:slug/analytics", requireAdminAuth, async (req: Request, res: Response) => {
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

    const GOAL = 500;

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

    const total = overall?.total ?? 0;
    const direct = overall?.directCount ?? 0;
    const referral = overall?.referralCount ?? 0;
    const club = overall?.clubCount ?? 0;
    const goalPercent = Math.min(100, Math.round((total / GOAL) * 100));
    const viralMultiplier = direct > 0 ? Number((total / direct).toFixed(2)) : 1.0;

    // 2. Timeline (Registrations grouped by calendar day, with cumulative progression for LineChart)
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

    let runningTotal = 0;
    const timelineWithCumulative = timelineRows.map((row) => {
      runningTotal += row.count;
      return {
        ...row,
        cumulative: runningTotal,
      };
    });

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

    // 4. Breakdown by Source
    const bySource = [
      { source: "Direct Signups", count: direct, key: "direct", fill: "#6366f1" },
      { source: "Student Referrals", count: referral, key: "referral", fill: "#a855f7" },
      { source: "Club Links", count: club, key: "club_link", fill: "#06b6d4" },
    ];

    // 5. Breakdown by Semester & Branch
    const semesterRows = await db
      .select({
        semester: registrations.semester,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .groupBy(registrations.semester)
      .orderBy(registrations.semester);

    const branchRows = await db
      .select({
        branch: registrations.branch,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .groupBy(registrations.branch)
      .orderBy(sql`count(*) desc`);

    return res.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        capacity: event.capacity ?? 1000,
      },
      kpis: {
        totalRegistrations: total,
        goal: GOAL,
        goalPercent,
        remainingToGoal: Math.max(0, GOAL - total),
        directCount: direct,
        referralCount: referral,
        clubCount: club,
        referralPercentage: total > 0 ? Math.round((referral / total) * 100) : 0,
        uniqueCollegesCount: overall?.uniqueColleges ?? 0,
        viralMultiplier,
      },
      timeline: timelineWithCumulative,
      byCollege: collegeRows,
      bySource,
      bySemester: semesterRows,
      byBranch: branchRows,
    });
  } catch (error) {
    console.error("Admin analytics fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/**
 * GET /api/admin/events/:slug/registrations
 * Paginated table of recent registrations with college and referrer details
 */
router.get("/events/:slug/registrations", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10));
    const search = ((req.query.search as string) || "").trim();

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Dynamic search conditions
    const searchCondition = search
      ? or(
          ilike(registrations.name, `%${search}%`),
          ilike(registrations.email, `%${search}%`),
          ilike(registrations.referralCode, `%${search}%`),
          ilike(communities.name, `%${search}%`)
        )
      : undefined;

    const whereClause = searchCondition
      ? and(eq(registrations.eventId, event.id), searchCondition)
      : eq(registrations.eventId, event.id);

    // Query registrations with college and referrer join
    const items = await db
      .select({
        id: registrations.id,
        name: registrations.name,
        email: registrations.email,
        collegeId: registrations.collegeId,
        collegeName: communities.name,
        semester: registrations.semester,
        branch: registrations.branch,
        source: registrations.source,
        referralCode: registrations.referralCode,
        referredByRegistrationId: registrations.referredByRegistrationId,
        referredByName: sql<string | null>`ref_reg.name`,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .innerJoin(communities, eq(registrations.collegeId, communities.id))
      .leftJoin(
        sql`registrations as ref_reg`,
        sql`ref_reg.id = ${registrations.referredByRegistrationId}`
      )
      .where(whereClause)
      .orderBy(desc(registrations.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(registrations)
      .innerJoin(communities, eq(registrations.collegeId, communities.id))
      .where(whereClause);

    return res.json({
      registrations: items,
      total: countResult?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Admin registrations fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

/**
 * GET /api/admin/events/:slug/export.csv
 * Export all registrations as CSV
 */
router.get("/events/:slug/export.csv", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return res.status(404).send("Event not found");
    }

    const rows = await db
      .select({
        id: registrations.id,
        name: registrations.name,
        email: registrations.email,
        collegeName: communities.name,
        semester: registrations.semester,
        branch: registrations.branch,
        source: registrations.source,
        referralCode: registrations.referralCode,
        referredByName: sql<string | null>`ref_reg.name`,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .innerJoin(communities, eq(registrations.collegeId, communities.id))
      .leftJoin(
        sql`registrations as ref_reg`,
        sql`ref_reg.id = ${registrations.referredByRegistrationId}`
      )
      .where(eq(registrations.eventId, event.id))
      .orderBy(desc(registrations.createdAt));

    // CSV header row
    const headers = [
      "ID",
      "Name",
      "Email",
      "College",
      "Semester",
      "Branch",
      "Source",
      "Referral Code",
      "Referred By",
      "Registration Time (UTC)",
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(",")];
    for (const r of rows) {
      csvLines.push(
        [
          r.id,
          escapeCsv(r.name),
          escapeCsv(r.email),
          escapeCsv(r.collegeName),
          r.semester,
          escapeCsv(r.branch),
          escapeCsv(r.source),
          escapeCsv(r.referralCode),
          escapeCsv(r.referredByName || "Direct / None"),
          escapeCsv(new Date(r.createdAt).toISOString()),
        ].join(",")
      );
    }

    const csvContent = csvLines.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slug}-registrations-${new Date().toISOString().split("T")[0]}.csv"`
    );
    return res.send(csvContent);
  } catch (error) {
    console.error("CSV Export error:", error);
    return res.status(500).send("Failed to export registrations");
  }
});

export default router;

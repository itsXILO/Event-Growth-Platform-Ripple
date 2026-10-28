import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { communities } from "../db/schema";

const router = Router();

/**
 * GET /api/colleges
 * Returns all colleges sorted alphabetically for dropdowns
 */
router.get("/", async (_req, res) => {
  try {
    const list = await db
      .select({
        id: communities.id,
        name: communities.name,
        type: communities.type,
      })
      .from(communities)
      .where(eq(communities.type, "college"))
      .orderBy(asc(communities.name));

    res.json({
      colleges: list,
    });
  } catch (error) {
    console.error("Failed to fetch colleges:", error);
    res.status(500).json({ error: "Failed to retrieve colleges list" });
  }
});

export default router;

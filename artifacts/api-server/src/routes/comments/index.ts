import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { reportCommentsTable, profilesTable, reportsTable } from "@workspace/db";
import { eq, and, asc, inArray } from "drizzle-orm";

const router = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

router.get("/comments/:reportId", async (req: Request, res: Response) => {
  try {
    const { section } = req.query as { section?: string };

    const [report] = await db
      .select({ userId: reportsTable.userId, isPublic: reportsTable.isPublic })
      .from(reportsTable)
      .where(eq(reportsTable.id, req.params.reportId))
      .limit(1);

    if (!report) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!report.isPublic) {
      const auth = getAuth(req);
      if (!auth?.userId || auth.userId !== report.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const comments = await db
      .select()
      .from(reportCommentsTable)
      .where(eq(reportCommentsTable.reportId, req.params.reportId))
      .orderBy(asc(reportCommentsTable.createdAt));

    const userIds = [...new Set(comments.map((c) => c.userId))];
    const profiles: Record<string, typeof profilesTable.$inferSelect> = {};
    if (userIds.length) {
      const profs = await db
        .select()
        .from(profilesTable)
        .where(inArray(profilesTable.userId, userIds));
      profs.forEach((p) => {
        profiles[p.userId] = p;
      });
    }

    const filtered = section
      ? comments.filter((c) => c.section === section)
      : comments;

    res.json({ comments: filtered, profiles });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/comments/:reportId", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const { body, section } = req.body as { body?: string; section?: string };
    if (!body?.trim()) {
      res.status(400).json({ error: "body required" });
      return;
    }

    const [report] = await db
      .select({ userId: reportsTable.userId, isPublic: reportsTable.isPublic })
      .from(reportsTable)
      .where(eq(reportsTable.id, req.params.reportId))
      .limit(1);

    if (!report) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!report.isPublic && report.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.insert(reportCommentsTable).values({
      reportId: req.params.reportId,
      userId,
      body: body.trim(),
      section: section ?? null,
    });
    res.status(201).json({ status: "ok" });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;

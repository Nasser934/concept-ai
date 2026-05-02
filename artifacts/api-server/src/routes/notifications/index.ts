import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

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

router.get("/notifications", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(20);
    res.json(rows);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/notifications/mark-all-read", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(eq(notificationsTable.userId, userId));
    res.json({ status: "ok" });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const result = await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, req.params.id),
          eq(notificationsTable.userId, userId),
        ),
      )
      .returning({ id: notificationsTable.id });
    if (!result.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ status: "ok" });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.delete("/notifications/:id", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const result = await db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, req.params.id),
          eq(notificationsTable.userId, userId),
        ),
      )
      .returning({ id: notificationsTable.id });
    if (!result.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;

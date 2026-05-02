import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

router.get("/profiles/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);
    if (!profile) {
      await db
        .insert(profilesTable)
        .values({ userId })
        .onConflictDoNothing();
      res.json({ userId, displayName: null, avatarUrl: null });
      return;
    }
    res.json(profile);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.put("/profiles/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const { displayName, avatarUrl } = req.body as {
      displayName?: string;
      avatarUrl?: string;
    };
    const [upserted] = await db
      .insert(profilesTable)
      .values({ userId, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: { displayName: displayName ?? null, avatarUrl: avatarUrl ?? null },
      })
      .returning();
    res.json(upserted);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;

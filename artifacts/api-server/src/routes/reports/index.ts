import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { reportsTable, reportStatusHistoryTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    nanoid(6)
  );
}

router.get("/reports", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const rows = await db
      .select({
        id: reportsTable.id,
        slug: reportsTable.slug,
        title: reportsTable.title,
        industry: reportsTable.industry,
        status: reportsTable.status,
        isPublic: reportsTable.isPublic,
        createdAt: reportsTable.createdAt,
        updatedAt: reportsTable.updatedAt,
      })
      .from(reportsTable)
      .where(eq(reportsTable.userId, userId))
      .orderBy(desc(reportsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/reports", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const { title, industry, inputs, output } = req.body as {
      title?: string;
      industry?: string;
      inputs?: unknown;
      output?: unknown;
    };
    if (!title || !inputs || !output) {
      res.status(400).json({ error: "title, inputs, output required" });
      return;
    }

    const slug = slugify(title);
    const [row] = await db
      .insert(reportsTable)
      .values({ userId, title, industry: industry ?? null, inputs, output, slug })
      .returning({ id: reportsTable.id, slug: reportsTable.slug });

    res.status(201).json(row);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports/slug/:slug", async (req: Request, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.slug, req.params.slug))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!row.isPublic) {
      const auth = getAuth(req);
      if (!auth?.userId || auth.userId !== row.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    res.json(row);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports/:id/output", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const [row] = await db
      .select({ output: reportsTable.output, userId: reportsTable.userId })
      .from(reportsTable)
      .where(eq(reportsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (row.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(row.output);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports/:id", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const [row] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (row.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(row);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.delete("/reports/:id", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const result = await db
      .delete(reportsTable)
      .where(and(eq(reportsTable.id, req.params.id), eq(reportsTable.userId, userId)))
      .returning({ id: reportsTable.id });
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

const VALID_STATUSES = new Set(["draft", "in_review", "approved", "rejected"]);

router.patch("/reports/:id/status", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const { status, note } = req.body as { status?: string; note?: string };
    if (!status || !VALID_STATUSES.has(status)) {
      res.status(400).json({ error: "status must be one of: draft, in_review, approved, rejected" });
      return;
    }
    const [row] = await db
      .select({ status: reportsTable.status, userId: reportsTable.userId })
      .from(reportsTable)
      .where(eq(reportsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (row.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db
      .update(reportsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(reportsTable.id, req.params.id));

    await db.insert(reportStatusHistoryTable).values({
      reportId: req.params.id,
      changedBy: userId,
      fromStatus: row.status,
      toStatus: status ?? null,
      note: note ?? null,
    });

    res.json({ status: "ok" });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/reports/:id/publish", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const result = await db
      .update(reportsTable)
      .set({ isPublic: true, updatedAt: new Date() })
      .where(and(eq(reportsTable.id, req.params.id), eq(reportsTable.userId, userId)))
      .returning({ id: reportsTable.id, slug: reportsTable.slug, isPublic: reportsTable.isPublic });
    if (!result.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(result[0]);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/reports/:id/unpublish", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  try {
    const result = await db
      .update(reportsTable)
      .set({ isPublic: false, updatedAt: new Date() })
      .where(and(eq(reportsTable.id, req.params.id), eq(reportsTable.userId, userId)))
      .returning({ id: reportsTable.id, slug: reportsTable.slug, isPublic: reportsTable.isPublic });
    if (!result.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(result[0]);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;

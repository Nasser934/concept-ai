import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.VITE_API_URL ?? "";

interface Comment {
  id: string; reportId: string; userId: string; section: string | null; body: string; createdAt: string;
}

export const CommentsPanel = ({ reportId, section }: { reportId: string; section?: string }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { displayName: string | null }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const url = `${BASE}/api/comments/${reportId}${section ? `?section=${section}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load comments");
      const { comments: data, profiles: profs } = await res.json();
      setComments(data ?? []);
      setProfiles(profs ?? {});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reportId, section]);

  const submit = async () => {
    if (!user) { toast.error("Sign in to comment"); return; }
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/comments/${reportId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: body.trim(), section: section ?? null }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      setBody(""); load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const p = profiles[c.userId];
            const name = p?.displayName || "User";
            const initial = name[0].toUpperCase();
            return (
              <div key={c.id} className="flex gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initial}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium">{name}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{c.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {user ? (
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" rows={3} maxLength={2000} />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={busy || !body.trim()} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Post
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground"><Link to="/sign-in" className="text-primary hover:underline">Sign in</Link> to join the discussion.</p>
      )}
    </div>
  );
};

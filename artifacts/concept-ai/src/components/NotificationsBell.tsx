import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Bell, Check, MessageSquare, Activity, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const BASE = import.meta.env.VITE_API_URL ?? "";

interface Notification {
  id: string;
  kind: "comment" | "status" | "shared";
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

const iconFor = (k: Notification["kind"]) =>
  k === "comment" ? MessageSquare : k === "status" ? Activity : Share2;

export const NotificationsBell = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${BASE}/api/notifications`, { credentials: "include" });
      if (!res.ok) return;
      setItems(await res.json());
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [user, load]);

  if (!user) return null;
  const unread = items.filter((n) => !n.readAt).length;

  const markAll = async () => {
    if (!unread) return;
    const res = await fetch(`${BASE}/api/notifications/mark-all-read`, { method: "POST", credentials: "include" });
    if (!res.ok) toast.error("Failed to mark read"); else load();
  };

  const open1 = async (n: Notification) => {
    if (!n.readAt) await fetch(`${BASE}/api/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" });
    setOpen(false); load();
    if (n.url) setLocation(n.url);
  };

  const remove = async (id: string) => {
    const res = await fetch(`${BASE}/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) toast.error("Failed to delete"); else load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={markAll} disabled={!unread}>
            <Check className="h-3 w-3" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = iconFor(n.kind);
                return (
                  <li key={n.id} className={`group flex gap-2 p-3 transition-colors hover:bg-accent/50 ${!n.readAt ? "bg-primary/5" : ""}`}>
                    <button onClick={() => open1(n)} className="flex flex-1 gap-2 text-left">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{n.title}</p>
                        {n.body && <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </button>
                    <button onClick={() => remove(n.id)} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Delete notification">
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

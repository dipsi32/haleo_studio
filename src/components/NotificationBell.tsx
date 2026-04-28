// Notification bell with realtime updates. Used by both contractor and homeowner.
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  outreach_send_id: string | null;
  type: string;
};

interface Props {
  table: "contractor_notifications" | "homeowner_notifications";
  filter: { column: string; value: string };
  onItemClick?: (n: Notification) => void;
}

export default function NotificationBell({ table, filter, onItemClick }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await (supabase as any)
        .from(table)
        .select("id, title, body, read, created_at, outreach_send_id, type")
        .eq(filter.column, filter.value)
        .order("created_at", { ascending: false })
        .limit(20);
      if (active && data) setItems(data as Notification[]);
    };
    load();

    const channel = supabase
      .channel(`${table}-${filter.value}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `${filter.column}=eq.${filter.value}` },
        (payload) => setItems((cur) => [payload.new as Notification, ...cur].slice(0, 20))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, filter.column, filter.value]);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = async () => {
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    if (!ids.length) return;
    await (supabase as any).from(table).update({ read: true, read_at: new Date().toISOString() }).in("id", ids);
    setItems((cur) => cur.map((i) => ({ ...i, read: true })));
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => { onItemClick?.(n); setOpen(false); }}
                className="block w-full border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium leading-snug">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

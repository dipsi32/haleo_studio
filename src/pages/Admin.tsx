import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, ArrowLeft, Users, Inbox, UserX, UserCheck, Mail, Shield } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type PilotRow = {
  id: string;
  email: string;
  name: string | null;
  pass_type: "paid" | "early_access" | "test";
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

type WaitRow = {
  id: string;
  email: string;
  name: string | null;
  project_type: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

const Admin = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [pilots, setPilots] = useState<PilotRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitRow[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [passType, setPassType] = useState<"paid" | "early_access" | "test">("early_access");
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: w }] = await Promise.all([
      supabase.from("pilot_users").select("*").order("created_at", { ascending: false }),
      supabase.from("waitlist").select("*").order("created_at", { ascending: false }),
    ]);
    setPilots((p ?? []) as PilotRow[]);
    setWaitlist((w ?? []) as WaitRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (authLoading || adminLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const addPilot = async (overrideEmail?: string, overrideName?: string | null) => {
    const e = (overrideEmail ?? email).trim().toLowerCase();
    if (!e) return;
    setBusy(true);
    const expires_at = passType === "paid" ? null : new Date(Date.now() + (parseInt(days) || 14) * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("pilot_users").upsert(
      { email: e, name: overrideName ?? name ?? null, pass_type: passType, is_active: true, expires_at },
      { onConflict: "email" },
    );
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't add user", description: error.message, variant: "destructive" });
      return;
    }
    if (overrideEmail) {
      await supabase.from("waitlist").update({ status: "approved" }).eq("email", e);
    } else {
      setEmail(""); setName("");
    }
    toast({ title: `Added ${e}`, description: `${passType.replace("_", " ")} pass granted.` });
    load();
  };

  const toggleActive = async (p: PilotRow) => {
    await supabase.from("pilot_users").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  };

  const extendDays = async (p: PilotRow, addDays: number) => {
    const base = p.expires_at ? new Date(p.expires_at).getTime() : Date.now();
    const next = new Date(base + addDays * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("pilot_users").update({ expires_at: next, is_active: true }).eq("id", p.id);
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/account" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Account
            </Link>
            <button onClick={signOut} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-secondary">Sign out</button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Founder console</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight">Mission control</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add pilots, grant early or test access, and triage the waitlist.</p>
        </motion.div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: "Total pilots", value: pilots.length, icon: Users },
            { label: "Active passes", value: pilots.filter((p) => p.is_active).length, icon: Shield },
            { label: "Waitlist", value: waitlist.length, icon: Inbox },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><s.icon className="h-3.5 w-3.5" /> {s.label}</div>
              <p className="mt-1 font-display text-3xl">{s.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="add" className="mt-8 space-y-6">
          <TabsList>
            <TabsTrigger value="add"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add user</TabsTrigger>
            <TabsTrigger value="pilots"><Users className="mr-1.5 h-3.5 w-3.5" /> Pilots</TabsTrigger>
            <TabsTrigger value="waitlist"><Inbox className="mr-1.5 h-3.5 w-3.5" /> Waitlist</TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg">Grant access</h3>
              <p className="mt-1 text-xs text-muted-foreground">Works whether or not the person has signed up yet — they're linked by email on first login.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" className="mt-1 h-10 rounded-xl bg-background" />
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" className="mt-1 h-10 rounded-xl bg-background" />
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pass</label>
                  <select value={passType} onChange={(e) => setPassType(e.target.value as never)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                    <option value="early_access">Early access</option>
                    <option value="test">Test user</option>
                    <option value="paid">Paid (permanent)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Days</label>
                  <Input value={days} onChange={(e) => setDays(e.target.value)} type="number" min="1" disabled={passType === "paid"} className="mt-1 h-10 rounded-xl bg-background" />
                </div>
              </div>
              <Button onClick={() => addPilot()} disabled={busy || !email} className="mt-4 rounded-full">
                <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add user"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="pilots">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : pilots.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No users yet — add one above.</p>
            ) : (
              <div className="space-y-2">
                {pilots.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{p.name || p.email}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.pass_type === "paid" ? "bg-sage-soft text-sage" :
                          p.pass_type === "early_access" ? "bg-accent-soft text-accent" :
                          "bg-secondary text-foreground/70"
                        }`}>{p.pass_type.replace("_", " ")}</span>
                        {!p.is_active && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Deactivated</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.email} · expires {fmtDate(p.expires_at)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {p.pass_type !== "paid" && (
                        <>
                          <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => extendDays(p, 7)}>+7d</Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => extendDays(p, 30)}>+30d</Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className={`h-8 rounded-full text-xs ${p.is_active ? "text-destructive" : "text-sage"}`} onClick={() => toggleActive(p)}>
                        {p.is_active ? <><UserX className="h-3 w-3" /> Deactivate</> : <><UserCheck className="h-3 w-3" /> Reactivate</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="waitlist">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : waitlist.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No waitlist requests yet.</p>
            ) : (
              <div className="space-y-2">
                {waitlist.map((w) => {
                  const already = pilots.some((p) => p.email === w.email);
                  return (
                    <div key={w.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{w.name || "—"}</p>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase text-foreground/60">{w.status}</span>
                            <span className="text-xs text-muted-foreground">{fmtDate(w.created_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{w.email}</p>
                          {w.project_type && <p className="mt-1.5 text-sm">{w.project_type}</p>}
                          {w.message && <p className="mt-1 text-sm italic text-muted-foreground">"{w.message}"</p>}
                        </div>
                        <div className="flex gap-1.5">
                          {already ? (
                            <span className="rounded-full bg-sage-soft px-2 py-1 text-[10px] font-medium text-sage">Already a pilot</span>
                          ) : (
                            <Button size="sm" className="h-8 rounded-full text-xs" onClick={() => addPilot(w.email, w.name)}>
                              <Plus className="h-3 w-3" /> Grant early access
                            </Button>
                          )}
                          <a href={`mailto:${w.email}`}>
                            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs"><Mail className="h-3 w-3" /> Email</Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
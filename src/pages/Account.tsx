import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Trash2, LogOut, Shield, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import HomeownerConversationDrawer from "@/components/HomeownerConversationDrawer";
import { useAuth } from "@/context/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePilotAccess } from "@/hooks/usePilotAccess";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { listMyProjects, deleteProject, type UserProject } from "@/lib/userProjects";
import { useIntake } from "@/lib/intake";
import { toast } from "@/hooks/use-toast";
import ProposalsReceivedSection from "@/components/ProposalsReceivedSection";

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const Account = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const access = usePilotAccess();
  const { isContractor, account, loading: contractorLoading } = useContractorAccount();
  const { reset, setData } = useIntake();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [convoSendId, setConvoSendId] = useState<string | null>(null);

  useEffect(() => {
    if (contractorLoading || !isContractor) return;
    navigate(account?.onboarded_at ? "/pro/profile" : "/pro/onboarding", { replace: true });
  }, [account?.onboarded_at, contractorLoading, isContractor, navigate]);

  useEffect(() => {
    if (isContractor) return;
    listMyProjects().then((rows) => { setProjects(rows); setLoading(false); }).catch(() => setLoading(false));
  }, [isContractor]);

  const startNew = () => {
    reset();
    navigate("/brief?fresh=1");
  };

  const resume = (p: UserProject) => {
    reset();
    setData({ painPoints: [], media: [], ...(p.intake ?? {}) });
    sessionStorage.setItem("haleo:active_project_id", p.id);
    navigate("/brief");
  };

  const remove = async (p: UserProject) => {
    if (!confirm("Delete this project? This can't be undone.")) return;
    try {
      await deleteProject(p.id);
      setProjects((ps) => ps.filter((x) => x.id !== p.id));
    } catch (e) {
      toast({ title: "Couldn't delete", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            {user && (
              <NotificationBell
                table="homeowner_notifications"
                filter={{ column: "user_id", value: user.id }}
                onItemClick={(n) => n.outreach_send_id && setConvoSendId(n.outreach_send_id)}
              />
            )}
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-secondary">
                <Shield className="h-3 w-3" /> Admin
              </Link>
            )}
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-secondary">
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Your account</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight md:text-5xl">
            {user?.user_metadata?.full_name ? `Welcome back, ${user.user_metadata.full_name.split(" ")[0]}.` : "Your saved projects."}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Every room you've worked on lives here. Resume where you left off — or start a brand new room with a clean slate.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-3 py-1">
              {user?.email}
            </span>
            {isAdmin ? (
              <span className="rounded-full bg-accent-soft px-3 py-1 font-medium text-accent">Admin · full access</span>
            ) : access.passType === "paid" ? (
              <span className="rounded-full bg-sage-soft px-3 py-1 font-medium text-sage">Paid · permanent access</span>
            ) : access.passType === "early_access" ? (
              <span className="rounded-full bg-accent-soft px-3 py-1 font-medium text-accent">
                Early access {access.daysRemaining != null && `· ${access.daysRemaining}d left`}
              </span>
            ) : access.passType === "test" ? (
              <span className="rounded-full bg-secondary px-3 py-1">Test account</span>
            ) : access.isNotInvited ? (
              <span className="rounded-full bg-secondary px-3 py-1">No active pass</span>
            ) : null}
          </div>
        </motion.div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Saved rooms</h2>
          <Button onClick={startNew} className="rounded-full">
            <Plus className="h-4 w-4" /> Start a new room
          </Button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-accent" />
            <p className="mt-3 font-display text-lg">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start your first brief and we'll keep it safe right here.</p>
            <Button onClick={startNew} className="mt-5 rounded-full">
              Start your first brief <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    <p className="truncate font-display text-base font-medium">{p.title || "Untitled project"}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/60">{p.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Updated {fmtDate(p.updated_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => resume(p)} className="rounded-full">Resume</Button>
                  <button onClick={() => remove(p)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete project">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ProposalsReceivedSection />
      </main>
    </div>
  );
};

export default Account;
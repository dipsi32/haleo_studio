// Three-screen claim flow.
// /pro/:slug/claim
//   Screen 1 — license verify
//   Screen 2 — notification email (sends magic link OTP)
//   Screen 3 — payoff (waiting brief OR portfolio prompt)
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";

type ContractorRow = {
  id: string;
  slug: string;
  license_number: string;
  name: string;
  company: string | null;
  city: string | null;
  claimed: boolean;
  notification_email: string | null;
};

type Step = "license" | "notify" | "verify-otp" | "payoff";

const ClaimProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ref = params.get("ref");

  const [contractor, setContractor] = useState<ContractorRow | null>(null);
  const [step, setStep] = useState<Step>("license");
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseOk, setLicenseOk] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitingBrief, setWaitingBrief] = useState<{ count: number } | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("contractors")
        .select("id,slug,license_number,name,company,city,claimed,notification_email")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) {
        toast({ title: "Profile not found", variant: "destructive" });
        navigate("/", { replace: true });
        return;
      }
      setContractor(data as ContractorRow);
      // Mark claim_started_at on first landing
      supabase
        .from("contractors")
        .update({ claim_started_at: new Date().toISOString() })
        .eq("id", data.id)
        .is("claim_started_at", null)
        .then(() => {});
    })();
  }, [slug, navigate]);

  // Verify license
  const handleLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractor) return;
    setBusy(true);
    const cleaned = licenseInput.replace(/\D/g, "");
    const matches = cleaned === contractor.license_number.replace(/\D/g, "");
    if (matches) {
      setLicenseOk(true);
      setTimeout(() => {
        setStep("notify");
        setBusy(false);
      }, 900);
    } else {
      setBusy(false);
      toast({
        title: "License doesn't match this profile",
        description:
          "Double-check the number and try again, or email hello@haleo.studio if you're stuck.",
        variant: "destructive",
      });
    }
  };

  // Send magic link OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractor) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/pro/${slug}/claim`,
          data: {
            full_name: contractor.company || contractor.name,
            haleo_contractor_id: contractor.id,
          },
        },
      });
      if (error) throw error;
      // Pre-stamp notification email on the contractor row so handle_new_user picks it up
      await supabase
        .from("contractors")
        .update({
          notification_email: emailInput.trim().toLowerCase(),
          notification_preference: "email",
          invitation_source: ref === "homeowner" ? "homeowner_referral" : (ref === "admin" ? "admin_email" : "direct"),
          invited_at: new Date().toISOString(),
        })
        .eq("id", contractor.id);
      setStep("verify-otp");
      toast({ title: "We sent you a 6-digit code", description: `Check ${emailInput}` });
    } catch (err) {
      toast({
        title: "Couldn't send code",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // Verify OTP → completes auth → handle_new_user trigger links contractor + flips claimed=true
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractor) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: emailInput,
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;

      // Belt-and-suspenders: ensure contractor + account are linked even if trigger missed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("contractors")
          .update({
            claimed: true,
            claimed_at: new Date().toISOString(),
            claim_completed_at: new Date().toISOString(),
          })
          .eq("id", contractor.id);

        // Make sure contractor_account exists & points to this contractor row
        await supabase.from("contractor_accounts").upsert(
          {
            user_id: user.id,
            contractor_id: contractor.id,
            company_name: contractor.company || contractor.name,
          },
          { onConflict: "user_id" },
        );
      }

      // Look for any waiting briefs addressed to this contractor
      const { count } = await supabase
        .from("outreach_sends")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", contractor.id);
      setWaitingBrief({ count: count ?? 0 });
      setStep("payoff");
    } catch (err) {
      toast({
        title: "That code didn't work",
        description: err instanceof Error ? err.message : "Try again or request a new one.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!contractor) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const displayName = contractor.company || contractor.name;

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link
            to={`/pro/${slug}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Back to profile
          </Link>
        </div>
      </header>

      <main className="container max-w-md py-12 md:py-20">
        {/* progress */}
        <div className="mb-8 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {(["license", "notify", "verify-otp", "payoff"] as const).map((s, i) => {
            const idx = (["license", "notify", "verify-otp", "payoff"] as const).indexOf(step);
            return (
              <span
                key={s}
                className={`h-1 flex-1 rounded-full ${i <= idx ? "bg-accent" : "bg-border"}`}
              />
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* SCREEN 1 — LICENSE */}
          {step === "license" && (
            <motion.div
              key="license"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-2xl font-light leading-tight">
                Verify this is your business.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your CSLB license number for{" "}
                <span className="text-foreground">{displayName}</span>.
              </p>

              <form onSubmit={handleLicense} className="mt-8 space-y-3">
                <Input
                  autoFocus
                  inputMode="numeric"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  placeholder="e.g. 1045821"
                  className="h-14 rounded-2xl bg-background text-center font-mono text-xl tracking-widest"
                  disabled={licenseOk}
                />
                {licenseOk ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 rounded-full bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" /> License verified
                  </motion.div>
                ) : (
                  <Button
                    type="submit"
                    disabled={busy || licenseInput.length < 4}
                    className="h-12 w-full rounded-full text-base"
                  >
                    Verify
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Can't remember? Check at{" "}
                <a
                  href="https://www.cslb.ca.gov/OnlineServices/CheckLicenseII"
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  cslb.ca.gov
                </a>
              </p>
            </motion.div>
          )}

          {/* SCREEN 2 — NOTIFY */}
          {step === "notify" && (
            <motion.div
              key="notify"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-2xl font-light leading-tight">
                Where should we send homeowner brief notifications?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We'll email you the moment a brief arrives. No spam — only real projects.
              </p>

              <form onSubmit={handleSendOtp} className="mt-8 space-y-4">
                <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-accent" /> Email
                  </div>
                  <Input
                    autoFocus
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@company.com"
                    className="h-12 rounded-xl bg-background"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    We'll send a 6-digit code to confirm.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={busy || !emailInput}
                  className="h-12 w-full rounded-full text-base"
                >
                  {busy ? "Sending…" : "Send my code"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </motion.div>
          )}

          {/* SCREEN 2b — OTP VERIFY */}
          {step === "verify-otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-2xl font-light leading-tight">
                Enter the code we just sent.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Check <span className="text-foreground">{emailInput}</span> — the 6-digit code expires in 10 minutes.
              </p>

              <form onSubmit={handleVerifyOtp} className="mt-8 space-y-3">
                <Input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="h-16 rounded-2xl bg-background text-center font-mono text-3xl tracking-[0.5em]"
                />
                <Button
                  type="submit"
                  disabled={busy || otp.length !== 6}
                  className="h-12 w-full rounded-full text-base"
                >
                  {busy ? "Opening your workspace…" : "Open my workspace"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => setStep("notify")}
                  className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Wrong email? Go back
                </button>
              </form>
            </motion.div>
          )}

          {/* SCREEN 3 — PAYOFF */}
          {step === "payoff" && (
            <motion.div
              key="payoff"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10"
              >
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
              </motion.div>

              {waitingBrief && waitingBrief.count > 0 ? (
                <>
                  <h1 className="mt-5 font-display text-2xl font-light leading-tight">
                    Welcome to Haleo, {displayName}.
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A homeowner already sent you a brief.
                  </p>
                  <Button
                    onClick={() => navigate("/pro/inbox")}
                    className="mt-6 h-12 w-full rounded-full text-base"
                  >
                    Open your inbox
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h1 className="mt-5 font-display text-2xl font-light leading-tight">
                    You're all set, {displayName}.
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We'll email you the moment a homeowner in {contractor.city ?? "your area"} sends you a brief.
                  </p>

                  <div className="mt-8 rounded-3xl border border-accent/30 bg-accent/5 p-5 text-left">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <p className="mt-2 text-sm font-medium">While you wait —</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bring your work to life. Drop one Instagram or website link and we'll pull in your portfolio.
                    </p>
                    <Button
                      onClick={() => navigate("/pro/onboarding")}
                      variant="outline"
                      className="mt-4 h-10 w-full rounded-full text-sm"
                    >
                      Add a portfolio link
                    </Button>
                  </div>

                  <Link
                    to={`/pro/${slug}`}
                    className="mt-6 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Or just explore your profile →
                  </Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default ClaimProfile;

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";

type OAuthResult = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { name?: string; client_name?: string; redirect_uri?: string } | null;
  scope?: string | null;
  scopes?: string[] | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "Share your email address",
  profile: "Share your basic profile",
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResult | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      setEmail(sess.session.user.email ?? null);
      try {
        const { data, error: err } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (err) {
          setError(err.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load this request.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "this app";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(/\s+/).filter(Boolean) : []);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-warm px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          {error ? (
            <>
              <h1 className="font-display text-2xl font-light">Couldn't load this request</h1>
              <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading authorization request…
            </div>
          ) : (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-light">
                Connect {clientName} to Haleo
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                This lets {clientName} use Haleo as you{email ? ` (${email})` : ""} — reading your
                projects, briefs, and quote audits through Haleo's tools.
              </p>

              {details.client?.redirect_uri && (
                <p className="mt-4 break-all rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  Redirects to {details.client.redirect_uri}
                </p>
              )}

              {scopes.length > 0 && (
                <ul className="mt-5 space-y-2 text-sm">
                  {scopes.map((s) => (
                    <li key={s} className="flex gap-2 text-foreground/80">
                      <span className="text-accent">•</span>
                      {SCOPE_LABELS[s] ?? `Additional permission requested: ${s}`}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-5 text-xs text-muted-foreground">
                This does not bypass Haleo's permissions — the connected app only sees what your
                account can already see.
              </p>

              <div className="mt-7 space-y-3">
                <Button disabled={busy} onClick={() => decide(true)} className="h-11 w-full rounded-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => decide(false)}
                  className="h-11 w-full rounded-full"
                >
                  Cancel connection
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

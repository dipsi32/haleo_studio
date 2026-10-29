// Supabase's auth errors, in words a homeowner can act on.
export const authMessage = (err: unknown): { kind: "rate" | "unconfirmed" | "exists" | "credentials" | "other"; title: string; body: string } => {
  const e = err as { status?: number; message?: string; code?: string } | null;
  const m = (e?.message ?? "").toLowerCase();
  if (e?.status === 429 || /rate limit|too many/.test(m)) {
    return {
      kind: "rate",
      title: "Slow down a moment",
      body: "We've sent several emails in a short time. Your link may already be in your inbox or spam. If not, wait a few minutes and try again.",
    };
  }
  if (/not confirmed/.test(m) || e?.code === "email_not_confirmed") {
    return { kind: "unconfirmed", title: "Confirm your email first", body: "Open the link we emailed you, then sign in." };
  }
  if (/already registered|already exists/.test(m) || e?.code === "user_already_exists") {
    return { kind: "exists", title: "You already have an account", body: "Sign in with that email instead." };
  }
  if (/invalid login|invalid credentials/.test(m)) {
    return { kind: "credentials", title: "That didn't match", body: "Check the email and password, and try again." };
  }
  return { kind: "other", title: "Something went wrong", body: e?.message || "Try again in a moment." };
};

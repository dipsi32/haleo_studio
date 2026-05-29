// Single source of truth for product analytics.
// PostHog client-side. Anonymous before auth; identified after.
// Dev mode → events are logged to console instead of sent.
import posthog from "posthog-js";

// phc_ keys are publishable by design — safe to ship in client code.
const POSTHOG_KEY = "phc_mWVyNiT4NULYmNdZUgsCntAk3HAjNnX8RT7wCRFJmmDj";
const POSTHOG_HOST = "https://us.i.posthog.com";

const isDev = import.meta.env.DEV;

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (isDev) {
    // Don't pollute the prod project with localhost traffic.
    // eslint-disable-next-line no-console
    console.info("[analytics] dev mode — events logged, not sent");
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // we do this manually via RouteTracker
    capture_pageleave: true,
    autocapture: true,
    loaded: (ph) => {
      // No PII — PostHog generates an anonymous distinct_id automatically.
      if (import.meta.env.MODE === "preview") ph.opt_out_capturing();
    },
  });
}

// Event names — central registry so we never typo them.
export type AnalyticsEvent =
  // Landing
  | "landing_viewed"
  | "cta_roast_clicked"
  | "cta_match_clicked"
  | "waitlist_joined"
  // Roast / Audit
  | "roast_started"
  | "proposal_uploaded"
  | "roast_completed"
  | "roast_cta_clicked"
  | "roast_abandoned"
  // Brief
  | "brief_started"
  | "brief_step_completed"
  | "brief_completed"
  | "brief_abandoned"
  // Match
  | "contractors_viewed"
  | "contractor_profile_clicked"
  | "contractor_invited"
  | "contractors_compared"
  | "contractor_card_hovered"
  // Auth
  | "signup_started"
  | "signup_completed"
  | "login_completed"
  | "access_gate_hit"
  // Contractor side
  | "contractor_profile_viewed"
  | "contractor_claimed_profile"
  | "contractor_onboarded"
  | "lead_unlock_attempted"
  | "lead_unlock_completed"
  // Errors
  | "error_proposal_upload"
  | "error_brief_generation"
  | "error_edge_function"
  // Generic page view
  | "$pageview";

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!initialized) return;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info("[analytics]", event, properties ?? {});
    return;
  }
  try {
    posthog.capture(event, properties);
  } catch (e) {
    // never let analytics break the app
    // eslint-disable-next-line no-console
    console.warn("[analytics] capture failed", e);
  }
}

export type IdentifyProps = {
  user_type?: "homeowner" | "contractor";
  is_pilot_user?: boolean;
  signup_method?: "email" | "google";
  city?: string;
  created_at?: string;
};

export function identify(distinctId: string, props?: IdentifyProps) {
  if (!initialized) return;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info("[analytics] identify", distinctId, props ?? {});
    return;
  }
  try {
    posthog.identify(distinctId, props as Record<string, unknown>);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] identify failed", e);
  }
}

export function resetAnalytics() {
  if (!initialized || isDev) return;
  try {
    posthog.reset();
  } catch {
    /* noop */
  }
}

export function setPersonProperties(props: Record<string, unknown>) {
  if (!initialized) return;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info("[analytics] set person props", props);
    return;
  }
  try {
    posthog.setPersonProperties(props);
  } catch {
    /* noop */
  }
}

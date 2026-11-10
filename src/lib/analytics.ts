// Single source of truth for product analytics.
// PostHog client-side. Anonymous before auth; identified after.
// Dev mode → events are logged to console instead of sent.
import posthog from "posthog-js";

// phc_ keys are publishable by design — safe to ship in client code.
const POSTHOG_KEY = "phc_mWVyNiT4NULYmNdZUgsCntAk3HAjNnX8RT7wCRFJmmDj";
const POSTHOG_HOST = "https://us.i.posthog.com";

const isDev = import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "staging";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (isDev) {
    // Don't pollute the prod project with localhost or staging traffic.
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
  // Contractor-owned brief links (the contractor's funnel, then the homeowner's)
  | "invite_created"
  | "invite_revoked"
  | "buy_box_saved"
  | "invite_opened"
  | "contractor_reply_sent"
  | "visit_prep_viewed"
  | "visit_prep_copied"
  | "visit_prep_question_added"
  // Shortlist: names from neighbors, checked against public records
  | "home_door_clicked"
  | "record_highlight_shown"
  | "record_companion_opened"
  | "record_glance_opened"
  | "password_reset_requested"
  | "password_reset_opened"
  | "password_reset_completed"
  | "shortlist_started"
  | "shortlist_extracted"
  | "shortlist_checked"
  | "shortlist_match_rejected"
  | "shortlist_request_opened"
  | "shortlist_brief_started"
  | "shortlist_bid_requested"
  | "visibility_scan_run"
  | "visibility_scan_blocked"
  | "invite_brief_started"
  // Homeowner answered the welcome in a contractor's link (name, and phone if given).
  | "homeowner_welcome_completed"
  // Contractor tapped Call or Text on a homeowner's number.
  | "homeowner_contacted"
  // A lead readiness read was shown to a contractor (level: ready, serious, early, unclear).
  | "lead_readiness_shown"
  | "invite_brief_sent"
  // Contractor front door (/c/:slug): their website, Google and text replies
  | "front_door_viewed"
  | "front_door_started"
  | "front_door_link_copied"
  | "front_door_color_saved"
  | "front_door_handle_saved"
  // Contractor demo (/demo/:slug)
  | "demo_opened"
  | "demo_door_chosen"
  | "demo_link_tapped"
  | "demo_brief_sent"
  | "demo_matt_viewed"
  // The contractor tapped the notification and opened the brief in the demo.
  | "demo_brief_opened"
  | "demo_cta_clicked"
  // Haleo's read of the homeowner's photos
  | "space_read_completed"
  | "space_read_failed"
  | "space_read_retried"
  | "space_finding_photo_opened"
  | "design_ideas_interest"
  | "space_read_question_answered"
  | "space_read_photo_requested"
  | "space_read_confirmed"
  // ADU feasibility
  | "adu_started"
  | "adu_address_submitted"
  | "adu_parcel_resolved"
  | "adu_parcel_failed"
  | "adu_feasibility_completed"
  | "adu_diagram_viewed"
  | "adu_annotation_method_chosen"
  | "adu_size_entered"
  | "adu_type_selected"
  | "adu_brief_generated"
  | "adu_brief_edited"
  | "adu_contractor_matched"
  | "adu_waitlist_joined"
  | "adu_data_enriched"
  | "adu_gaps_filled_manually"
  // Hero story (interactive "Text From Mike" hero)
  | "hero_story_started"
  | "hero_story_beat"
  | "hero_story_choice"
  | "hero_story_completed"
  | "hero_story_skipped"
  // Errors
  | "error_proposal_upload"
  | "error_brief_generation"
  | "error_edge_function"
  // Generic page view
  | "$pageview";

// While a contractor plays their own lead in the demo, only demo events count,
// so demo runs never inflate the real funnel (briefs started, records shown…).
// Reads storage directly to keep this module free of app imports.
const inDemo = (): boolean => {
  try {
    const raw = localStorage.getItem("haleo:active_invite");
    return !!raw && JSON.parse(raw)?.demo === true;
  } catch {
    return false;
  }
};

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!initialized) return;
  if (!event.startsWith("demo_") && inDemo()) return;
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

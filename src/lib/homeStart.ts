// Hand-offs from the homepage gateway into the flows (they touch storage, so
// they live apart from the pure gateway config in homeGateway.ts).
import { clearActiveInvite, getActiveInvite } from "@/lib/invites";
import { saveIntakeStart } from "@/lib/intake";

/**
 * A homeowner starting their own search from the homepage. A contractor's
 * link (or the contractor demo) left in this browser must not follow them:
 * no co-brand, no demo banner, no lead's name from someone else's run.
 * A new project in their words starts a fresh brief.
 */
export const startOwnSearch = (note?: string): void => {
  const inherited = !!getActiveInvite();
  clearActiveInvite();
  if (note?.trim()) saveIntakeStart({ goalNote: note.trim().slice(0, 500) }, true);
  else if (inherited) saveIntakeStart({}, true);
};

// ───── Screenshots handed from the homepage to the shortlist ─────
let pendingShots: File[] = [];
export const setPendingShots = (files: File[]) => {
  pendingShots = files.slice(0, 6);
};
export const takePendingShots = (): File[] => {
  const out = pendingShots;
  pendingShots = [];
  return out;
};

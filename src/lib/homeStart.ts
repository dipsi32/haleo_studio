// Hand-offs from the homepage gateway into the flows (they touch storage, so
// they live apart from the pure gateway config in homeGateway.ts).
import { clearActiveInvite, getActiveInvite } from "@/lib/invites";
import { primaryRoom, saveIntakeStart } from "@/lib/intake";
import { detectProject } from "@/lib/projectDetect";

/**
 * A homeowner starting their own search from the homepage. A contractor's
 * link (or the contractor demo) left in this browser must not follow them:
 * no co-brand, no demo banner, no lead's name from someone else's run.
 * A new project in their words starts a fresh brief.
 */
export const startOwnSearch = (note?: string, zip?: string): void => {
  const inherited = !!getActiveInvite();
  clearActiveInvite();
  const words = note?.trim() ?? "";
  const hasZip = !!zip && /^\d{5}$/.test(zip);
  if (words || hasZip) {
    // Their words, the rooms and jobs we can read from them, and their ZIP:
    // enough to show who has done this nearby before asking for anything else.
    const found = words ? detectProject(words) : { rooms: [], goals: [] };
    saveIntakeStart(
      {
        ...(words ? { goalNote: words.slice(0, 500) } : {}),
        ...(found.rooms.length || found.goals.length ? { rooms: found.rooms, goals: found.goals, room: primaryRoom(found.rooms, found.goals) } : {}),
        ...(hasZip ? { address: { zip } } : {}),
      },
      true,
    );
  } else if (inherited) saveIntakeStart({}, true);
};

/** Can we show a match from just their words and ZIP? Needs a project we can read and a ZIP. */
export const canMatchFrom = (note: string, zip: string): boolean => {
  if (!/^\d{5}$/.test(zip)) return false;
  const found = detectProject(note);
  return found.rooms.length > 0 || found.goals.length > 0;
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

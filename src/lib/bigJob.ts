// Bigger jobs: an addition, a whole home, moving walls or adding space. For
// these, the brief asks who's on the team (architect, designer) and for the
// floor plans, because a contractor can't size the job without them.
// Pure; tested in bigJob.test.ts.
import type { IntakeData } from "@/lib/intake";

export type TeamAnswer = "yes" | "looking" | "no";

export const TEAM_LABEL: Record<TeamAnswer, string> = {
  yes: "Working with one",
  looking: "Looking for one",
  no: "Not using one",
};

export const isBigJob = (d: Pick<IntakeData, "room" | "scope" | "goals">): boolean =>
  d.room === "addition" ||
  d.room === "full-home" ||
  d.scope === "reconfigure" ||
  d.scope === "structural" ||
  (d.goals ?? []).some((g) => g === "adu-addition" || g === "garage-conversion" || g === "foundation");

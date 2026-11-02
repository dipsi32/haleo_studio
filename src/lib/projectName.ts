// The project, named from what the homeowner actually chose. One source of truth
// for headings, the brief's first line, saved-project titles and bid requests,
// so nothing ever reads "remodeling the something else".
import { GOAL_LABELS, ROOM_LABELS, type IntakeData, type ProjectGoal, type Room } from "@/lib/intake";

// How each non-room job reads in a sentence ("We're planning ___.").
const GOAL_PHRASES: Record<ProjectGoal, string> = {
  "pool-removal": "a pool removal",
  demolition: "a demolition",
  roof: "roof work",
  electrical: "electrical work",
  plumbing: "plumbing work",
  hvac: "heating and cooling work",
  landscape: "landscape and hardscape work",
  foundation: "foundation and structural work",
  "windows-doors": "new windows and doors",
  exterior: "siding and exterior work",
  "garage-conversion": "converting our garage into living space",
  "adu-addition": "adding an ADU or addition",
  "whole-home": "remodeling our whole home",
  "other-job": "a home project",
};

const ROOM_IN_SENTENCE: Partial<Record<Room, string>> = {
  kitchen: "the kitchen",
  bathroom: "the bathroom",
  living: "the living room",
  bedroom: "the bedroom",
  office: "the home office",
};

const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The homeowner's own words for an "other" job, trimmed to a short phrase. */
const ownWords = (d: IntakeData): string | null => {
  const raw = (d.goalNote || d.visionNote || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const first = raw.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "");
  return first.length > 70 ? `${first.slice(0, 67).trimEnd()}…` : first;
};

// Jobs that aren't a room (roof, pool removal…). Whole-home, ADU and garage are
// carried by d.room; "Something else" is carried by the homeowner's own words.
const ROOM_BUCKET_GOALS: ProjectGoal[] = ["other-job", "whole-home", "adu-addition", "garage-conversion"];
const jobGoals = (d: IntakeData): ProjectGoal[] => (d.goals ?? []).filter((g) => !ROOM_BUCKET_GOALS.includes(g));

const namedRooms = (d: IntakeData): Room[] => {
  const rooms = (d.rooms?.length ? d.rooms : d.room ? [d.room] : []).filter((r) => r in ROOM_IN_SENTENCE);
  return [...new Set(rooms)];
};

/** Short name for headings and lists: "Kitchen", "Kitchen & bathroom", "Roof", "Pool removal / fill-in". */
export const projectLabel = (d: IntakeData): string => {
  if (d.room === "addition") return (d.goals ?? []).includes("garage-conversion") ? "Garage conversion" : "Addition";
  if (d.room === "full-home" && namedRooms(d).length < 2) return "Whole-home remodel";
  const goals = jobGoals(d);
  if (goals.length) return goals.map((g) => GOAL_LABELS[g]).join(" & ");
  const rooms = namedRooms(d);
  if (rooms.length) {
    const names = rooms.map((r) => ROOM_LABELS[r]);
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1].toLowerCase()}`;
  }
  const own = ownWords(d);
  if (own) return own.charAt(0).toUpperCase() + own.slice(1);
  return "Home project";
};

/** First line of the brief, in the homeowner's voice. Only uses what they chose. */
export const projectOpener = (d: IntakeData): string => {
  if (d.room === "addition") {
    return (d.goals ?? []).includes("garage-conversion")
      ? "We're converting our garage into living space."
      : "We're adding on to our home.";
  }
  const rooms = namedRooms(d);
  if (d.room === "full-home" && rooms.length < 2) return "We're remodeling our whole home.";
  const goals = jobGoals(d);
  if (goals.length) return `We're planning ${joinAnd(goals.map((g) => GOAL_PHRASES[g]))}.`;
  if (rooms.length) return `We're remodeling ${joinAnd(rooms.map((r) => ROOM_IN_SENTENCE[r]!))}.`;
  const own = ownWords(d);
  if (own) return `Our project: ${own.charAt(0).toLowerCase() + own.slice(1)}.`;
  return "We're planning a home project.";
};

/** Lowercase noun for "your ___ project" and "a ___" in sentences. */
export const projectNoun = (d: IntakeData): string => {
  const label = projectLabel(d);
  return label === "Home project" ? "home project" : label.toLowerCase();
};

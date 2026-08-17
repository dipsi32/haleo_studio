// Turn a homeowner's own words into rooms + jobs, so they never have to
// hunt through a grid of options. Purely additive: the user always confirms.
import type { ProjectGoal, Room } from "@/lib/intake";

type Rule = { re: RegExp; rooms?: Room[]; goals?: ProjectGoal[] };

const RULES: Rule[] = [
  { re: /\bkitchen|cabinet|countertop|backsplash\b/i, rooms: ["kitchen"] },
  { re: /\bbath(room)?|shower|tub|vanity|toilet\b/i, rooms: ["bathroom"] },
  { re: /\bliving room|family room|den\b/i, rooms: ["living"] },
  { re: /\bbedroom|primary suite|master\b/i, rooms: ["bedroom"] },
  { re: /\boffice|study|workspace\b/i, rooms: ["office"] },
  { re: /\bpool\b/i, goals: ["pool-removal"] },
  { re: /\bdemo(lition|lish)?|tear down|tear-out\b/i, goals: ["demolition"] },
  { re: /\broof|shingle|re-?deck\b/i, goals: ["roof"] },
  { re: /\belectric(al|ian)?|panel|rewire|ev charger|outlet\b/i, goals: ["electrical"] },
  { re: /\bplumb(ing|er)?|repipe|sewer|water heater|pipes?\b/i, goals: ["plumbing"] },
  { re: /\bhvac|furnace|air condition|a\/c|heat pump|duct|mini-?split\b/i, goals: ["hvac"] },
  { re: /\blandscap|yard|patio|driveway|drainage|fence|hardscape\b/i, goals: ["landscape"] },
  { re: /\bfoundation|structural|retrofit|leveling|beam\b/i, goals: ["foundation"] },
  { re: /\bwindow|door(s)?|slider\b/i, goals: ["windows-doors"] },
  { re: /\bsiding|stucco|exterior paint|facade\b/i, goals: ["exterior"] },
  { re: /\bgarage conversion|convert(ing)? (the )?garage\b/i, goals: ["garage-conversion"] },
  { re: /\badu|jadu|addition|add (a )?room|square footage|granny flat\b/i, goals: ["adu-addition"] },
  { re: /\bwhole home|whole house|entire house|full remodel|gut\b/i, goals: ["whole-home"] },
];

export const detectProject = (text: string): { rooms: Room[]; goals: ProjectGoal[] } => {
  const rooms = new Set<Room>();
  const goals = new Set<ProjectGoal>();
  if (text.trim().length < 3) return { rooms: [], goals: [] };
  for (const rule of RULES) {
    if (!rule.re.test(text)) continue;
    rule.rooms?.forEach((r) => rooms.add(r));
    rule.goals?.forEach((g) => goals.add(g));
  }
  return { rooms: [...rooms], goals: [...goals] };
};

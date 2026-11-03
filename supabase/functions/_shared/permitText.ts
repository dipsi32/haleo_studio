// San Jose's permit data names each job in FOLDERNAME ("BPD (BEMP100%)
// KITCHEN REMODEL"). It's the most telling field there is: the others say
// only "Single-Family — Additions/Alterations". Keep the job name, without
// the city's internal codes, so "kitchen" means a kitchen.
// Pure, so vitest can test it (src/lib/permitText.test.ts).

// Leading codes the city prefixes to job names. Never strip real words
// like ADU, so this list is explicit rather than "any short caps word".
const CODE_PREFIXES = new Set(["BPD", "OTC", "EXP", "BEP", "PRJ", "RES", "BLD", "BLDG"]);

/** "BPD (BEMP100%) KITCHEN REMODEL" → "Kitchen remodel". Null when nothing useful is left. */
export const permitJobName = (folderName?: string | null): string | null => {
  if (!folderName) return null;
  let s = folderName.replace(/\([^)]*\)/g, " ").replace(/[_*#]+/g, " ").replace(/\s+/g, " ").trim();
  const words = s.split(" ");
  while (words.length && CODE_PREFIXES.has(words[0].toUpperCase().replace(/[^A-Z]/g, ""))) words.shift();
  s = words.join(" ").replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, "").trim();
  if (s.length < 3 || !/[a-z]{3}/i.test(s)) return null;
  // Sentence case, keeping short all-caps terms that are real acronyms.
  const KEEP = /^(ADU|JADU|HVAC|PV|EV|SFD|MEP|II|III)$/;
  const out = s
    .toLowerCase()
    .split(" ")
    .map((w) => (KEEP.test(w.toUpperCase()) ? w.toUpperCase() : w))
    .join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
};

/** The description we store: the job name first, then the city's category. */
export const permitDescription = (folderName: string | null | undefined, category: string): string | null => {
  const job = permitJobName(folderName);
  const parts = [job, category.trim() || null].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : null;
};

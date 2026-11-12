// Claiming a contractor profile: what the browser remembers between
// "verify your license" and signing in (the emailed link can land back in a
// fresh tab), and server errors in words a contractor can act on.

const KEY = "haleo:pending_claim";
const MAX_AGE_MS = 60 * 60 * 1000;

type Pending = { contractorId: string; license: string; at: number };

export const savePendingClaim = (contractorId: string, license: string) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ contractorId, license, at: Date.now() } satisfies Pending));
  } catch {
    /* private mode: the code path still works in the same tab */
  }
};

/** The license they verified for this profile in the last hour, if any. */
export const readPendingClaim = (contractorId: string, now = Date.now()): string | null => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pending | null;
    if (!p || p.contractorId !== contractorId || typeof p.license !== "string" || now - p.at > MAX_AGE_MS) return null;
    return p.license;
  } catch {
    return null;
  }
};

export const clearPendingClaim = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
};

export const claimErrorMessage = (raw: string | null | undefined): string => {
  const m = raw ?? "";
  if (/license_mismatch/.test(m)) return "That license number doesn't match this profile.";
  if (/license_in_use/.test(m)) return "That license number belongs to another profile on Haleo. Email hello@haleo.studio and we'll sort it out.";
  if (/already_claimed/.test(m)) return "Someone has already claimed this profile. Email hello@haleo.studio and we'll sort it out.";
  if (/profile_not_found/.test(m)) return "We couldn't find this profile.";
  if (/not_authenticated/.test(m)) return "Sign in with your email first.";
  return "Something went wrong. Try again in a moment.";
};

/** Profiles built from city permit records carry a placeholder, not a license number. */
export const hasLicenseOnFile = (license: string | null | undefined) => /^\d[\d\s-]*$/.test((license ?? "").trim());

/** Does what they typed pass, given what's on file? Placeholder profiles take any CSLB-shaped number. */
export const licenseAccepted = (entered: string, onFile: string | null | undefined): boolean => {
  const e = entered.replace(/\D/g, "");
  if (!hasLicenseOnFile(onFile)) return /^\d{5,8}$/.test(e);
  return e.length > 0 && e === (onFile ?? "").replace(/\D/g, "");
};

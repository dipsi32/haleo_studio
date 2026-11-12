import { beforeEach, describe, expect, it } from "vitest";
import { claimErrorMessage, hasLicenseOnFile, licenseAccepted, clearPendingClaim, readPendingClaim, savePendingClaim } from "@/lib/claim";

describe("pending claim", () => {
  beforeEach(() => clearPendingClaim());

  it("remembers the license for the same profile, for an hour", () => {
    savePendingClaim("c1", "1025687");
    expect(readPendingClaim("c1")).toBe("1025687");
    expect(readPendingClaim("c2")).toBeNull();
    expect(readPendingClaim("c1", Date.now() + 2 * 60 * 60 * 1000)).toBeNull();
  });

  it("forgets it once the claim is done", () => {
    savePendingClaim("c1", "1025687");
    clearPendingClaim();
    expect(readPendingClaim("c1")).toBeNull();
  });

  it("turns server errors into plain words", () => {
    expect(claimErrorMessage("license_mismatch")).toMatch(/doesn't match/);
    expect(claimErrorMessage("already_claimed")).toMatch(/already claimed/);
    expect(claimErrorMessage("boom")).toMatch(/Try again/);
  });
});

describe("license check", () => {
  it("matches the number on file", () => {
    expect(licenseAccepted("1025687", "1025687")).toBe(true);
    expect(licenseAccepted("1025 687", "1025687")).toBe(true);
    expect(licenseAccepted("1111111", "1025687")).toBe(false);
  });

  it("takes any CSLB-shaped number when the profile came from permit records", () => {
    expect(hasLicenseOnFile("SJ-BAKHTIARY-MEHDI")).toBe(false);
    expect(hasLicenseOnFile("SJ-ACME-2-BUILDERS")).toBe(false);
    expect(hasLicenseOnFile("1025687")).toBe(true);
    expect(licenseAccepted("1025687", "SJ-BAKHTIARY-MEHDI")).toBe(true);
    expect(licenseAccepted("12", "SJ-BAKHTIARY-MEHDI")).toBe(false);
  });
});

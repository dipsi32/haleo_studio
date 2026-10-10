import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveInvite,
  contractorDisplayName,
  getActiveInvite,
  inviteListStatus,
  inviteMessage,
  invitePath,
  inviteSendPath,
  inviteUrl,
  parseInviteError,
  setActiveInvite,
} from "@/lib/invites";

const contractor = { id: "c1", slug: "creative-builders", name: "Matt", company: "Creative Builders", city: "San Jose" };

describe("links and messages", () => {
  it("builds paths and absolute urls", () => {
    expect(invitePath("abc123")).toBe("/i/abc123");
    expect(inviteSendPath("abc123")).toBe("/i/abc123/send");
    expect(inviteUrl("abc123", "https://haleo.studio")).toBe("https://haleo.studio/i/abc123");
  });

  it("prefers the company name", () => {
    expect(contractorDisplayName(contractor)).toBe("Creative Builders");
    expect(contractorDisplayName({ name: "Matt", company: "  " })).toBe("Matt");
  });

  it("writes a plain text the contractor can paste", () => {
    const m = inviteMessage({ contractor: "Creative Builders", url: "https://x/i/1", firstName: "Pat" });
    expect(m.startsWith("Hi Pat, it's Creative Builders.")).toBe(true);
    expect(m).toContain("https://x/i/1");
    expect(inviteMessage({ contractor: "Creative Builders", url: "u" }).startsWith("Hi, it's Creative Builders.")).toBe(true);
  });
});

describe("inviteListStatus", () => {
  const base = { revoked_at: null, completed_at: null, first_opened_at: null, expires_at: "2099-01-01T00:00:00Z" };
  const now = new Date("2026-10-06T00:00:00Z");
  it("walks sent → opened → received", () => {
    expect(inviteListStatus(base, now)).toBe("sent");
    expect(inviteListStatus({ ...base, first_opened_at: "2026-10-05T00:00:00Z" }, now)).toBe("opened");
    expect(inviteListStatus({ ...base, first_opened_at: "x", completed_at: "2026-10-05T00:00:00Z" }, now)).toBe("received");
  });
  it("lets revoked and completed win over expired", () => {
    const old = { ...base, expires_at: "2020-01-01T00:00:00Z" };
    expect(inviteListStatus(old, now)).toBe("expired");
    expect(inviteListStatus({ ...old, completed_at: "2019-01-01T00:00:00Z" }, now)).toBe("received");
    expect(inviteListStatus({ ...old, revoked_at: "2019-01-01T00:00:00Z" }, now)).toBe("revoked");
  });
});

describe("parseInviteError", () => {
  it("maps database messages to codes", () => {
    expect(parseInviteError("invite_expired")).toBe("invite_expired");
    expect(parseInviteError("ERROR: invite_used (P0001)")).toBe("invite_used");
    expect(parseInviteError("not_authenticated")).toBe("not_authenticated");
    expect(parseInviteError("something else")).toBe("unknown");
    expect(parseInviteError(undefined)).toBe("unknown");
  });
});

describe("active invite", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips", () => {
    setActiveInvite("tok", contractor);
    expect(getActiveInvite()).toMatchObject({ token: "tok", contractorId: "c1", contractorName: "Creative Builders", contractorSlug: "creative-builders" });
    clearActiveInvite();
    expect(getActiveInvite()).toBeNull();
  });

  it("expires after a week", () => {
    setActiveInvite("tok", contractor);
    const saved = getActiveInvite()!.savedAt;
    expect(getActiveInvite(saved + 6 * 24 * 3600 * 1000)).not.toBeNull();
    expect(getActiveInvite(saved + 8 * 24 * 3600 * 1000)).toBeNull();
    expect(localStorage.getItem("haleo:active_invite")).toBeNull();
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("haleo:active_invite", "{not json");
    expect(getActiveInvite()).toBeNull();
    localStorage.setItem("haleo:active_invite", JSON.stringify({ token: "t" }));
    expect(getActiveInvite()).toBeNull();
  });
});

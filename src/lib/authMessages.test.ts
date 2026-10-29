import { describe, expect, it } from "vitest";
import { authMessage } from "./authMessages";

describe("authMessage", () => {
  it("turns the email rate limit into a calm explanation", () => {
    const m = authMessage({ status: 429, message: "email rate limit exceeded" });
    expect(m.kind).toBe("rate");
    expect(m.body).toMatch(/inbox or spam/);
    expect(authMessage({ message: "Too many requests" }).kind).toBe("rate");
  });

  it("recognizes the common sign-in states", () => {
    expect(authMessage({ message: "Email not confirmed" }).kind).toBe("unconfirmed");
    expect(authMessage({ message: "User already registered" }).kind).toBe("exists");
    expect(authMessage({ message: "Invalid login credentials" }).kind).toBe("credentials");
  });

  it("falls back to the raw message, never an empty one", () => {
    expect(authMessage({ message: "Weird" }).body).toBe("Weird");
    expect(authMessage(null).body).toMatch(/Try again/);
  });
});

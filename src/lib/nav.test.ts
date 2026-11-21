import { describe, expect, it } from "vitest";
import { NAV, NAV_GROUPS, navForGateway } from "./nav";
import { GATEWAY } from "./homeGateway";

describe("nav", () => {
  it("every homepage tile has exactly one menu item, so the two never drift", () => {
    for (const g of GATEWAY) expect(navForGateway(g.id)?.gateway).toBe(g.id);
  });
  it("every item sits in exactly one group", () => {
    const ids = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(NAV).sort());
  });
  it("labels are unique", () => {
    const labels = Object.values(NAV).map((n) => n.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

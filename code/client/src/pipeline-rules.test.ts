import { describe, it, expect } from "vitest";
import { failedMoveRules, MOVE_RULES } from "./pipeline-rules";
import { Opportunity, Stage } from "./types";

const stage = (id: number, name: string, status: Stage["status"], order: number): Stage => ({
    id,
    name,
    status,
    conversionLikelihood: 0.5,
    order,
});

const first = stage(1, "Cold Lead", "pending", 1); // lowest order → intake column
const later = stage(2, "Negotiation", "pending", 2);
const won = stage(3, "Closed Won", "won", 3);
const stages = [later, won, first]; // deliberately unordered: rule must find the real first by order

const lead = { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" };
const opp = (expectedCloseDate: string | null): Opportunity => ({
    id: 1,
    lead,
    stage: first,
    value: 1000,
    expectedValue: 500,
    name: "Deal",
    expectedCloseDate,
});

describe("failedMoveRules", () => {
    it("allows moving into the first (intake) stage even with no close date", () => {
        expect(failedMoveRules(opp(null), first, stages)).toEqual([]);
    });

    it("blocks moving into a later stage when the close date is missing", () => {
        expect(failedMoveRules(opp(null), later, stages)).toEqual(["Expected close date is required"]);
    });

    it("blocks moving into a later stage when the close date is blank", () => {
        expect(failedMoveRules(opp(""), won, stages)).toEqual(["Expected close date is required"]);
    });

    it("allows moving into a later stage when a close date is set", () => {
        expect(failedMoveRules(opp("2026-09-01"), later, stages)).toEqual([]);
    });

    it("exposes an extensible rule list (the close-date rule is registered)", () => {
        expect(MOVE_RULES.map(r => r.id)).toContain("expected-close-date");
    });
});

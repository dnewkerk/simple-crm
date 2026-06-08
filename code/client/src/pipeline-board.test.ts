import { describe, it, expect } from "vitest";
import { buildStageColumns, moveOpportunityToStage } from "./pipeline-board";
import { Opportunity, Stage } from "./types";

const stage = (id: number, name: string, status: Stage["status"], order: number): Stage => ({
    id,
    name,
    status,
    conversionLikelihood: status === "won" ? 1 : status === "lost" ? 0 : 0.5,
    order,
});

const lead = { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" };

let nextId = 1;
const opp = (s: Stage, value: number, expectedValue?: number): Opportunity => ({
    id: nextId++,
    lead,
    stage: s,
    value,
    expectedValue,
    name: "Deal",
});

const lead2pending = stage(1, "Demo", "pending", 1);
const negotiation = stage(2, "Negotiation", "pending", 2);
const closedWon = stage(3, "Closed Won", "won", 3);
const closedLost = stage(4, "Closed Lost", "lost", 4);
const stages = [lead2pending, negotiation, closedWon, closedLost];

describe("buildStageColumns", () => {
    it("returns one column per stage in input order, all empty (empty state)", () => {
        const cols = buildStageColumns([], stages);
        expect(cols).toHaveLength(4);
        expect(cols.map(c => c.stage.name)).toEqual(["Demo", "Negotiation", "Closed Won", "Closed Lost"]);
        expect(cols.every(c => c.count === 0 && c.totalValue === 0 && c.totalExpectedValue === 0)).toBe(true);
        expect(cols.every(c => c.opportunities.length === 0)).toBe(true);
    });

    it("groups opportunities by stage id and computes count and totals", () => {
        const cols = buildStageColumns(
            [
                opp(lead2pending, 100, 50),
                opp(lead2pending, 200, 100),
                opp(negotiation, 400, 200),
                opp(closedWon, 1000, 1000),
                opp(closedLost, 500, 0),
            ],
            stages,
        );
        const byId = Object.fromEntries(cols.map(c => [c.stage.id, c]));

        expect(byId[1].count).toBe(2);
        expect(byId[1].totalValue).toBe(300);
        expect(byId[1].totalExpectedValue).toBe(150);

        expect(byId[2].count).toBe(1);
        expect(byId[2].totalExpectedValue).toBe(200);

        expect(byId[3].count).toBe(1);
        expect(byId[3].totalExpectedValue).toBe(1000);

        expect(byId[4].count).toBe(1);
        expect(byId[4].totalValue).toBe(500);
        expect(byId[4].totalExpectedValue).toBe(0);
    });

    it("treats a missing expectedValue as 0 (edge input)", () => {
        const cols = buildStageColumns([opp(lead2pending, 100 /* no expectedValue */)], stages);
        const demo = cols.find(c => c.stage.id === 1)!;
        expect(demo.count).toBe(1);
        expect(demo.totalValue).toBe(100);
        expect(demo.totalExpectedValue).toBe(0);
    });

    it("ignores opportunities whose stage is not in the stage list", () => {
        const orphanStage = stage(99, "Ghost", "pending", 99);
        const cols = buildStageColumns([opp(orphanStage, 1000, 500), opp(lead2pending, 100, 50)], stages);
        expect(cols).toHaveLength(4);
        expect(cols.reduce((n, c) => n + c.count, 0)).toBe(1);
        expect(cols.find(c => c.stage.id === 1)!.count).toBe(1);
    });
});

describe("moveOpportunityToStage", () => {
    it("reassigns the target opportunity to the new stage", () => {
        const a = opp(lead2pending, 100, 50);
        const b = opp(negotiation, 200, 100);
        const next = moveOpportunityToStage([a, b], a.id, closedWon);
        expect(next.find(o => o.id === a.id)!.stage).toBe(closedWon);
    });

    it("leaves other opportunities untouched", () => {
        const a = opp(lead2pending, 100, 50);
        const b = opp(negotiation, 200, 100);
        const next = moveOpportunityToStage([a, b], a.id, closedWon);
        expect(next.find(o => o.id === b.id)!.stage).toBe(negotiation);
    });

    it("does not mutate the input array or the moved opportunity", () => {
        const a = opp(lead2pending, 100, 50);
        const before = [a];
        const next = moveOpportunityToStage(before, a.id, closedWon);
        expect(next).not.toBe(before);
        expect(a.stage).toBe(lead2pending); // original object unchanged
    });

    it("returns the list unchanged when the id is not found (edge input)", () => {
        const a = opp(lead2pending, 100, 50);
        const next = moveOpportunityToStage([a], 9999, closedWon);
        expect(next.map(o => o.id)).toEqual([a.id]);
        expect(next[0].stage).toBe(lead2pending);
    });
});

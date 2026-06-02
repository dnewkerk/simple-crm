import { describe, it, expect } from "vitest";
import { buildForecast } from "./forecast";
import { Opportunity, Stage } from "./types";

const pendingStage: Stage = { id: 1, name: "Demo", status: "pending", conversionLikelihood: 0.5, order: 1 };

let nextId = 1;
const opp = (expectedCloseDate: string | null, value = 1000): Opportunity => ({
    id: nextId++,
    lead: { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" },
    stage: pendingStage,
    value,
    expectedValue: value * 0.5,
    name: "Deal",
    expectedCloseDate,
});

// Fixed reference: 15 June 2026 (month index 5).
const today = new Date(2026, 5, 15);

describe("buildForecast", () => {
    it("renders 8 columns all empty for no opportunities (empty state)", () => {
        const cols = buildForecast([], today);
        expect(cols).toHaveLength(8);
        expect(cols.map(c => c.title)).toEqual([
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "Past / No Date Set",
            "Future",
        ]);
        expect(cols.every(c => c.count === 0 && c.totalExpectedValue === 0)).toBe(true);
        // Past/No Date column still exposes its two sub-groups, empty.
        expect(cols[6].groups.map(g => g.heading)).toEqual(["Past", "No Date Set"]);
    });

    it("buckets each opportunity into the right column", () => {
        const cols = buildForecast(
            [
                opp("2026-06-20", 100), // current month -> June
                opp("2026-07-05", 200), // +1 -> July
                opp("2026-11-30", 300), // +5 -> November (last month column)
                opp("2026-12-01", 400), // +6 -> Future
                opp("2026-03-10", 500), // past
                opp(null, 600), // no date
            ],
            today,
        );
        const byKey = Object.fromEntries(cols.map(c => [c.key, c]));
        expect(byKey["month-0"].count).toBe(1);
        expect(byKey["month-0"].totalExpectedValue).toBe(50); // value 100 * 0.5
        expect(byKey["month-1"].count).toBe(1);
        expect(byKey["month-5"].count).toBe(1); // November
        expect(byKey["future"].count).toBe(1);
        expect(byKey["future"].totalExpectedValue).toBe(200); // value 400 * 0.5

        const pastNoDate = byKey["past-nodate"];
        expect(pastNoDate.count).toBe(2);
        expect(pastNoDate.totalExpectedValue).toBe(550); // (500 + 600) * 0.5
        expect(pastNoDate.groups[0]).toMatchObject({ heading: "Past" });
        expect(pastNoDate.groups[0].opportunities).toHaveLength(1);
        expect(pastNoDate.groups[1]).toMatchObject({ heading: "No Date Set" });
        expect(pastNoDate.groups[1].opportunities).toHaveLength(1);
    });

    it("sorts opportunities within a column by close date ascending", () => {
        const cols = buildForecast([opp("2026-06-25"), opp("2026-06-02"), opp("2026-06-15")], today);
        const june = cols[0];
        expect(june.groups[0].opportunities.map(o => o.expectedCloseDate)).toEqual(["2026-06-02", "2026-06-15", "2026-06-25"]);
    });

    it("treats exactly six months out as Future, five months as the last month column", () => {
        const cols = buildForecast([opp("2026-11-15"), opp("2026-12-15")], today);
        const byKey = Object.fromEntries(cols.map(c => [c.key, c]));
        expect(byKey["month-5"].count).toBe(1); // November (offset 5)
        expect(byKey["future"].count).toBe(1); // December (offset 6)
    });

    it("handles year rollover in month titles", () => {
        const december = new Date(2026, 11, 1); // December 2026
        const cols = buildForecast([], december);
        expect(cols.slice(0, 6).map(c => c.title)).toEqual(["December", "January", "February", "March", "April", "May"]);
    });
});

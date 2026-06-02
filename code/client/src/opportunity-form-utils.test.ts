import { describe, it, expect } from "vitest";
import {
    opportunityCustomFields,
    buildInitialValues,
    buildPayload,
    validateOpportunity,
    hasErrors,
    displayedCustomFields,
    normalizeDateString,
    formatDateValue,
    parseDateValue,
} from "./opportunity-form-utils";
import { CustomField, Opportunity, Stage } from "./types";

const stages: Stage[] = [
    { id: 1, name: "Cold", status: "pending", conversionLikelihood: 0.1, order: 1 },
    { id: 2, name: "Demo", status: "pending", conversionLikelihood: 0.5, order: 2 },
];

const fields: CustomField[] = [
    { id: 1, name: "industry", label: "Industry", entity: "lead", type: "text" },
    { id: 2, name: "region", label: "Region", entity: "opportunity", type: "text" },
];

describe("opportunityCustomFields", () => {
    it("returns only opportunity-scoped fields", () => {
        expect(opportunityCustomFields(fields).map(f => f.name)).toEqual(["region"]);
    });

    it("returns an empty list when there are no fields (empty state)", () => {
        expect(opportunityCustomFields([])).toEqual([]);
    });
});

describe("buildInitialValues", () => {
    it("uses blank defaults and the first stage when adding (empty state)", () => {
        const v = buildInitialValues(null, [], stages);
        expect(v).toEqual({ stageId: 1, value: "", name: "", expectedCloseDate: "", customFieldValues: {} });
    });

    it("seeds blank custom-field values when adding with opp fields present", () => {
        const v = buildInitialValues(null, opportunityCustomFields(fields), stages);
        expect(v.customFieldValues).toEqual({ region: "" });
    });

    it("prefills from an existing opportunity, coercing custom fields to strings", () => {
        const opp: Opportunity = {
            id: 9,
            lead: { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" },
            stage: stages[1],
            value: 5000,
            name: "Deal",
            expectedCloseDate: "2026-07-15",
            customFields: { region: 123 as unknown as string },
        };
        const v = buildInitialValues(opp, opportunityCustomFields(fields), stages);
        expect(v.stageId).toBe(2);
        expect(v.value).toBe("5000");
        expect(v.name).toBe("Deal");
        expect(v.expectedCloseDate).toBe("2026-07-15");
        expect(v.customFieldValues).toEqual({ region: "123" });
    });

    it("leaves the close date empty when the opportunity has none (empty state)", () => {
        const opp: Opportunity = {
            id: 9,
            lead: { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" },
            stage: stages[1],
            value: 5000,
            expectedCloseDate: null,
            customFields: {},
        };
        expect(buildInitialValues(opp, [], stages).expectedCloseDate).toBe("");
    });

    it("defaults a missing custom-field value to empty string", () => {
        const opp: Opportunity = {
            id: 9,
            lead: { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" },
            stage: stages[1],
            value: 5000,
            customFields: {},
        };
        const v = buildInitialValues(opp, opportunityCustomFields(fields), stages);
        expect(v.customFieldValues).toEqual({ region: "" });
    });
});

describe("validateOpportunity", () => {
    const base = { stageId: 1 as number | "", expectedCloseDate: "", customFieldValues: {} };

    it("requires a name (no silent Unnamed fallback)", () => {
        const errors = validateOpportunity({ ...base, name: "   ", value: "5000" });
        expect(errors.name).toMatch(/required/i);
        expect(hasErrors(errors)).toBe(true);
    });

    it("requires a value", () => {
        const errors = validateOpportunity({ ...base, name: "Deal", value: "" });
        expect(errors.value).toMatch(/required/i);
    });

    it("rejects a zero or negative value (the blank -> $0 bug)", () => {
        expect(validateOpportunity({ ...base, name: "Deal", value: "0" }).value).toMatch(/greater than 0/i);
        expect(validateOpportunity({ ...base, name: "Deal", value: "-5" }).value).toMatch(/greater than 0/i);
    });

    it("passes a valid name + value", () => {
        const errors = validateOpportunity({ ...base, name: "Deal", value: "5000" });
        expect(errors).toEqual({});
        expect(hasErrors(errors)).toBe(false);
    });
});

describe("displayedCustomFields", () => {
    const oppFields = opportunityCustomFields([
        ...fields,
        { id: 3, name: "headcount", label: "Headcount", entity: "opportunity", type: "number" },
    ]);
    const makeOpp = (customFields: Record<string, unknown>): Opportunity => ({
        id: 1,
        lead: { id: 1, firstName: "A", lastName: "B", age: 30, phoneNumber: "x" },
        stage: stages[0],
        value: 5000,
        customFields: customFields as Record<string, string>,
    });

    it("returns label/value pairs for filled opportunity fields, coercing to string", () => {
        expect(displayedCustomFields(makeOpp({ region: "NA", headcount: 120 }), oppFields)).toEqual([
            { name: "region", label: "Region", value: "NA" },
            { name: "headcount", label: "Headcount", value: "120" },
        ]);
    });

    it("omits fields with empty or missing values (empty state)", () => {
        expect(displayedCustomFields(makeOpp({ region: "", headcount: undefined }), oppFields)).toEqual([]);
        expect(displayedCustomFields(makeOpp({}), oppFields)).toEqual([]);
    });

    it("returns nothing when no opportunity fields are defined", () => {
        expect(displayedCustomFields(makeOpp({ region: "NA" }), [])).toEqual([]);
    });
});

describe("buildPayload", () => {
    it("numericizes stage and value and passes the close date for the API", () => {
        const payload = buildPayload(7, {
            stageId: 2,
            value: "5000",
            name: "Deal",
            expectedCloseDate: "2026-07-15",
            customFieldValues: { region: "NA" },
        });
        expect(payload).toEqual({
            leadId: 7,
            stageId: 2,
            value: 5000,
            name: "Deal",
            expectedCloseDate: "2026-07-15",
            customFields: { region: "NA" },
        });
    });

    it("sends null when no close date is set (empty state)", () => {
        const payload = buildPayload(7, { stageId: 2, value: "5000", name: "Deal", expectedCloseDate: "", customFieldValues: {} });
        expect(payload.expectedCloseDate).toBeNull();
    });
});

describe("date helpers", () => {
    it("normalizes API date values to YYYY-MM-DD", () => {
        expect(normalizeDateString("2026-07-15")).toBe("2026-07-15");
        expect(normalizeDateString("2026-07-15T00:00:00.000Z")).toBe("2026-07-15");
        expect(normalizeDateString(null)).toBe("");
        expect(normalizeDateString(undefined)).toBe("");
    });

    it("round-trips between Date and string without timezone drift", () => {
        const d = parseDateValue("2026-07-15");
        expect(d?.getFullYear()).toBe(2026);
        expect(d?.getMonth()).toBe(6); // July (0-indexed)
        expect(d?.getDate()).toBe(15);
        expect(formatDateValue(d)).toBe("2026-07-15");
    });

    it("treats empty/invalid input as no date", () => {
        expect(parseDateValue("")).toBeNull();
        expect(formatDateValue(null)).toBe("");
    });
});

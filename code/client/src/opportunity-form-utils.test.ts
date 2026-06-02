import { describe, it, expect } from "vitest";
import { opportunityCustomFields, buildInitialValues, buildPayload } from "./opportunity-form-utils";
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
        expect(v).toEqual({ stageId: 1, value: "", name: "", customFieldValues: {} });
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
            customFields: { region: 123 as unknown as string },
        };
        const v = buildInitialValues(opp, opportunityCustomFields(fields), stages);
        expect(v.stageId).toBe(2);
        expect(v.value).toBe("5000");
        expect(v.name).toBe("Deal");
        expect(v.customFieldValues).toEqual({ region: "123" });
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

describe("buildPayload", () => {
    it("numericizes stage and value for the API", () => {
        const payload = buildPayload(7, { stageId: 2, value: "5000", name: "Deal", customFieldValues: { region: "NA" } });
        expect(payload).toEqual({ leadId: 7, stageId: 2, value: 5000, name: "Deal", customFields: { region: "NA" } });
    });
});

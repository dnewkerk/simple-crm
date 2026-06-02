import { CustomField, Opportunity, Stage } from "./types";

export interface OpportunityFormValues {
    stageId: number | "";
    value: string;
    name: string;
    customFieldValues: Record<string, string>;
}

/** Custom fields that apply to opportunities (entity defaults to "lead" when unset). */
export const opportunityCustomFields = (fields: CustomField[]): CustomField[] =>
    fields.filter(f => (f.entity ?? "lead") === "opportunity");

/**
 * Initial form state. With opp === null we're adding (blank defaults, first
 * stage preselected); otherwise we prefill from the opportunity. Custom-field
 * values are coerced to strings and default to "" when the opp lacks them.
 */
export const buildInitialValues = (
    opp: Opportunity | null,
    oppFields: CustomField[],
    stages: Stage[],
): OpportunityFormValues => {
    const customFieldValues: Record<string, string> = {};
    for (const field of oppFields) {
        const raw = opp?.customFields?.[field.name];
        customFieldValues[field.name] = raw === undefined || raw === null ? "" : String(raw);
    }
    return {
        stageId: opp?.stage?.id ?? stages[0]?.id ?? "",
        value: opp ? String(opp.value) : "",
        name: opp?.name ?? "",
        customFieldValues,
    };
};

export interface OpportunityPayload {
    leadId: number;
    stageId: number;
    value: number;
    name: string;
    customFields: Record<string, string>;
}

export interface OpportunityFieldErrors {
    name?: string;
    value?: string;
}

/**
 * Client-side validation for the opportunity form. Name is required (no silent
 * "Unnamed" fallback) and Value must be a number greater than zero (so a blank
 * field can't post a $0 deal). The server still enforces the configured minimum.
 */
export const validateOpportunity = (values: OpportunityFormValues): OpportunityFieldErrors => {
    const errors: OpportunityFieldErrors = {};
    if (!values.name.trim()) {
        errors.name = "Name is required";
    }
    if (values.value.trim() === "") {
        errors.value = "Value is required";
    } else if (!(Number(values.value) > 0)) {
        errors.value = "Value must be greater than 0";
    }
    return errors;
};

export const hasErrors = (errors: OpportunityFieldErrors): boolean => Object.keys(errors).length > 0;

export const buildPayload = (leadId: number, values: OpportunityFormValues): OpportunityPayload => ({
    leadId,
    stageId: Number(values.stageId),
    value: Number(values.value),
    name: values.name,
    customFields: values.customFieldValues,
});

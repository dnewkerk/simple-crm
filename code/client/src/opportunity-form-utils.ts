import { CustomField, Opportunity, Stage } from "./types";

export interface OpportunityFormValues {
    stageId: number | "";
    value: string;
    name: string;
    expectedCloseDate: string; // "YYYY-MM-DD", or "" when not set
    customFieldValues: Record<string, string>;
}

/** Normalize an API date value ("YYYY-MM-DD" or ISO datetime) to "YYYY-MM-DD". */
export const normalizeDateString = (value: string | null | undefined): string =>
    value ? String(value).slice(0, 10) : "";

/** Close date for read-only display, or "N/A" when the opportunity has none. */
export const closeDateDisplay = (opp: Opportunity): string => normalizeDateString(opp.expectedCloseDate) || "N/A";

/** Format a Date as a local "YYYY-MM-DD" string (no timezone shift). */
export const formatDateValue = (date: Date | null): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

/** Parse a "YYYY-MM-DD" string into a local Date, or null when empty/invalid. */
export const parseDateValue = (value: string): Date | null => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

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
        expectedCloseDate: normalizeDateString(opp?.expectedCloseDate),
        customFieldValues,
    };
};

export interface OpportunityPayload {
    leadId: number;
    stageId: number;
    value: number;
    name: string;
    expectedCloseDate: string | null;
    customFields: Record<string, string>;
}

export interface DisplayedCustomField {
    name: string;
    label: string;
    value: string;
}

/**
 * Opportunity-scoped custom fields that have a value on this opportunity, for
 * read-only display on the card. Fields the opp hasn't filled in are omitted so
 * cards don't show empty noise.
 */
export const displayedCustomFields = (opp: Opportunity, oppFields: CustomField[]): DisplayedCustomField[] => {
    const result: DisplayedCustomField[] = [];
    for (const field of oppFields) {
        const raw = opp.customFields?.[field.name];
        const value = raw === undefined || raw === null ? "" : String(raw);
        if (value.trim() !== "") {
            result.push({ name: field.name, label: field.label, value });
        }
    }
    return result;
};

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
    expectedCloseDate: values.expectedCloseDate || null,
    customFields: values.customFieldValues,
});

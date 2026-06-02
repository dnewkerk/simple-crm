import { CustomField, Opportunity } from "./types";
import { parseDateValue, normalizeDateString } from "./opportunity-form-utils";

export const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export const FORECAST_MONTHS = 6;

export interface ForecastGroup {
    heading?: string;
    opportunities: Opportunity[];
}

export interface ForecastColumn {
    key: string;
    title: string;
    count: number;
    totalExpectedValue: number; // sum of opportunity `expectedValue` (risk-adjusted forecast)
    groups: ForecastGroup[];
}

/** Whole-calendar-month offset of an opportunity's close date from `today`. */
const monthOffset = (today: Date, dateStr: string): number => {
    const d = parseDateValue(dateStr);
    if (!d) return NaN;
    return (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
};

/** Sort by close date ascending; undated entries sort after dated ones. */
const byCloseDateAsc = (a: Opportunity, b: Opportunity): number => {
    const da = normalizeDateString(a.expectedCloseDate);
    const db = normalizeDateString(b.expectedCloseDate);
    if (da && db) return da < db ? -1 : da > db ? 1 : 0;
    if (da) return -1;
    if (db) return 1;
    return 0;
};

const sumExpectedValue = (list: Opportunity[]): number => list.reduce((sum, o) => sum + (o.expectedValue || 0), 0);

/**
 * Bucket open opportunities into forecast columns:
 *   [current month .. +5 months], "Past / No Date Set", "Future".
 * Past = close date before the current calendar month. No Date Set = no close
 * date (needs estimating). Future = more than six months out (offset >= 6).
 * `today` is injected so the result is deterministic and testable.
 */
export const buildForecast = (opps: Opportunity[], today: Date): ForecastColumn[] => {
    const months: Opportunity[][] = Array.from({ length: FORECAST_MONTHS }, () => []);
    const past: Opportunity[] = [];
    const noDate: Opportunity[] = [];
    const future: Opportunity[] = [];

    for (const opp of opps) {
        const ds = normalizeDateString(opp.expectedCloseDate);
        const offset = ds ? monthOffset(today, ds) : NaN;
        if (Number.isNaN(offset)) noDate.push(opp);
        else if (offset < 0) past.push(opp);
        else if (offset < FORECAST_MONTHS) months[offset].push(opp);
        else future.push(opp);
    }

    const sorted = (list: Opportunity[]) => [...list].sort(byCloseDateAsc);
    const columns: ForecastColumn[] = [];

    for (let i = 0; i < FORECAST_MONTHS; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const list = sorted(months[i]);
        columns.push({
            key: `month-${i}`,
            title: MONTH_NAMES[monthDate.getMonth()],
            count: list.length,
            totalExpectedValue: sumExpectedValue(list),
            groups: [{ opportunities: list }],
        });
    }

    const pastSorted = sorted(past);
    const noDateSorted = sorted(noDate);
    columns.push({
        key: "past-nodate",
        title: "Past / No Date Set",
        count: pastSorted.length + noDateSorted.length,
        totalExpectedValue: sumExpectedValue(pastSorted) + sumExpectedValue(noDateSorted),
        groups: [
            { heading: "Past", opportunities: pastSorted },
            { heading: "No Date Set", opportunities: noDateSorted },
        ],
    });

    const futureSorted = sorted(future);
    columns.push({
        key: "future",
        title: "Future",
        count: futureSorted.length,
        totalExpectedValue: sumExpectedValue(futureSorted),
        groups: [{ opportunities: futureSorted }],
    });

    return columns;
};

/**
 * Split opportunities into sub-groups by the value of a custom field. Distinct
 * values become headings (sorted), each group sorted by close date. Opps with
 * no value for the field collect in a "No {label}" group rendered last.
 */
export const groupByCustomField = (opps: Opportunity[], field: CustomField): ForecastGroup[] => {
    const byValue = new Map<string, Opportunity[]>();
    const noValue: Opportunity[] = [];
    for (const opp of opps) {
        const raw = opp.customFields?.[field.name];
        const value = raw === undefined || raw === null ? "" : String(raw).trim();
        if (value === "") {
            noValue.push(opp);
        } else {
            if (!byValue.has(value)) byValue.set(value, []);
            byValue.get(value)!.push(opp);
        }
    }
    const groups: ForecastGroup[] = [];
    for (const value of [...byValue.keys()].sort()) {
        groups.push({ heading: value, opportunities: [...byValue.get(value)!].sort(byCloseDateAsc) });
    }
    if (noValue.length) groups.push({ heading: `No ${field.label}`, opportunities: [...noValue].sort(byCloseDateAsc) });
    return groups;
};

/**
 * Re-group every column's opportunities by a custom field (preserving each
 * column's count/total). With no field selected, columns are returned as-is.
 */
export const regroupColumns = (columns: ForecastColumn[], field: CustomField | null): ForecastColumn[] => {
    if (!field) return columns;
    return columns.map(column => ({
        ...column,
        groups: groupByCustomField(
            column.groups.flatMap(group => group.opportunities),
            field,
        ),
    }));
};

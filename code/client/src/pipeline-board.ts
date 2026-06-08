import { Opportunity, Stage } from "./types";

export interface StageColumn {
    stage: Stage;
    opportunities: Opportunity[];
    count: number;
    totalValue: number; // sum of opportunity `value`
    totalExpectedValue: number; // sum of opportunity `expectedValue` (risk-adjusted forecast)
}

/**
 * Group opportunities into one column per stage (in the given stage order) for the
 * pipeline Kanban board. Totals are summed client-side from each opportunity's own
 * `value` / `expectedValue` (missing expectedValue counts as 0) rather than trusting
 * the cached `Stage.expectedValue` aggregate. Opportunities whose stage is not in
 * `stages` are dropped. Every stage gets a column even when it has no opportunities.
 */
export const buildStageColumns = (opps: Opportunity[], stages: Stage[]): StageColumn[] => {
    const byStageId = new Map<number, Opportunity[]>();
    for (const stage of stages) byStageId.set(stage.id, []);
    for (const opp of opps) {
        const list = byStageId.get(opp.stage?.id);
        if (list) list.push(opp);
    }

    return stages.map(stage => {
        const opportunities = byStageId.get(stage.id)!;
        const totalValue = opportunities.reduce((sum, o) => sum + (o.value || 0), 0);
        const totalExpectedValue = opportunities.reduce((sum, o) => sum + (o.expectedValue || 0), 0);
        return { stage, opportunities, count: opportunities.length, totalValue, totalExpectedValue };
    });
};

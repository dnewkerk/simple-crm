import { Opportunity, Stage } from "./types";
import { normalizeDateString } from "./opportunity-form-utils";

/**
 * A precondition that must hold before a card may be dropped into a target stage.
 * Rules are evaluated per target column, so new ones can be added here without
 * touching the board. `appliesTo` decides which columns enforce the rule;
 * `passes` decides whether a given opportunity satisfies it.
 */
export interface MoveRule {
    id: string;
    message: string; // shown as a bullet in the toast when the rule fails
    appliesTo: (target: Stage, stages: Stage[]) => boolean;
    passes: (opp: Opportunity, target: Stage) => boolean;
}

/** The intake column is the stage with the lowest `order`. */
const isFirstStage = (stage: Stage, stages: Stage[]): boolean => {
    if (stages.length === 0) return false;
    const firstId = [...stages].sort((a, b) => a.order - b.order)[0].id;
    return stage.id === firstId;
};

export const MOVE_RULES: MoveRule[] = [
    {
        id: "expected-close-date",
        message: "Expected close date is required",
        // Every column except the first/intake one requires a close date.
        appliesTo: (target, stages) => !isFirstStage(target, stages),
        passes: opp => normalizeDateString(opp.expectedCloseDate) !== "",
    },
];

/**
 * Messages for every rule that fails when dropping `opp` into `target`.
 * An empty array means the move is allowed.
 */
export const failedMoveRules = (opp: Opportunity, target: Stage, stages: Stage[]): string[] =>
    MOVE_RULES.filter(rule => rule.appliesTo(target, stages) && !rule.passes(opp, target)).map(rule => rule.message);

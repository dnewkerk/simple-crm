import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { AppDataSource } from "../src/data-source";
import { createApp } from "../src/index";
import { AppSetting } from "../src/entity/AppSetting";
import { Lead } from "../src/entity/Lead";

// DEMONSTRATION TEST — documents the `expectedValue` cache-drift bug (see
// NOTES.md). `Opportunity.expectedValue` is a stored copy of `value × likelihood`,
// but editing a stage's likelihood never recomputes the opportunities on it, so
// the pipeline/forecast keep reporting the OLD number. This test passes *because*
// the bug exists. When the bug is fixed (compute-on-read, or recompute opps on a
// stage edit), flip the stale assertion to `correctValue` and it should still pass.

let app: ReturnType<typeof createApp>;
let leadId: number;

beforeAll(async () => {
    await AppDataSource.initialize();
    const m = AppDataSource.manager;
    await m.getRepository(AppSetting).save([
        Object.assign(new AppSetting(), { key: "minimumOpportunityValue", value: "1000" }),
        Object.assign(new AppSetting(), { key: "wonStageLikelihood", value: "1.0" }),
        Object.assign(new AppSetting(), { key: "lostStageLikelihood", value: "0.0" }),
    ]);
    const lead = await m.getRepository(Lead).save(
        Object.assign(new Lead(), { firstName: "Drift", lastName: "Demo", age: 30, phoneNumber: "555-0000", customFields: {} }),
    );
    leadId = lead.id;
    app = createApp();
});

afterAll(async () => {
    await AppDataSource.destroy();
});

// Pull one stage's row out of the pipeline report.
interface StageRow {
    stage: { id: number; conversionLikelihood: number };
    expectedValue: number;
}
const stageRow = (pipeline: { byStage: StageRow[] }, stageId: number) =>
    pipeline.byStage.find(row => row.stage.id === stageId) as StageRow;

describe("expectedValue cache drift", () => {
    it("pipeline expected value goes STALE after a stage's likelihood changes", async () => {
        // A pending stage at 50%, with a single $10,000 deal on it.
        const stage = (
            await request(app).post("/stages").send({ name: "Drift Stage", status: "pending", conversionLikelihood: 0.5 })
        ).body;
        await request(app).post("/opportunities").send({ leadId, stageId: stage.id, value: 10000, name: "Drift Deal" });

        // Baseline: the pipeline reports 10000 × 0.5 = 5000 for this stage.
        const before = stageRow((await request(app).get("/pipeline")).body, stage.id);
        expect(before.expectedValue).toBe(5000);

        // Change the stage's likelihood 50% → 90% via the real endpoint.
        await request(app)
            .put(`/stages/${stage.id}`)
            .send({ name: "Drift Stage", status: "pending", conversionLikelihood: 0.9 });

        const after = stageRow((await request(app).get("/pipeline")).body, stage.id);
        const correctValue = 10000 * 0.9; // 9000 — what the pipeline SHOULD now report

        // The stage's own likelihood updated correctly...
        expect(after.stage.conversionLikelihood).toBe(0.9);

        // ...but the reported expected value is STILL 5000 (computed at create time
        // with the old 0.5), not 9000. The opportunity's cached expectedValue was
        // never recomputed when the stage changed. THIS is the drift.
        expect(after.expectedValue).toBe(5000); // stale  ← flip to `correctValue` once fixed
        expect(after.expectedValue).not.toBe(correctValue);

        // eslint-disable-next-line no-console
        console.log(
            `\n[drift demo] stage likelihood 0.5 → 0.9 | pipeline still reports $${after.expectedValue} (stale) | correct would be $${correctValue}\n`,
        );
    });
});

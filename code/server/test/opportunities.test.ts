import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { AppDataSource } from "../src/data-source";
import { createApp } from "../src/index";
import { AppSetting } from "../src/entity/AppSetting";
import { Lead } from "../src/entity/Lead";
import { Stage } from "../src/entity/Stage";
import { Opportunity } from "../src/entity/Opportunity";

let app: ReturnType<typeof createApp>;
let leadId: number;
let stageId: number;

beforeAll(async () => {
    await AppDataSource.initialize(); // synchronize:true builds the schema in :memory:
    const m = AppDataSource.manager;
    await m.getRepository(AppSetting).save([
        Object.assign(new AppSetting(), { key: "minimumOpportunityValue", value: "1000" }),
        Object.assign(new AppSetting(), { key: "wonStageLikelihood", value: "1.0" }),
        Object.assign(new AppSetting(), { key: "lostStageLikelihood", value: "0.0" }),
    ]);
    const lead = await m.getRepository(Lead).save(
        Object.assign(new Lead(), { firstName: "Test", lastName: "Lead", age: 30, phoneNumber: "555-0000", customFields: {} }),
    );
    const stage = await m.getRepository(Stage).save(
        Object.assign(new Stage(), { name: "Demo", status: "pending", conversionLikelihood: 0.5, order: 1, expectedValue: 0 }),
    );
    leadId = lead.id;
    stageId = stage.id;
    app = createApp();
});

afterAll(async () => {
    await AppDataSource.destroy();
});

describe("POST /opportunities", () => {
    it("creates an opportunity and computes expectedValue (happy path)", async () => {
        const res = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 5000, name: "New Deal", customFields: { region: "NA" } });
        expect(res.status).toBe(200);
        expect(res.body.value).toBe(5000);
        expect(res.body.expectedValue).toBe(2500); // 5000 * 0.5
        expect(res.body.customFields).toEqual({ region: "NA" });
    });

    it("rejects a value below the configured minimum (error path)", async () => {
        const res = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 500, name: "Too cheap" });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/at least/i);
    });

    it("rejects an invalid lead or stage", async () => {
        const res = await request(app)
            .post("/opportunities")
            .send({ leadId: 99999, stageId, value: 5000 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid/i);
    });
});

describe("PUT /opportunities/:id", () => {
    it("updates value and recomputes expectedValue (happy path)", async () => {
        const created = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 4000, name: "Editable" });
        const res = await request(app)
            .put(`/opportunities/${created.body.id}`)
            .send({ value: 8000, customFields: { region: "EMEA" } });
        expect(res.status).toBe(200);
        expect(res.body.value).toBe(8000);
        expect(res.body.expectedValue).toBe(4000); // 8000 * 0.5
        expect(res.body.customFields).toEqual({ region: "EMEA" });
    });

    it("returns 404 for an unknown opportunity (error path)", async () => {
        const res = await request(app).put("/opportunities/99999").send({ value: 5000 });
        expect(res.status).toBe(404);
    });
});

describe("PUT /opportunities/reorder", () => {
    const make = (value: number, name: string) =>
        request(app).post("/opportunities").send({ leadId, stageId, value, name }).then(r => r.body);

    it("persists an explicit card order within a stage", async () => {
        const a = await make(2000, "Order A");
        const b = await make(2000, "Order B");
        const c = await make(2000, "Order C");

        const res = await request(app).put("/opportunities/reorder").send({ stageId, orderedIds: [c.id, a.id, b.id] });
        expect(res.status).toBe(200);

        const all = (await request(app).get("/opportunities")).body.filter((o: { stage: { id: number } }) => o.stage.id === stageId);
        const idx = (id: number) => all.findIndex((o: { id: number }) => o.id === id);
        expect(idx(c.id)).toBeLessThan(idx(a.id));
        expect(idx(a.id)).toBeLessThan(idx(b.id));
    });

    it("moves a card to another stage at a position and recomputes expectedValue", async () => {
        const m = AppDataSource.manager;
        const wonStage = await m.getRepository(Stage).save(
            Object.assign(new Stage(), { name: "Won2", status: "won", conversionLikelihood: 1, order: 98, expectedValue: 0 }),
        );
        const opp = await make(5000, "Mover"); // pending: expected 2500

        const res = await request(app).put("/opportunities/reorder").send({ stageId: wonStage.id, orderedIds: [opp.id] });
        expect(res.status).toBe(200);

        const reloaded = (await request(app).get("/opportunities")).body.find((o: { id: number }) => o.id === opp.id);
        expect(reloaded.stage.id).toBe(wonStage.id);
        expect(reloaded.expectedValue).toBe(5000); // 5000 * won likelihood 1.0
        expect(reloaded.position).toBe(0);
    });

    it("returns 400 for an invalid stage (error path)", async () => {
        const res = await request(app).put("/opportunities/reorder").send({ stageId: 99999, orderedIds: [] });
        expect(res.status).toBe(400);
    });

    it("returns 400 when an opportunity id is unknown (edge input)", async () => {
        const res = await request(app).put("/opportunities/reorder").send({ stageId, orderedIds: [99999] });
        expect(res.status).toBe(400);
    });
});

describe("PUT /opportunities/:id/move (fractional, single-row)", () => {
    // A dedicated stage so positions are predictable and isolated from other tests.
    let moveStageId: number;
    const getOpp = async (id: number) =>
        (await request(app).get("/opportunities")).body.find((o: { id: number }) => o.id === id);
    const make = (stage: number, value: number, name: string) =>
        request(app).post("/opportunities").send({ leadId, stageId: stage, value, name }).then(r => r.body);

    beforeAll(async () => {
        const stage = await AppDataSource.manager.getRepository(Stage).save(
            Object.assign(new Stage(), { name: "MoveLane", status: "pending", conversionLikelihood: 0.5, order: 50, expectedValue: 0 }),
        );
        moveStageId = stage.id;
    });

    it("places a card between two neighbors WITHOUT changing their rows (happy + single-row)", async () => {
        const a = await make(moveStageId, 2000, "A"); // position 0
        const b = await make(moveStageId, 2000, "B"); // position 1
        const c = await make(moveStageId, 2000, "C"); // position 2
        const aPosBefore = (await getOpp(a.id)).position;
        const bPosBefore = (await getOpp(b.id)).position;

        // Move C to sit between A and B.
        const res = await request(app)
            .put(`/opportunities/${c.id}/move`)
            .send({ stageId: moveStageId, prevId: a.id, nextId: b.id });
        expect(res.status).toBe(200);

        const cPos = (await getOpp(c.id)).position;
        expect(cPos).toBeGreaterThan(aPosBefore);
        expect(cPos).toBeLessThan(bPosBefore);
        // The defining property of option 1: neighbors' rows are untouched.
        expect((await getOpp(a.id)).position).toBe(aPosBefore);
        expect((await getOpp(b.id)).position).toBe(bPosBefore);

        // GET order reflects A, C, B.
        const inStage = (await request(app).get("/opportunities")).body
            .filter((o: { stage: { id: number } }) => o.stage.id === moveStageId)
            .map((o: { id: number }) => o.id);
        const idx = (id: number) => inStage.indexOf(id);
        expect(idx(a.id)).toBeLessThan(idx(c.id));
        expect(idx(c.id)).toBeLessThan(idx(b.id));
    });

    it("drops at the top (nextId only) and bottom (prevId only)", async () => {
        const top = await make(moveStageId, 2000, "ToTop");
        const first = (await request(app).get("/opportunities")).body
            .filter((o: { stage: { id: number } }) => o.stage.id === moveStageId)
            .sort((x: { position: number }, y: { position: number }) => x.position - y.position)[0];
        const res = await request(app).put(`/opportunities/${top.id}/move`).send({ stageId: moveStageId, nextId: first.id });
        expect(res.status).toBe(200);
        expect((await getOpp(top.id)).position).toBeLessThan(first.position);
    });

    it("moves into an EMPTY stage with no neighbors → position 0 and recomputed expectedValue (empty/cross-stage)", async () => {
        const empty = await AppDataSource.manager.getRepository(Stage).save(
            Object.assign(new Stage(), { name: "EmptyWon", status: "won", conversionLikelihood: 1, order: 60, expectedValue: 0 }),
        );
        const opp = await make(moveStageId, 5000, "Mover"); // pending: expected 2500
        const res = await request(app).put(`/opportunities/${opp.id}/move`).send({ stageId: empty.id });
        expect(res.status).toBe(200);

        const reloaded = await getOpp(opp.id);
        expect(reloaded.stage.id).toBe(empty.id);
        expect(reloaded.position).toBe(0);
        expect(reloaded.expectedValue).toBe(5000); // 5000 * won likelihood 1.0
    });

    it("rebalances cross-stage totals", async () => {
        const src = await AppDataSource.manager.getRepository(Stage).save(
            Object.assign(new Stage(), { name: "RbSrc", status: "pending", conversionLikelihood: 0.5, order: 61, expectedValue: 0 }),
        );
        const dst = await AppDataSource.manager.getRepository(Stage).save(
            Object.assign(new Stage(), { name: "RbDst", status: "won", conversionLikelihood: 1, order: 62, expectedValue: 0 }),
        );
        const opp = await make(src.id, 4000, "Rebalance"); // src expected +2000
        const srcBefore = (await request(app).get("/stages")).body.find((s: { id: number }) => s.id === src.id).expectedValue;

        await request(app).put(`/opportunities/${opp.id}/move`).send({ stageId: dst.id });

        const stages = (await request(app).get("/stages")).body;
        expect(stages.find((s: { id: number }) => s.id === src.id).expectedValue).toBe(srcBefore - 2000);
        expect(stages.find((s: { id: number }) => s.id === dst.id).expectedValue).toBe(4000); // 4000 * 1.0
    });

    it("returns 404 for an unknown opportunity (error path)", async () => {
        const res = await request(app).put("/opportunities/99999/move").send({ stageId: moveStageId });
        expect(res.status).toBe(404);
    });

    it("returns 400 for an invalid target stage (error path)", async () => {
        const opp = await make(moveStageId, 2000, "BadStage");
        const res = await request(app).put(`/opportunities/${opp.id}/move`).send({ stageId: 99999 });
        expect(res.status).toBe(400);
    });
});

describe("GET /opportunities/open", () => {
    it("returns only opportunities on a pending stage", async () => {
        const m = AppDataSource.manager;
        const wonStage = await m.getRepository(Stage).save(
            Object.assign(new Stage(), { name: "Won", status: "won", conversionLikelihood: 1, order: 99, expectedValue: 0 }),
        );
        // One open (pending) and one closed (won) opportunity.
        const openRes = await request(app).post("/opportunities").send({ leadId, stageId, value: 5000, name: "Open one" });
        const wonOpp = await m.getRepository(Opportunity).save(
            Object.assign(new Opportunity(), {
                lead: { id: leadId },
                stage: { id: wonStage.id },
                value: 7000,
                expectedValue: 7000,
                name: "Closed one",
                customFields: {},
            }),
        );

        const res = await request(app).get("/opportunities/open");
        expect(res.status).toBe(200);
        const ids = res.body.map((o: { id: number }) => o.id);
        expect(ids).toContain(openRes.body.id);
        expect(ids).not.toContain(wonOpp.id);
        expect(res.body.every((o: { stage: { status: string } }) => o.stage.status === "pending")).toBe(true);
    });
});

describe("expectedCloseDate", () => {
    it("persists and returns the close date on create", async () => {
        const res = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 5000, name: "Dated", expectedCloseDate: "2026-07-15" });
        expect(res.status).toBe(200);
        expect(String(res.body.expectedCloseDate)).toContain("2026-07-15");

        const reload = await request(app).get("/opportunities");
        const found = reload.body.find((o: { id: number }) => o.id === res.body.id);
        expect(String(found.expectedCloseDate)).toContain("2026-07-15");
    });

    it("defaults to null when no close date is given (empty state)", async () => {
        const res = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 5000, name: "No date" });
        expect(res.status).toBe(200);
        expect(res.body.expectedCloseDate).toBeNull();
    });

    it("can set then clear the close date via PUT", async () => {
        const created = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 5000, name: "Clearable", expectedCloseDate: "2026-08-01" });
        const cleared = await request(app)
            .put(`/opportunities/${created.body.id}`)
            .send({ expectedCloseDate: null });
        expect(cleared.status).toBe(200);
        expect(cleared.body.expectedCloseDate).toBeNull();
    });

    it("leaves the close date unchanged when PUT omits it", async () => {
        const created = await request(app)
            .post("/opportunities")
            .send({ leadId, stageId, value: 5000, name: "Keep date", expectedCloseDate: "2026-09-09" });
        const updated = await request(app)
            .put(`/opportunities/${created.body.id}`)
            .send({ value: 6000 });
        expect(updated.status).toBe(200);
        expect(String(updated.body.expectedCloseDate)).toContain("2026-09-09");
    });
});

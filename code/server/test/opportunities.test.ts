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

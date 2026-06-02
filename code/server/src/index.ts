import { AppDataSource } from "./data-source";
import { Lead } from "./entity/Lead";
import { CustomField } from "./entity/CustomField";
import { Stage } from "./entity/Stage";
import { Opportunity } from "./entity/Opportunity";
import { AppSetting } from "./entity/AppSetting";
import { seedDatabase } from "./seed";
import express from "express";

export const createApp = () => {
    const app = express();
    app.use(express.json());

    // Settings endpoints
    app.get("/settings", async (req, res) => {
        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        res.json(settings);
    });

    app.put("/settings/:key", async (req, res) => {
        const setting = await AppDataSource.manager.getRepository(AppSetting).findOne({ where: { key: req.params.key } });
        if (!setting) {
            const created = new AppSetting();
            created.key = req.params.key;
            created.value = req.body.value;
            await AppDataSource.manager.getRepository(AppSetting).save(created);
            res.json(created);
            return;
        }
        setting.value = req.body.value;
        await AppDataSource.manager.getRepository(AppSetting).save(setting);

        if (setting.key === "wonStageLikelihood" || setting.key === "lostStageLikelihood") {
            const status = setting.key === "wonStageLikelihood" ? "won" : "lost";
            const newLikelihood = parseFloat(setting.value);
            const stagesRepo = AppDataSource.manager.getRepository(Stage);
            const oppsRepo = AppDataSource.manager.getRepository(Opportunity);
            const stages = await stagesRepo.find({ where: { status } });
            for (const stage of stages) {
                const stageOpps = await oppsRepo.find({ where: { stage: { id: stage.id } } });
                stage.expectedValue = stageOpps.reduce((sum, opp) => sum + opp.value * newLikelihood, 0);
                await stagesRepo.save(stage);
            }
        }

        res.json(setting);
    });

    // Custom Fields endpoints
    app.get("/custom-fields", async (req, res) => {
        const fields = await AppDataSource.manager.getRepository(CustomField).find();
        res.json(fields);
    });

    app.post("/custom-fields", async (req, res) => {
        const field = new CustomField();
        field.name = req.body.name;
        field.label = req.body.label;
        if (req.body.entity) field.entity = req.body.entity;
        if (req.body.type) field.type = req.body.type;
        try {
            await AppDataSource.manager.getRepository(CustomField).save(field);
            res.json(field);
        } catch (error) {
            res.status(400).json({ error: "Field name already exists" });
        }
    });

    app.delete("/custom-fields/:id", async (req, res) => {
        await AppDataSource.manager.getRepository(CustomField).delete(req.params.id);
        res.json({ success: true });
    });

    // Leads endpoints
    app.get("/leads", async (req, res) => {
        const leads = await AppDataSource.manager.getRepository(Lead).find();
        res.json(leads);
    });

    app.post("/leads", async (req, res) => {
        const lead = new Lead();
        lead.firstName = req.body.firstName;
        lead.lastName = req.body.lastName;
        lead.age = req.body.age;
        lead.phoneNumber = req.body.phoneNumber;
        lead.customFields = req.body.customFields || {};
        await AppDataSource.manager.getRepository(Lead).save(lead);
        res.json(lead);
    });

    app.put("/leads/:id", async (req, res) => {
        const lead = await AppDataSource.manager
            .getRepository(Lead)
            .findOne({ where: { id: parseInt(req.params.id) } });
        lead.firstName = req.body.firstName;
        lead.lastName = req.body.lastName;
        lead.age = req.body.age;
        lead.phoneNumber = req.body.phoneNumber;
        lead.customFields = req.body.customFields || {};
        await AppDataSource.manager.getRepository(Lead).save(lead);
        res.json(lead);
    });

    // Stages endpoints
    app.get("/stages", async (req, res) => {
        const stages = await AppDataSource.manager.getRepository(Stage).find({ order: { order: "ASC" } });
        res.json(stages);
    });

    app.post("/stages", async (req, res) => {
        const stage = new Stage();
        stage.name = req.body.name;
        stage.status = req.body.status;
        stage.conversionLikelihood = req.body.conversionLikelihood;
        const maxOrder = await AppDataSource.manager
            .getRepository(Stage)
            .createQueryBuilder("stage")
            .select("MAX(stage.order)", "max")
            .getRawOne();
        stage.order = (maxOrder.max || 0) + 1;
        await AppDataSource.manager.getRepository(Stage).save(stage);
        res.json(stage);
    });

    app.put("/stages/:id", async (req, res) => {
        const stage = await AppDataSource.manager.getRepository(Stage).findOne({ where: { id: parseInt(req.params.id) } });
        stage.name = req.body.name;
        stage.status = req.body.status;
        stage.conversionLikelihood = req.body.conversionLikelihood;
        if (req.body.order !== undefined) stage.order = req.body.order;
        await AppDataSource.manager.getRepository(Stage).save(stage);
        res.json(stage);
    });

    app.delete("/stages/:id", async (req, res) => {
        await AppDataSource.manager.getRepository(Stage).delete(req.params.id);
        res.json({ success: true });
    });

    // Opportunities endpoints
    app.get("/opportunities", async (req, res) => {
        const opportunities = await AppDataSource.manager.getRepository(Opportunity).find();
        res.json(opportunities);
    });

    // Open opportunities only (stage status "pending") — used by the forecast.
    app.get("/opportunities/open", async (req, res) => {
        const opportunities = await AppDataSource.manager.getRepository(Opportunity).find();
        res.json(opportunities.filter(opp => opp.stage?.status === "pending"));
    });

    app.post("/opportunities", async (req, res) => {
        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        const minValue = parseFloat(settings.find(s => s.key === "minimumOpportunityValue")?.value ?? "0");
        const wonLikelihood = parseFloat(settings.find(s => s.key === "wonStageLikelihood")?.value ?? "1");
        const lostLikelihood = parseFloat(settings.find(s => s.key === "lostStageLikelihood")?.value ?? "0");

        if (req.body.value < minValue) {
            res.status(400).json({ error: `Value must be at least ${minValue}` });
            return;
        }

        const lead = await AppDataSource.manager.getRepository(Lead).findOne({ where: { id: req.body.leadId } });
        const stage = await AppDataSource.manager.getRepository(Stage).findOne({ where: { id: req.body.stageId } });
        if (!lead || !stage) {
            res.status(400).json({ error: "Invalid lead or stage" });
            return;
        }

        const opp = new Opportunity();
        opp.lead = lead;
        opp.stage = stage;
        opp.value = req.body.value;
        opp.name = req.body.name;
        opp.expectedCloseDate = req.body.expectedCloseDate ?? null;
        opp.customFields = req.body.customFields || {};
        const likelihood =
            opp.stage.status === "won" ? wonLikelihood : opp.stage.status === "lost" ? lostLikelihood : opp.stage.conversionLikelihood;
        opp.expectedValue = opp.value * likelihood;
        await AppDataSource.manager.getRepository(Opportunity).save(opp);

        opp.stage.expectedValue = (opp.stage.expectedValue || 0) + opp.expectedValue;
        await AppDataSource.manager.getRepository(Stage).save(opp.stage);

        res.json(opp);
    });

    app.put("/opportunities/:id", async (req, res) => {
        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        const minValue = parseFloat(settings.find(s => s.key === "minimumOpportunityValue")?.value ?? "0");
        const wonLikelihood = parseFloat(settings.find(s => s.key === "wonStageLikelihood")?.value ?? "1");
        const lostLikelihood = parseFloat(settings.find(s => s.key === "lostStageLikelihood")?.value ?? "0");

        const opp = await AppDataSource.manager.getRepository(Opportunity).findOne({ where: { id: parseInt(req.params.id) } });
        if (!opp) {
            res.status(404).json({ error: "Opportunity not found" });
            return;
        }
        const oldExpectedValue = opp.expectedValue || 0;
        const oldStage = opp.stage;
        if (req.body.stageId) {
            const nextStage = await AppDataSource.manager.getRepository(Stage).findOne({ where: { id: req.body.stageId } });
            if (!nextStage) {
                res.status(400).json({ error: "Invalid stage" });
                return;
            }
            opp.stage = nextStage;
        }
        if (req.body.value !== undefined) {
            if (req.body.value < minValue) {
                res.status(400).json({ error: `Value must be at least ${minValue}` });
                return;
            }
            opp.value = req.body.value;
        }
        if (req.body.name !== undefined) opp.name = req.body.name;
        if (req.body.expectedCloseDate !== undefined) opp.expectedCloseDate = req.body.expectedCloseDate;
        if (req.body.customFields) opp.customFields = req.body.customFields;
        const likelihood =
            opp.stage.status === "won" ? wonLikelihood : opp.stage.status === "lost" ? lostLikelihood : opp.stage.conversionLikelihood;
        opp.expectedValue = opp.value * likelihood;
        await AppDataSource.manager.getRepository(Opportunity).save(opp);

        if (oldStage.id !== opp.stage.id) {
            oldStage.expectedValue = (oldStage.expectedValue || 0) - oldExpectedValue;
            await AppDataSource.manager.getRepository(Stage).save(oldStage);
            opp.stage.expectedValue = (opp.stage.expectedValue || 0) + opp.expectedValue;
            await AppDataSource.manager.getRepository(Stage).save(opp.stage);
        } else {
            opp.stage.expectedValue = (opp.stage.expectedValue || 0) - oldExpectedValue + opp.expectedValue;
            await AppDataSource.manager.getRepository(Stage).save(opp.stage);
        }

        res.json(opp);
    });

    app.delete("/opportunities/:id", async (req, res) => {
        const opp = await AppDataSource.manager.getRepository(Opportunity).findOne({ where: { id: parseInt(req.params.id) } });
        if (opp) {
            opp.stage.expectedValue = (opp.stage.expectedValue || 0) - (opp.expectedValue || 0);
            await AppDataSource.manager.getRepository(Stage).save(opp.stage);
            await AppDataSource.manager.getRepository(Opportunity).delete(req.params.id);
        }
        res.json({ success: true });
    });

    // Pipeline report endpoint
    app.get("/pipeline", async (req, res) => {
        const stages = await AppDataSource.manager.getRepository(Stage).find({ order: { order: "ASC" } });
        const opportunities = await AppDataSource.manager.getRepository(Opportunity).find();

        let totalValue = 0;
        let expectedValue = 0;

        const byStage = stages.map(stage => {
            const stageOpps = opportunities.filter(opp => opp.stage.id === stage.id);
            const stageTotal = stageOpps.reduce((sum, opp) => sum + opp.value, 0);
            const stageExpected = stageOpps.reduce((sum, opp) => sum + (opp.expectedValue ?? 0), 0);

            totalValue += stageTotal;
            expectedValue += stageExpected;

            return {
                stage,
                count: stageOpps.length,
                totalValue: stageTotal,
                expectedValue: stageExpected,
            };
        });

        res.json({ totalValue, expectedValue, byStage });
    });

    return app;
};

const run = async () => {
    await AppDataSource.initialize();
    await seedDatabase();
    const app = createApp();
    app.listen(3000, () => {
        console.log("Server is running on http://localhost:3000");
    });
};

if (require.main === module) {
    run();
}

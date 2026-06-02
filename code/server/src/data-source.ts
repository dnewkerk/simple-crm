import "reflect-metadata";
import { DataSource } from "typeorm";
import { Lead } from "./entity/Lead";
import { CustomField } from "./entity/CustomField";
import { Stage } from "./entity/Stage";
import { Opportunity } from "./entity/Opportunity";
import { AppSetting } from "./entity/AppSetting";

// Tests build the schema from entities (synchronize); everything else owns the
// schema via migrations (treated like production). The DB path is a separate
// concern — SQLITE_DB overrides it (tests use ":memory:") without changing how
// the schema is created.
const isTest = process.env.NODE_ENV === "test";

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: process.env.SQLITE_DB ?? "database.sqlite",
    // Production/dev: synchronize off, migrations run on boot. Tests synchronize
    // from entities on an in-memory DB for isolation (TypeORM loads .ts
    // migrations via a path that bypasses Vitest's transform); the migrations
    // themselves are exercised by the dev-server boot and the Playwright run.
    synchronize: isTest,
    migrations: isTest ? [] : [__dirname + "/migrations/*{.ts,.js}"],
    migrationsRun: !isTest,
    logging: false,
    entities: [Lead, CustomField, Stage, Opportunity, AppSetting],
    subscribers: [],
});

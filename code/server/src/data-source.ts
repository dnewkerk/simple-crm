import "reflect-metadata";
import { DataSource } from "typeorm";
import { Lead } from "./entity/Lead";
import { CustomField } from "./entity/CustomField";
import { Stage } from "./entity/Stage";
import { Opportunity } from "./entity/Opportunity";
import { AppSetting } from "./entity/AppSetting";

// Tests point at an isolated in-memory database via SQLITE_DB.
const usingTestDb = !!process.env.SQLITE_DB;

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: process.env.SQLITE_DB ?? "database.sqlite",
    // Production/dev: schema is owned by migrations (treated like production),
    // synchronize off. Tests build the schema from entities on an in-memory DB
    // for isolation; the migrations themselves are exercised by the dev-server
    // boot (and the Playwright run against it).
    synchronize: usingTestDb,
    migrations: usingTestDb ? [] : [__dirname + "/migrations/*{.ts,.js}"],
    migrationsRun: !usingTestDb,
    logging: false,
    entities: [Lead, CustomField, Stage, Opportunity, AppSetting],
    subscribers: [],
});

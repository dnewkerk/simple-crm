import "reflect-metadata";
import { DataSource } from "typeorm";
import { Lead } from "./entity/Lead";
import { CustomField } from "./entity/CustomField";
import { Stage } from "./entity/Stage";
import { Opportunity } from "./entity/Opportunity";
import { AppSetting } from "./entity/AppSetting";

export const AppDataSource = new DataSource({
    type: "sqlite",
    // Allow tests to point at an isolated in-memory database via SQLITE_DB.
    database: process.env.SQLITE_DB ?? "database.sqlite",
    synchronize: true,
    logging: false,
    entities: [Lead, CustomField, Stage, Opportunity, AppSetting],
    migrations: [],
    subscribers: [],
});

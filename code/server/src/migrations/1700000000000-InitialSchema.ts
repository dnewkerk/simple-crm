import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline schema. Captures the tables that `synchronize` previously created so
 * a fresh database can be built entirely from migrations (synchronize is now
 * off). DDL mirrors what TypeORM generated for the current entities.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
    name = "InitialSchema1700000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "app_setting" ("key" varchar PRIMARY KEY NOT NULL, "value" varchar NOT NULL)`,
        );
        await queryRunner.query(
            `CREATE TABLE "custom_field" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "label" varchar NOT NULL, "entity" varchar NOT NULL DEFAULT ('lead'), "type" varchar NOT NULL DEFAULT ('text'), CONSTRAINT "UQ_custom_field_name" UNIQUE ("name"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "lead" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "firstName" varchar NOT NULL, "lastName" varchar NOT NULL, "age" integer NOT NULL, "phoneNumber" varchar NOT NULL, "customFields" text)`,
        );
        await queryRunner.query(
            `CREATE TABLE "stage" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "status" varchar NOT NULL, "conversionLikelihood" real NOT NULL, "order" integer NOT NULL, "expectedValue" real NOT NULL DEFAULT (0))`,
        );
        await queryRunner.query(
            `CREATE TABLE "opportunity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "value" real NOT NULL, "expectedValue" real, "name" varchar, "customFields" text, "leadId" integer, "stageId" integer, CONSTRAINT "FK_opportunity_lead" FOREIGN KEY ("leadId") REFERENCES "lead" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_opportunity_stage" FOREIGN KEY ("stageId") REFERENCES "stage" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "opportunity"`);
        await queryRunner.query(`DROP TABLE "stage"`);
        await queryRunner.query(`DROP TABLE "lead"`);
        await queryRunner.query(`DROP TABLE "custom_field"`);
        await queryRunner.query(`DROP TABLE "app_setting"`);
    }
}

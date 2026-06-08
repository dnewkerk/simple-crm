import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Add a per-stage sort position to opportunities so the pipeline Kanban board can
 * persist the order cards are dropped into. Backfill assigns 0-based positions
 * within each stage by existing id order, so current data keeps a stable order.
 */
export class AddOpportunityPosition1700000000002 implements MigrationInterface {
    name = "AddOpportunityPosition1700000000002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opportunity" ADD COLUMN "position" integer`);
        await queryRunner.query(`
            UPDATE "opportunity"
            SET "position" = (
                SELECT COUNT(*) FROM "opportunity" AS o2
                WHERE o2."stageId" = "opportunity"."stageId" AND o2."id" < "opportunity"."id"
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opportunity" DROP COLUMN "position"`);
    }
}

import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Add a projected close date to opportunities. Nullable with no default: a rep
 * may not be able to estimate a date when first creating the deal, and forcing
 * a value (or defaulting one) would pollute forecasts with bogus dates. Named
 * "expected" to leave room for a future "actual close date" comparison.
 */
export class AddExpectedCloseDate1700000000001 implements MigrationInterface {
    name = "AddExpectedCloseDate1700000000001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opportunity" ADD COLUMN "expectedCloseDate" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opportunity" DROP COLUMN "expectedCloseDate"`);
    }
}

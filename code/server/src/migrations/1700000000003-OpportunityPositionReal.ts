import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Switch Opportunity.position from integer to real so the pipeline board can use
 * fractional sort keys: a card dropped between two others is stored at the
 * midpoint of their positions, which lets a reorder persist by writing only the
 * moved row instead of renumbering the whole column. Existing integer positions
 * are valid starting values (midpoints subdivide the gaps between them), so the
 * column rebuild preserves data unchanged.
 */
export class OpportunityPositionReal1700000000003 implements MigrationInterface {
    name = "OpportunityPositionReal1700000000003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("opportunity");
        const column = table!.findColumnByName("position")!;
        const updated = column.clone();
        updated.type = "real";
        await queryRunner.changeColumn("opportunity", column, updated);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("opportunity");
        const column = table!.findColumnByName("position")!;
        const updated = column.clone();
        updated.type = "integer";
        await queryRunner.changeColumn("opportunity", column, updated);
    }
}

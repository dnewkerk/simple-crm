import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Lead } from "./Lead";
import { Stage } from "./Stage";

@Entity()
export class Opportunity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Lead, lead => lead.opportunities, { eager: true })
    lead: Lead;

    @ManyToOne(() => Stage, stage => stage.opportunities, { eager: true })
    stage: Stage;

    @Column("real")
    value: number;

    @Column("real", { nullable: true })
    expectedValue: number;

    @Column({ nullable: true })
    name: string;

    // Projected close date (YYYY-MM-DD). Nullable, no default — see the
    // AddExpectedCloseDate migration for the rationale.
    @Column({ type: "date", nullable: true })
    expectedCloseDate: string | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Column("simple-json", { nullable: true })
    customFields: Record<string, any> = {};
}

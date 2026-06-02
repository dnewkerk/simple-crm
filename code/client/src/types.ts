export interface Lead {
    id: number;
    firstName: string;
    lastName: string;
    age: number;
    phoneNumber: string;
    customFields?: Record<string, string>;
}

export interface CustomField {
    id: number;
    name: string;
    label: string;
    entity?: string;
    type?: string;
}

export interface Stage {
    id: number;
    name: string;
    status: "pending" | "won" | "lost";
    conversionLikelihood: number;
    order: number;
    expectedValue?: number;
}

export interface Opportunity {
    id: number;
    lead: Lead;
    stage: Stage;
    value: number;
    expectedValue?: number;
    name?: string;
    expectedCloseDate?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customFields?: Record<string, any>;
}

export interface AppSetting {
    key: string;
    value: string;
}

export interface PipelineReport {
    totalValue: number;
    expectedValue: number;
    byStage: {
        stage: Stage;
        count: number;
        totalValue: number;
        expectedValue: number;
    }[];
}

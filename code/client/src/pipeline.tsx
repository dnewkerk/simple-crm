import axios from "axios";
import { useEffect, useState } from "react";
import { CustomField, Opportunity, Stage } from "./types";
import { buildStageColumns, StageColumn } from "./pipeline-board";
import { opportunityCustomFields } from "./opportunity-form-utils";
import { OpportunityCard } from "./opportunity-card";

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const StageColumnView: React.FC<{ column: StageColumn; oppFields: CustomField[] }> = ({ column, oppFields }) => {
    const { stage } = column;
    const tint = stage.status === "won" ? "bg-green-50" : stage.status === "lost" ? "bg-red-50" : "bg-gray-100";
    return (
        <div className={`w-[275px] shrink-0 mx-2 p-2 ${tint} rounded self-start max-h-[calc(100vh-12rem)] overflow-y-auto`}>
            <div className="flex justify-between items-baseline">
                <h3 className="font-bold">
                    {stage.name}
                    <span className="text-xs font-normal text-gray-500 ml-2">({stage.status})</span>
                </h3>
                <span className="pl-2 text-sm text-gray-600">{column.count}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">Total Expected Value: {formatCurrency(column.totalExpectedValue)}</p>
            {column.count === 0 ? (
                <p className="text-sm text-gray-400">No opportunities</p>
            ) : (
                column.opportunities.map(opp => <OpportunityCard key={opp.id} opp={opp} oppFields={oppFields} />)
            )}
        </div>
    );
};

export const Pipeline: React.FC = () => {
    const [opps, setOpps] = useState<Opportunity[] | null>(null);
    const [stages, setStages] = useState<Stage[]>([]);
    const [oppFields, setOppFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchPipeline();
    }, []);

    const fetchPipeline = async () => {
        setLoading(true);
        setError("");
        try {
            const [oppsRes, stagesRes, fieldsRes] = await Promise.all([
                axios.get<Opportunity[]>("/api/opportunities"),
                axios.get<Stage[]>("/api/stages"),
                axios.get<CustomField[]>("/api/custom-fields"),
            ]);
            setOpps(oppsRes.data);
            setStages(stagesRes.data);
            setOppFields(opportunityCustomFields(fieldsRes.data));
        } catch {
            setError("Could not load the pipeline. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p className="text-gray-500">Loading pipeline…</p>;
    if (error)
        return (
            <div className="space-y-2">
                <p className="text-red-500">{error}</p>
                <button onClick={fetchPipeline} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        );

    const columns = buildStageColumns(opps ?? [], stages);
    const totalValue = columns.reduce((sum, c) => sum + c.totalValue, 0);
    const expectedValue = columns.reduce((sum, c) => sum + c.totalExpectedValue, 0);
    const totalOpps = opps?.length ?? 0;

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold">Pipeline Report</h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-gray-600">Total Pipeline Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded border border-green-200">
                    <p className="text-sm text-gray-600">Expected Close Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(expectedValue)}</p>
                </div>
            </div>

            {totalOpps === 0 && (
                <p className="text-gray-500">No opportunities in the pipeline yet. Add one to a stage to see it here.</p>
            )}

            <div className="flex overflow-x-auto pb-4 items-start">
                {columns.map(column => (
                    <StageColumnView key={column.stage.id} column={column} oppFields={oppFields} />
                ))}
            </div>
        </div>
    );
};

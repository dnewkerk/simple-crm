import axios from "axios";
import { useEffect, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { CustomField, Opportunity, Stage } from "./types";
import { buildStageColumns, moveOpportunityToStage, StageColumn } from "./pipeline-board";
import { opportunityCustomFields } from "./opportunity-form-utils";
import { OpportunityCard } from "./opportunity-card";

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const cardDragId = (opp: Opportunity) => `card:${opp.id}`;
const columnDropId = (stage: Stage) => `col:${stage.id}`;

const DraggableCard: React.FC<{ opp: Opportunity; oppFields: CustomField[] }> = ({ opp, oppFields }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cardDragId(opp) });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`cursor-grab touch-none rounded ${isDragging ? "opacity-40" : ""}`}
            aria-label={`Drag ${opp.name || "opportunity"} to another stage`}
        >
            <OpportunityCard opp={opp} oppFields={oppFields} />
        </div>
    );
};

const StageColumnView: React.FC<{ column: StageColumn; oppFields: CustomField[] }> = ({ column, oppFields }) => {
    const { stage } = column;
    const { setNodeRef, isOver } = useDroppable({ id: columnDropId(stage) });
    const tint = stage.status === "won" ? "bg-green-50" : stage.status === "lost" ? "bg-red-50" : "bg-gray-100";
    const overRing = isOver ? "ring-2 ring-blue-400" : "";
    return (
        <div
            ref={setNodeRef}
            className={`w-[275px] shrink-0 mx-2 p-2 ${tint} ${overRing} rounded self-start max-h-[calc(100vh-12rem)] overflow-y-auto`}
        >
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
                column.opportunities.map(opp => <DraggableCard key={opp.id} opp={opp} oppFields={oppFields} />)
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
    const [moveError, setMoveError] = useState("");
    const [activeOpp, setActiveOpp] = useState<Opportunity | null>(null);

    const sensors = useSensors(
        // Require a small drag distance so clicking a card's "More" button isn't a drag.
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor),
    );

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

    const handleDragStart = (event: DragStartEvent) => {
        const id = Number(String(event.active.id).replace("card:", ""));
        setActiveOpp(opps?.find(o => o.id === id) ?? null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveOpp(null);
        const { active, over } = event;
        if (!over || !opps) return;

        const oppId = Number(String(active.id).replace("card:", ""));
        const targetStageId = Number(String(over.id).replace("col:", ""));
        const opp = opps.find(o => o.id === oppId);
        const targetStage = stages.find(s => s.id === targetStageId);
        if (!opp || !targetStage || opp.stage.id === targetStage.id) return;

        // Optimistically move the card, remembering the prior state so we can revert.
        const previous = opps;
        setMoveError("");
        setOpps(moveOpportunityToStage(opps, oppId, targetStage));

        try {
            await axios.put(`/api/opportunities/${oppId}`, { stageId: targetStageId });
            // Reconcile expectedValue / column totals with the server's authoritative values.
            const fresh = await axios.get<Opportunity[]>("/api/opportunities");
            setOpps(fresh.data);
        } catch {
            setOpps(previous); // revert the optimistic move
            setMoveError(`Could not move "${opp.name || "opportunity"}" to ${targetStage.name}. Please try again.`);
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
            <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-bold">Pipeline Report</h2>
                <span className="text-sm text-gray-500">Drag a card to a new stage to update it</span>
            </div>

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

            {moveError && (
                <div className="flex items-center justify-between gap-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-600">{moveError}</p>
                    <button onClick={() => setMoveError("")} className="text-sm text-red-600 hover:text-red-700" aria-label="Dismiss">
                        ✕
                    </button>
                </div>
            )}

            {totalOpps === 0 && (
                <p className="text-gray-500">No opportunities in the pipeline yet. Add one to a stage to see it here.</p>
            )}

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex overflow-x-auto pb-4 items-start">
                    {columns.map(column => (
                        <StageColumnView key={column.stage.id} column={column} oppFields={oppFields} />
                    ))}
                </div>
                <DragOverlay>
                    {activeOpp ? (
                        <div className="w-[259px] cursor-grabbing opacity-90 shadow-lg rounded">
                            <OpportunityCard opp={activeOpp} oppFields={oppFields} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
    closestCorners,
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import { CustomField, Opportunity, Stage } from "./types";
import { buildStageColumns, StageColumn } from "./pipeline-board";
import { failedMoveRules } from "./pipeline-rules";
import { opportunityCustomFields } from "./opportunity-form-utils";
import { OpportunityCard } from "./opportunity-card";

const MOVE_BLOCKED_TOAST_ID = "pipeline-move-blocked";
const HIGHLIGHT_MS = 10000;

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const COL_PREFIX = "col:";
const columnDropId = (stageId: number) => `${COL_PREFIX}${stageId}`;
const isColumnId = (id: string | number) => String(id).startsWith(COL_PREFIX);

/** The stage id that a draggable/droppable id belongs to, or null. */
const containerOf = (id: string | number, opps: Opportunity[]): number | null => {
    if (isColumnId(id)) return Number(String(id).slice(COL_PREFIX.length));
    const opp = opps.find(o => o.id === Number(id));
    return opp ? opp.stage.id : null;
};

const SortableCard: React.FC<{ opp: Opportunity; oppFields: CustomField[]; highlighted: boolean }> = ({
    opp,
    oppFields,
    highlighted,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(opp.id) });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="cursor-grab touch-none rounded"
            aria-label={`Drag ${opp.name || "opportunity"} to reorder or move stage`}
        >
            <OpportunityCard opp={opp} oppFields={oppFields} highlighted={highlighted} />
        </div>
    );
};

const StageColumnView: React.FC<{ column: StageColumn; oppFields: CustomField[]; highlightedId: number | null }> = ({
    column,
    oppFields,
    highlightedId,
}) => {
    const { stage } = column;
    const { setNodeRef, isOver } = useDroppable({ id: columnDropId(stage.id) });
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
            <SortableContext items={column.opportunities.map(o => String(o.id))} strategy={verticalListSortingStrategy}>
                {column.count === 0 ? (
                    <p className="text-sm text-gray-400">No opportunities</p>
                ) : (
                    column.opportunities.map(opp => (
                        <SortableCard key={opp.id} opp={opp} oppFields={oppFields} highlighted={opp.id === highlightedId} />
                    ))
                )}
            </SortableContext>
        </div>
    );
};

export const Pipeline: React.FC = () => {
    const [opps, setOpps] = useState<Opportunity[]>([]);
    const [stages, setStages] = useState<Stage[]>([]);
    const [oppFields, setOppFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [moveError, setMoveError] = useState("");
    const [activeId, setActiveId] = useState<number | null>(null);
    // The card whose move was rejected by a rule; gets a light-yellow highlight.
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    // Snapshot of the order before a drag starts, so a failed save can revert.
    const dragSnapshot = useRef<Opportunity[]>([]);
    // Single timer that clears the highlight AND dismisses the toast together at 10s.
    const flagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => flagTimer.current != null && clearTimeout(flagTimer.current), []);

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

    const stageById = (id: number) => stages.find(s => s.id === id)!;

    const handleDragStart = (event: DragStartEvent) => {
        dragSnapshot.current = opps;
        setActiveId(Number(event.active.id));
    };

    // Live preview: as the card hovers a different column, move it there in local state.
    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
        const activeContainer = containerOf(active.id, opps);
        const overContainer = containerOf(over.id, opps);
        if (activeContainer == null || overContainer == null || activeContainer === overContainer) return;

        setOpps(prev => {
            const activeIdx = prev.findIndex(o => o.id === Number(active.id));
            if (activeIdx === -1) return prev;
            const moved = { ...prev[activeIdx], stage: stageById(overContainer) };
            const without = prev.filter(o => o.id !== Number(active.id));
            const overIdx = isColumnId(over.id) ? without.length : without.findIndex(o => o.id === Number(over.id));
            const insertAt = overIdx === -1 ? without.length : overIdx;
            const next = [...without];
            next.splice(insertAt, 0, moved);
            return next;
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) {
            setOpps(dragSnapshot.current); // dropped outside any column → undo preview
            return;
        }
        const overContainer = containerOf(over.id, opps);
        if (overContainer == null) return;

        // Enforce the target column's entry rules on a cross-stage move. The
        // original stage comes from the pre-drag snapshot (drag-over already moved
        // the card optimistically). Failing rules block the move entirely.
        const movedId = Number(active.id);
        const original = dragSnapshot.current.find(o => o.id === movedId);
        if (original && original.stage.id !== overContainer) {
            const failures = failedMoveRules(original, stageById(overContainer), stages);
            if (failures.length > 0) {
                setOpps(dragSnapshot.current); // revert — the card stays put
                flagFailedMove(movedId, failures);
                return;
            }
        }

        let next = opps;
        if (!isColumnId(over.id)) {
            const activeIdx = opps.findIndex(o => o.id === Number(active.id));
            const overIdx = opps.findIndex(o => o.id === Number(over.id));
            if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) next = arrayMove(opps, activeIdx, overIdx);
        }
        setOpps(next);
        persistOrder(movedId, overContainer, next);
    };

    // Persist a single card's placement: send the ids of its new neighbors so the
    // server writes only this card's fractional position (option 1). Either
    // neighbor is omitted at the top/bottom of a column or when it lands alone.
    const persistOrder = async (movedId: number, stageId: number, list: Opportunity[]) => {
        const column = list.filter(o => o.stage.id === stageId);
        const idx = column.findIndex(o => o.id === movedId);
        const prevId = idx > 0 ? column[idx - 1].id : undefined;
        const nextId = idx >= 0 && idx < column.length - 1 ? column[idx + 1].id : undefined;
        const snapshot = dragSnapshot.current;
        setMoveError("");
        try {
            await axios.put(`/api/opportunities/${movedId}/move`, { stageId, prevId, nextId });
            // Reconcile expectedValue / column totals with the server's values.
            const fresh = await axios.get<Opportunity[]>("/api/opportunities");
            setOpps(fresh.data);
        } catch {
            setOpps(snapshot); // revert the optimistic reorder
            setMoveError("Could not save the new card order. Please try again.");
        }
    };

    // Highlight the rejected card and raise a toast listing the failed rules. A
    // single 10s timer clears both at once; a repeat move resets that timer.
    const flagFailedMove = (oppId: number, failures: string[]) => {
        if (flagTimer.current != null) clearTimeout(flagTimer.current);
        setHighlightedId(oppId);
        toast.custom(
            t => (
                <div
                    role="alert"
                    className={`max-w-sm bg-white border border-yellow-300 rounded shadow-lg p-3 ${t.visible ? "" : "opacity-0"}`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-800">Can’t move this opportunity yet:</p>
                        <button
                            onClick={() => {
                                if (flagTimer.current != null) clearTimeout(flagTimer.current);
                                setHighlightedId(null);
                                toast.dismiss(MOVE_BLOCKED_TOAST_ID);
                            }}
                            className="text-gray-400 hover:text-gray-600 text-sm leading-none"
                            aria-label="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                    <ul className="mt-1 list-disc list-inside text-sm text-gray-600">
                        {failures.map((f, i) => (
                            <li key={i}>{f}</li>
                        ))}
                    </ul>
                </div>
            ),
            { id: MOVE_BLOCKED_TOAST_ID, duration: Infinity },
        );
        flagTimer.current = setTimeout(() => {
            setHighlightedId(null);
            toast.dismiss(MOVE_BLOCKED_TOAST_ID);
        }, HIGHLIGHT_MS);
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

    const columns = buildStageColumns(opps, stages);
    const totalValue = columns.reduce((sum, c) => sum + c.totalValue, 0);
    const expectedValue = columns.reduce((sum, c) => sum + c.totalExpectedValue, 0);
    const activeOpp = activeId == null ? null : opps.find(o => o.id === activeId) ?? null;

    return (
        <div className="space-y-4">
            <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-bold">Pipeline Report</h2>
                <span className="text-sm text-gray-500">Drag cards to reorder or move them between stages</span>
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

            {opps.length === 0 && (
                <p className="text-gray-500">No opportunities in the pipeline yet. Add one to a stage to see it here.</p>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex overflow-x-auto pb-4 items-start">
                    {columns.map(column => (
                        <StageColumnView key={column.stage.id} column={column} oppFields={oppFields} highlightedId={highlightedId} />
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

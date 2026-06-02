import { useEffect, useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import { CustomField, Opportunity, Stage } from "./types";
import {
    opportunityCustomFields,
    buildInitialValues,
    buildPayload,
    validateOpportunity,
    hasErrors,
    OpportunityFormValues,
    OpportunityFieldErrors,
} from "./opportunity-form-utils";

// react-modal needs the app root for accessibility (aria-hidden the rest of the
// page). Guarded so it's a no-op in non-DOM environments.
if (typeof document !== "undefined" && document.getElementById("root")) {
    Modal.setAppElement("#root");
}

const inputClass = "block w-full p-2 border border-gray-300 rounded";

export const OpportunityForm: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    leadId: number;
    opportunity?: Opportunity | null;
}> = ({ isOpen, onClose, onSaved, leadId, opportunity }) => {
    const isEdit = !!opportunity;
    const [stages, setStages] = useState<Stage[]>([]);
    const [oppFields, setOppFields] = useState<CustomField[]>([]);
    const [values, setValues] = useState<OpportunityFormValues>({ stageId: "", value: "", name: "", customFieldValues: {} });
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<OpportunityFieldErrors>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setLoadError("");
            setError("");
            setFieldErrors({});
            try {
                const [stagesRes, fieldsRes] = await Promise.all([
                    axios.get<Stage[]>("/api/stages"),
                    axios.get<CustomField[]>("/api/custom-fields"),
                ]);
                if (cancelled) return;
                const fields = opportunityCustomFields(fieldsRes.data);
                setStages(stagesRes.data);
                setOppFields(fields);
                setValues(buildInitialValues(opportunity ?? null, fields, stagesRes.data));
            } catch {
                if (!cancelled) setLoadError("Could not load the form. Please try again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [isOpen, opportunity]);

    const setCustomField = (name: string, value: string) =>
        setValues(prev => ({ ...prev, customFieldValues: { ...prev.customFieldValues, [name]: value } }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationErrors = validateOpportunity(values);
        setFieldErrors(validationErrors);
        if (hasErrors(validationErrors)) return;
        setSaving(true);
        setError("");
        const payload = buildPayload(leadId, values);
        try {
            if (isEdit && opportunity) {
                await axios.put(`/api/opportunities/${opportunity.id}`, payload);
            } else {
                await axios.post("/api/opportunities", payload);
            }
            onSaved();
            onClose();
        } catch (err) {
            // Show the server's validation message when present; otherwise a
            // generic fallback so a network error never leaves the user stuck.
            const data = axios.isAxiosError(err) ? err.response?.data : undefined;
            const message = typeof data === "string" ? data : data?.error;
            setError(message || "Something went wrong saving this opportunity.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel={isEdit ? "Edit opportunity" : "Add opportunity"}
            className="bg-white p-6 rounded shadow-lg w-96 max-w-[90vw] mx-auto mt-24 outline-none"
            overlayClassName="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50"
        >
            <h2 className="text-xl font-bold mb-4">{isEdit ? "Edit Opportunity" : "Add Opportunity"}</h2>

            {loading ? (
                <p className="text-gray-500">Loading…</p>
            ) : loadError ? (
                <p className="text-red-500">{loadError}</p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-500">{error}</p>}

                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                            type="text"
                            placeholder="Deal name"
                            value={values.name}
                            onChange={e => setValues(prev => ({ ...prev, name: e.target.value }))}
                            className={inputClass}
                        />
                        {fieldErrors.name && <p className="text-red-500 text-sm mt-1">{fieldErrors.name}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Stage</label>
                        <select
                            value={values.stageId}
                            onChange={e => setValues(prev => ({ ...prev, stageId: Number(e.target.value) }))}
                            className={inputClass}
                        >
                            {stages.map(stage => (
                                <option key={stage.id} value={stage.id}>
                                    {stage.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Value</label>
                        <input
                            type="number"
                            min="1"
                            placeholder="Value"
                            value={values.value}
                            onChange={e => setValues(prev => ({ ...prev, value: e.target.value }))}
                            className={inputClass}
                        />
                        {fieldErrors.value && <p className="text-red-500 text-sm mt-1">{fieldErrors.value}</p>}
                    </div>

                    {oppFields.map(field => (
                        <div key={field.id}>
                            <label className="block text-sm font-medium mb-1">{field.label}</label>
                            <input
                                type={field.type === "number" ? "number" : "text"}
                                placeholder={field.label}
                                value={values.customFieldValues[field.name] ?? ""}
                                onChange={e => setCustomField(field.name, e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    ))}

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                        >
                            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Opportunity"}
                        </button>
                        <button type="button" onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

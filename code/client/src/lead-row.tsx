import { useState, useEffect } from "react";
import { Lead, CustomField, Opportunity } from "./types";
import axios from "axios";
import { OpportunityForm } from "./opportunity-form";

export const LeadRow: React.FC<{ lead: Lead; onUpdate: () => void }> = ({ lead, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showOpps, setShowOpps] = useState(false);
    const [firstName, setFirstName] = useState(lead.firstName);
    const [lastName, setLastName] = useState(lead.lastName);
    const [age, setAge] = useState(`${lead.age}`);
    const [phoneNumber, setPhoneNumber] = useState(lead.phoneNumber);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(lead.customFields || {});
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [oppModalOpen, setOppModalOpen] = useState(false);
    const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);

    useEffect(() => {
        if (isEditing) {
            fetchCustomFields();
        }
    }, [isEditing]);

    useEffect(() => {
        if (showOpps) {
            fetchOpportunities();
        }
    }, [showOpps]);

    const fetchCustomFields = async () => {
        const result = await axios.get("/api/custom-fields");
        setCustomFields(result.data);
    };

    const fetchOpportunities = async () => {
        const result = await axios.get("/api/opportunities");
        setOpportunities(result.data.filter((opp: Opportunity) => opp.lead.id === lead.id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await axios.put(`/api/leads/${lead.id}`, {
                firstName,
                lastName,
                age,
                phoneNumber,
                customFields: customFieldValues,
            });
            setSuccess(true);
            setIsEditing(false);
            onUpdate();
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setError((error as any).response.data);
        }
        setLoading(false);
    };

    const deleteOpportunity = async (oppId: number) => {
        await axios.delete(`/api/opportunities/${oppId}`);
        fetchOpportunities();
    };

    const openAddOpp = () => {
        setEditingOpp(null);
        setOppModalOpen(true);
    };

    const openEditOpp = (opp: Opportunity) => {
        setEditingOpp(opp);
        setOppModalOpen(true);
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

    if (isEditing) {
        return (
            <tr>
                <td colSpan={6}>
                    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded bg-gray-100 w-96">
                        <h2 className="text-xl font-bold">Edit</h2>
                        {error && <p className="text-red-500">{error}</p>}
                        {success && <p className="text-green-500">Lead updated successfully</p>}
                        <input
                            type="text"
                            placeholder="First Name"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded"
                        />
                        <input
                            type="text"
                            placeholder="Last Name"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded"
                        />
                        <input
                            type="text"
                            placeholder="Age"
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded"
                        />
                        <input
                            type="text"
                            placeholder="Phone Number"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded"
                        />
                        {customFields.map(field => (
                            <input
                                key={field.id}
                                type="text"
                                placeholder={field.label}
                                value={customFieldValues[field.name] || ""}
                                onChange={e =>
                                    setCustomFieldValues({
                                        ...customFieldValues,
                                        [field.name]: e.target.value,
                                    })
                                }
                                className="block w-full p-2 border border-gray-300 rounded"
                            />
                        ))}
                        <button type="submit" disabled={loading} className="block w-full p-2 bg-blue-500 text-white rounded">
                            Update Lead
                        </button>
                    </form>
                </td>
            </tr>
        );
    }

    return (
        <>
            <tr key={lead.id}>
                <td>
                    <button onClick={() => setIsEditing(true)} className="mr-2">
                        Edit
                    </button>
                    <button onClick={() => setShowOpps(!showOpps)}>{showOpps ? "Hide" : "Show"} Opps</button>
                </td>
                <td>{firstName}</td>
                <td>{lastName}</td>
                <td>{age}</td>
                <td>{phoneNumber}</td>
            </tr>
            {showOpps && (
                <tr>
                    <td colSpan={5} className="p-4 bg-gray-50">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold">Opportunities</h3>
                                <button
                                    onClick={openAddOpp}
                                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                                >
                                    Add
                                </button>
                            </div>
                            {opportunities.length === 0 ? (
                                <p className="text-gray-500">No opportunities</p>
                            ) : (
                                <div className="space-y-2">
                                    {opportunities.map(opp => (
                                        <div key={opp.id} className="flex justify-between items-center p-2 bg-white border rounded">
                                            <div>
                                                <span className="font-medium">{opp.name || "Unnamed"}</span>
                                                <span className="text-sm text-gray-600 ml-2">{opp.stage.name}</span>
                                                <span className="text-sm text-gray-600 ml-2">{formatCurrency(opp.value)}</span>
                                                <span className="text-sm text-gray-500 ml-2">
                                                    Expected: {formatCurrency(opp.value * opp.stage.conversionLikelihood)}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEditOpp(opp)}
                                                    className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteOpportunity(opp.id)}
                                                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <OpportunityForm
                            isOpen={oppModalOpen}
                            onClose={() => setOppModalOpen(false)}
                            onSaved={fetchOpportunities}
                            leadId={lead.id}
                            opportunity={editingOpp}
                        />
                    </td>
                </tr>
            )}
        </>
    );
};

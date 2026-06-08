import axios from "axios";
import { useEffect, useState } from "react";
import { CustomField, Opportunity } from "./types";
import { buildForecast, regroupColumns, ForecastColumn } from "./forecast";
import { opportunityCustomFields } from "./opportunity-form-utils";
import { OpportunityCard } from "./opportunity-card";

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const ForecastColumnView: React.FC<{ column: ForecastColumn; oppFields: CustomField[] }> = ({ column, oppFields }) => (
    <div className="w-[275px] shrink-0 mx-2 p-2 bg-gray-100 rounded self-start max-h-[calc(100vh-12rem)] overflow-y-auto">
        <div className="flex justify-between items-baseline">
            <h3 className="font-bold">{column.title}</h3>
            <span className="pl-2 text-sm text-gray-600">{column.count}</span>
        </div>
        <p className="text-sm text-gray-600 mb-2">Total Expected Value: {formatCurrency(column.totalExpectedValue)}</p>
        {column.count === 0 ? (
            <p className="text-sm text-gray-400">No opportunities</p>
        ) : (
            column.groups.map((group, gi) =>
                group.opportunities.length === 0 ? null : (
                    <div key={gi}>
                        {group.heading && (
                            <p className="text-xs font-semibold text-gray-500 mt-2 mb-1">{group.heading}</p>
                        )}
                        {group.opportunities.map(opp => (
                            <OpportunityCard key={opp.id} opp={opp} oppFields={oppFields} />
                        ))}
                    </div>
                ),
            )
        )}
    </div>
);

export const Forecast: React.FC = () => {
    const [opps, setOpps] = useState<Opportunity[] | null>(null);
    const [oppFields, setOppFields] = useState<CustomField[]>([]);
    const [groupByName, setGroupByName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchOpen();
    }, []);

    const fetchOpen = async () => {
        setLoading(true);
        setError("");
        try {
            const [openRes, fieldsRes] = await Promise.all([
                axios.get<Opportunity[]>("/api/opportunities/open"),
                axios.get<CustomField[]>("/api/custom-fields"),
            ]);
            setOpps(openRes.data);
            setOppFields(opportunityCustomFields(fieldsRes.data));
        } catch {
            setError("Could not load the forecast. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p className="text-gray-500">Loading forecast…</p>;
    if (error)
        return (
            <div className="space-y-2">
                <p className="text-red-500">{error}</p>
                <button onClick={fetchOpen} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        );

    const groupByField = oppFields.find(f => f.name === groupByName) ?? null;
    const columns = regroupColumns(buildForecast(opps ?? [], new Date()), groupByField);
    const totalOpen = opps?.length ?? 0;

    return (
        <div className="space-y-4">
            <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-bold">Monthly Forecast</h2>
                <span className="text-sm text-gray-500">
                    {totalOpen} open {totalOpen === 1 ? "opportunity" : "opportunities"}
                </span>
            </div>
            {oppFields.length > 0 && (
                <div className="flex items-center gap-2">
                    <label htmlFor="forecast-group-by" className="text-sm font-medium">
                        Group by
                    </label>
                    <select
                        id="forecast-group-by"
                        value={groupByName}
                        onChange={e => setGroupByName(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                    >
                        <option value="">No grouping</option>
                        {oppFields.map(field => (
                            <option key={field.id} value={field.name}>
                                {field.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {totalOpen === 0 && (
                <p className="text-gray-500">No open opportunities to forecast yet. Add one with a close date to see it here.</p>
            )}
            <div className="flex overflow-x-auto pb-4 items-start">
                {columns.map(column => (
                    <ForecastColumnView key={column.key} column={column} oppFields={oppFields} />
                ))}
            </div>
        </div>
    );
};

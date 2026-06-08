import { useState } from "react";
import { CustomField, Opportunity } from "./types";
import { normalizeDateString, displayedCustomFields } from "./opportunity-form-utils";

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export const OpportunityCard: React.FC<{ opp: Opportunity; oppFields: CustomField[] }> = ({ opp, oppFields }) => {
    const [showMore, setShowMore] = useState(false);
    const extra = displayedCustomFields(opp, oppFields);
    return (
        <div className="bg-white border rounded p-2 mb-2">
            {opp.name && <p className="font-medium text-sm">{opp.name}</p>}
            <p className="text-xs text-gray-600">Stage: {opp.stage.name}</p>
            <p className="text-xs text-gray-600">Close: {normalizeDateString(opp.expectedCloseDate) || "—"}</p>
            <p className="text-xs text-gray-600">Expected: {formatCurrency(opp.expectedValue ?? 0)}</p>
            {extra.length > 0 && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowMore(v => !v)}
                        className="text-xs text-blue-500 hover:text-blue-600 mt-1"
                        aria-expanded={showMore}
                    >
                        <span className="inline-block mr-1">{showMore ? "▾" : "▸"}</span>
                        {showMore ? "Less" : "More"}
                    </button>
                    {showMore && (
                        <div className="mt-1 space-y-0.5">
                            {extra.map(field => (
                                <p key={field.name} className="text-xs text-gray-500">
                                    {field.label}: {field.value}
                                </p>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

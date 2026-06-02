import axios from "axios";
import { useEffect, useState } from "react";
import { Lead } from "./types";
import { LeadRow } from "./lead-row";

export const Leads: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger = 0 }) => {
    const [leads, setLeads] = useState<Lead[]>([]);

    useEffect(() => {
        fetchLeads();
    }, [refreshTrigger]);

    const fetchLeads = async () => {
        const result = await axios.get("/api/leads");
        setLeads(result.data);
    };

    return (
        <div className="w-full">
            <h2 className="text-xl font-bold mb-2">Leads</h2>
            <table className="table-auto w-full border-collapse border border-gray-200">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-200 p-2 text-left">Actions</th>
                        <th className="border border-gray-200 p-2 text-left">First Name</th>
                        <th className="border border-gray-200 p-2 text-left">Last Name</th>
                        <th className="border border-gray-200 p-2 text-left">Age</th>
                        <th className="border border-gray-200 p-2 text-left">Phone Number</th>
                    </tr>
                </thead>
                <tbody>
                    {leads.map(lead => (
                        <LeadRow lead={lead} key={lead.id} onUpdate={fetchLeads} />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

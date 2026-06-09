import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { AddLead } from "./add-lead";
import { Leads } from "./leads";
import { Pipeline } from "./pipeline";
import { Forecast } from "./forecast-page";
import { ManageFields } from "./manage-fields";
import { ManageStages } from "./manage-stages";
import { ManageSettings } from "./manage-settings";

type Page = "home" | "forecast" | "pipeline" | "settings";

export const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>("home");
    const [fieldsRefresh, setFieldsRefresh] = useState(0);

    const handleFieldsChanged = () => {
        setFieldsRefresh(prev => prev + 1);
    };

    const navClass = "px-4 py-2 rounded font-medium transition";
    const activeNavClass = "bg-blue-500 text-white";
    const inactiveNavClass = "bg-gray-200 text-gray-700 hover:bg-gray-300";

    return (
        <div className="p-4 space-y-8">
            <Toaster position="top-right" />
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold">SimpleCRM</h1>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentPage("home")} className={`${navClass} ${currentPage === "home" ? activeNavClass : inactiveNavClass}`}>
                        Home
                    </button>
                    <button onClick={() => setCurrentPage("forecast")} className={`${navClass} ${currentPage === "forecast" ? activeNavClass : inactiveNavClass}`}>
                        Forecast
                    </button>
                    <button onClick={() => setCurrentPage("pipeline")} className={`${navClass} ${currentPage === "pipeline" ? activeNavClass : inactiveNavClass}`}>
                        Pipeline
                    </button>
                    <button onClick={() => setCurrentPage("settings")} className={`${navClass} ${currentPage === "settings" ? activeNavClass : inactiveNavClass}`}>
                        Settings
                    </button>
                </div>
            </div>

            {currentPage === "home" && (
                <>
                    <Leads refreshTrigger={fieldsRefresh} />
                    <AddLead triggerRefresh={fieldsRefresh} />
                </>
            )}

            {currentPage === "forecast" && <Forecast />}

            {currentPage === "pipeline" && <Pipeline />}

            {currentPage === "settings" && (
                <>
                    <ManageFields onFieldsChanged={handleFieldsChanged} />
                    <ManageStages />
                    <ManageSettings />
                </>
            )}
        </div>
    );
};

export default App;

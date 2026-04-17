import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ReconcileForm = () => {
    const [bankFile, setBankFile] = useState(null);
    const [ledgerFile, setLedgerFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!bankFile || !ledgerFile) {
            alert("Please upload both files");
            return;
        }

        const formData = new FormData();
        formData.append("bankFile", bankFile);
        formData.append("ledgerFile", ledgerFile);

        try {
            setLoading(true);

            const response = await axios.post(
                `${API_URL}/api/reconcile`,
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    responseType: "blob",
                }
            );

            const url = window.URL.createObjectURL(
                new Blob([response.data])
            );

            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "reconciliation.xlsx");
            document.body.appendChild(link);
            link.click();

            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("FULL ERROR:", error);
            console.error("RESPONSE:", error.response);
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sony-container">
            <h2 className="sony-title">Bank Reconciliation System</h2>

            <form onSubmit={handleSubmit} className="sony-form">
                <div className="sony-input-group">
                    <label className="sony-label">Upload Bank Statement (PDF)</label>
                    <input
                        type="file"
                        accept=".pdf,.xlsx,.xlsm,.xls"
                        className="sony-file-input"
                        onChange={(e) => setBankFile(e.target.files[0])}
                    />
                </div>

                <div className="sony-input-group">
                    <label className="sony-label">Upload Company Ledger (PDF or Excel)</label>
                    <input
                        type="file"
                        accept=".pdf,.xlsx,.xlsm,.xls"
                        className="sony-file-input"
                        onChange={(e) => setLedgerFile(e.target.files[0])}
                    />
                </div>

                <button type="submit" disabled={loading} className="sony-button">
                    {loading ? "Processing..." : "Reconcile & Download Excel"}
                </button>
            </form>
        </div>
    );
};

export default ReconcileForm;

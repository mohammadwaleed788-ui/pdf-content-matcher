import { useState } from "react";
import axios from "axios";

const ReconcileForm = () => {
    const [bankFile, setBankFile] = useState(null);
    const [ledgerFile, setLedgerFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!bankFile || !ledgerFile) {
            alert("Please upload both PDFs");
            return;
        }

        const formData = new FormData();
        formData.append("bankPdf", bankFile);
        formData.append("ledgerPdf", ledgerFile);

        try {
            setLoading(true);

            const response = await axios.post(
                "http://localhost:5000/api/reconcile",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    responseType: "blob",
                }
            );


            // Create download link
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
        <div style={styles.container}>
            <h2>Bank Reconciliation System</h2>

            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label>Upload Bank Statement (PDF)</label>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setBankFile(e.target.files[0])}
                    />
                </div>

                <div style={styles.inputGroup}>
                    <label>Upload Ledger Statement (PDF)</label>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setLedgerFile(e.target.files[0])}
                    />
                </div>

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? "Processing..." : "Reconcile & Download Excel"}
                </button>
            </form>
        </div>
    );
};

const styles = {
    container: {
        maxWidth: "500px",
        margin: "80px auto",
        padding: "30px",
        borderRadius: "10px",
        boxShadow: "0 0 15px rgba(0,0,0,0.1)",
        textAlign: "center",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
    },
    button: {
        padding: "12px",
        border: "none",
        borderRadius: "6px",
        backgroundColor: "#007bff",
        color: "white",
        fontWeight: "bold",
        cursor: "pointer",
    },
};

export default ReconcileForm;

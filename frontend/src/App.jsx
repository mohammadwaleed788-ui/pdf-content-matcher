import { useEffect, useState } from "react";
import axios from "axios";
import ReconcileForm from "./components/ReconcileForm";
import LoginForm from "./components/LoginForm";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const AUTH_STORAGE_KEY = "pdf_app_authenticated";
const APPROVAL_DATE_STORAGE_KEY = "pdf_app_approval_date";

const isSubscriptionValid = (approvalDateString) => {
  if (!approvalDateString) return false;

  const approvalDate = new Date(approvalDateString);
  if (Number.isNaN(approvalDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  approvalDate.setHours(0, 0, 0, 0);

  return today < approvalDate;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY) === "true";
      const savedApprovalDate = localStorage.getItem(APPROVAL_DATE_STORAGE_KEY);

      if (!savedAuth || !isSubscriptionValid(savedApprovalDate)) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(APPROVAL_DATE_STORAGE_KEY);
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/auth/subscription-status`);
        const isActive = response.data?.isActive === true;
        const approvalDate = response.data?.approvalDate;

        if (!isActive || !isSubscriptionValid(approvalDate)) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          localStorage.removeItem(APPROVAL_DATE_STORAGE_KEY);
          setIsAuthenticated(false);
          return;
        }

        localStorage.setItem(APPROVAL_DATE_STORAGE_KEY, approvalDate);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(APPROVAL_DATE_STORAGE_KEY);
        setIsAuthenticated(false);
      }
    };

    initAuth();
  }, []);

  const handleLoginSuccess = (approvalDate) => {
    if (!isSubscriptionValid(approvalDate)) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(APPROVAL_DATE_STORAGE_KEY);
      setIsAuthenticated(false);
      return;
    }

    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    localStorage.setItem(APPROVAL_DATE_STORAGE_KEY, approvalDate);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(APPROVAL_DATE_STORAGE_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <div className="app-actions">
        <button type="button" className="sony-button app-logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <ReconcileForm />
    </div>
  );
}

export default App;
import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const LoginForm = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      onLoginSuccess(response.data?.approvalDate);
    } catch (error) {
      const message = error.response?.data?.message || "Login failed";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sony-container">
      <h2 className="sony-title">Login</h2>

      <form onSubmit={handleSubmit} className="sony-form">
        <div className="sony-input-group">
          <label className="sony-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sony-text-input"
            required
          />
        </div>

        <div className="sony-input-group">
          <label className="sony-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sony-text-input"
            required
          />
        </div>

        {errorMessage && <p className="sony-error">{errorMessage}</p>}

        <button type="submit" disabled={loading} className="sony-button">
          {loading ? "Checking..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
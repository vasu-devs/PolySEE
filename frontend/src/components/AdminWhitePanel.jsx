import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminWhitePanel = () => {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNo: registrationNumber, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      // save token locally
      localStorage.setItem("token", data.token);

      // redirect if admin
      if (data.role === "admin") {
        navigate("/dashboard");
      } else {
        alert("You are not an admin!");
      }
    } catch (err) {
      console.error(err);
      alert("Invalid credentials");
    }
  };

  return (
    <div className="absolute inset-0 p-8 flex flex-col justify-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h2>
      <p className="text-gray-600 mb-6 text-sm">Enter your UID to sign in.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* UID input */}
        <div>
          <label className="block text-gray-900 font-medium mb-1 text-sm">
            UID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="e.g. 1230xxyyz"
            className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            required
          />
        </div>

        {/* Password input */}
        <div>
          <label className="block text-gray-900 font-medium mb-1 text-sm">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            required
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-sm cursor-pointer"
        >
          Sign in
        </button>
      </form>
    </div>
  );
};

export default AdminWhitePanel;

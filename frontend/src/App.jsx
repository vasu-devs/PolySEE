import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import { LandingPage } from "./components/LandingPage";
import ChatInterface from "./components/ChatInterface";

export const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-white text-black">
        {/* <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardLayout />} />
        </Routes> */}
        <ChatInterface/>
        {/* <DashboardLayout /> */}
      </div>
    </Router>
  );
};

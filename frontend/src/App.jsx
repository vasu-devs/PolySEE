import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import { LandingPage } from "./components/LandingPage";
import Signup from "./components/Signup";
import UserchatPage from "./components/UserchatPage";
import Analytics  from "./components/Analytics";
export const App = () => {
  return (
    // dark:bg-zinc-900 dark:text-white for dark mode
    <div className="min-h-screen bg-white text-black ">
      {/* <LandingPage /> */}
      {/* <DashboardLayout /> */}
      {/* <UserchatPage /> */}
      <Analytics />
    </div>
  );
};

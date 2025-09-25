import DashboardLayout from "./components/DashboardLayout";
import { LandingPage } from "./components/LandingPage";

export const App = () => {
  return (
    // dark:bg-zinc-900 dark:text-white for dark mode 
    <div className="min-h-screen bg-white text-black ">
      {/* <LandingPage /> */}
      <DashboardLayout />
    </div>
  );
};
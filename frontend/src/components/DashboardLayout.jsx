//This is the main layout component with sidebar and main content are for admin dashboard upload and stats
import { useState } from "react";
import {
  Menu,
  ChevronLeft,
  BarChart3,
  MessageSquare,
  FileText,
  User,
  Upload,
  Download,
  Settings,
} from "lucide-react";
import Dashboard from "./Dashboard";

export default function DashboardLayout() {
  const [isExpanded, setIsExpanded] = useState(true);

  const sidebarItems = [
    { name: "Analytics", icon: BarChart3 },
    { name: "Test Chatbot", icon: MessageSquare },
    { name: "Policies", icon: FileText },
  ];

  const recentActivities = [
    { name: "Sample_doc.pdf uploaded", time: "2 mins ago" },
    { name: "Sample_doc.pdf verified", time: "2 mins ago" },
    { name: "Sample_doc.pdf uploaded", time: "2 mins ago" },
    { name: "Sample_doc.pdf", time: "2 mins ago" },
    { name: "Sample_doc.pdf", time: "2 mins ago" },
    { name: "Sample_doc.pdf", time: "2 mins ago" },
  ];

  return (
    <div className="relative  bg-gray-100">
      {/* Backdrop overlay when sidebar is expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-black text-white flex flex-col z-50 transition-all duration-300 ease-in-out
          ${
            isExpanded
              ? "w-64 translate-x-0"
              : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
          }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4">
          {/* App Title */}
          <span
            className={`font-bold text-lg transition-all duration-300
               ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}
          >
            MyApp
          </span>

          {/* Toggle Button - only show on larger screens and when expanded */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`pr-5 pt-2 pb-2 pl-2 cursor-pointer rounded-md hover:bg-gray-800 transition-all duration-300 ${
              isExpanded
                ? "opacity-100"
                : "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
            }`}
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Sidebar Content */}
        <nav className="mt-4 flex flex-col gap-2 flex-1">
          {sidebarItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.name}
                className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 rounded-md cursor-pointer mx-2"
              >
                <IconComponent
                  size={22}
                  className="text-white shrink-0" // icon stays same size
                />
                <span
                  className={`transition-all duration-300 ${
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  {item.name}
                </span>
              </div>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4">
          <div className="flex items-center gap-3 px-2 py-2 text-gray-300 rounded-md cursor-pointer">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center shrink-0">
              <User size={18} className="text-white shrink-0" />
            </div>
            <div
              className={`transition-all duration-300 ${
                isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              <div className="text-sm font-medium text-white">User Profile</div>
              <div className="text-xs text-gray-400">Admin</div>
            </div>
            <Settings
              size={18}
              className={`ml-auto text-gray-400 shrink-0 transition-all duration-300 ${
                isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Toggle Button - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed top-4 left-4 z-50 p-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors duration-200 lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Main Section */}
      <main
        className={`w-full p-6 overflow-y-auto transition-all duration-300 ${
          isExpanded ? "lg:pl-72" : "lg:pl-24"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            <Download size={16} />
            Export Data
          </button>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Upload Section */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="bg-gray-200 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Drop your PDF files here or browse
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Max file size up to 50MB
                </p>
                <button className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800">
                  Upload PDF
                </button>
              </div>
            </div>

            {/* Guidelines */}
            <div className="bg-gray-100 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Guidelines & Best Practices
              </h3>

              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  File Requirements
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Text-based documents work best</li>
                  <li>• Avoid password-protected files</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Processing Info
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>
                    • Documents are automatically chunked for optimal retrieval
                  </li>
                  <li>• Processing time varies by document size</li>
                  <li>• Files are immediately available after processing</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Side - Stats and Activity */}
          <Dashboard />
        </div>
      </main>
    </div>
  );
}

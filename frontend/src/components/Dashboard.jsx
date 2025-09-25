// This is just the subcomponent for the right side of the DashboardLayout
const Dashboard = () => {
  const recentActivities = [
    { name: "Sample_doc.pdf uploaded", time: "2 mins ago" },
    { name: "Sample_doc.pdf verified", time: "2 mins ago" },
    { name: "Sample_doc.pdf uploaded", time: "2 mins ago" },
    { name: "Sample_doc.pdf", time: "2 mins ago" },
    { name: "Sample_doc.pdf", time: "2 mins ago" },
    { name: "Sample_doc.pdf", time: "2 mins ago" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 pl-10 pr-5">
      <div className="max-w-6xl mx-auto">
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <div className="text-5xl font-bold text-black mb-3">20</div>
            <div className="text-gray-700 font-medium">Documents</div>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm">
            <div className="text-5xl font-bold text-black mb-3">4</div>
            <div className="text-gray-700 font-medium">
              Pending Verification
            </div>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm">
            <div className="text-5xl font-bold text-black mb-3">0</div>
            <div className="text-gray-700 font-medium">Escalations</div>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm">
            <div className="text-5xl font-bold text-black mb-3">5</div>
            <div className="text-gray-700 font-medium">Languages</div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-800 font-medium">
                    {activity.name}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

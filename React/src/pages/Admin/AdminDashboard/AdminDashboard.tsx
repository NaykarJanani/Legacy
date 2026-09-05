import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";

interface DashboardStats {
  totalUsers: number;
  totalEditors: number;
  totalSessions: number;
  totalQuestions: number;
  publishedBooks: number;
  pendingApprovals: number;
}

const Dashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalEditors: 0,
    totalSessions: 0,
    totalQuestions: 0,
    publishedBooks: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get("/dashboard-stats");

console.log(res.data);

setStats({
  totalUsers: res.data.data.totalUsers || 0,
  totalEditors: res.data.data.totalAdmins || 0,
  totalSessions: res.data.data.totalSessions || 0,
  totalQuestions: res.data.data.totalQuestions || 0,
  publishedBooks: res.data.data.publishedBooks || 0,
  pendingApprovals: res.data.data.pendingApprovals || 0,
});
    } catch (error) {
      console.error(error);
    }
  };

  const dashboardSections = [
    {
      title: "MSME",
      description: "Manage MSME users and content",
      route: "/Admin/CRM?category=msme",
    },
    {
      title: "School",
      description: "Manage School users and activities",
      route: "/Admin/CRM?category=school",
    },
    {
      title: "Temple",
      description: "Manage Temple legacy profiles",
      route: "/Admin/CRM?category=temple",
    },
    {
      title: "Village",
      description: "Manage Village documentation",
      route: "/Admin/CRM?category=village",
    },
  ];

  return (
    <div className="container-fluid p-4 dashboard-page">

      <div className="mb-4">
        <h1 className="fw-bold">Admin Dashboard</h1>
        <p>Platform overview and management</p>
      </div>

      {/* KPI Cards */}

      <div className="row g-3 mb-5">

        <div className="col-md-3">
          <div className="dashboard-stat-card">
            <h6>Total Users</h6>
            <h2>{stats.totalUsers}</h2>
          </div>
        </div>

        <div className="col-md-3">
          <div className="dashboard-stat-card">
            <h6>Total Editors</h6>
            <h2>{stats.totalEditors}</h2>
          </div>
        </div>

        <div className="col-md-3">
          <div className="dashboard-stat-card">
            <h6>Total Sessions</h6>
            <h2>{stats.totalSessions}</h2>
          </div>
        </div>

        <div className="col-md-3">
          <div className="dashboard-stat-card">
            <h6>Total Questions</h6>
            <h2>{stats.totalQuestions}</h2>
          </div>
        </div>

        <div className="col-md-3">
          <div className="dashboard-stat-card">
            <h6>Published Books</h6>
            <h2>{stats.publishedBooks}</h2>
          </div>
        </div>

        <div className="col-md-3">
          <div className="dashboard-stat-card">
            <h6>Pending Approvals</h6>
            <h2>{stats.pendingApprovals}</h2>
          </div>
        </div>

      </div>

      {/* Category Modules */}

      <h3 className="mb-3">Category Management</h3>

      <div className="row g-4">

        {dashboardSections.map((item, index) => (
          <div className="col-md-6 col-lg-3" key={index}>

            <div
              className="dashboard-module-card"
              onClick={() => navigate(item.route)}
            >
              <h4>{item.title}</h4>

              <p>{item.description}</p>

              <button className="btn btn-primary">
                Open
              </button>

            </div>

          </div>
        ))}

      </div>
    </div>
  );
};

export default Dashboard;
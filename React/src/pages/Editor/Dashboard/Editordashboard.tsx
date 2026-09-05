import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./Editordashboard.css";
import {
  BookOpen,
  BarChart3,
} from "lucide-react";
import api from "../../../services/api";
import { useLoader } from "../../../context/LoaderContext";
import { formatAge } from "../../../utils/publishRequestUrgency";

// ── Types ────────────────────────────────────────────────────────────────────

interface AssignedCustomer {
  user_id: number;
  name: string;
  avatar_url?: string | null;
  assigned_at?: string;
  created_at?: string;
  project_status: string;
  progress_percent: number;
  pending_notifications?: number;
}

// Stage order + bar color, shared by the stat cards and the pipeline graph
const STAGES: { key: string; label: string; color: string }[] = [
  { key: "Research", label: "Research", color: "#e7e5e4" },
  { key: "Drafting", label: "Drafting", color: "#f59e0b" },
  { key: "In Review", label: "In Review", color: "#d6d3d1" },
  { key: "Approved", label: "Approved", color: "#7e22ce" },
  { key: "Ready To Publish", label: "Ready", color: "#0f766e" },
  { key: "Published", label: "Published", color: "#16a34a" },
];

const RECENT_ACTIVITY_LIMIT = 5;

const Editordashboard = () => {
  const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();

  const [customers, setCustomers] = useState<AssignedCustomer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        showLoader();
        const res = await api.get("/customers");
        if (res.data.success) {
          setCustomers(res.data.data || []);
        } else {
          toast.error(res?.data?.message || "Failed to fetch dashboard data");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Something went wrong");
      } finally {
        setLoaded(true);
        hideLoader();
      }
    };

    fetchCustomers();
  }, []);

  // ── Top stat cards ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const inProgress = customers.filter(
      (c) => c.project_status === "Research" || c.project_status === "Drafting"
    ).length;
    const underReview = customers.filter((c) => c.project_status === "In Review").length;
    const readyToPublish = customers.filter(
      (c) => c.project_status === "Ready To Publish"
    ).length;

    return [
      { number: String(customers.length), label: "Active Legacies", color: "#c96a12" },
      { number: String(inProgress), label: "In Progress", color: "#d97706" },
      { number: String(underReview), label: "Under Review", color: "#7e22ce" },
      { number: String(readyToPublish), label: "Ready to Publish", color: "#0f766e" },
    ];
  }, [customers]);

  // ── Recent activity — most recently assigned/updated projects first ────────
  const activities = useMemo(() => {
    return [...customers]
      .sort(
        (a, b) =>
          new Date(b.assigned_at || b.created_at || 0).getTime() -
          new Date(a.assigned_at || a.created_at || 0).getTime()
      )
      .slice(0, RECENT_ACTIVITY_LIMIT);
  }, [customers]);

  // ── Pipeline graph — count of projects per stage ────────────────────────────
  const graphData = useMemo(() => {
    return STAGES.map((stage) => ({
      label: stage.label,
      color: stage.color,
      value: customers.filter((c) => c.project_status === stage.key).length,
    }));
  }, [customers]);

  const maxGraphValue = Math.max(1, ...graphData.map((g) => g.value));

  return (
    <div className="editordashboard-container">
      {/* HEADER */}
      <div className="editordashboard-header">
        <h1>Editor Dashboard</h1>
        <p>Overview of all your active biography projects.</p>
      </div>

      {/* TOP STATS */}
      <div className="editordashboard-stats-grid">
        {stats.map((item, index) => (
          <div className="editordashboard-stat-card" key={index}>
            <h2 style={{ color: item.color }}>{item.number}</h2>
            <p>{item.label}</p>
          </div>
        ))}
      </div>

      {/* CONTENT GRID */}
      <div className="editordashboard-content-grid">
        {/* RECENT ACTIVITY */}
        <div className="editordashboard-activity-card">
          <div className="editordashboard-card-header">
            <h3>
              <BookOpen size={16} />
              Recent Activity
            </h3>
          </div>

          <div className="editordashboard-activity-list">
            {loaded && activities.length === 0 && (
              <p style={{ padding: "12px 4px", color: "var(--editordashboard-text)" }}>
                No projects assigned yet.
              </p>
            )}

            {activities.map((item) => (
              <div
                className="editordashboard-activity-item"
                key={item.user_id}
                style={{ cursor: "pointer" }}
                onClick={() =>
                  navigate("/editor/Editorcardinnerpage", {
                    state: {
                      project: {
                        id: item.user_id,
                        author: item.name,
                        title: `A journey through time: ${item.name}`,
                        status: item.project_status,
                        created: item.assigned_at || item.created_at,
                      },
                    },
                  })
                }
              >
                <div className="editordashboard-activity-left">
                  <div className="editordashboard-circle">
                    <BookOpen size={14} />
                  </div>

                  <div>
                    <div className="editordashboard-title-row">
                      <h4>A Journey Through Time: {item.name}</h4>

                      <span>{item.project_status}</span>
                    </div>

                    <p>Project created</p>

                    <div className="editordashboard-progress-row">
                      <div className="editordashboard-progress-bar">
                        <div
                          className="editordashboard-progress-fill"
                          style={{ width: `${item.progress_percent}%` }}
                        />
                      </div>

                      <small>{item.progress_percent}%</small>
                      <small>
                        {item.assigned_at || item.created_at
                          ? formatAge(item.assigned_at || item.created_at!)
                          : "-"}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRAPH */}
        <div className="editordashboard-graph-card">
          <div className="editordashboard-card-header">
            <h3>
              <BarChart3 size={16} />
              Pipeline
            </h3>
          </div>

          <div className="editordashboard-graph-wrapper">
            <div className="editordashboard-graph">
              {graphData.map((item, index) => (
                <div className="editordashboard-bar-wrapper" key={index}>
                  <div className="editordashboard-bar-tooltip">
                    {item.label}
                    <br />
                    count : {item.value}
                  </div>

                  <div
                    className="editordashboard-bar"
                    style={{
                      // Scale relative to the busiest stage, in a 260px band,
                      // rather than a fixed px-per-project multiplier — a
                      // handful of large accounts would otherwise blow the
                      // bars straight through the top of the card.
                      height:
                        item.value === 0
                          ? "0px"
                          : `${Math.max(8, Math.round((item.value / maxGraphValue) * 260))}px`,
                      background: item.color,
                    }}
                  />

                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <button
              className="editordashboard-view-btn"
              onClick={() => navigate("/editor/Editorprojects")}
            >
              View all projects →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editordashboard;
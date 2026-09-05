import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BookOpen } from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";
import { getUrgencyLevel, formatAge } from "../utils/publishRequestUrgency";
import "./PublishRequestsBell.css";

interface PublishRequest {
  id: number;
  user_id: number;
  status: string;
  created_at: string;
  customer_name: string;
}

const POLL_INTERVAL_MS = 30000;

const PublishRequestsBell = () => {
  const [requests, setRequests] = useState<PublishRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/flipbook-publish-requests");
      if (res.data.success) {
        setRequests(res.data.data || []);
      }
    } catch {
      // Silent fail — don't spam a toast on every 30s poll
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAcknowledge = async (id: number) => {
    try {
      setLoading(true);
      const res = await api.patch(`/flipbook-publish-requests/${id}/acknowledge`);
      if (res.data.success) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(res?.data?.message || "Failed to update request");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = (req: PublishRequest) => {
    setOpen(false);
    navigate("/editor/Editorcardinnerpage", {
      state: {
        project: {
          id: req.user_id,
          title: `A journey through time: ${req.customer_name}`,
          author: req.customer_name,
        },
      },
    });
  };

  const hasOverdue = requests.some((r) => getUrgencyLevel(r.created_at) === "overdue");

  return (
    <div className="publishbell-wrapper" ref={wrapperRef}>
      <button
        className="publishbell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Publish requests"
      >
        <Bell size={20} />
        {requests.length > 0 && (
          <span className={`publishbell-badge ${hasOverdue ? "publishbell-badge-overdue" : ""}`}>
            {requests.length > 9 ? "9+" : requests.length}
          </span>
        )}
      </button>

      {open && (
        <div className="publishbell-dropdown">
          <div className="publishbell-dropdown-header">
            <h4>Publish Requests</h4>
            <span>{requests.length} pending</span>
          </div>

          <div className="publishbell-list">
            {requests.length === 0 ? (
              <div className="publishbell-empty">
                No pending publish requests right now.
              </div>
            ) : (
              requests.map((req) => {
                const urgency = getUrgencyLevel(req.created_at);
                return (
                  <div className="publishbell-item" key={req.id}>
                    <div
                      className="publishbell-item-main"
                      onClick={() => handleOpenProject(req)}
                    >
                      <div className="publishbell-item-icon">
                        <BookOpen size={16} />
                      </div>
                      <div className="publishbell-item-text">
                        <p>
                          <strong>{req.customer_name}</strong> wants their book
                          published
                        </p>
                        <span className="publishbell-item-meta">
                          <span className={`publishbell-urgency-dot publishbell-urgency-${urgency}`} />
                          {formatAge(req.created_at)}
                        </span>
                      </div>
                    </div>

                    <button
                      className="publishbell-dismiss-btn"
                      disabled={loading}
                      onClick={() => handleAcknowledge(req.id)}
                    >
                      Mark reviewed
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishRequestsBell;
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../../services/api';
import { useLoader } from '../../../context/LoaderContext';
import { useLocation, useNavigate } from 'react-router-dom';


// ─── Types ───────────────────────────────────────────────────────────────────

interface SubPoint {
  id: string;
  title: string;
}

interface SubChapter {
  id: string;
  title: string;
  subPoints: SubPoint[];
}

interface MainPoint {
  id: string;
  title: string;
  subChapters: SubChapter[];
}

interface SessionBlock {
  id: string;
  sessionName: string;
  mainPoints: MainPoint[];
}

interface FormData {
  sessionId?: string;
  sessions: SessionBlock[];
}

// ─── Component ───────────────────────────────────────────────────────────────

const AdminSessionManagementEdit: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({ sessions: [] });

  const { showLoader, hideLoader } = useLoader();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = (location.state as { session: any }) || {};

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // ── Pre-fill on mount ──────────────────────────────────────────────────────
  useEffect(() => {
  if (session?.session_id) {
    const mapped: SessionBlock = {
      id: generateId(),
      sessionName: session.title || '',
      mainPoints: session.mainPoints?.map((main: any) => ({
        id: generateId(),
        title: main.title,
        subChapters: main.subChapters?.map((sc: any) => ({
          id: generateId(),
          title: sc.title,
          subPoints: sc.questions?.map((q: any) => ({
            id: generateId(),
            title: q.question,
          })) || [],
        })) || [],
      })) || [],
    };

    setFormData({
      sessionId: String(session.session_id),
      sessions: [mapped],
    });
  }
}, [session]);

  // ── Session helpers ────────────────────────────────────────────────────────
  const addSession = () => {
    setFormData(prev => ({
      ...prev,
      sessions: [...prev.sessions, { id: generateId(), sessionName: '', mainPoints: [] }],
    }));
  };

  const removeSession = (sessionId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== sessionId),
    }));
  };

  const updateSessionName = (sessionId: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId ? { ...s, sessionName: name } : s
      ),
    }));
  };

  // ── Chapter helpers ────────────────────────────────────────────────────────
  const addMainPoint = (sessionId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, mainPoints: [...s.mainPoints, { id: generateId(), title: '', subChapters: [] }] }
          : s
      ),
    }));
  };

  const removeMainPoint = (sessionId: string, mainId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, mainPoints: s.mainPoints.filter(mp => mp.id !== mainId) }
          : s
      ),
    }));
  };

  const updateMainPointTitle = (sessionId: string, mainId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, mainPoints: s.mainPoints.map(mp => mp.id === mainId ? { ...mp, title } : mp) }
          : s
      ),
    }));
  };

  // ── SubChapter helpers ─────────────────────────────────────────────────────
  const addSubChapter = (sessionId: string, mainId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              mainPoints: s.mainPoints.map(mp =>
                mp.id === mainId
                  ? { ...mp, subChapters: [...mp.subChapters, { id: generateId(), title: '', subPoints: [] }] }
                  : mp
              ),
            }
          : s
      ),
    }));
  };

  const removeSubChapter = (sessionId: string, mainId: string, subChapterId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              mainPoints: s.mainPoints.map(mp =>
                mp.id === mainId
                  ? { ...mp, subChapters: mp.subChapters.filter(sc => sc.id !== subChapterId) }
                  : mp
              ),
            }
          : s
      ),
    }));
  };

  const updateSubChapterTitle = (sessionId: string, mainId: string, subChapterId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              mainPoints: s.mainPoints.map(mp =>
                mp.id === mainId
                  ? {
                      ...mp,
                      subChapters: mp.subChapters.map(sc =>
                        sc.id === subChapterId ? { ...sc, title } : sc
                      ),
                    }
                  : mp
              ),
            }
          : s
      ),
    }));
  };

  // ── Question helpers ───────────────────────────────────────────────────────
  const addSubPoint = (sessionId: string, mainId: string, subChapterId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              mainPoints: s.mainPoints.map(mp =>
                mp.id === mainId
                  ? {
                      ...mp,
                      subChapters: mp.subChapters.map(sc =>
                        sc.id === subChapterId
                          ? { ...sc, subPoints: [...sc.subPoints, { id: generateId(), title: '' }] }
                          : sc
                      ),
                    }
                  : mp
              ),
            }
          : s
      ),
    }));
  };

  const removeSubPoint = (sessionId: string, mainId: string, subChapterId: string, subPointId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              mainPoints: s.mainPoints.map(mp =>
                mp.id === mainId
                  ? {
                      ...mp,
                      subChapters: mp.subChapters.map(sc =>
                        sc.id === subChapterId
                          ? { ...sc, subPoints: sc.subPoints.filter(sp => sp.id !== subPointId) }
                          : sc
                      ),
                    }
                  : mp
              ),
            }
          : s
      ),
    }));
  };

  const updateSubPointTitle = (sessionId: string, mainId: string, subChapterId: string, subPointId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              mainPoints: s.mainPoints.map(mp =>
                mp.id === mainId
                  ? {
                      ...mp,
                      subChapters: mp.subChapters.map(sc =>
                        sc.id === subChapterId
                          ? {
                              ...sc,
                              subPoints: sc.subPoints.map(sp =>
                                sp.id === subPointId ? { ...sp, title } : sp
                              ),
                            }
                          : sc
                      ),
                    }
                  : mp
              ),
            }
          : s
      ),
    }));
  };

 

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Guard against empty sessions
  if (!formData.sessions || formData.sessions.length === 0) {
    toast.error('No session data to save. Please reload and try again.');
    return;
  }

  try {
    showLoader();
    await api.post('/updateSession', formData);
    toast.success('Session Updated Successfully');
    navigate('/Admin/SessionManagement');
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Update failed');
  } finally {
    hideLoader();
  }
};

  const handleReset = () => setFormData({ sessions: [] });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="session-add-container">
      <h1 className="form-title">Edit Session</h1>

      <form onSubmit={handleSubmit} className="session-form">

        

        {/* Add Session Button */}
        <div className="section-header">
          <h2 className="section-title">Sessions</h2>
          <button type="button" className="btn btn-primary" onClick={addSession}>
            + Add Session
          </button>
        </div>

        {/* Sessions */}
        {formData.sessions.map((session, sIdx) => (
          <div key={session.id} className="session-card">

            <div className="card-header session-header">
              <span className="point-number">Session {sIdx + 1}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeSession(session.id)}
              >
                ✕ Remove Session
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Session Title <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={session.sessionName}
                onChange={e => updateSessionName(session.id, e.target.value)}
                placeholder="e.g. CH 1 — ROOTS OF THE FOUNDER"
                required
              />
            </div>

            {/* Chapters */}
            <div className="main-points-section">
              <div className="section-header">
                <h3 className="section-title">Chapters</h3>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => addMainPoint(session.id)}
                >
                  + Add Chapter
                </button>
              </div>

              {session.mainPoints.map((mainPoint, mIdx) => (
                <div key={mainPoint.id} className="main-point-card">

                  <div className="card-header">
                    <span className="point-number">Chapter {mIdx + 1}</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeMainPoint(session.id, mainPoint.id)}
                    >
                      ✕ Remove
                    </button>
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input mt-2"
                      value={mainPoint.title}
                      onChange={e => updateMainPointTitle(session.id, mainPoint.id, e.target.value)}
                      placeholder="e.g. The Human Behind the Institution"
                      required
                    />
                  </div>

                  {/* SubChapters */}
                  <div className="sub-chapters-section">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => addSubChapter(session.id, mainPoint.id)}
                    >
                      + Add Sub Chapter
                    </button>

                    {mainPoint.subChapters.map((subChapter, scIdx) => (
                      <div key={subChapter.id} className="subchapter-card">

                        <div className="card-header">
                          <span className="point-number">Sub Chapter {scIdx + 1}</span>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => removeSubChapter(session.id, mainPoint.id, subChapter.id)}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="form-group">
                          <input
                            type="text"
                            className="form-input mt-2"
                            value={subChapter.title}
                            onChange={e => updateSubChapterTitle(session.id, mainPoint.id, subChapter.id, e.target.value)}
                            placeholder="e.g. Personal Identity"
                            required
                          />
                        </div>

                        {/* Questions */}
                        <div className="sub-points-section">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => addSubPoint(session.id, mainPoint.id, subChapter.id)}
                          >
                            + Add Question
                          </button>

                          {subChapter.subPoints.map((subPoint, spIdx) => (
                            <div key={subPoint.id} className="sub-point-card">
                              <div className="card-header">
                                <span className="point-number">Question {spIdx + 1}</span>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-xs"
                                  onClick={() => removeSubPoint(session.id, mainPoint.id, subChapter.id, subPoint.id)}
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="form-group">
                                <input
                                  type="text"
                                  className="form-input form-input-sm"
                                  value={subPoint.title}
                                  onChange={e => updateSubPointTitle(session.id, mainPoint.id, subChapter.id, subPoint.id, e.target.value)}
                                  placeholder="Enter question"
                                  required
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div className="form-actions">
          <button type="submit" className="btn btn-success">Update Session</button>
          <button type="button" className="btn btn-outline" onClick={handleReset}>
            Reset Form
          </button>
        </div>

      </form>
    </div>
  );
};

export default AdminSessionManagementEdit;
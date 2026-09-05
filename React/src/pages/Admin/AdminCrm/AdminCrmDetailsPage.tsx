import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faChevronDown,
  faChevronRight,
  faUpload,
  faTimes,
  faSpinner,
  faPlay,
  faEye,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faFileAudio,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminCrmDetailsPage.css";
import { useLocation } from "react-router-dom";
import { User } from "lucide-react";
import api from "../../../services/api";

import { toast } from "react-toastify";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  question?: { q: string; a: string };
};

type GroupedSubSession = {
  title: string;
  sub_session_id: number;
  questions: any[];
};

type AudioSession = {
  audio_session_id: number;
  label: string | null;
  total_files: number;
  status: "uploaded" | "processing" | "mapped" | "drafted" | "failed";
  created_at: string;
  transcript_count: number;
  mapped_answer_count: number;
  approved_count: number;
  draft_count: number;
  approved_draft_count: number;
};

type ChapterDraft = {
  draft_id: number;
  chapter_number: number;
  chapter_title: string;
  draft_content: string;
  editor_content: string | null;
  status: string;
  is_placeholder: boolean;
};

type MappedAnswer = {
  mapped_answer_id: number;
  question_text: string;
  extracted_answer: string;
  confidence_label: "high" | "medium" | "low";
  confidence_score: number;
  editor_status: string;
};

// ─── Helper: group flat rows by sub_session_title ─────────────────────────────

const groupBySubSession = (data: any[]): GroupedSubSession[] => {
  const map: Record<string, GroupedSubSession> = {};
  data.forEach((row) => {
    const title = row.sub_session_title || "General";
    if (!map[title]) {
      map[title] = { title, sub_session_id: row.sub_session_id, questions: [] };
    }
    map[title].questions.push(row);
  });
  return Object.values(map);
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ─── QA Modal ─────────────────────────────────────────────────────────────────

const QAModal: React.FC<ModalProps> = ({ isOpen, onClose, question }) => {
  if (!isOpen || !question) return null;
  return (
    <div className="CustomerInfoPage-modal-overlay">
      <div className="CustomerInfoPage-modal-content">
        <h3>Q/A</h3>
        <div className="CustomerInfoPage-modal-question">
          <strong>Q:</strong> {question.q}
        </div>
        <div className="CustomerInfoPage-modal-answer">
          <strong>A:</strong> {question.a}
        </div>
        <button className="CustomerInfoPage-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

// ─── Confidence Badge ─────────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <span className={`Audio-confidence-badge Audio-confidence-${label}`}>
    {label.charAt(0).toUpperCase() + label.slice(1)} {score}%
  </span>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
 const map: Record<string, { label: string; cls: string; icon: any }> = {
    uploaded:   { label: "Uploaded",   cls: "grey",   icon: faClock },
    processing: { label: "Processing", cls: "yellow", icon: faSpinner },
    mapped:     { label: "Mapped",     cls: "green",  icon: faCheckCircle },
    drafted:    { label: "Drafted",    cls: "green",  icon: faCheckCircle },
    failed:     { label: "Failed",     cls: "red",    icon: faTimesCircle },
  };
  const s = map[status] ?? { label: status, cls: "grey", icon: faClock };
  return (
    <span className={`Audio-status-badge Audio-status-${s.cls}`}>
      <FontAwesomeIcon icon={s.icon} spin={status === "processing"} style={{ marginRight: 5 }} />
      {s.label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const AdminCrmDetailsPage: React.FC = () => {

  // ── Existing state (unchanged) ──────────────────────────────────────────────
  const [qaData, setQaData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSubSession, setOpenSubSession] = useState<string | null>(null);
  const [modalQA, setModalQA] = useState<{ q: string; a: string } | null>(null);

  // ── Audio state (new) ───────────────────────────────────────────────────────
  const [audioSessions, setAudioSessions] = useState<AudioSession[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [viewMappedId, setViewMappedId] = useState<number | null>(null);
  const [mappedChapters, setMappedChapters] = useState<Record<string, MappedAnswer[]>>({});
  const [mappedStats, setMappedStats] = useState<any>(null);
  const [mappedLoading, setMappedLoading] = useState(false);
  const [openMappedChapter, setOpenMappedChapter] = useState<string | null>(null);
  const [processMode, setProcessMode] = useState<"qa" | "story">("qa");
const [storyLanguage, setStoryLanguage] = useState<"en" | "hi" | "gu">("en");
const [viewDraftsId, setViewDraftsId] = useState<number | null>(null);
const [chapterDrafts, setChapterDrafts] = useState<ChapterDraft[]>([]);
const [draftsStats, setDraftsStats] = useState<any>(null);
const [draftsLoading, setDraftsLoading] = useState(false);
const [openDraftChapter, setOpenDraftChapter] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const location = useLocation();
  const item = location.state?.item || {};

  // ── Existing: fetch Q/A (unchanged) ────────────────────────────────────────
  useEffect(() => {
    const fetchQA = async () => {
      setLoading(true);
      try {
        if (!item?.user_id) { setQaData([]); return; }
        const res = await api.get(`/customer/qa/${item.user_id}`);
        const rows = res?.data?.data || [];
        setQaData(rows);
        const grouped = groupBySubSession(rows);
        if (grouped.length > 0) setOpenSubSession(grouped[0].title);
      } catch (err) {
        console.error(err);
        setQaData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchQA();
  }, [item?.user_id]);

  useEffect(() => { setModalQA(null); }, [item?.user_id]);

  // ── Audio: load sessions when page opens ────────────────────────────────────
  useEffect(() => {
    if (item?.user_id) fetchAudioSessions();
  }, [item?.user_id]);

  const fetchAudioSessions = async () => {
    setAudioLoading(true);
    try {
      const res = await api.get(`/audio/status/${item.user_id}`);
      setAudioSessions(res?.data?.data?.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAudioLoading(false);
    }
  };

  // ── Audio: file picker ──────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const allowed = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4"];
    const valid = selected.filter((f) =>
      allowed.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const oversized = valid.filter((f) => f.size > 24 * 1024 * 1024);
    if (oversized.length) {
      toast.error(`${oversized.length} file(s) exceed 24 MB. Please compress or split them.`);
    }
    const ok = valid.filter((f) => f.size <= 24 * 1024 * 1024);
    setUploadFiles((prev) => [...prev, ...ok].slice(0, 8));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) =>
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  // ── Audio: upload ───────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFiles.length) { toast.error("Select at least one audio file."); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      uploadFiles.forEach((f) => formData.append("audio_files", f));
      if (uploadLabel.trim()) formData.append("label", uploadLabel.trim());
      await api.post(`/audio/upload/${item.user_id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${uploadFiles.length} file(s) uploaded.`);
      setUploadFiles([]);
      setUploadLabel("");
      fetchAudioSessions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // ── Audio: process (Whisper + GPT mapping) ──────────────────────────────────
const handleProcess = async (sessionId: number) => {
  setProcessingId(sessionId);
  setAudioSessions((prev) =>
    prev.map((s) =>
      s.audio_session_id === sessionId ? { ...s, status: "processing" } : s
    )
  );
  try {
    const res = await api.post(
  `/audio/process/${sessionId}`,
  { mode: processMode, language: storyLanguage },
  { headers: { "Content-Type": "application/json" } }
);
    const d = res?.data?.data;
    if (processMode === "story") {
      toast.success(
        `Done. ${d?.chapters_with_content ?? 0} chapters generated, ` +
        `${d?.chapters_need_editor ?? 0} need editor input.`
      );
    } else {
      toast.success(
        `Done. ${d?.answers_mapped ?? 0} answers mapped, ` +
        `${d?.unanswered_count ?? 0} questions unanswered.`
      );
    }
    fetchAudioSessions();
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Processing failed.");
    fetchAudioSessions();
  } finally {
    setProcessingId(null);
  }
};
  // ── Audio: view mapped answers ───────────────────────────────────────────────
  const handleViewMapped = async (sessionId: number) => {
    if (viewMappedId === sessionId) {
      setViewMappedId(null);
      setMappedChapters({});
      setMappedStats(null);
      return;
    }
    setViewMappedId(sessionId);
    setMappedChapters({});
    setMappedStats(null);
    setMappedLoading(true);
    try {
      const res = await api.get(`/audio/mapped/${sessionId}`);
      const d = res?.data?.data;
      setMappedChapters(d?.chapters || {});
      setMappedStats(d?.stats || null);
      const firstKey = Object.keys(d?.chapters || {})[0];
      if (firstKey) setOpenMappedChapter(firstKey);
    } catch {
      toast.error("Could not load mapped answers.");
      setViewMappedId(null);
    } finally {
      setMappedLoading(false);
    }
  };

  // ── Existing helpers (unchanged) ────────────────────────────────────────────
  // ── Audio: view chapter drafts (story mode) ──────────────────────────────
  const handleViewDrafts = async (sessionId: number) => {
    if (viewDraftsId === sessionId) {
      setViewDraftsId(null);
      setChapterDrafts([]);
      setDraftsStats(null);
      return;
    }
    setViewDraftsId(sessionId);
    setChapterDrafts([]);
    setDraftsStats(null);
    setDraftsLoading(true);
    try {
      const res = await api.get(`/audio/drafts/${sessionId}`);
      const d = res?.data?.data;
      setChapterDrafts(d?.drafts || []);
      setDraftsStats(d?.stats || null);
      if (d?.drafts?.length > 0) setOpenDraftChapter(d.drafts[0].chapter_number);
    } catch {
      toast.error("Could not load chapter drafts.");
      setViewDraftsId(null);
    } finally {
      setDraftsLoading(false);
    }
  };

  // ── Existing helpers (unchanged) ────────────────────────────────────────────
  const groupedQA = groupBySubSession(qaData);
  const toggleSubSession = (title: string) =>
    setOpenSubSession((prev) => (prev === title ? null : title));

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="CustomerInfoPage-root">

      {/* ── Profile Header (unchanged) ── */}
      <div className="CustomerInfoPage-profile-header">
        <User className="CustomerInfoPage-profile-img" />
        <div>
          <div className="CustomerInfoPage-profile-name">{item?.name}</div>
          {item?.website && (
            <a href={item.website} className="CustomerInfoPage-profile-website">
              {item.website}
            </a>
          )}
        </div>
      </div>

      {/* ── Customer Details (unchanged) ── */}
      <div className="CustomerInfoPage-customer-details">
        <div><span>Email:</span> {item?.email}</div>
        <div><span>Contact No:</span> {item?.mobile}</div>
        <div><span>Entity Name:</span> {item?.entityname}</div>
        <div><span>Industry:</span> {item?.industry}</div>
        <div><span>Established Year:</span> {item?.year}</div>
        <div><span>Pincode:</span> {item?.pincode}</div>
        <div><span>State:</span> {item?.state}</div>
        <div><span>District:</span> {item?.district}</div>
        <div><span>Address:</span> {item?.address}</div>
        {item?.category && (
          <div>
            <span>Category:</span>{" "}
            <span className="CustomerInfoPage-category-badge">
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* ── Q/A Section (unchanged) ── */}
      <div className="CustomerInfoPage-qa-section">
        <h2>Q/A DETAILS</h2>
        {loading ? (
          <div className="CustomerInfoPage-loading">Loading customer Q/A...</div>
        ) : groupedQA.length === 0 ? (
          <div className="CustomerInfoPage-loading">No Q/A data available.</div>
        ) : (
          groupedQA.map((group) => (
            <div key={group.sub_session_id} className="CustomerInfoPage-accordion">
              <button
                className={`CustomerInfoPage-accordion-header ${
                  openSubSession === group.title ? "active" : ""
                }`}
                onClick={() => toggleSubSession(group.title)}
              >
                <span>{group.title}</span>
                <FontAwesomeIcon
                  icon={openSubSession === group.title ? faChevronDown : faChevronRight}
                />
              </button>
              {openSubSession === group.title && (
                <ul className="CustomerInfoPage-qa-list">
                  {group.questions.map((qa, i) => (
                    <li key={i} className="CustomerInfoPage-qa-list-item">
                      <span>{qa.question}</span>
                      <button
                        className="CustomerInfoPage-info-btn"
                        onClick={() =>
                          setModalQA({ q: qa.question, a: qa.answer || "Pending" })
                        }
                      >
                        <FontAwesomeIcon icon={faInfoCircle} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ── Audio Interviews Section (NEW) ──────────────────────────────────
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="Audio-section">
        <h2 className="Audio-section-title">
          <FontAwesomeIcon icon={faFileAudio} style={{ marginRight: 8 }} />
          Audio Interviews
        </h2>

        {/* ── Upload Panel ─────────────────────────────────────────────────── */}
        <div className="Audio-upload-panel">

          {/* Mode selector */}
          <div className="Audio-mode-selector">
            <span className="Audio-mode-label">Processing Mode:</span>
            <button
              className={`Audio-mode-btn ${processMode === "qa" ? "active" : ""}`}
              onClick={() => setProcessMode("qa")}
            >
              Q/A Mapping
            </button>
            <button
              className={`Audio-mode-btn ${processMode === "story" ? "active" : ""}`}
              onClick={() => setProcessMode("story")}
            >
              Story Draft
            </button>
          </div>
          <p className="Audio-mode-hint">
  {processMode === "qa"
    ? "Maps spoken content to individual biography questions."
    : "Generates a chapter-wise biography story draft from the interview."}
</p>

{processMode === "story" && (
  <div className="Audio-language-selector">
    <span className="Audio-mode-label">Output Language:</span>
    <button
      className={`Audio-mode-btn ${storyLanguage === "en" ? "active" : ""}`}
      onClick={() => setStoryLanguage("en")}
    >
      English
    </button>
    <button
      className={`Audio-mode-btn ${storyLanguage === "hi" ? "active" : ""}`}
      onClick={() => setStoryLanguage("hi")}
    >
      Hindi
    </button>
    <button
      className={`Audio-mode-btn ${storyLanguage === "gu" ? "active" : ""}`}
      onClick={() => setStoryLanguage("gu")}
    >
      Gujarati
    </button>
  </div>
)}

          <div className="Audio-upload-label-row">
            <input
              type="text"
              className="Audio-label-input"
              placeholder="Session label  e.g. Interview Round 1 — Childhood"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              disabled={uploading}
            />
            <button
              className="Audio-pick-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || uploadFiles.length >= 8}
            >
              <FontAwesomeIcon icon={faUpload} style={{ marginRight: 6 }} />
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp3,.wav,.m4a,.ogg,.flac,.webm,.mp4"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
          <p className="Audio-upload-hint">
            Max 8 files · Max 24 MB each · mp3, wav, m4a, ogg, flac, webm, mp4
          </p>

          {/* Selected files list */}
          {uploadFiles.length > 0 && (
            <>
              <ul className="Audio-filelist">
                {uploadFiles.map((f, i) => (
                  <li key={i} className="Audio-filelist-item">
                    <FontAwesomeIcon icon={faFileAudio} className="Audio-filelist-icon" />
                    <span className="Audio-filelist-name">{f.name}</span>
                    <span className="Audio-filelist-size">{formatSize(f.size)}</span>
                    <button
                      className="Audio-filelist-remove"
                      onClick={() => removeFile(i)}
                      disabled={uploading}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="Audio-upload-btn"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUpload} style={{ marginRight: 6 }} />
                    Upload {uploadFiles.length} File{uploadFiles.length > 1 ? "s" : ""}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* ── Sessions List ─────────────────────────────────────────────────── */}
        <div className="Audio-sessions-wrap">
          {audioLoading ? (
            <div className="Audio-empty">
              <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
              Loading sessions...
            </div>
          ) : audioSessions.length === 0 ? (
            <div className="Audio-empty">
              No audio sessions yet. Upload interview recordings above.
            </div>
          ) : (
            audioSessions.map((session) => (
              <div key={session.audio_session_id} className="Audio-session-card">

                {/* Session header row */}
                <div className="Audio-session-row">
                  <div className="Audio-session-info">
                    <span className="Audio-session-label">
                      {session.label || `Session #${session.audio_session_id}`}
                    </span>
                    <span className="Audio-session-meta">
                      {formatDate(session.created_at)}
                      {" · "}{session.total_files} file{session.total_files !== 1 ? "s" : ""}
                      {session.mapped_answer_count > 0 &&
                        ` · ${session.mapped_answer_count} answers mapped`}
                      {session.approved_count > 0 &&
                        ` · ${session.approved_count} approved`}
                    </span>
                  </div>

                  <div className="Audio-session-actions">
                    <StatusBadge status={session.status} />

                    {session.status === "uploaded" && (
                      <button
                        className="Audio-action-btn Audio-btn-process"
                        onClick={() => handleProcess(session.audio_session_id)}
                        disabled={processingId === session.audio_session_id}
                      >
                        {processingId === session.audio_session_id ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 5 }} />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faPlay} style={{ marginRight: 5 }} />
                            Process
                          </>
                        )}
                      </button>
                    )}

                    {session.status === "mapped" && (
                      <button
                        className={`Audio-action-btn Audio-btn-view ${
                          viewMappedId === session.audio_session_id ? "active" : ""
                        }`}
                        onClick={() => handleViewMapped(session.audio_session_id)}
                      >
                        <FontAwesomeIcon icon={faEye} style={{ marginRight: 5 }} />
                        {viewMappedId === session.audio_session_id
                          ? "Hide Answers"
                          : "View Mapped Answers"}
                      </button>
                    )}

                    {session.status === "drafted" && (
                      <button
                        className={`Audio-action-btn Audio-btn-view ${
                          viewDraftsId === session.audio_session_id ? "active" : ""
                        }`}
                        onClick={() => handleViewDrafts(session.audio_session_id)}
                      >
                        <FontAwesomeIcon icon={faEye} style={{ marginRight: 5 }} />
                        {viewDraftsId === session.audio_session_id
                          ? "Hide Drafts"
                          : "View Story Drafts"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mapped answers panel — expands inline under the session row */}
                {viewMappedId === session.audio_session_id && (
                  <div className="Audio-mapped-panel">
                    {mappedLoading ? (
                      <div className="Audio-empty">
                        <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
                        Loading mapped answers...
                      </div>
                    ) : (
                      <>
                        {/* Stats bar */}
                        {mappedStats && (
                          <div className="Audio-stats-bar">
                            <span>Total <strong>{mappedStats.total}</strong></span>
                            <span className="Audio-stat-high">High <strong>{mappedStats.high}</strong></span>
                            <span className="Audio-stat-medium">Medium <strong>{mappedStats.medium}</strong></span>
                            <span className="Audio-stat-low">Low <strong>{mappedStats.low}</strong></span>
                            <span>Approved <strong>{mappedStats.approved}</strong></span>
                            <span>Pending <strong>{mappedStats.pending}</strong></span>
                          </div>
                        )}

                        {/* Chapter accordions */}
                        {Object.entries(mappedChapters).map(([chapter, answers]) => (
                          <div key={chapter} className="Audio-chapter">
                            <button
                              className={`Audio-chapter-btn ${
                                openMappedChapter === chapter ? "active" : ""
                              }`}
                              onClick={() =>
                                setOpenMappedChapter((prev) =>
                                  prev === chapter ? null : chapter
                                )
                              }
                            >
                              <span>{chapter}</span>
                              <span className="Audio-chapter-count">
                                {answers.length} answer{answers.length !== 1 ? "s" : ""}
                              </span>
                              <FontAwesomeIcon
                                icon={openMappedChapter === chapter ? faChevronDown : faChevronRight}
                              />
                            </button>

                            {openMappedChapter === chapter && (
                              <div className="Audio-answers-list">
                                {answers.map((ans) => (
                                  <div key={ans.mapped_answer_id} className="Audio-answer-card">
                                    <div className="Audio-answer-question">
                                      {ans.question_text}
                                    </div>
                                    <div className="Audio-answer-text">
                                      {ans.extracted_answer || (
                                        <em className="Audio-no-answer">No answer extracted</em>
                                      )}
                                    </div>
                                    <div className="Audio-answer-footer">
                                      <ConfidenceBadge
                                        label={ans.confidence_label}
                                        score={ans.confidence_score}
                                      />
                                      <span className={`Audio-editor-status Audio-es-${ans.editor_status}`}>
                                        {ans.editor_status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
             {/* Chapter drafts panel — story mode */}
                {viewDraftsId === session.audio_session_id && (
                  <div className="Audio-mapped-panel">
                    {draftsLoading ? (
                      <div className="Audio-empty">
                        <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
                        Loading chapter drafts...
                      </div>
                    ) : (
                      <>
                        {draftsStats && (
                          <div className="Audio-stats-bar">
                            <span>Chapters <strong>{draftsStats.total}</strong></span>
                            <span className="Audio-stat-high">With Content <strong>{draftsStats.total - draftsStats.placeholder}</strong></span>
                            <span className="Audio-stat-low">Need Editor <strong>{draftsStats.placeholder}</strong></span>
                            <span>Approved <strong>{draftsStats.approved}</strong></span>
                          </div>
                        )}
                        {chapterDrafts.map((draft) => (
                          <div key={draft.draft_id} className="Audio-chapter">
                            <button
                              className={`Audio-chapter-btn ${
                                openDraftChapter === draft.chapter_number ? "active" : ""
                              }`}
                              onClick={() =>
                                setOpenDraftChapter((prev) =>
                                  prev === draft.chapter_number ? null : draft.chapter_number
                                )
                              }
                            >
                              <span>Chapter {draft.chapter_number}: {draft.chapter_title}</span>
                              {draft.is_placeholder && (
                                <span className="Audio-placeholder-badge">Needs Editor</span>
                              )}
                              <FontAwesomeIcon
                                icon={openDraftChapter === draft.chapter_number ? faChevronDown : faChevronRight}
                              />
                            </button>
                            {openDraftChapter === draft.chapter_number && (
                              <div className="Audio-answers-list">
                                <div className="Audio-answer-card">
                                  <div className="Audio-answer-text" style={{ whiteSpace: "pre-wrap" }}>
                                    {draft.editor_content || draft.draft_content}
                                  </div>
                                  <div className="Audio-answer-footer">
                                    <span className={`Audio-editor-status Audio-es-${draft.status}`}>
                                      {draft.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
          
      {/* ── Modal (unchanged) ── */}
      <QAModal
        isOpen={!!modalQA}
        onClose={() => setModalQA(null)}
        question={modalQA || undefined}
      />
    </div>
  );
};

export default AdminCrmDetailsPage;
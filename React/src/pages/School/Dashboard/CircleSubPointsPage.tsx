import {
  useState, useRef, useEffect,
  type ChangeEvent, type KeyboardEvent, type JSX,
} from "react";
import BackButton from "../../../components/BackButton";
import "./CircleSubPointsPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiQuestion {
  question_id: number;
  question: string;
  session_id?: number;
  sub_session_id?: number;
}

interface ApiSubSession {
  sub_session_id: number;
  title: string;
  seq: number;
  questions: ApiQuestion[];
}

interface ApiSession {
  session_id: number;
  title: string;
  seq: number;
  sub_sessions: ApiSubSession[];
}

interface Chapter {
  id: string;
  title: string;
  subTopics: SubChapter[];
}

interface SubChapter {
  sub_session_id: number;
  label: string;
  session_id: number;
  questions: ApiQuestion[];
}

interface Session {
  session_id: number;
  label: string;
  chapters: Chapter[];
}

interface NavCursor {
  si: number;
  ci: number;
  sti: number;
  dqi: number;
}

interface SavedAnswer {
  customer_answer_id: number;
  question_id: number;
  session_id: number;
  sub_session_id: number;
  answer: string;
  ai_req_res_id: number | null;
   question: string | null;          // ← ADD — comes from q.question
  ai_json: { narrative?: string } | null; 
}

// ─── AI panel state per question ──────────────────────────────────────────────
// Tracks how many times user has re-generated AI narrative for a given question_id
// and whether the answer has been "finally submitted" (locking the AI panel input)
interface AiPanelState {
  narrative: string;          // current AI-generated narrative shown
  savedAnswer: string;        // the answer text that was submitted
  questionText: string;       // the question text
  generationsUsed: number;    // how many AI re-generations consumed (max 3)
  finallySubmitted: boolean;  // true once user clicked final "Submit" → locks panel
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const API_BASE = `${(import.meta as any).env?.VITE_API_URL ?? "http://localhost:5002"}/api`;

function getToken(): string {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

// ─── Transform API sessions → Session[] ──────────────────────────────────────
function transformSessions(apiSessions: ApiSession[]): Session[] {
  return apiSessions.map((s, si) => {
    const chapterMap = new Map<string, SubChapter[]>();
    const sorted = [...(s.sub_sessions ?? [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

    for (const ss of sorted) {
      const arrowIdx = ss.title.indexOf(" → ");
      const chapterTitle = arrowIdx !== -1 ? ss.title.slice(0, arrowIdx).trim() : ss.title.trim();
      const subLabel = arrowIdx !== -1 ? ss.title.slice(arrowIdx + 3).trim() : ss.title.trim();
      if (!chapterMap.has(chapterTitle)) chapterMap.set(chapterTitle, []);
      chapterMap.get(chapterTitle)!.push({
        sub_session_id: ss.sub_session_id,
        label: subLabel,
        session_id: s.session_id,
        questions: (ss.questions ?? []).map((q) => ({
          ...q,
          session_id: s.session_id,
          sub_session_id: ss.sub_session_id,
        })),
      });
    }

    const chapters: Chapter[] = [];
    let ci = 0;
    for (const [chapterTitle, subTopics] of chapterMap) {
      chapters.push({ id: `${si + 1}.${ci + 1}`, title: chapterTitle, subTopics });
      ci++;
    }

    return {
      session_id: s.session_id,
      label: `SESSION ${si + 1}: ${s.title.toUpperCase()}`,
      chapters,
    };
  });
}

// ─── Build flat navigation list ───────────────────────────────────────────────
function buildFlatNav(sessions: Session[]): NavCursor[] {
  const nav: NavCursor[] = [];
  sessions.forEach((s, si) => {
    s.chapters.forEach((ch, ci) => {
      ch.subTopics.forEach((st, sti) => {
        const qs = st.questions;
        if (qs.length === 0) {
          nav.push({ si, ci, sti, dqi: 0 });
        } else {
          qs.forEach((_, dqi) => nav.push({ si, ci, sti, dqi }));
        }
      });
    });
  });
  return nav;
}

// ─── Data fetching hook ───────────────────────────────────────────────────────
function useSessionsAndAnswers() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [answeredMap, setAnsweredMap] = useState<Record<number, string>>({});
  const [aiPanelSeed, setAiPanelSeed] = useState<Record<number, AiPanelState>>({});  // ← ADD
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [sessRes, answRes] = await Promise.all([
          fetch(`${API_BASE}/user/sessions`, { headers: authHeaders() }),
          fetch(`${API_BASE}/user/answers`, { headers: authHeaders() }),
        ]);

        if (!sessRes.ok) throw new Error(`Sessions: server returned ${sessRes.status}`);
        const sessJson = await sessRes.json();
        if (!sessJson.success) throw new Error(sessJson.message ?? "Failed to load sessions");

        if (cancelled) return;

        const transformed = transformSessions(sessJson.data ?? []);
        setSessions(transformed);

       if (answRes.ok) {
          const answJson = await answRes.json();
          if (answJson.success && Array.isArray(answJson.data)) {
            const map: Record<number, string> = {};
            const aiSeed: Record<number, AiPanelState> = {};
            for (const row of answJson.data as SavedAnswer[]) {
              map[row.question_id] = row.answer;
              const narrative = row.ai_json?.narrative;
              if (narrative) {
                aiSeed[row.question_id] = {
                  narrative,
                  savedAnswer: row.answer,
                  questionText: row.question ?? "",
                  generationsUsed: 0,
                  finallySubmitted: true,
                };
              }
            }
            setAnsweredMap(map);
            setAiPanelSeed(aiSeed);   // ← ADD
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { sessions, answeredMap, setAnsweredMap, aiPanelSeed, loading, error };

}

function getServiceId(chapterIndex: number): number {
  const id = chapterIndex + 1;
  return id <= 11 ? id : 99;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function MicIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="#b5814a" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="#b5814a" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" stroke="#b5814a" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="21" x2="15" y2="21" stroke="#b5814a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AiIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 36 36" fill="none" width="36" height="36" aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="7" stroke="#b5814a" strokeWidth="1.5" fill="#f5f0e8" />
      <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fontSize="13" fill="#b5814a" fontWeight="600">Ai</text>
      <circle cx="28" cy="8" r="4" fill="#b5814a" />
      <text x="28" y="8" dominantBaseline="middle" textAnchor="middle" fontSize="6" fill="#fff">✦</text>
    </svg>
  );
}

function UploadIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="11" stroke="#999" strokeWidth="1.4" />
      <path d="M12 16V8M9 11l3-3 3 3" stroke="#999" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path d="M6 2.5h7.5L18 7v14.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" stroke="#b5814a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13.5 2.5V7H18" stroke="#b5814a" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" fill="none" width="52" height="52" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#f5f0e8" stroke="#b5814a" strokeWidth="2" />
      <path d="M14 25l7 7 13-14" stroke="#b5814a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" aria-hidden="true">
      <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Sub-chapter complete card ────────────────────────────────────────────────
interface SubChapterDoneProps {
  subChapterTitle: string;
  isLastOverall: boolean;
  nextLabel: string;
  onNext: () => void;
}

function SubChapterDoneCard({ subChapterTitle, isLastOverall, nextLabel, onNext }: SubChapterDoneProps): JSX.Element {
  return (
    <div className="fsp-done-card">
      <CheckCircleIcon />
      <h2 className="fsp-done-title">"{subChapterTitle}" Complete!</h2>
      <p className="fsp-done-desc">All questions answered. Your responses have been saved to the database.</p>
      {!isLastOverall && (
        <button type="button" className="fsp-done-next-btn" onClick={onNext}>
          Continue: {nextLabel} →
        </button>
      )}
      {isLastOverall && (
        <p className="fsp-done-final">🎉 You've completed the entire interview!</p>
      )}
    </div>
  );
}

// ─── Already-answered modal — exact old design ────────────────────────────────
function AlreadyAnsweredModal({
  questionTitle,
  onClose,
  onReview,
}: {
  questionTitle: string;
  onClose: () => void;
  onReview: () => void;
}): JSX.Element {
  return (
    <>
      <style>{`
        .fsmodal-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(60, 40, 20, 0.38);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(2px);
          animation: fsmodal-fadein 0.18s ease;
        }
        @keyframes fsmodal-fadein { from { opacity: 0; } to { opacity: 1; } }
        .fsmodal-card {
          background: #fffdf9;
          border: 1.5px solid #e8d9c4;
          border-radius: 18px;
          padding: 36px 32px 28px;
          max-width: 420px;
          width: 90%;
          position: relative;
          box-shadow: 0 8px 40px rgba(90, 55, 20, 0.18);
          text-align: center;
          animation: fsmodal-slidein 0.2s cubic-bezier(.4,0,.2,1);
        }
        @keyframes fsmodal-slidein {
          from { transform: translateY(18px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0) scale(1);      opacity: 1; }
        }
        .fsmodal-icon { margin-bottom: 12px; }
        .fsmodal-title {
          font-size: 20px; font-weight: 700; color: #5c3d1e;
          margin: 0 0 6px; letter-spacing: -0.01em;
        }
        .fsmodal-subtitle {
          font-size: 13px; color: #8a7260; margin: 0 0 4px;
        }
        .fsmodal-question-name {
          font-size: 13.5px; font-weight: 600; color: #b5814a;
          font-style: italic; margin: 0 0 10px; line-height: 1.5;
        }
        .fsmodal-hint {
          font-size: 12.5px; color: #8a7260; margin: 0 0 20px; line-height: 1.6;
        }
        .fsmodal-actions {
          display: flex; gap: 10px; justify-content: center;
        }
        .fsmodal-btn {
          border: none; border-radius: 8px;
          padding: 10px 24px; font-size: 13.5px; font-weight: 600;
          cursor: pointer; transition: background 0.15s, transform 0.1s;
        }
        .fsmodal-btn:active { transform: scale(0.97); }
        .fsmodal-btn--secondary {
          background: #f0e6d3; color: #7a5c3a;
        }
        .fsmodal-btn--secondary:hover { background: #e8d9c4; }
        .fsmodal-btn--primary {
          background: #b5814a; color: #fff;
        }
        .fsmodal-btn--primary:hover { background: #7a5c3a; }
        .fsmodal-close {
          position: absolute; top: 14px; right: 16px;
          background: none; border: none; font-size: 22px;
          color: #b5a090; cursor: pointer; line-height: 1;
          padding: 0 4px; transition: color 0.15s;
        }
        .fsmodal-close:hover { color: #7a5c3a; }
      `}</style>
      <div
        className="fsmodal-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fsmodal-title"
      >
        <div className="fsmodal-card" onClick={(e) => e.stopPropagation()}>
          <div className="fsmodal-icon"><CheckCircleIcon /></div>
          <h2 className="fsmodal-title" id="fsmodal-title">Already Answered</h2>
          <p className="fsmodal-subtitle">You've already submitted a response for</p>
          <p className="fsmodal-question-name">"{questionTitle}"</p>
          <p className="fsmodal-hint">
            Your answer has been recorded. You can review it or continue to the next question.
          </p>
          <div className="fsmodal-actions">
            <button type="button" className="fsmodal-btn fsmodal-btn--secondary" onClick={onReview}>
              Review Answer
            </button>
            <button type="button" className="fsmodal-btn fsmodal-btn--primary" onClick={onClose}>
              Continue
            </button>
          </div>
          <button type="button" className="fsmodal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>
    </>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────
function LoadingScreen(): JSX.Element {
  return (
    <div className="founderstory-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", color: "#b5814a" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #f0e6d3", borderTopColor: "#b5814a", borderRadius: "50%", animation: "fs-spin 0.7s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ fontFamily: "inherit", fontSize: 14 }}>Loading questions…</p>
        <style>{`@keyframes fs-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }): JSX.Element {
  return (
    <div className="founderstory-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Could not load questions</p>
        <p style={{ color: "#888", fontSize: 13 }}>{message}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CircleSubPointsPage(): JSX.Element {
  const { sessions, answeredMap, setAnsweredMap, aiPanelSeed, loading, error } = useSessionsAndAnswers();

  const flatNav = sessions.length > 0 ? buildFlatNav(sessions) : [];

  // ── Position ────────────────────────────────────────────────────────────────
  const [flatIndex, setFlatIndex] = useState<number>(0);

  // ── Activity tracking (for admin "Daily Active User" reporting) ────────────
  // Timestamp (ms) of when the current question was first shown to the user
  const questionStartTimeRef = useRef<number>(Date.now());
  // Number of submit attempts made per question_id in this session
  const questionAttemptsRef = useRef<Record<number, number>>({});

  // ── Answer textarea ─────────────────────────────────────────────────────────
  const [answerText, setAnswerText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Sub-chapter completion overlay ──────────────────────────────────────────
  const [showSubChapterDone, setShowSubChapterDone] = useState<boolean>(false);

  // ── AI right panel state ─────────────────────────────────────────────────────
  // Per-question AI panel state: question_id → AiPanelState
  const [aiPanelMap, setAiPanelMap] = useState<Record<number, AiPanelState>>({});

  useEffect(() => {
    if (Object.keys(aiPanelSeed).length > 0) {
      setAiPanelMap((prev) => ({ ...aiPanelSeed, ...prev }));
    }
  }, [aiPanelSeed]);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiTypedText, setAiTypedText] = useState<string>("");
  // Regenerate loading for the "modify" action
  const [aiRegenLoading, setAiRegenLoading] = useState<boolean>(false);

  // Default AI panel text (before any question is answered)
  const defaultAiContent = "Your story will be reflected here. As you answer questions across sessions, this space will weave your responses into a living narrative — capturing the essence of your journey, values, and vision.";

  // ── Media ────────────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Modal for prev-question-already-answered ──────────────────────────────
  const [prevModal, setPrevModal] = useState<{ show: boolean; questionText: string; answer: string }>(
    { show: false, questionText: "", answer: "" }
  );

  // ── Mobile sidebar ────────────────────────────────────────────────────────────
  const [mobileExpanded, setMobileExpanded] = useState<boolean>(false);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const cursor: NavCursor | undefined = flatNav[flatIndex];
  const session  = cursor ? sessions[cursor.si]                        : undefined;
  const chapter  = cursor && session ? session.chapters[cursor.ci]     : undefined;
  const subChap  = cursor && chapter ? chapter.subTopics[cursor.sti]   : undefined;
  const dbQs     = subChap ? subChap.questions                         : [];
  const currentQ = dbQs[cursor?.dqi ?? 0] ?? null;

  const isLastInSubChap  = cursor ? cursor.dqi === Math.max(0, dbQs.length - 1) : false;
  const isFirstQuestion  = flatIndex === 0;
  const isLastOverall    = flatIndex >= flatNav.length - 1;

  const nextCursor = flatNav[flatIndex + 1];
  const nextSubChapLabel = (() => {
    if (!nextCursor || !session) return "";
    const nextSession = sessions[nextCursor.si];
    const nextChapter = nextSession?.chapters[nextCursor.ci];
    const nextSubChap = nextChapter?.subTopics[nextCursor.sti];
    if (!nextSubChap) return "";
    if (nextCursor.ci !== cursor?.ci || nextCursor.si !== cursor?.si) {
      return `${nextChapter?.title} › ${nextSubChap.label}`;
    }
    return nextSubChap.label;
  })();

  // Is the current question already answered in the DB?
  const isAlreadyAnswered = currentQ ? Boolean(answeredMap[currentQ.question_id]) : false;

  // Current AI panel state for this question
  const currentAiState = currentQ ? aiPanelMap[currentQ.question_id] : undefined;

  // Answer is "finally submitted" through the AI panel confirm
  const isAiPanelLocked = currentAiState?.finallySubmitted === true;

  // How many AI re-generations remain for this question
  const aiGenerationsUsed = currentAiState?.generationsUsed ?? 0;
  const aiGenerationsLeft = Math.max(0, 3 - aiGenerationsUsed);

  // ── Sync answer text when navigating ─────────────────────────────────────────
  useEffect(() => {
    if (currentQ && answeredMap[currentQ.question_id]) {
      setAnswerText(answeredMap[currentQ.question_id]);
    } else {
      setAnswerText("");
    }
    setSubmitError(null);
    setShowSubChapterDone(false);
    setAiTypedText("");
    // Start the clock fresh for whatever question the user is now looking at
    questionStartTimeRef.current = Date.now();
  }, [flatIndex]);

  // ── Check if entire sub-chapter is answered ───────────────────────────────
  function isSubChapterFullyAnswered(si: number, ci: number, sti: number): boolean {
    const qs = sessions[si]?.chapters[ci]?.subTopics[sti]?.questions ?? [];
    if (qs.length === 0) return false;
    return qs.every((q) => Boolean(answeredMap[q.question_id]));
  }

  // ── Submit text answer to DB ───────────────────────────────────────────────
  async function handleSubmitAnswer(): Promise<void> {
    if (!answerText.trim() || !cursor || !currentQ || !subChap || !chapter) return;
    // If already answered, block re-submission from main panel
    if (isAlreadyAnswered) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setAiLoading(true);

    try {
      const serviceId = getServiceId(cursor.ci);

      // Track how long the user spent on this question and how many
      // submit attempts they've made, for admin "Daily Active User" reporting
      const time_spent = Math.max(
        0,
        Math.round((Date.now() - questionStartTimeRef.current) / 1000)
      );
      const qId = currentQ.question_id;
      questionAttemptsRef.current[qId] = (questionAttemptsRef.current[qId] ?? 0) + 1;
      const attempts = questionAttemptsRef.current[qId];

      const res = await fetch(`${API_BASE}/user/answer`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          question_id:    currentQ.question_id,
          session_id:     subChap.session_id,
          sub_session_id: subChap.sub_session_id,
          answer:         answerText.trim(),
          serviceId,
          title:          currentQ.question,
          title_desc:     subChap.label,
          time_spent,
          attempts,
          completed:      true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to save answer");

      // Mark answered locally
      setAnsweredMap((prev) => ({ ...prev, [currentQ.question_id]: answerText.trim() }));

      // Set AI panel state for this question — not finally submitted yet
      // User can now modify the narrative up to 3 times before final submit
      const narrativeText: string =
        json.data?.ai_json?.narrative ?? "Your story is being generated…";

      setAiPanelMap((prev) => ({
        ...prev,
        [currentQ.question_id]: {
          narrative: narrativeText,
          savedAnswer: answerText.trim(),
          questionText: currentQ.question,
          generationsUsed: 0,
          finallySubmitted: false,
        },
      }));

    } catch (err: any) {
      setSubmitError(err.message ?? "Could not save your answer. Please try again.");
    } finally {
      setIsSubmitting(false);
      setAiLoading(false);
    }
  }

  // ── AI panel: user modifies the narrative (max 3 times) ───────────────────
  async function handleAiRegenerate(): Promise<void> {
    if (!currentQ || !cursor || !subChap) return;
    const state = aiPanelMap[currentQ.question_id];
    if (!state || state.generationsUsed >= 3 || state.finallySubmitted) return;
    if (!aiTypedText.trim()) return;

    setAiRegenLoading(true);
    try {
      const serviceId = getServiceId(cursor.ci);
      // Re-submit with the modified/additional context the user typed
      const combinedAnswer = `${state.savedAnswer}\n\nAdditional context: ${aiTypedText.trim()}`;

      const res = await fetch(`${API_BASE}/user/answer`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          question_id:    currentQ.question_id,
          session_id:     subChap.session_id,
          sub_session_id: subChap.sub_session_id,
          answer:         combinedAnswer,
          serviceId,
          title:          currentQ.question,
          title_desc:     subChap.label,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to regenerate");

      const newNarrative: string =
        json.data?.ai_json?.narrative ?? "Your story is being refined…";

      setAiPanelMap((prev) => ({
        ...prev,
        [currentQ.question_id]: {
          ...state,
          narrative: newNarrative,
          generationsUsed: state.generationsUsed + 1,
          finallySubmitted: false,
        },
      }));
      setAiTypedText("");
    } catch (err: any) {
      setSubmitError((err as Error).message ?? "Failed to update narrative.");
    } finally {
      setAiRegenLoading(false);
    }
  }

  // ── AI panel: final "Submit" — locks the panel and advances to next question ──
  function handleAiFinalSubmit(): void {
    if (!currentQ) return;
    const state = aiPanelMap[currentQ.question_id];
    if (!state) return;

    // Lock the AI panel for this question
    setAiPanelMap((prev) => ({
      ...prev,
      [currentQ.question_id]: { ...state, finallySubmitted: true },
    }));

    // Advance to next question or show sub-chapter done
    if (isLastInSubChap) {
      setShowSubChapterDone(true);
    } else {
      setFlatIndex((prev) => prev + 1);
      setAnswerText("");
    }
  }

  // ── Submit audio answer to DB ─────────────────────────────────────────────
  async function handleSubmitAudio(audioBlob: Blob, fileName: string): Promise<void> {
    if (!cursor || !currentQ || !subChap || !chapter) return;
    if (isAlreadyAnswered) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setAiLoading(true);

    try {
      const serviceId = getServiceId(cursor.ci);

      // Track how long the user spent on this question and how many
      // submit attempts they've made, for admin "Daily Active User" reporting
      const time_spent = Math.max(
        0,
        Math.round((Date.now() - questionStartTimeRef.current) / 1000)
      );
      const qId = currentQ.question_id;
      questionAttemptsRef.current[qId] = (questionAttemptsRef.current[qId] ?? 0) + 1;
      const attempts = questionAttemptsRef.current[qId];

      const formData = new FormData();
      formData.append("audio_file",    audioBlob, fileName);
      formData.append("question_id",   String(currentQ.question_id));
      formData.append("session_id",    String(subChap.session_id));
      formData.append("sub_session_id",String(subChap.sub_session_id));
      formData.append("serviceId",     String(serviceId));
      formData.append("title",         currentQ.question);
      formData.append("title_desc",    subChap.label);
      formData.append("time_spent",    String(time_spent));
      formData.append("attempts",      String(attempts));
      formData.append("completed",     "true");

      const res = await fetch(`${API_BASE}/user/audio-answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Audio upload failed");

      const transcript: string = json.data?.transcript ?? "(audio transcribed)";
      setAnsweredMap((prev) => ({ ...prev, [currentQ.question_id]: transcript }));
      setAnswerText(transcript);

      setAiPanelMap((prev) => ({
        ...prev,
        [currentQ.question_id]: {
          narrative: `🎤 Audio transcribed and saved. Your voice answer has been processed by AI and added to your biography.`,
          savedAnswer: transcript,
          questionText: currentQ.question,
          generationsUsed: 0,
          finallySubmitted: false,
        },
      }));

      setRecordedAudio(null);
      setRecordedAudioUrl(null);
      setUploadedAudio(null);
    } catch (err: any) {
      setSubmitError(err.message ?? "Audio submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
      setAiLoading(false);
    }
  }

  // ── Upload image to S3 ────────────────────────────────────────────────────
  async function handleImageUploadToS3(file: File): Promise<void> {
    if (!currentQ || !subChap) return;
    setIsUploadingImage(true);
    try {
      const uniqueName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const urlRes = await fetch(`${API_BASE}/user/gallery/upload-url`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fileName: file.name, fileType: file.type, UniqueFileName: uniqueName }),
      });
      const urlJson = await urlRes.json();
      if (!urlRes.ok || !urlJson.success) throw new Error("Could not get upload URL");

      const { uploadUrl, key } = urlJson.data;
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Image upload to S3 failed");

      // Save the DB row linking this image to the question/sub-chapter/chapter
      const saveRes = await fetch(`${API_BASE}/user/gallery/save`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          key,
          session_id: subChap.session_id,
          sub_session_id: subChap.sub_session_id,
          question_id: currentQ.question_id,
        }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok || !saveJson.success) throw new Error("Could not save image record");

      setUploadedFileName(file.name);
    } catch (err: any) {
      setSubmitError(err.message ?? "Image upload failed");
    } finally {
      setIsUploadingImage(false);
    }
  }

  // ── Sub-chapter done → advance ────────────────────────────────────────────
  function handleSubChapterDoneContinue(): void {
    setShowSubChapterDone(false);
    if (!isLastOverall) {
      setFlatIndex((prev) => prev + 1);
      setAnswerText("");
    }
  }

  // ── Prev question ─────────────────────────────────────────────────────────
  function handlePrevQuestion(): void {
    if (flatIndex <= 0) return;
    const prevIndex = flatIndex - 1;
    const prevCursor = flatNav[prevIndex];
    if (!prevCursor) return;

    // Get the question at the prev cursor
    const prevSession  = sessions[prevCursor.si];
    const prevChapter  = prevSession?.chapters[prevCursor.ci];
    const prevSubChap  = prevChapter?.subTopics[prevCursor.sti];
    const prevQs       = prevSubChap?.questions ?? [];
    const prevQ        = prevQs[prevCursor.dqi] ?? null;

    if (prevQ && answeredMap[prevQ.question_id]) {
      // Already answered — show informational modal
      setPrevModal({
        show: true,
        questionText: prevQ.question,
        answer: answeredMap[prevQ.question_id],
      });
    }

    // Navigate regardless — user can view but not re-submit
    setFlatIndex(prevIndex);
    setShowSubChapterDone(false);
  }

  function handleNextQuestion(): void {
  if (flatIndex >= flatNav.length - 1) return;

  setFlatIndex((prev) => prev + 1);
  setShowSubChapterDone(false);
}

  // ── Sidebar: click a sub-chapter ─────────────────────────────────────────
  function handleSubTopicSidebarClick(si: number, ci: number, sti: number): void {
    const qs = sessions[si]?.chapters[ci]?.subTopics[sti]?.questions ?? [];
    if (isSubChapterFullyAnswered(si, ci, sti)) {
      const q = qs[0];
      if (q) {
        setPrevModal({ show: true, questionText: q.question, answer: answeredMap[q.question_id] ?? "" });
      }
      return;
    }
    const firstUnanswered = qs.findIndex((q) => !answeredMap[q.question_id]);
    const targetDqi = firstUnanswered >= 0 ? firstUnanswered : 0;
    const idx = flatNav.findIndex((c) => c.si === si && c.ci === ci && c.sti === sti && c.dqi === targetDqi);
    if (idx >= 0) {
      setFlatIndex(idx);
      setShowSubChapterDone(false);
    }
    setMobileExpanded(false);
  }

  // ── Sidebar: click session header ────────────────────────────────────────
  function handleSessionClick(si: number): void {
    if (si === cursor?.si) { setMobileExpanded((p) => !p); return; }
    const idx = flatNav.findIndex((c) => c.si === si && c.ci === 0 && c.sti === 0 && c.dqi === 0);
    if (idx >= 0) { setFlatIndex(idx); setShowSubChapterDone(false); }
    setMobileExpanded(true);
  }

  // ── Recording ────────────────────────────────────────────────────────────
  function toggleRecording(): void {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudio(blob);
        setRecordedAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    }).catch(() => setIsRecording(false));
  }

  function handleAudioFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) setUploadedAudio(file);
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImageFile(file);
    setUploadedFileName(file.name);
    handleImageUploadToS3(file);
  }

  function handleRemoveFile(): void {
    setUploadedFileName(null);
    setUploadedImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Render guards ────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} />;
  if (!cursor || !session || !chapter || !subChap) return <ErrorScreen message="No sessions found for your account." />;

  // ── Determine what to show in the AI right panel ──────────────────────────
  const showAiAnswerSection = Boolean(currentQ && aiPanelMap[currentQ.question_id]);
  const aiState = currentQ ? aiPanelMap[currentQ.question_id] : undefined;

  return (
    <div className="founderstory-root">
      <BackButton className="founderstory-back-button" />
      <img src="/assets/backgroundimg.png" alt="" className="founderstory-bg-img" aria-hidden="true" />

      {/* ── Prev question already-answered modal ── */}
      {prevModal.show && (
        <AlreadyAnsweredModal
          questionTitle={prevModal.questionText}
          onClose={() => setPrevModal({ show: false, questionText: "", answer: "" })}
          onReview={() => {
            // Scroll the user's attention to the answer already visible in the textarea
            // (the center panel already shows it read-only when navigated back)
            setPrevModal({ show: false, questionText: "", answer: "" });
          }}
        />
      )}

      <div className="founderstory-layout">

        {/* ── LEFT PANEL ── */}
        <aside className="founderstory-left">
          <div className="founderstory-sessions-scroll">
            {sessions.map((s, si) => {
              const isActiveSess = cursor.si === si;
              return (
                <div key={s.session_id} className={`founderstory-session-group${isActiveSess ? " is-active-group" : ""}`}>
                  <button
                    type="button"
                    className={`founderstory-session-title${isActiveSess ? " is-active" : ""}`}
                    onClick={() => handleSessionClick(si)}
                  >
                    <span className="founderstory-session-label-text">{s.label}</span>
                    <span className="founderstory-session-chevron">{isActiveSess && mobileExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isActiveSess && (
                    <div className={`founderstory-subtopic-list${mobileExpanded ? " is-mobile-open" : ""}`}>
                      {s.chapters.map((ch, ci) => (
                        <div key={ch.id} className="fsp-chapter-group">
                          <div className={`fsp-chapter-label${cursor.ci === ci ? " is-active-chapter" : ""}`}>
                            {ch.id} {ch.title}
                          </div>
                          {ch.subTopics.map((st, sti) => {
                            const fullyDone = isSubChapterFullyAnswered(si, ci, sti);
                            const isActive  = cursor.si === si && cursor.ci === ci && cursor.sti === sti;
                            return (
                              <button
                                type="button"
                                key={st.sub_session_id}
                                className={`founderstory-subtopic-btn${isActive ? " is-active" : ""}${fullyDone ? " is-done" : ""}`}
                                onClick={() => handleSubTopicSidebarClick(si, ci, sti)}
                              >
                                {st.label || `Sub-chapter ${sti + 1}`}
                                {fullyDone && <span className="founderstory-subtopic-check">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CENTER PANEL ── */}
        <main className="founderstory-center">

          {/* Breadcrumb + progress */}
          <div className="fsp-breadcrumb">
            <span className="fsp-bc-session">{session.label}</span>
            <span className="fsp-bc-sep">›</span>
            <span className="fsp-bc-chapter">{chapter.title}</span>
            <span className="fsp-bc-sep">›</span>
            <span className="fsp-bc-sub">{subChap.label}</span>
            <span className="fsp-bc-count">
              Q {(cursor.dqi) + 1} / {dbQs.length || 1}
            </span>
          </div>

          {showSubChapterDone ? (
            <div className="fsp-done-wrapper">
              <SubChapterDoneCard
                subChapterTitle={subChap.label}
                isLastOverall={isLastOverall}
                nextLabel={nextSubChapLabel}
                onNext={handleSubChapterDoneContinue}
              />
            </div>
          ) : (
            <>
              {/* Question header */}
              <div className="founderstory-question-header">
                <span className="founderstory-question-mark" aria-hidden="true">?</span>
                <div className="founderstory-question-headtext">
                  <h1 className="founderstory-question-title">
                    {chapter.id} {chapter.title}
                  </h1>
                  <p className="fsp-sub-chapter-label">{subChap.label}</p>
                  {currentQ ? (
                    <p className="fsp-single-question">{currentQ.question}</p>
                  ) : (
                    <p className="fsp-single-question" style={{ color: "#aaa", fontStyle: "italic" }}>
                      No questions in this sub-chapter yet.
                    </p>
                  )}
                  {isAlreadyAnswered && (
                    <span className="fsp-already-badge">✓ Answer submitted — view only</span>
                  )}
                </div>
              </div>

              {/* Answer box */}
              <div className="founderstory-answer-box">
                {/* Only show recording controls if question not yet answered */}
                {!isAlreadyAnswered && (
                  <div className="founderstory-voice-row">
                    <button
                      type="button"
                      className={`founderstory-mic-btn${isRecording ? " is-recording" : ""}`}
                      onClick={toggleRecording}
                      title={isRecording ? "Stop recording" : "Record audio answer"}
                    >
                      <MicIcon />
                      {isRecording && <span className="founderstory-rec-dot" />}
                    </button>
                    <button
                      type="button"
                      className="fsp-audio-upload-btn"
                      onClick={() => audioInputRef.current?.click()}
                      title="Upload audio file"
                    >
                      Upload audio
                    </button>
                    <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={handleAudioFileChange} />
                  </div>
                )}

                {/* Audio preview (only when not answered) */}
                {!isAlreadyAnswered && (recordedAudioUrl || uploadedAudio) && (
                  <div className="founderstory-audio-preview">
                    {recordedAudioUrl && (
                      <>
                        <p className="fsp-audio-label">Recorded audio</p>
                        <audio controls><source src={recordedAudioUrl} /></audio>
                        <button
                          type="button"
                          className="fsp-submit-answer-btn"
                          style={{ marginTop: 8 }}
                          disabled={isSubmitting}
                          onClick={() => { if (recordedAudio) handleSubmitAudio(recordedAudio, "recorded-answer.webm"); }}
                        >
                          {isSubmitting ? "Saving…" : "Submit Audio Answer →"}
                        </button>
                      </>
                    )}
                    {uploadedAudio && (
                      <>
                        <p className="fsp-audio-label">Uploaded: {uploadedAudio.name}</p>
                        <audio controls><source src={URL.createObjectURL(uploadedAudio)} /></audio>
                        <button
                          type="button"
                          className="fsp-submit-answer-btn"
                          style={{ marginTop: 8 }}
                          disabled={isSubmitting}
                          onClick={() => handleSubmitAudio(uploadedAudio, uploadedAudio.name)}
                        >
                          {isSubmitting ? "Saving…" : "Submit Audio Answer →"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="founderstory-answer-body">
                  <textarea
                    className="founderstory-answer-textarea"
                    placeholder={isAlreadyAnswered ? "Answer submitted — view only." : "Write your answer here…"}
                    value={answerText}
                    onChange={(e) => { if (!isAlreadyAnswered) setAnswerText(e.target.value); }}
                    disabled={isSubmitting || isAlreadyAnswered}
                    readOnly={isAlreadyAnswered}
                    style={isAlreadyAnswered ? { background: "#f9f5ef", color: "#7a6555", cursor: "default" } : {}}
                  />
                </div>

                {submitError && (
                  <p className="fsp-submit-error">{submitError}</p>
                )}
              </div>

              {/* Image upload (only when not yet answered) */}
              {!isAlreadyAnswered && (
                <div
                  className="founderstory-upload-box"
                  onClick={() => { if (!uploadedFileName && !isUploadingImage) fileInputRef.current?.click(); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !uploadedFileName) fileInputRef.current?.click(); }}
                >
                  {isUploadingImage ? (
                    <p className="founderstory-upload-label">Uploading…</p>
                  ) : uploadedFileName ? (
                    <div className="founderstory-filename-chip">
                      <FileIcon />
                      <span className="founderstory-filename-text" title={uploadedFileName}>{uploadedFileName}</span>
                      <button
                        type="button"
                        className="founderstory-upload-remove"
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                        aria-label="Remove file"
                      >×</button>
                    </div>
                  ) : (
                    <>
                      <p className="founderstory-upload-label">Any relevant<br />Image Upload !</p>
                      <UploadIcon />
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="founderstory-file-input" onChange={handleFileUpload} />
                </div>
              )}

              {/* ── Nav row: Prev Question + Submit ── */}
              <div className="founderstory-nav-row">
                {/* Prev Question button */}
                <button
                  type="button"
                  className="fsp-prev-btn"
                  onClick={handlePrevQuestion}
                  disabled={isFirstQuestion}
                  title={isFirstQuestion ? "No previous question" : "Go to previous question"}
                >
                  <ArrowLeftIcon />
                  Prev Question
                </button>
                <button
                  type="button"
                  className="fsp-next-btn"
                  onClick={handleNextQuestion}
                  disabled={isLastOverall}
                  >
                  Next Question →
                </button>
                {/* Submit button — hidden if already answered */}
                {!isAlreadyAnswered && (
                  <button
                    type="button"
                    className="fsp-submit-answer-btn"
                    onClick={handleSubmitAnswer}
                    disabled={!answerText.trim() || isSubmitting || !currentQ}
                  >
                    {isSubmitting
                      ? "Saving…"
                      : isLastInSubChap
                      ? "Submit Answer ✓"
                      : "Submit Answer →"}
                  </button>
                )}

                {/* If already answered and AI panel is not yet locked — show hint */}
                {isAlreadyAnswered && !isAiPanelLocked && aiState && (
                  <p className="fsp-answered-hint">
                    Review your answer in the AI panel →
                  </p>
                )}

                {/* If AI panel is locked (final submitted) — show next button here */}
                {isAlreadyAnswered && isAiPanelLocked && !isLastInSubChap && (
                  <button
                    type="button"
                    className="fsp-submit-answer-btn"
                    onClick={() => {
                      setFlatIndex((prev) => prev + 1);
                      setAnswerText("");
                    }}
                  >
                    Next Question →
                  </button>
                )}
              </div>
            </>
          )}
        </main>

        {/* ── RIGHT PANEL (AI) ── */}
        <aside className="founderstory-right">
          <div className="founderstory-ai-header"><AiIcon /></div>

          <div className="founderstory-ai-content">
            {aiLoading ? (
              <div className="fsp-ai-loading">
                <div className="fsp-ai-spinner" />
                <p>AI is processing your answer…</p>
              </div>
            ) : showAiAnswerSection && aiState ? (
              /* ── Answer submitted state ── */
              <div className="fsp-ai-answer-panel">
                {/* Saved indicator */}
                <div className="fsp-ai-saved-badge">
                  <span className="fsp-ai-saved-check">✓</span>
                  <span>Answer saved for:</span>
                </div>
                <p className="fsp-ai-saved-question">"{aiState.questionText}"</p>

                {/* The actual answer the user submitted */}
                <div className="fsp-ai-user-answer">
                  <p className="fsp-ai-user-answer-label">Your answer:</p>
                  <p className="fsp-ai-user-answer-text">{aiState.savedAnswer}</p>
                </div>

                {/* AI narrative */}
                <div className="fsp-ai-narrative">
                  <p>{aiState.narrative}</p>
                </div>

                {/* Generation counter */}
                {!aiState.finallySubmitted && (
                  <div className="fsp-ai-gen-counter">
                    <span className="fsp-ai-gen-label">AI modifications remaining:</span>
                    <span className={`fsp-ai-gen-dots ${aiGenerationsLeft === 0 ? "is-exhausted" : ""}`}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} className={`fsp-gen-dot ${i < aiGenerationsLeft ? "is-active" : ""}`} />
                      ))}
                    </span>
                    <span className="fsp-ai-gen-count">{aiGenerationsLeft} / 3</span>
                  </div>
                )}

                {/* Locked state — final submitted */}
                {aiState.finallySubmitted && (
                  <div className="fsp-ai-locked-badge">
                    <span>🔒</span>
                    <span>Answer finalised — moving to next question</span>
                  </div>
                )}
              </div>
            ) : (
              /* ── Default state — no answer submitted yet ── */
              <p style={{ whiteSpace: "pre-line", color: "#8a7260", fontSize: 13, lineHeight: 1.7 }}>
                {defaultAiContent}
              </p>
            )}
          </div>

          {/* ── AI input row — shown only after answer saved, before final submit ── */}
          {showAiAnswerSection && aiState && !aiState.finallySubmitted && (
            <>
              {aiGenerationsLeft > 0 ? (
                <>
                  <div className="founderstory-type-row">
                    <input
                      className="founderstory-type-input"
                      placeholder="Add context or modify the AI narrative…"
                      value={aiTypedText}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAiTypedText(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !aiRegenLoading) handleAiRegenerate(); }}
                      disabled={aiRegenLoading}
                    />
                    <button
                      type="button"
                      className="founderstory-type-send"
                      onClick={handleAiRegenerate}
                      disabled={!aiTypedText.trim() || aiRegenLoading}
                      title="Regenerate with context"
                    >
                      {aiRegenLoading ? "…" : "↺"}
                    </button>
                  </div>
                  <p className="fsp-ai-modify-hint">
                    You can modify the AI narrative up to {aiGenerationsLeft} more time{aiGenerationsLeft !== 1 ? "s" : ""}.
                  </p>
                </>
              ) : (
                <p className="fsp-ai-modify-exhausted">
                  Modification limit reached (3/3). Please submit your answer to continue.
                </p>
              )}

              {/* Final submit button in AI panel */}
              <div className="founderstory-submit-row">
                <button
                  type="button"
                  className="founderstory-submit-btn fsp-ai-final-submit"
                  onClick={handleAiFinalSubmit}
                  disabled={aiRegenLoading}
                >
                  {isLastInSubChap ? "Submit & Finish ✓" : "Submit & Next Question →"}
                </button>
              </div>
            </>
          )}

          {/* ── When AI panel is locked — just show a done message ── */}
          {showAiAnswerSection && aiState?.finallySubmitted && (
            <div className="fsp-ai-done-row">
              <p className="fsp-ai-done-text">Answer finalised ✓</p>
            </div>
          )}

          {/* ── Default state input (before any answer) — decorative only ── */}
          {!showAiAnswerSection && (
            <div className="founderstory-submit-row">
              <p className="fsp-ai-waiting-text">Submit an answer to activate AI narrative</p>
            </div>
          )}
        </aside>
      </div>

      <style>{`
        /* ── Breadcrumb ── */
        .fsp-breadcrumb {
          display: flex; align-items: center; gap: 6px;
          font-size: 11.5px; color: #a08060; margin-bottom: 14px; flex-wrap: wrap;
        }
        .fsp-bc-sep { color: #c9a97a; font-size: 13px; }
        .fsp-bc-session { font-weight: 600; color: #7a5c3a; }
        .fsp-bc-chapter { color: #8a6848; }
        .fsp-bc-sub { color: #b5814a; font-weight: 600; }
        .fsp-bc-count {
          margin-left: auto; background: #f0e6d3; color: #7a5c3a;
          border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; white-space: nowrap;
        }

        /* ── Question display ── */
        .fsp-sub-chapter-label {
          font-size: 11.5px; font-weight: 700; color: #b5814a;
          text-transform: uppercase; letter-spacing: 0.06em; margin: 4px 0 6px;
        }
        .fsp-single-question {
          font-size: 15px; color: #3a3028; line-height: 1.6; margin: 0; font-weight: 500;
        }
        .fsp-already-badge {
          display: inline-block; margin-top: 6px; background: #e8f5e9;
          color: #2e7d32; border-radius: 12px; padding: 2px 10px; font-size: 11px; font-weight: 600;
        }

        /* ── Submit answer button ── */
        .fsp-submit-answer-btn {
          background: #7a5c3a; color: #fff; border: none; border-radius: 8px;
          padding: 10px 22px; font-size: 13.5px; font-weight: 600; cursor: pointer;
          transition: background 0.18s, transform 0.1s; letter-spacing: 0.01em;
        }
        .fsp-submit-answer-btn:hover:not(:disabled) { background: #5c4228; }
        .fsp-submit-answer-btn:active:not(:disabled) { transform: scale(0.97); }
        .fsp-submit-answer-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Prev button ── */
        .fsp-prev-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent; color: #7a5c3a; border: 1.5px solid #c9a97a;
          border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .fsp-prev-btn:hover:not(:disabled) { background: #f5ede0; color: #5c3d1e; }
        .fsp-prev-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* ── Answered hint ── */
        .fsp-answered-hint {
          font-size: 12px; color: #b5814a; font-style: italic; margin: 0;
          padding: 8px 0; align-self: center;
        }

        /* ── Error ── */
        .fsp-submit-error {
          color: #c0392b; font-size: 12.5px; margin: 6px 0 0; padding: 6px 10px;
          background: #fff0ee; border-radius: 6px; border-left: 3px solid #e74c3c;
        }

        /* ── Audio upload btn ── */
        .fsp-audio-upload-btn {
          background: transparent; border: 1px solid #b5814a; color: #b5814a;
          border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer;
          transition: background 0.15s;
        }
        .fsp-audio-upload-btn:hover { background: #f5ede0; }
        .fsp-audio-label { font-size: 12px; color: #7a6555; margin-bottom: 4px; }

        /* ── Sub-chapter done card ── */
        .fsp-done-wrapper {
          display: flex; align-items: center; justify-content: center; flex: 1; padding: 40px 24px;
        }
        .fsp-done-card {
          background: #fff; border: 1.5px solid #e8d9c4; border-radius: 16px;
          padding: 40px 36px; text-align: center; max-width: 440px;
          box-shadow: 0 4px 24px rgba(181,129,74,0.10);
        }
        .fsp-done-title { font-size: 18px; font-weight: 700; color: #5c3d1e; margin: 16px 0 8px; }
        .fsp-done-desc { font-size: 13.5px; color: #7a6555; line-height: 1.6; margin-bottom: 24px; }
        .fsp-done-next-btn {
          background: #b5814a; color: #fff; border: none; border-radius: 8px;
          padding: 11px 28px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .fsp-done-next-btn:hover { background: #7a5c3a; }
        .fsp-done-final { font-size: 15px; color: #b5814a; font-weight: 600; margin-top: 8px; }

        /* ── Chapter sidebar ── */
        .fsp-chapter-group { margin-bottom: 4px; }
        .fsp-chapter-label {
          font-size: 11px; font-weight: 700; color: #a08060;
          text-transform: uppercase; letter-spacing: 0.07em; padding: 8px 12px 4px;
        }
        .fsp-chapter-label.is-active-chapter { color: #7a3a10; }

        /* ── AI right panel ── */
        .fsp-ai-loading {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 20px 0; color: #b5814a;
        }
        .fsp-ai-spinner {
          width: 28px; height: 28px; border: 3px solid #f0e6d3;
          border-top-color: #b5814a; border-radius: 50%;
          animation: fs-spin 0.7s linear infinite;
        }
        @keyframes fs-spin { to { transform: rotate(360deg); } }

        .fsp-ai-answer-panel {
          display: flex; flex-direction: column; gap: 10px; width: 100%;
        }
        .fsp-ai-saved-badge {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; color: #2e7d32;
        }
        .fsp-ai-saved-check {
          width: 18px; height: 18px; background: #e8f5e9; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; color: #2e7d32; font-weight: 800;
        }
        .fsp-ai-saved-question {
          font-size: 12.5px; color: #5c3d1e; font-weight: 600;
          font-style: italic; margin: 0; line-height: 1.5;
        }
        .fsp-ai-user-answer {
          background: #f9f5ef; border: 1px solid #e8d9c4; border-radius: 8px;
          padding: 10px 12px;
        }
        .fsp-ai-user-answer-label {
          font-size: 10.5px; font-weight: 700; color: #b5814a;
          text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px;
        }
        .fsp-ai-user-answer-text {
          font-size: 12.5px; color: #3a3028; line-height: 1.6; margin: 0;
          max-height: 100px; overflow-y: auto;
        }
        .fsp-ai-narrative {
          background: #fff8f0; border-left: 3px solid #b5814a; border-radius: 0 8px 8px 0;
          padding: 10px 12px; font-size: 12.5px; color: #5c3d1e; line-height: 1.7;
        }
        .fsp-ai-narrative p { margin: 0; }

        /* ── Generation counter ── */
        .fsp-ai-gen-counter {
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; color: #8a7260; padding: 6px 0;
        }
        .fsp-ai-gen-label { font-weight: 600; }
        .fsp-ai-gen-dots { display: flex; gap: 4px; }
        .fsp-gen-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #e0d0bc; transition: background 0.2s;
        }
        .fsp-gen-dot.is-active { background: #b5814a; }
        .fsp-ai-gen-count { font-weight: 700; color: #7a5c3a; }
        .fsp-ai-gen-counter.is-exhausted .fsp-ai-gen-label { color: #c0392b; }

        /* ── Locked / finalised ── */
        .fsp-ai-locked-badge {
          display: flex; align-items: center; gap: 6px;
          background: #f0e6d3; border-radius: 8px; padding: 8px 12px;
          font-size: 12px; font-weight: 600; color: #7a5c3a;
        }
        .fsp-ai-done-row {
          padding: 12px 0; border-top: 1px solid #f0e6d3; margin-top: 4px;
        }
        .fsp-ai-done-text {
          font-size: 12.5px; font-weight: 700; color: #2e7d32;
          text-align: center; margin: 0;
        }

        /* ── Modify hint ── */
        .fsp-ai-modify-hint {
          font-size: 11px; color: #a08060; text-align: center; margin: 4px 0 0;
          font-style: italic;
        }
        .fsp-ai-modify-exhausted {
          font-size: 11.5px; color: #c0392b; text-align: center;
          background: #fff0ee; border-radius: 8px; padding: 8px 12px; margin: 4px 0;
        }

        /* ── AI final submit ── */
        .fsp-ai-final-submit {
          width: 100%; background: #b5814a !important; font-size: 13px !important;
          padding: 11px 16px !important;
        }
        .fsp-ai-final-submit:hover:not(:disabled) { background: #7a5c3a !important; }

        /* ── Waiting text ── */
        .fsp-ai-waiting-text {
          font-size: 11.5px; color: #b5a090; text-align: center;
          font-style: italic; margin: 0; padding: 8px 0;
        }


      `}</style>
    </div>
  );
}
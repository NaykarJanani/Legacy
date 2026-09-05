import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { useLoader } from "../../../context/LoaderContext";
import BackButton from "../../../components/BackButton";
import "./EditorChapterpage.css";

// ─── Types matching GET /customer/:user_id/chapters ────────────────────────
interface QuestionItem {
  question_id: number;
  question: string;
  seq: number;
  question_type?: string;
}

interface SubChapter {
  sub_session_id: number;
  title: string;
  full_title: string;
  seq: number;
  question_count: number;
  questions: QuestionItem[];
}

interface Chapter {
  title: string;
  subChapters: SubChapter[];
}

interface SessionBlock {
  session_id: number;
  title: string;
  subtitle?: string;
  category?: string;
  seq?: number;
  chapters: Chapter[];
}

// Flattened chapter that remembers which session it came from,
// so the right-hand panel can show "SESSION · <title>" above the questions.
interface FlatChapter extends Chapter {
  sessionTitle: string;
  sessionCategory?: string;
}

export default function EditorChapterpage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showLoader, hideLoader } = useLoader();

  // Passed in from Editorcardinnerpage.tsx: navigate(path, { state: { customerId, project, summary } })
  const customerId = (location.state as any)?.customerId ?? (location.state as any)?.project?.id;

  const [chapters, setChapters] = useState<FlatChapter[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedChapter, setSelectedChapter] = useState<FlatChapter | null>(null);
  const [selectedSubChapter, setSelectedSubChapter] = useState<SubChapter | null>(null);

  useEffect(() => {
    const getData = async () => {
      if (!customerId) {
        toast.error("No project selected");
        navigate(-1);
        return;
      }

      try {
        setLoading(true);
        showLoader();

        const res = await api.get(`/customer/${customerId}/chapters`);

        if (res.data.success) {
          const sessions: SessionBlock[] = res.data.data || [];

          const flat: FlatChapter[] = sessions.flatMap((s) =>
            (s.chapters || []).map((c) => ({
              ...c,
              sessionTitle: s.title,
              sessionCategory: s.category,
            }))
          );

          setChapters(flat);
          setSelectedChapter(flat[0] ?? null);
          setSelectedSubChapter(flat[0]?.subChapters[0] ?? null);
        } else {
          toast.error(res?.data?.message || "Failed to fetch chapters");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Something went wrong");
      } finally {
        setLoading(false);
        hideLoader();
      }
    };

    getData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleChapterClick = (chapter: FlatChapter) => {
    setSelectedChapter(chapter);
    setSelectedSubChapter(chapter.subChapters[0] ?? null);
  };

  const panelCategory = chapters[0]?.sessionCategory || "";

  return (
    <div className="editordashboard-container">
      <BackButton />
      <div className="editor-page">
        {/* LEFT PANEL — CHAPTERS */}
        <div className="chapter-panel">
          <div className="panel-title">
            {panelCategory ? `CATEGORY · ${panelCategory.toUpperCase()}` : "CHAPTERS"}
          </div>

          <div className="chapter-list">
            {!loading && chapters.length === 0 && (
              <div className="empty-message">No chapters available.</div>
            )}

            {chapters.map((chapter, idx) => (
              <div
                key={`${chapter.sessionTitle}-${chapter.title}-${idx}`}
                className={`chapter-card ${
                  selectedChapter?.title === chapter.title &&
                  selectedChapter?.sessionTitle === chapter.sessionTitle
                    ? "active"
                    : ""
                }`}
                onClick={() => handleChapterClick(chapter)}
              >
                <div className="chapter-title">{chapter.title}</div>
                <div className="chapter-count">
                  {chapter.subChapters.length} sub chapters
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE PANEL — SUB CHAPTERS */}
        <div className="subchapter-panel">
          <div className="panel-title">SUB CHAPTERS</div>

          <div className="subchapter-list">
            {selectedChapter && selectedChapter.subChapters.length === 0 && (
              <div className="empty-message">No sub chapters available.</div>
            )}

            {selectedChapter?.subChapters.map((sub) => (
              <div
                key={sub.sub_session_id}
                className={`subchapter-card ${
                  selectedSubChapter?.sub_session_id === sub.sub_session_id
                    ? "active"
                    : ""
                }`}
                onClick={() => setSelectedSubChapter(sub)}
              >
                <div className="subchapter-title">{sub.title}</div>
                <div className="subchapter-count">
                  {sub.questions.length} questions
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — QUESTIONS */}
        <div className="question-panel">
          {selectedSubChapter && selectedChapter ? (
            <>
              <div className="session-title">
                SESSION · {selectedChapter.sessionTitle.toUpperCase()}
              </div>

              <h2 className="question-heading">{selectedSubChapter.title}</h2>

              <div className="question-list">
                {selectedSubChapter.questions.length === 0 && (
                  <div className="empty-message">No questions available.</div>
                )}

                {selectedSubChapter.questions.map((q) => (
                  <div
                    key={q.question_id}
                    className="question-item"
                    onClick={() =>
                      navigate("/editor/EditorAIgeneratetext", {
                        state: {
                          customerId,
                          session: selectedChapter.sessionTitle,
                          chapter: selectedChapter.title,
                          subChapter: selectedSubChapter.title,
                          subSessionId: selectedSubChapter.sub_session_id,
                          questionId: q.question_id,
                          question: q.question,
                        },
                      })
                    }
                  >
                    <span>{q.question}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-message">
              {loading ? "Loading..." : "Select a Sub Chapter"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
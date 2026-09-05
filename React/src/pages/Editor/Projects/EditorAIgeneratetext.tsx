// EditorAIgeneratetext.tsx

import React, { useEffect, useState } from "react";
import "./EditorAIgeneratetext.css";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { useLoader } from "../../../context/LoaderContext";
import BackButton from "../../../components/BackButton";

// ─── Types ───────────────────────────────────────────────────────────────
interface QuestionRef {
  question_id: number;
  question: string;
  seq: number;
}

interface SubChapterNav {
  sub_session_id: number;
  title: string;
  questions: QuestionRef[];
}

interface ChapterNav {
  title: string;
  subChapters: SubChapterNav[];
}

interface QuestionAnswer {
  question_id: number;
  question: string;
  session_title: string;
  sub_session_id: number;
  chapter_title: string;
  sub_chapter_title: string;
  customer_answer_id: number | null;
  answer: string | null;       // original submitted response
  ai_narrative: string | null; // AI-generated response
  is_approved: boolean;
}

// What EditorChapterpage passes via navigate(..., { state: {...} })
interface IncomingState {
  customerId: number;
  session?: string;
  chapter?: string;
  subChapter?: string;
  subSessionId?: number;
  questionId?: number;
  question?: string;
}

const EditorAIgeneratetext: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showLoader, hideLoader } = useLoader();

  const incoming = (location.state as IncomingState) || {};
  const customerId = incoming.customerId;

  // ALL chapters (not just the one we arrived from) — needed so "Proceed"
  // can walk past the end of one chapter into the next one.
  const [chapters, setChapters] = useState<ChapterNav[]>([]);

  // Position = which chapter, which sub-chapter within it, which question within that
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activeSubChapterIndex, setActiveSubChapterIndex] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const [answerData, setAnswerData] = useState<QuestionAnswer | null>(null);
  const [aiDraft, setAiDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingAnswer, setLoadingAnswer] = useState(true);

  const activeChapter = chapters[activeChapterIndex];
  const activeSubChapter = activeChapter?.subChapters[activeSubChapterIndex];
  const activeQuestion = activeSubChapter?.questions[activeQuestionIndex];

  // ── Load every chapter → sub-chapter → question for this customer ───────
  useEffect(() => {
    const getChapters = async () => {
      if (!customerId) {
        toast.error("No project selected");
        navigate(-1);
        return;
      }
      try {
        setLoadingList(true);
        const res = await api.get(`/customer/${customerId}/chapters`);

        if (res.data.success) {
          const sessions = res.data.data || [];
          const allChapters: ChapterNav[] = sessions.flatMap((s: any) =>
            (s.chapters || []).map((c: any) => ({
              title: c.title,
              subChapters: (c.subChapters || []).map((sc: any) => ({
                sub_session_id: sc.sub_session_id,
                title: sc.title,
                questions: sc.questions || [],
              })),
            }))
          );
          setChapters(allChapters);

          // Land on exactly the chapter → sub-chapter → question that was
          // clicked in EditorChapterpage.
          const chapIdx = Math.max(
            0,
            allChapters.findIndex((c) => c.title === incoming.chapter)
          );
          const subIdx = Math.max(
            0,
            allChapters[chapIdx]?.subChapters.findIndex(
              (s) => s.sub_session_id === incoming.subSessionId
            ) ?? 0
          );
          const qIdx = Math.max(
            0,
            allChapters[chapIdx]?.subChapters[subIdx]?.questions.findIndex(
              (q) => q.question_id === incoming.questionId
            ) ?? 0
          );

          setActiveChapterIndex(chapIdx);
          setActiveSubChapterIndex(subIdx);
          setActiveQuestionIndex(qIdx);
        } else {
          toast.error(res?.data?.message || "Failed to fetch chapters");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Something went wrong");
      } finally {
        setLoadingList(false);
      }
    };

    getChapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // ── Load the original + AI answer for whichever question is active ──────
  useEffect(() => {
    const getAnswer = async () => {
      if (!customerId || !activeQuestion) return;

      try {
        setLoadingAnswer(true);
        showLoader();
        const res = await api.get(
          `/customer/${customerId}/question/${activeQuestion.question_id}/answer`
        );

        if (res.data.success) {
          setAnswerData(res.data.data);
          setAiDraft(res.data.data.ai_narrative || "");
        } else {
          toast.error(res?.data?.message || "Failed to fetch answer");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Something went wrong");
      } finally {
        setLoadingAnswer(false);
        hideLoader();
      }
    };

    getAnswer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, activeQuestion?.question_id]);

  const handleSubChapterClick = (index: number) => {
    setActiveSubChapterIndex(index);
    setActiveQuestionIndex(0);
  };

  // Walk QUESTIONS → then SUB-CHAPTERS → then CHAPTERS, in that order.
  // Only hits BookLayoutPage once every chapter is exhausted.
  const handleProceed = () => {
    const questionsInSub = activeSubChapter?.questions.length ?? 0;
    if (activeQuestionIndex + 1 < questionsInSub) {
      setActiveQuestionIndex(activeQuestionIndex + 1);
      return;
    }

    const subsInChapter = activeChapter?.subChapters.length ?? 0;
    if (activeSubChapterIndex + 1 < subsInChapter) {
      setActiveSubChapterIndex(activeSubChapterIndex + 1);
      setActiveQuestionIndex(0);
      return;
    }

    if (activeChapterIndex + 1 < chapters.length) {
      setActiveChapterIndex(activeChapterIndex + 1);
      setActiveSubChapterIndex(0);
      setActiveQuestionIndex(0);
      return;
    }

    navigate("/editor/BookLayoutPage");
  };

  const proceedLabel = (() => {
    const questionsInSub = activeSubChapter?.questions.length ?? 0;
    if (activeQuestionIndex + 1 < questionsInSub) {
      return "Proceed to next question";
    }
    const nextSub = activeChapter?.subChapters[activeSubChapterIndex + 1];
    if (nextSub) return `Proceed for ${nextSub.title}`;
    const nextChapter = chapters[activeChapterIndex + 1];
    return nextChapter ? `Proceed to ${nextChapter.title}` : "Further Proceed";
  })();

  return (
    <div className="editoraigeneratetext-wrapper editordashboard-container">
      <BackButton />
      <div className="editoraigeneratetext-container">
        {/* Left Section — SUB CHAPTERS of the current chapter */}
        <div className="editoraigeneratetext-left">
          <h2 className="editoraigeneratetext-heading">
            {activeChapter?.title || "Sub Chapters"}
          </h2>

          <div className="editoraigeneratetext-lessonslist">
            {!loadingList && (activeChapter?.subChapters.length ?? 0) === 0 && (
              <div>No sub chapters available.</div>
            )}

            {activeChapter?.subChapters.map((sub, index) => (
              <button
                key={sub.sub_session_id}
                onClick={() => handleSubChapterClick(index)}
                className={`editoraigeneratetext-lessonbtn ${
                  activeSubChapterIndex === index
                    ? "editoraigeneratetext-lessonactive"
                    : ""
                }`}
              >
                {sub.title}
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    opacity: 0.7,
                    marginTop: 2,
                  }}
                >
                  {sub.questions.length} question
                  {sub.questions.length === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Section */}
        <div className="editoraigeneratetext-right">
          <div className="editoraigeneratetext-scrollcontent">
            {loadingAnswer || !answerData ? (
              <div className="editoraigeneratetext-section">
                {loadingAnswer ? "Loading..." : "Select a sub chapter question."}
              </div>
            ) : (
              <>
                {/* Breadcrumb — which chapter / sub-chapter / question # this is */}
                <div className="editoraigeneratetext-section" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#8d6d40", letterSpacing: 1 }}>
                    CHAPTER {activeChapterIndex + 1} OF {chapters.length} ·{" "}
                    {activeChapter?.title.toUpperCase()} &nbsp;›&nbsp;{" "}
                    {activeSubChapter?.title.toUpperCase()} &nbsp;·&nbsp; QUESTION{" "}
                    {activeQuestionIndex + 1} OF {activeSubChapter?.questions.length ?? 0}
                  </div>
                  <h4 style={{ marginTop: 6 }}>{answerData.question}</h4>
                </div>

                {/* Submitted Response — customer's original answer */}
                <div className="editoraigeneratetext-section">
                  <h2 className="editoraigeneratetext-title">
                    Submitted response
                  </h2>

                  <p>
                    {answerData.answer && answerData.answer.trim() !== ""
                      ? answerData.answer
                      : "No response submitted yet."}
                  </p>
                </div>

                {/* AI Response — editable draft, seeded from ai_req_res.json_data.narrative */}
                <div className="editoraigeneratetext-section">
                  <h2 className="editoraigeneratetext-title">
                    System-generated response
                  </h2>

                  <div className="editoraigeneratetext-editorwrapper">
                    <textarea
                      className="editoraigeneratetext-editor"
                      value={aiDraft}
                      placeholder="No AI-generated response yet for this question."
                      onChange={(e) => setAiDraft(e.target.value)}
                    />

                    <span className="editoraigeneratetext-placeholder">
                      Want to Do editing click
                    </span>
                  </div>

                  <div className="editoraigeneratetext-btnwrap">
                    <button
                      className="editoraigeneratetext-generatebtn"
                      onClick={handleProceed}
                    >
                      {proceedLabel}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorAIgeneratetext;
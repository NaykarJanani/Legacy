import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { PageFlip } from "page-flip";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import "./UserFlipbookPage.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface FlipbookData {
  title: string;
  pdf_url: string;
  pdf_file_name?: string;
}

interface NoteMap {
  [pageNumber: number]: string;
}

const UserFlipbookPage: React.FC = () => {
  const navigate = useNavigate();

  const flipBookRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const isInitialized = useRef(false);

  const [book, setBook] = useState<FlipbookData | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // page_number (1-indexed) -> note text
  const [notes, setNotes] = useState<NoteMap>({});
  const [drafts, setDrafts] = useState<NoteMap>({});
  const [savingPage, setSavingPage] = useState<number | null>(null);
  const [requestingPublish, setRequestingPublish] = useState(false);

  // ── Load the approved flipbook + existing notes ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        const [bookRes, notesRes] = await Promise.all([
          api.get("/flipbook"),
          api.get("/flipbook-notes"),
        ]);

        if (cancelled) return;

        if (!bookRes.data.success || !bookRes.data.data) {
          setBook(null);
          setLoading(false);
          return;
        }

        const bookData: FlipbookData = bookRes.data.data;
        setBook(bookData);

        const noteMap: NoteMap = {};
        (notesRes.data.data || []).forEach((n: any) => {
          noteMap[n.page_number] = n.note_text;
        });
        setNotes(noteMap);

        // Render the PDF into page images for page-flip.
        // Some PDFs export each "page" as a left+right spread combined into
        // one wide page — split those into two separate flip-book leaves so
        // the page count matches the real book, not the PDF's file layout.
        const pdf = await pdfjsLib.getDocument({ url: bookData.pdf_url }).promise;
        if (cancelled) return;

        const pageImages: string[] = [];
        const SPREAD_ASPECT_RATIO = 1.15; // width/height above this = spread (landscape-ish)

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;

          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
          }).promise;

          const isSpread = canvas.width / canvas.height > SPREAD_ASPECT_RATIO;

          if (isSpread) {
            const halfWidth = canvas.width / 2;

            const leftCanvas = document.createElement("canvas");
            leftCanvas.width = halfWidth;
            leftCanvas.height = canvas.height;
            leftCanvas
              .getContext("2d")!
              .drawImage(canvas, 0, 0, halfWidth, canvas.height, 0, 0, halfWidth, canvas.height);

            const rightCanvas = document.createElement("canvas");
            rightCanvas.width = halfWidth;
            rightCanvas.height = canvas.height;
            rightCanvas
              .getContext("2d")!
              .drawImage(canvas, halfWidth, 0, halfWidth, canvas.height, 0, 0, halfWidth, canvas.height);

            pageImages.push(leftCanvas.toDataURL("image/jpeg", 0.85));
            pageImages.push(rightCanvas.toDataURL("image/jpeg", 0.85));
          } else {
            pageImages.push(canvas.toDataURL("image/jpeg", 0.85));
          }
        }

        setTotalPages(pageImages.length);
        if (!cancelled) setPages(pageImages);
      } catch (err: any) {
        if (!cancelled) toast.error(err.response?.data?.message || "Failed to load flipbook");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Initialize page-flip once page images are ready ──────────────────────
  useEffect(() => {
    if (pages.length === 0 || !flipBookRef.current) return;
    if (isInitialized.current) return;
    isInitialized.current = true;

    const pageFlip = new PageFlip(flipBookRef.current, {
      width: 550,
      height: 733,
      size: "stretch",
      minWidth: 315,
      maxWidth: 1000,
      minHeight: 420,
      maxHeight: 1350,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: false,
      autoSize: true,
    });

    pageFlip.loadFromImages(pages);

    pageFlip.on("flip", (e: any) => {
      setCurrentPage(e.data);
    });

    pageFlipRef.current = pageFlip;

    return () => {
      isInitialized.current = false;
      pageFlip.destroy();
      pageFlipRef.current = null;
    };
  }, [pages]);

  // Which page numbers are visible right now (1-indexed).
  // page-flip shows page 1 alone as a cover, then pairs pages 2&3, 4&5, ...
  // together as a spread — so whichever page we land on, its partner
  // (the other half of the spread) is the next one, unless it's the very
  // first page or there's no next page left.
  const leftPageNum = currentPage + 1;
  const hasPartner = currentPage > 0 && currentPage + 1 < totalPages;
  const rightPageNum = hasPartner ? currentPage + 2 : null;
  const visiblePageNums = rightPageNum ? [leftPageNum, rightPageNum] : [leftPageNum];

  // Seed drafts for any newly-visible page that doesn't have a draft yet
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      visiblePageNums.forEach((pageNum) => {
        if (!(pageNum in next)) {
          next[pageNum] = notes[pageNum] || "";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, notes]);

  const handlePrev = useCallback(() => {
    pageFlipRef.current?.flipPrev();
  }, []);

  const handleNext = useCallback(() => {
    pageFlipRef.current?.flipNext();
  }, []);

  const handleSaveNote = useCallback(
    async (pageNumber: number) => {
      try {
        setSavingPage(pageNumber);
        const res = await api.post("/flipbook-notes", {
          page_number: pageNumber,
          note_text: drafts[pageNumber] || "",
        });
        if (res.data.success) {
          setNotes((prev) => ({ ...prev, [pageNumber]: drafts[pageNumber] || "" }));
          toast.success(`Note saved for page ${pageNumber}`);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to save note");
      } finally {
        setSavingPage(null);
      }
    },
    [drafts]
  );

  // ── Download the approved PDF as-is ───────────────────────────────────────
  const handleDownloadPdf = useCallback(() => {
    if (!book) return;
    const a = document.createElement("a");
    a.href = book.pdf_url;
    a.download = book.pdf_file_name || "flipbook.pdf";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();

    // Downloading counts as approving the book — let the backend know so
    // the editor's project list moves this to "Approved".
    api.post("/flipbook/mark-downloaded", {}).catch(() => {
      // Non-critical — don't interrupt the download over this.
    });
  }, [book]);

  // ── Tell the assigned editor(s) the customer wants this book published ───
  const handleRequestPublish = useCallback(async () => {
    try {
      setRequestingPublish(true);
      const res = await api.post("/flipbook/request-publish", {});
      if (res.data.success) {
        toast.success("Your editor has been notified!");
      } else {
        toast.error(res.data.message || "Failed to send request");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send request");
    } finally {
      setRequestingPublish(false);
    }
  }, []);

  // ── Empty / loading states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ufb-container">
        <div className="ufb-loading">Loading your flipbook…</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="ufb-container">
        <div className="ufb-empty">
          <div className="ufb-empty-icon">📖</div>
          <h2>Your flipbook isn't ready yet</h2>
          <p>Your editor hasn't published a book for you to view yet. Check back soon!</p>
          <button className="ufb-back-btn" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ufb-container">
      <BackButton />
      <div className="ufb-header-row">
        <h1 className="ufb-title">{book.title}</h1>
        <div className="ufb-header-actions">
          <button className="ufb-action-btn ufb-action-btn--outline" onClick={handleDownloadPdf}>
            ⬇ Download PDF
          </button>
          <button
            className="ufb-action-btn ufb-action-btn--filled"
            onClick={handleRequestPublish}
            disabled={requestingPublish}
          >
            {requestingPublish ? "Sending…" : "✓ Publish Book"}
          </button>
        </div>
      </div>

      <div className="ufb-layout">
        {/* ── Flipbook ── */}
        <div className="ufb-book-column">
          {pages.length === 0 ? (
            <div className="ufb-loading">Rendering pages…</div>
          ) : (
            <>
              <div className="ufb-flipbook-wrapper">
                <div ref={flipBookRef} />
              </div>
              <div className="ufb-controls">
                <button onClick={handlePrev} disabled={currentPage === 0}>
                  ← Prev
                </button>
                <span>
                  Page {currentPage + 1} / {totalPages}
                </span>
                <button onClick={handleNext} disabled={currentPage >= totalPages - 1}>
                  Next →
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Notes panel(s) — one per currently visible page ── */}
        <div className="ufb-notes-column">
          {visiblePageNums.map((pageNum) => (
            <div key={pageNum} className="ufb-notes-block">
              <h3 className="ufb-notes-title">Notes for page {pageNum}</h3>
              <textarea
                className="ufb-notes-textarea"
                placeholder="Write your thoughts, memories, or corrections for this page…"
                value={drafts[pageNum] || ""}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [pageNum]: e.target.value }))
                }
                rows={visiblePageNums.length > 1 ? 8 : 12}
              />
              <button
                className="ufb-notes-save-btn"
                onClick={() => handleSaveNote(pageNum)}
                disabled={savingPage === pageNum}
              >
                {savingPage === pageNum ? "Saving…" : "Save Note"}
              </button>
            </div>
          ))}
          <p className="ufb-notes-hint">
            Your editor can see these notes while reviewing your book.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserFlipbookPage;

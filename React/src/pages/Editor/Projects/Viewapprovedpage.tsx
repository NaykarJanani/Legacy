import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import "./Viewapprovedpage.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface FlipbookNote {
  page_number: number;
  note_text: string;
  updated_at: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const ViewApprovedPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Passed from Editorcardinnerpage.tsx as { customerId, project, summary }
  const customerId = (location.state as any)?.customerId;
  const projectFromState = (location.state as any)?.project;

  // Local (not-yet-saved) file preview
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // What's actually saved on the backend for this customer
  const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Workflow timestamps from approved_flipbooks — drive the Ready-To-Publish action
  const [customerApprovedAt, setCustomerApprovedAt] = useState<string | null>(null);
  const [readyAt, setReadyAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [markingReady, setMarkingReady] = useState(false);

  // Customer's notes, written on the user side flipbook
  const [notes, setNotes] = useState<FlipbookNote[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing flipbook + notes for this customer ─────────────────────
  const fetchFlipbook = useCallback(async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const res = await api.get(`/customer/${customerId}/flipbook`);
      if (res.data.success && res.data.data) {
        setSavedPdfUrl(res.data.data.pdf_url);
        setSavedFileName(res.data.data.pdf_file_name);
        setCustomerApprovedAt(res.data.data.customer_approved_at || null);
        setReadyAt(res.data.data.ready_at || null);
        setPublishedAt(res.data.data.published_at || null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load flipbook");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const fetchNotes = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await api.get(`/customer/${customerId}/flipbook-notes`);
      if (res.data.success) setNotes(res.data.data || []);
    } catch (err: any) {
      // notes are secondary — don't block the page on failure
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      toast.error("No project selected");
      navigate(-1);
      return;
    }
    fetchFlipbook();
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // ── Local file selection (preview only, before upload) ───────────────────
  const handleFile = useCallback(
    (file: File | null | undefined): void => {
      if (!file || file.type !== "application/pdf") {
        if (file) toast.error("Please choose a PDF file");
        return;
      }
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfFile(file);
      setPdfUrl(URL.createObjectURL(file));
    },
    [pdfUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragOver(true);
    },
    []
  );

  const handleDragLeave = useCallback((): void => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      handleFile(e.target.files?.[0]);
    },
    [handleFile]
  );

  const openFilePicker = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const handleChooseBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      openFilePicker();
    },
    [openFilePicker]
  );

  const handleDropzoneKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Enter" || e.key === " ") openFilePicker();
    },
    [openFilePicker]
  );

  // ── Upload PDF directly to the backend (local-disk, no AWS needed) →
  //    this is what the user side flipbook page will actually render.
  //    Once real AWS credentials are configured, swap this back to the
  //    presigned-URL flow (upload-url + PUT to S3 + PUT /flipbook).
  const handlePublish = useCallback(async () => {
    if (!pdfFile || !customerId) return;
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("title", projectFromState?.title || "My Legacy Book");

      const saveRes = await api.post(
        `/customer/${customerId}/flipbook/upload-local`,
        formData,
        { headers: { "Content-Type": undefined } } // let the browser set multipart boundary
      );

      if (saveRes.data.success) {
        toast.success("Published — the customer can now view it as a flipbook");
        setPdfFile(null);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        fetchFlipbook();
      } else {
        toast.error(saveRes.data.message || "Failed to publish");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to publish flipbook");
    } finally {
      setUploading(false);
    }
  }, [pdfFile, pdfUrl, customerId, projectFromState, fetchFlipbook]);

  // ── Mark the customer-approved book as Ready To Publish (hands off to admin) ──
  const handleMarkReady = useCallback(async () => {
    if (!customerId) return;
    try {
      setMarkingReady(true);
      const res = await api.put(`/customer/${customerId}/flipbook/ready`, {});
      if (res.data.success) {
        toast.success("Marked Ready To Publish — admin can now publish it");
        setReadyAt(res.data.data?.ready_at || new Date().toISOString());
      } else {
        toast.error(res.data.message || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setMarkingReady(false);
    }
  }, [customerId]);

  // Which PDF are we currently showing: an unsaved local pick, or the saved one
  const displayUrl = pdfUrl || savedPdfUrl;
  const displayName = pdfFile ? pdfFile.name : savedFileName;

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPdf = useCallback((): void => {
    if (!displayUrl) return;
    const a = document.createElement("a");
    a.href = displayUrl;
    a.download = displayName || "flipbook.pdf";
    a.click();
  }, [displayUrl, displayName]);

  // ── Open PDF in New Tab (fullscreen) ─────────────────────────────────────
  const handleOpenNewTab = useCallback((): void => {
    if (!displayUrl) return;
    window.open(displayUrl, "_blank", "noopener,noreferrer");
  }, [displayUrl]);

  return (
    <div className="vap-root editordashboard-container">
      {/* ── Header ── */}
      <header className="vap-header">
        <div className="vap-header-left">
          <BackButton className="vap-back-button" />
          <span className="vap-header-title">📋 Verification Stage</span>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="vap-layout">
        {/* ── LEFT: PDF Viewer ── */}
        <div className="vap-pdf-panel">
          {/* Mac-style toolbar */}
          <div className="vap-pdf-toolbar">
            <span className="vap-pdf-dot vap-pdf-dot-r" />
            <span className="vap-pdf-dot vap-pdf-dot-y" />
            <span className="vap-pdf-dot vap-pdf-dot-g" />
            <span className="vap-pdf-name">
              {displayName || "No PDF loaded"}
            </span>

            {/* PDF action buttons — only shown when a PDF is loaded */}
            {displayUrl && (
              <div className="vap-toolbar-actions">
                <button
                  type="button"
                  className="vap-toolbar-btn vap-toolbar-btn--icon"
                  onClick={handleOpenNewTab}
                  title="Open in new tab (fullscreen)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  New Tab
                </button>

                <button
                  type="button"
                  className="vap-toolbar-btn vap-toolbar-btn--icon"
                  onClick={handleDownloadPdf}
                  title="Download PDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </button>
              </div>
            )}

            <button
              type="button"
              className="vap-upload-btn"
              onClick={openFilePicker}
            >
              {displayName ? "Change PDF" : "Upload PDF"}
            </button>

            {pdfFile && (
              <button
                type="button"
                className="vap-upload-btn"
                onClick={handlePublish}
                disabled={uploading}
                style={{ background: "#3D9970", marginLeft: 6 }}
              >
                {uploading ? "Publishing…" : "Publish to Flipbook"}
              </button>
            )}

            {/* ── Ready-To-Publish handoff — only relevant once the customer has
                approved the saved book, and only while there's no unsaved local
                pick pending (that should be published first). ── */}
            {!pdfFile && savedPdfUrl && (
              publishedAt ? (
                <span className="vap-status-pill vap-status-pill--published">
                  ✅ Published
                </span>
              ) : readyAt ? (
                <span className="vap-status-pill vap-status-pill--ready">
                  📗 Ready To Publish
                </span>
              ) : customerApprovedAt ? (
                <button
                  type="button"
                  className="vap-upload-btn"
                  onClick={handleMarkReady}
                  disabled={markingReady}
                  style={{ background: "#2563eb", marginLeft: 6 }}
                  title="Confirm this final PDF is checked and ready for admin to publish"
                >
                  {markingReady ? "Marking…" : "Mark Ready To Publish"}
                </button>
              ) : (
                <span className="vap-status-pill vap-status-pill--waiting">
                  ⏳ Awaiting customer approval
                </span>
              )
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={handleInputChange}
          />

          {/* PDF frame or drop zone */}
          {loading ? (
            <div className="vap-dropzone">
              <div className="vap-dropzone-title">Loading…</div>
            </div>
          ) : displayUrl !== null ? (
            <div className="vap-pdf-frame">
              <iframe
                className="vap-pdf-iframe"
                src={`${displayUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                title="PDF Viewer"
              />
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              className={`vap-dropzone${dragOver ? " vap-drag-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFilePicker}
              onKeyDown={handleDropzoneKeyDown}
            >
              <div className="vap-dropzone-icon">📄</div>
              <div className="vap-dropzone-title">Drop your PDF here</div>
              <div className="vap-dropzone-hint">
                Supports multi-page PDFs with full scroll
              </div>
              <button
                type="button"
                className="vap-choose-btn"
                onClick={handleChooseBtnClick}
              >
                Choose PDF
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Customer notes, per page ── */}
        <div className="vap-right-panel">
          <div className="vap-text-card">
            <div className="vap-stage-title" style={{ textAlign: "left", marginBottom: 8 }}>
              📝 Customer Notes
            </div>

            {notes.length === 0 ? (
              <p className="vap-para" style={{ color: "var(--vap-muted)" }}>
                No notes yet. Once the customer opens their flipbook and adds
                notes on a page, they'll show up here.
              </p>
            ) : (
              notes.map((note, i) => (
                <React.Fragment key={note.page_number}>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Segoe UI', sans-serif",
                        fontSize: ".72rem",
                        fontWeight: 700,
                        color: "var(--vap-brown)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      Page {note.page_number}
                    </div>
                    <p className="vap-para">{note.note_text || "(empty note)"}</p>
                  </div>
                  {i < notes.length - 1 && <hr className="vap-divider" />}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewApprovedPage;
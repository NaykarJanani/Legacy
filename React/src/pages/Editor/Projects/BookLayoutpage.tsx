import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import "./BookLayoutpage.css";
import type { ChangeEvent, DragEvent, MouseEvent } from "react";
// ─── Types ────────────────────────────────────────────────────────────────────

type BoxType = "text" | "image";
type AlignType = "left" | "center" | "right";
type ObjectFitType = "cover" | "contain" | "fill" | "none";
type PageSide = "left" | "right";

interface Box {
  id: string;
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: AlignType;
  fillColor: string;
  borderColor: string;
  borderRadius: number;
  borderWidth: number;
  imgSrc: string | null;
  objectFit: ObjectFitType;
  zIndex: number;
}

interface PageData {
  id: string;
  left: Box[];
  right: Box[];
}

interface ContentSection {
  id: string;
  label: string;
  type: BoxType;
  preview: string;
  overrides: Partial<Box>;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

const uid = (): string => Math.random().toString(36).slice(2, 9);

const DEFAULT_BOX: Omit<Box, "id"> = {
  type: "text",
  x: 60,
  y: 60,
  w: 200,
  h: 100,
  content: "Text box",
  fontSize: 16,
  bold: false,
  italic: false,
  align: "left",
  fillColor: "#ffffff",
  borderColor: "#cccccc",
  borderRadius: 4,
  borderWidth: 1,
  imgSrc: null,
  objectFit: "cover",
  zIndex: 1,
};

// ─── Content Section Presets ─────────────────────────────────────────────────
// Ready-made content blocks the user can drag from the bottom shelf onto a page.

const CONTENT_SECTIONS: ContentSection[] = [
  {
    id: "chapter-title",
    label: "Chapter Title",
    type: "text",
    preview: "Aa",
    overrides: {
      content: "Chapter One",
      fontSize: 32,
      bold: true,
      align: "center",
      w: 300,
      h: 80,
      fillColor: "#ffffff",
      borderWidth: 0,
    },
  },
  {
    id: "heading",
    label: "Heading",
    type: "text",
    preview: "Aa",
    overrides: {
      content: "Section Heading",
      fontSize: 22,
      bold: true,
      align: "left",
      w: 260,
      h: 50,
      fillColor: "#ffffff",
      borderWidth: 0,
    },
  },
  {
    id: "paragraph",
    label: "Paragraph",
    type: "text",
    preview: "¶",
    overrides: {
      content: "Type your paragraph text here. Click to start writing your story.",
      fontSize: 15,
      bold: false,
      align: "left",
      w: 260,
      h: 160,
      fillColor: "#ffffff",
      borderWidth: 0,
    },
  },
  {
    id: "quote",
    label: "Pull Quote",
    type: "text",
    preview: "“ ”",
    overrides: {
      content: "“A memorable quote goes here.”",
      fontSize: 20,
      italic: true,
      align: "center",
      w: 280,
      h: 110,
      fillColor: "#f7f3ec",
      borderColor: "#b8a06a",
      borderWidth: 1,
      borderRadius: 6,
    },
  },
  {
    id: "caption",
    label: "Caption",
    type: "text",
    preview: "abc",
    overrides: {
      content: "Image caption",
      fontSize: 11,
      italic: true,
      align: "center",
      w: 200,
      h: 36,
      fillColor: "#ffffff",
      borderWidth: 0,
    },
  },
  {
    id: "full-image",
    label: "Full Image",
    type: "image",
    preview: "🖼",
    overrides: {
      w: 340,
      h: 420,
      borderWidth: 0,
    },
  },
  {
    id: "small-image",
    label: "Small Image",
    type: "image",
    preview: "🖼",
    overrides: {
      w: 160,
      h: 160,
      borderWidth: 0,
    },
  },
];

// ─── Resize Handle ────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResize: (dx: number, dy: number) => void;
}

function ResizeHandle({ onResize }: ResizeHandleProps) {
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (me: globalThis.MouseEvent) => {
      onResize(me.clientX - startX, me.clientY - startY);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="blp-resize-handle"
      onMouseDown={handleMouseDown}
      title="Resize"
    />
  );
}

// ─── Single Box ───────────────────────────────────────────────────────────────

interface LayoutBoxProps {
  box: Box;
  selected: boolean;
  editingId: string | null;
  scale: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Box>) => void;
  onDelete: (id: string) => void;
  /** Opens the Media Library picker for this box, instead of a native file dialog. */
  onRequestImage: (id: string) => void;
  onSetEditing: (id: string | null) => void;
}

function LayoutBox({
  box,
  selected,
  editingId,
  scale,
  onSelect,
  onUpdate,
  onDelete,
  onRequestImage,
  onSetEditing,
}: LayoutBoxProps) {
  const sizeStart = useRef<{ w: number; h: number } | null>(null);
  const isEditing = editingId === box.id;

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains("blp-resize-handle")) return;
    // While actively editing text, let clicks place the cursor instead of dragging.
    if (isEditing) return;
    e.stopPropagation();
    onSelect(box.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const bx = box.x;
    const by = box.y;

    const onMove = (me: globalThis.MouseEvent) => {
      const dx = (me.clientX - startX) / scale;
      const dy = (me.clientY - startY) / scale;
      onUpdate(box.id, {
        x: Math.max(0, bx + dx),
        y: Math.max(0, by + dy),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleResize = useCallback(
    (dx: number, dy: number) => {
      if (!sizeStart.current) {
        sizeStart.current = { w: box.w, h: box.h };
      }
      onUpdate(box.id, {
        w: Math.max(60, sizeStart.current.w + dx / scale),
        h: Math.max(40, sizeStart.current.h + dy / scale),
      });
    },
    [box, scale, onUpdate]
  );

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onUpdate(box.id, { content: (e.target as HTMLDivElement).innerText });
  };

  useEffect(() => {
    sizeStart.current = null;
  }, [box.w, box.h]);

  const style: React.CSSProperties = {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    background: box.fillColor,
    border: `${box.borderWidth}px solid ${box.borderColor}`,
    borderRadius: box.borderRadius,
    zIndex: selected ? 999 : box.zIndex,
    outline: selected ? "2px solid #4f8ef7" : "none",
    outlineOffset: 2,
    cursor: isEditing ? "text" : "move",
    overflow: "hidden",
    userSelect: "none",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div className="blp-layout-box" style={style} onMouseDown={handleMouseDown}>
      {box.type === "text" ? (
        <div
          className="blp-text-content"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onInput={handleInput}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onSelect(box.id);
            onSetEditing(box.id);
          }}
          onMouseDown={(e) => {
            // Only swallow the mousedown once we're actually in edit mode —
            // otherwise the outer handler needs it to start a drag.
            if (isEditing) e.stopPropagation();
          }}
          onBlur={() => onSetEditing(null)}
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: box.fontSize,
            fontWeight: box.bold ? "700" : "400",
            fontStyle: box.italic ? "italic" : "normal",
            textAlign: box.align,
            outline: "none",
            wordBreak: "break-word",
            overflow: "auto",
            color: "#111",
            fontFamily: "'Georgia', serif",
            lineHeight: 1.5,
          }}
        >
          {box.content}
        </div>
      ) : (
        <div style={{ flex: 1, position: "relative" }}>
          {box.imgSrc ? (
            <>
              <img
                src={box.imgSrc}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: box.objectFit,
                  display: "block",
                }}
                draggable={false}
              />
              {selected && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestImage(box.id);
                  }}
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 11,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Change image
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(box.id);
                onRequestImage(box.id);
              }}
              className="blp-img-placeholder"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                cursor: "pointer",
                background: "#f0f0f0",
                flexDirection: "column",
                gap: 6,
                border: "none",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#aaa"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ fontSize: 11, color: "#aaa" }}>Choose from Media Library</span>
            </button>
          )}
        </div>
      )}
      {selected && (
        <>
          <ResizeHandle onResize={handleResize} />
          <button
            className="blp-delete-btn"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDelete(box.id);
            }}
            title="Delete"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

// ─── Single Page ──────────────────────────────────────────────────────────────

interface BookPageProps {
  side: PageSide;
  boxes: Box[];
  selectedId: string | null;
  editingId: string | null;
  scale: number;
  pageW: number;
  pageH: number;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, changes: Partial<Box>) => void;
  onDelete: (id: string) => void;
  onRequestImage: (id: string) => void;
  onSetEditing: (id: string | null) => void;
  onDrop: (
    side: PageSide,
    type: BoxType,
    x: number,
    y: number,
    overrides?: Partial<Box>
  ) => void;
}

function BookPage({
  side,
  boxes,
  selectedId,
  editingId,
  scale,
  pageW,
  pageH,
  onSelect,
  onUpdate,
  onDelete,
  onRequestImage,
  onSetEditing,
  onDrop,
}: BookPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("blp-type") as BoxType;
    if (!type) return;
    const rect = pageRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    let overrides: Partial<Box> | undefined;
    const presetRaw = e.dataTransfer.getData("blp-preset");
    if (presetRaw) {
      try {
        overrides = JSON.parse(presetRaw) as Partial<Box>;
      } catch {
        overrides = undefined;
      }
    }
    onDrop(side, type, x, y, overrides);
  };

  return (
    <div
      ref={pageRef}
      className={`blp-page blp-page-${side}`}
      style={{
        position: "relative",
        width: pageW * scale,
        height: pageH * scale,
        background: "#fff",
        boxShadow:
          side === "left"
            ? "inset -4px 0 12px rgba(0,0,0,0.08), 2px 0 6px rgba(0,0,0,0.12)"
            : "inset 4px 0 12px rgba(0,0,0,0.08), -2px 0 6px rgba(0,0,0,0.12)",
        overflow: "hidden",
        flexShrink: 0,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.target === pageRef.current) onSelect(null);
      }}
    >
      <div className="blp-page-label">
        {side === "left" ? "Left page" : "Right page"}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: pageW,
          height: pageH,
        }}
      >
        {boxes.map((box) => (
          <LayoutBox
            key={box.id}
            box={box}
            selected={selectedId === box.id}
            editingId={editingId}
            scale={scale}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onRequestImage={onRequestImage}
            onSetEditing={onSetEditing}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

interface TBtnProps {
  title: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  drag?: boolean;
  dragType?: string;
  dragPreset?: Partial<Box>;
}

function TBtn({
  title,
  active = false,
  onClick,
  children,
  drag = false,
  dragType = "",
  dragPreset,
}: TBtnProps) {
  const dragProps = drag
    ? {
        draggable: true as const,
        onDragStart: (e: DragEvent<HTMLButtonElement>) => {
          e.dataTransfer.setData("blp-type", dragType);
          if (dragPreset) {
            e.dataTransfer.setData("blp-preset", JSON.stringify(dragPreset));
          }
        },
      }
    : { onClick };

  return (
    <button
      {...dragProps}
      title={title}
      className={`blp-tbtn${active ? " blp-tbtn-active" : ""}${drag ? " blp-tbtn-drag" : ""}`}
    >
      {children}
    </button>
  );
}

// ─── Content Section Card ─────────────────────────────────────────────────────

interface ContentSectionCardProps {
  section: ContentSection;
}

function ContentSectionCard({ section }: ContentSectionCardProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("blp-type", section.type);
    e.dataTransfer.setData("blp-preset", JSON.stringify(section.overrides));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className="blp-content-card"
      draggable
      onDragStart={handleDragStart}
      title={`Drag onto a page: ${section.label}`}
    >
      <span className="blp-content-card-preview">{section.preview}</span>
      <span className="blp-content-card-label">{section.label}</span>
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <label className="blp-color-picker" title={label}>
      <span className="blp-color-swatch" style={{ background: value }} />
      <span className="blp-color-label">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </label>
  );
}

// ─── Saved book-page row shape (from GET /customer/:id/book-pages) ───────────

interface BookPageRow {
  page_index: number;
  left_boxes: Box[] | null;
  right_boxes: Box[] | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookLayoutPage() {
  const PAGE_W = 420;
  const PAGE_H = 594;

  const location = useLocation();
  const navigate = useNavigate();
  const customerId = (location.state as any)?.customerId;

  const [pages, setPages] = useState<PageData[]>([
    { id: uid(), left: [], right: [] },
  ]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);

  // ── Load / save state ────────────────────────────────────────────────────
  const [loadingPages, setLoadingPages] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const hasLoadedRef = useRef(false);

  // ── Media Library picker (for image boxes) ─────────────────────────────
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [pickingForBoxId, setPickingForBoxId] = useState<string | null>(null);
  const [libraryImages, setLibraryImages] = useState<
    { id: number; url: string; uploaded_by?: string }[]
  >([]);
  const [libraryImagesLoading, setLibraryImagesLoading] = useState(false);
  const [uploadingNewImage, setUploadingNewImage] = useState(false);
  const mediaPickerFileInputRef = useRef<HTMLInputElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const [publishing, setPublishing] = useState(false);
  // Bridges to `updateBox`, which is declared further below in this
  // component — populated via useEffect once it exists.
  const updateBoxRef = useRef<(id: string, changes: Partial<Box>) => void>(() => {});

  // ── Load saved pages on mount ───────────────────────────────────────────
  // Without this, every refresh (or navigating away and back) wiped out
  // whatever the editor had placed, since state only ever lived in memory.
  useEffect(() => {
    let cancelled = false;

    const loadPages = async () => {
      if (!customerId) {
        hasLoadedRef.current = true;
        setLoadingPages(false);
        return;
      }
      try {
        const res = await api.get(`/customer/${customerId}/book-pages`);
        const rows: BookPageRow[] = res.data.data ?? [];
        if (!cancelled && rows.length > 0) {
          const maxIndex = Math.max(...rows.map((r) => r.page_index));
          const loaded: PageData[] = [];
          for (let i = 0; i <= maxIndex; i++) {
            const row = rows.find((r) => r.page_index === i);
            loaded.push({
              id: uid(),
              left: row?.left_boxes ?? [],
              right: row?.right_boxes ?? [],
            });
          }
          setPages(loaded);
        }
      } catch (err) {
        console.error("Failed to load saved book pages", err);
        if (!cancelled) {
          toast.error("Couldn't load your saved progress for this book");
        }
      } finally {
        if (!cancelled) {
          hasLoadedRef.current = true;
          setLoadingPages(false);
          setIsDirty(false);
        }
      }
    };

    loadPages();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Mark the book as having unsaved changes any time the layout changes —
  // cleared again once "Save Changes" succeeds. Ignore the very first
  // render/load so opening the page doesn't immediately show "unsaved".
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    setIsDirty(true);
  }, [pages]);

  // Warn on browser refresh / tab close if there's anything unsaved —
  // this is the safety net for the "refresh wiped my work" problem now
  // that saving is a deliberate action instead of automatic.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Save Changes ─────────────────────────────────────────────────────────
  // Saves every spread currently in memory, not just the one on screen —
  // so hitting Save always captures everything you've worked on this
  // session, however many pages you've hopped between.
  const handleSaveChanges = useCallback(async () => {
    if (!customerId) {
      toast.error("No project selected");
      return;
    }
    setSaveStatus("saving");
    try {
      for (let i = 0; i < pages.length; i++) {
        await api.put(`/customer/${customerId}/book-pages`, {
          page_index: i,
          left_boxes: pages[i].left,
          right_boxes: pages[i].right,
        });
      }
      setSaveStatus("saved");
      setIsDirty(false);
      toast.success("Changes saved");
    } catch (err) {
      console.error("Save failed", err);
      setSaveStatus("error");
      toast.error("Couldn't save your changes — check your connection and try again");
    }
  }, [customerId, pages]);

  const fetchLibraryImages = useCallback(async () => {
    if (!customerId) return;
    setLibraryImagesLoading(true);
    try {
      const res = await api.get(`/customer/${customerId}/media-library`);
      setLibraryImages(
        res.data.data.map((row: any) => ({
          id: row.id,
          url: row.view_url,
          uploaded_by: row.uploaded_by,
        }))
      );
    } catch {
      toast.error("Failed to load media library");
    } finally {
      setLibraryImagesLoading(false);
    }
  }, [customerId]);

  const openMediaPicker = useCallback(
    (boxId: string) => {
      if (!customerId) {
        toast.error("No project selected");
        return;
      }
      setPickingForBoxId(boxId);
      setMediaPickerOpen(true);
      fetchLibraryImages();
    },
    [customerId, fetchLibraryImages]
  );

  const closeMediaPicker = () => {
    setMediaPickerOpen(false);
    setPickingForBoxId(null);
  };

  const handlePickImage = (url: string) => {
    if (!pickingForBoxId) return;
    updateBoxRef.current(pickingForBoxId, { imgSrc: url });
    closeMediaPicker();
  };

  const handleUploadNewImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !customerId) return;

    setUploadingNewImage(true);
    try {
      const urlRes = await api.post(`/customer/${customerId}/media-library/upload-url`, {
        fileName: file.name,
        fileType: file.type,
      });
      const { uploadUrl, key } = urlRes.data.data;

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Image upload to S3 failed");

      const saveRes = await api.post(`/customer/${customerId}/media-library`, { key });
      const saved = saveRes.data.data;

      setLibraryImages((prev) => [
        { id: saved.id, url: saved.view_url, uploaded_by: "editor" },
        ...prev,
      ]);

      // Straight into the box that requested it — no extra click needed
      if (pickingForBoxId) {
        updateBoxRef.current(pickingForBoxId, { imgSrc: saved.view_url });
        closeMediaPicker();
      }
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingNewImage(false);
    }
  };

  // ── Publish PDF ─────────────────────────────────────────────────────────
  // Walks every page, forces scale=1 and clears selection so the capture
  // is clean and full-resolution regardless of the current viewport/zoom,
  // screenshots each spread, and compiles them into one downloadable PDF.
  const handlePublishPDF = async () => {
    if (pages.length === 0) return;
    setPublishing(true);

    const originalPage = currentPage;
    const originalSelected = selectedId;
    const originalScale = scale;
    setSelectedId(null);
    setScale(1);

    try {
      const jsPDFModule = await import("jspdf");
      const html2canvasModule = await import("html2canvas");
      const jsPDF = jsPDFModule.default;
      const html2canvas = html2canvasModule.default;

      const spreadW = PAGE_W * 2;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [spreadW, PAGE_H],
      });

      for (let i = 0; i < pages.length; i++) {
        setCurrentPage(i);
        // Give React a moment to actually render this page before capturing
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!spreadRef.current) continue;

        const canvas = await html2canvas(spreadRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        if (i > 0) pdf.addPage([spreadW, PAGE_H], "landscape");
        pdf.addImage(imgData, "JPEG", 0, 0, spreadW, PAGE_H);
      }

      pdf.save("book.pdf");
      toast.success("Book published — PDF downloaded");
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error(
        "Couldn't generate the PDF. Run: npm install jspdf html2canvas"
      );
    } finally {
      setCurrentPage(originalPage);
      setSelectedId(originalSelected);
      setScale(originalScale);
      setPublishing(false);
    }
  };

  // Auto-scale based on viewport
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const available = vw - 48;
      const needed = PAGE_W * 2 + 4;
      const s = Math.min(1, available / needed);
      setScale(Math.max(0.35, s));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // ── selection helpers ────────────────────────────────────────────────────
  // Selecting a different box always drops out of text-edit mode for the
  // previous one, so a stray click elsewhere can't leave a box stuck
  // "uneditable-but-undraggable" in between states.
  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    setEditingId((prev) => (id === prev ? prev : null));
  }, []);

  const getSelected = (): Box | null => {
    if (!selectedId) return null;
    const pg = pages[currentPage];
    return (
      pg.left.find((b) => b.id === selectedId) ||
      pg.right.find((b) => b.id === selectedId) ||
      null
    );
  };
  const selBox = getSelected();

  // ── update a box ─────────────────────────────────────────────────────────
  const updateBox = useCallback(
    (id: string, changes: Partial<Box>) => {
      setPages((prev) =>
        prev.map((pg, i) => {
          if (i !== currentPage) return pg;
          return {
            ...pg,
            left: pg.left.map((b) => (b.id === id ? { ...b, ...changes } : b)),
            right: pg.right.map((b) => (b.id === id ? { ...b, ...changes } : b)),
          };
        })
      );
    },
    [currentPage]
  );

  useEffect(() => {
    updateBoxRef.current = updateBox;
  }, [updateBox]);

  // ── delete a box ─────────────────────────────────────────────────────────
  const deleteBox = useCallback(
    (id: string) => {
      setSelectedId(null);
      setEditingId(null);
      setPages((prev) =>
        prev.map((pg, i) => {
          if (i !== currentPage) return pg;
          return {
            ...pg,
            left: pg.left.filter((b) => b.id !== id),
            right: pg.right.filter((b) => b.id !== id),
          };
        })
      );
    },
    [currentPage]
  );

  // ── drop on page ──────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (side: PageSide, type: BoxType, x: number, y: number, overrides?: Partial<Box>) => {
      const w = overrides?.w ?? DEFAULT_BOX.w;
      const h = overrides?.h ?? DEFAULT_BOX.h;
      const newBox: Box = {
        ...DEFAULT_BOX,
        id: uid(),
        type,
        x: Math.max(4, x - w / 2),
        y: Math.max(4, y - h / 2),
        content: type === "text" ? "New text box" : "",
        imgSrc: null,
        zIndex: Date.now() % 10000,
        ...overrides,
      };
      setPages((prev) =>
        prev.map((pg, i) => {
          if (i !== currentPage) return pg;
          return { ...pg, [side]: [...pg[side], newBox] };
        })
      );
      setSelectedId(newBox.id);
      setEditingId(null);
    },
    [currentPage]
  );

  // ── add page ──────────────────────────────────────────────────────────────
  const addPage = () => {
    setPages((prev) => [...prev, { id: uid(), left: [], right: [] }]);
    setCurrentPage(pages.length);
    setSelectedId(null);
    setEditingId(null);
  };

  // ── insert box via toolbar button ─────────────────────────────────────────
  const insertBox = (side: PageSide, type: BoxType) => {
    const newBox: Box = {
      ...DEFAULT_BOX,
      id: uid(),
      type,
      x: 40,
      y: 40 + Math.random() * 60,
      content: type === "text" ? "New text box" : "",
      imgSrc: null,
      zIndex: Date.now() % 10000,
    };
    setPages((prev) =>
      prev.map((pg, i) => {
        if (i !== currentPage) return pg;
        return { ...pg, [side]: [...pg[side], newBox] };
      })
    );
    setSelectedId(newBox.id);
    setEditingId(null);
  };

  // ── toolbar action shortcuts ──────────────────────────────────────────────
  const tbAction = <K extends keyof Box>(key: K, val: Box[K]) => {
    if (!selectedId) return;
    updateBox(selectedId, { [key]: val } as Partial<Box>);
  };

  const tbToggle = (key: keyof Box) => {
    if (!selBox) return;
    updateBox(selectedId!, { [key]: !selBox[key] } as Partial<Box>);
  };

  const pg = pages[currentPage] ?? { left: [], right: [] };

  // ── Icons ─────────────────────────────────────────────────────────────────
  const iconText = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 10h16M4 14h10" />
    </svg>
  );
  const iconImg = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
  const iconBold = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </svg>
  );
  const iconItalic = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
  const iconAlignL = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="18" y2="18" />
    </svg>
  );
  const iconAlignC = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
  const iconAlignR = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="9" y1="12" x2="21" y2="12" />
      <line x1="6" y1="18" x2="21" y2="18" />
    </svg>
  );

  const saveIndicator = !customerId ? null : (
    <span
      style={{
        fontSize: 12,
        color:
          saveStatus === "error" ? "#c0392b" : saveStatus === "saving" ? "#8a8f98" : "#1a7f4b",
        marginRight: 10,
        whiteSpace: "nowrap",
      }}
    >
      {saveStatus === "saving" && "Saving…"}
      {saveStatus === "saved" && !isDirty && "All changes saved"}
      {saveStatus === "error" && "Save failed — try again"}
      {saveStatus !== "saving" && saveStatus !== "error" && isDirty && "Unsaved changes"}
    </span>
  );

  return (
    <div className="blp-root editordashboard-container">
      <BackButton />
      {/* ── Toolbar ── */}
      <div className="blp-toolbar">
        <span className="blp-app-title">📖 Book Layout Designer</span>
        <div className="blp-toolbar-sep" />

        {/* Drag-to-insert */}
        <span className="blp-hint">Drag onto page:</span>
        <TBtn title="Text Box — drag to insert" drag dragType="text">
          {iconText} T
        </TBtn>
        <TBtn title="Image Box — drag to insert" drag dragType="image">
          {iconImg} Img
        </TBtn>
        <div className="blp-toolbar-sep" />

        {/* Quick content sections (compact — full library is in the bottom shelf) */}
        <span className="blp-hint">Sections:</span>
        {CONTENT_SECTIONS.slice(0, 3).map((section) => (
          <TBtn
            key={section.id}
            title={`Drag to insert — ${section.label}`}
            drag
            dragType={section.type}
            dragPreset={section.overrides}
          >
            {section.label}
          </TBtn>
        ))}
        <div className="blp-toolbar-sep" />

        {/* Quick-insert by side */}
        <TBtn title="Insert Text on Left" onClick={() => insertBox("left", "text")}>
          TL
        </TBtn>
        <TBtn title="Insert Text on Right" onClick={() => insertBox("right", "text")}>
          TR
        </TBtn>
        <TBtn title="Insert Image on Left" onClick={() => insertBox("left", "image")}>
          {iconImg}L
        </TBtn>
        <TBtn title="Insert Image on Right" onClick={() => insertBox("right", "image")}>
          {iconImg}R
        </TBtn>
        <div className="blp-toolbar-sep" />

        {/* Format */}
        <TBtn title="Bold" active={selBox?.bold} onClick={() => tbToggle("bold")}>
          {iconBold}
        </TBtn>
        <TBtn title="Italic" active={selBox?.italic} onClick={() => tbToggle("italic")}>
          {iconItalic}
        </TBtn>
        <TBtn
          title="Align Left"
          active={selBox?.align === "left"}
          onClick={() => tbAction("align", "left")}
        >
          {iconAlignL}
        </TBtn>
        <TBtn
          title="Align Center"
          active={selBox?.align === "center"}
          onClick={() => tbAction("align", "center")}
        >
          {iconAlignC}
        </TBtn>
        <TBtn
          title="Align Right"
          active={selBox?.align === "right"}
          onClick={() => tbAction("align", "right")}
        >
          {iconAlignR}
        </TBtn>

        {/* Font size */}
        <span className="blp-input-label">Size</span>
        <input
          className="blp-number-input"
          type="number"
          min={8}
          max={96}
          value={selBox?.fontSize ?? 16}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            tbAction("fontSize", Number(e.target.value))
          }
        />
        <div className="blp-toolbar-sep" />

        {/* Colors */}
        <ColorPicker
          label="Fill"
          value={selBox?.fillColor ?? "#ffffff"}
          onChange={(v) => tbAction("fillColor", v)}
        />
        <ColorPicker
          label="Border"
          value={selBox?.borderColor ?? "#cccccc"}
          onChange={(v) => tbAction("borderColor", v)}
        />
        <div className="blp-toolbar-sep" />

        {/* Border controls */}
        <span className="blp-input-label">Radius</span>
        <input
          className="blp-number-input"
          type="number"
          min={0}
          max={100}
          value={selBox?.borderRadius ?? 4}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            tbAction("borderRadius", Number(e.target.value))
          }
        />
        <span className="blp-input-label">Border</span>
        <input
          className="blp-number-input"
          type="number"
          min={0}
          max={20}
          value={selBox?.borderWidth ?? 1}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            tbAction("borderWidth", Number(e.target.value))
          }
        />

        {/* Image fit */}
        {selBox?.type === "image" && (
          <>
            <div className="blp-toolbar-sep" />
            <span className="blp-input-label">Fit</span>
            <select
              className="blp-select"
              value={selBox.objectFit}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                tbAction("objectFit", e.target.value as ObjectFitType)
              }
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
            </select>
          </>
        )}
      </div>

      {/* ── Canvas ── */}
      <div className="blp-canvas-area">
        {loadingPages ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
            Loading your saved layout…
          </div>
        ) : (
          <div className="blp-spread-wrapper">
            {/* Page navigation */}
            <div className="blp-page-nav">
              {pages.map((p, i) => (
                <div
                  key={p.id}
                  className={`blp-page-dot${currentPage === i ? " blp-page-dot-active" : ""}`}
                  onClick={() => {
                    if (currentPage === i) return;
                    setCurrentPage(i);
                    setSelectedId(null);
                    setEditingId(null);
                  }}
                  title={`Spread ${i + 1}`}
                >
                  {i + 1}
                </div>
              ))}
              <button className="blp-add-page-btn" onClick={addPage}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Spread
              </button>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                {saveIndicator}

                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saveStatus === "saving" || !customerId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1px solid #1a7f4b",
                    background: "#fff",
                    color: "#1a7f4b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saveStatus === "saving" ? "default" : "pointer",
                  }}
                  title="Save your current progress"
                >
                  {saveStatus === "saving" ? (
                    "Saving..."
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePublishPDF}
                  disabled={publishing}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: publishing ? "#9aa5b1" : "#1a7f4b",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: publishing ? "default" : "pointer",
                  }}
                  title="Export every spread as a downloadable PDF"
                >
                  {publishing ? (
                    "Generating PDF..."
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Publish PDF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Spread */}
            <div className="blp-spread" ref={spreadRef}>
              <BookPage
                side="left"
                boxes={pg.left}
                selectedId={selectedId}
                editingId={editingId}
                scale={scale}
                pageW={PAGE_W}
                pageH={PAGE_H}
                onSelect={handleSelect}
                onUpdate={updateBox}
                onDelete={deleteBox}
                onRequestImage={openMediaPicker}
                onSetEditing={setEditingId}
                onDrop={handleDrop}
              />
              <div className="blp-spine" style={{ height: PAGE_H * scale }} />
              <BookPage
                side="right"
                boxes={pg.right}
                selectedId={selectedId}
                editingId={editingId}
                scale={scale}
                pageW={PAGE_W}
                pageH={PAGE_H}
                onSelect={handleSelect}
                onUpdate={updateBox}
                onDelete={deleteBox}
                onRequestImage={openMediaPicker}
                onSetEditing={setEditingId}
                onDrop={handleDrop}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Content Drawer (collapsible — keep closed for max canvas space) ── */}
      <div className="blp-drawer">
        <div className="blp-drawer-bar">
          <button
            className="blp-drawer-toggle"
            onClick={() => setLibraryOpen((v) => !v)}
            title={libraryOpen ? "Hide content library" : "Show content library"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                transform: libraryOpen ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform 0.15s",
              }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {libraryOpen ? "Hide" : "Content Library"}
          </button>
        </div>

        {libraryOpen && (
          <div className="blp-drawer-body">
            <div className="blp-content-library-track">
              {CONTENT_SECTIONS.map((section) => (
                <ContentSectionCard key={section.id} section={section} />
              ))}
            </div>
          </div>
        )}
      </div>

      {mediaPickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={closeMediaPicker}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "min(720px, 92vw)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #eee",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16 }}>Choose from Media Library</h3>
              <button
                type="button"
                onClick={closeMediaPicker}
                style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ padding: "12px 20px", borderBottom: "1px solid #eee" }}>
              <button
                type="button"
                onClick={() => mediaPickerFileInputRef.current?.click()}
                disabled={uploadingNewImage}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #d8dbe3",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {uploadingNewImage ? "Uploading..." : "+ Upload new photo"}
              </button>
              <input
                ref={mediaPickerFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleUploadNewImage}
              />
            </div>

            <div style={{ padding: 20, overflowY: "auto" }}>
              {libraryImagesLoading ? (
                <p style={{ color: "#888", fontSize: 13 }}>Loading...</p>
              ) : libraryImages.length === 0 ? (
                <p style={{ color: "#888", fontSize: 13 }}>
                  No photos yet — upload one above to get started.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                    gap: 10,
                  }}
                >
                  {libraryImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => handlePickImage(img.url)}
                      style={{
                        border: "2px solid transparent",
                        borderRadius: 8,
                        overflow: "hidden",
                        aspectRatio: "1 / 1",
                        padding: 0,
                        cursor: "pointer",
                        background: "#f0f0f0",
                      }}
                    >
                      <img
                        src={img.url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
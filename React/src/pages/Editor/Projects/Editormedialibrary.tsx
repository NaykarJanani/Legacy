import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import "./Editormedialibrary.css";

interface UploadedImage {
  id: number;        // real user_gallery.id from the backend
  url: string;        // signed view_url
  name: string;
  uploaded_by?: string;
}

interface CategoryOption {
  id: string;         // UI key
  boardType: string;  // backend board_type value
  label: string;
  color: string;
  idOptions: string[];
}

// categoryId -> chosen position id, for a single image
type ImageAssignments = Record<string, string>;

const IMAGES_PER_PAGE = 12;

// The list shown per-image in the modal, each with its own "Select id" dropdown.
// idOptions here match the REAL slot counts/formats used on the actual
// Vision Board / Achievement / Legacy Timeline / Generation Web pages.
const CATEGORIES: CategoryOption[] = [
  {
    id: "vision-board",
    boardType: "vision_board",
    label: "Vision Board",
    color: "#8b2635",
    idOptions: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },
  {
    id: "achievement",
    boardType: "achievement",
    label: "Achievement",
    color: "#3f5fd6",
    // Achievement slots are letters A–Z, not numbers — matches the real page
    idOptions: Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  },
  {
    id: "gen-web",
    boardType: "generation_web",
    label: "Generation Web",
    color: "#1f9d6b",
    idOptions: Array.from({ length: 20 }, (_, i) => String(i + 1)),
  },
  {
    id: "legacy-timeline",
    boardType: "legacy_timeline",
    label: "Legacy Timeline",
    color: "#c98a1a",
    // 38 dot positions, ids must match ALL_DOT_IDS in Legacytimeline.tsx /
    // Legacyimginnerpage.tsx exactly (dot-1 .. dot-38), or placements saved
    // here will never match what those pages look up.
    idOptions: Array.from({ length: 38 }, (_, i) => `dot-${i + 1}`),
  },
];

const Editormedialibrary: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Passed from Editorcardinnerpage.tsx as { state: { customerId, ... } }
  const customerId = (location.state as any)?.customerId;

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Per-image assignment state ----
  // Saved assignments keyed by gallery image id, built from real placements
  const [assignments, setAssignments] = useState<Record<number, ImageAssignments>>({});
  // The image currently open in the modal (null = modal closed)
  const [activeImage, setActiveImage] = useState<UploadedImage | null>(null);
  // Working copy edited inside the modal, committed to `assignments` on Submit
  const [draftSelections, setDraftSelections] = useState<ImageAssignments>({});
  const [submitting, setSubmitting] = useState(false);

  // Load the unified photo pool + current placements for this customer
  useEffect(() => {
    if (!customerId) {
      toast.error("No project selected");
      navigate(-1);
      return;
    }

    const load = async () => {
      try {
        const [libRes, placementsRes] = await Promise.all([
          api.get(`/customer/${customerId}/media-library`),
          api.get(`/customer/${customerId}/board-placements`),
        ]);

        const libImages: UploadedImage[] = libRes.data.data.map((row: any) => ({
          id: row.id,
          url: row.view_url,
          name: row.uploaded_by === "editor" ? "Editor upload" : "Customer upload",
          uploaded_by: row.uploaded_by,
        }));
        setImages(libImages);

        // Build { gallery_id -> { categoryUiId: position_id } } from real placements
        const boardTypeToUiId: Record<string, string> = {};
        CATEGORIES.forEach((c) => (boardTypeToUiId[c.boardType] = c.id));

        const built: Record<number, ImageAssignments> = {};
        placementsRes.data.data.forEach((p: any) => {
          const uiId = boardTypeToUiId[p.board_type];
          if (!uiId) return;
          if (!built[p.gallery_id]) built[p.gallery_id] = {};
          built[p.gallery_id][uiId] = p.position_id;
        });
        setAssignments(built);
      } catch (err) {
        toast.error("Failed to load media library");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // 1. Get a pre-signed S3 upload URL
        const urlRes = await api.post(`/customer/${customerId}/media-library/upload-url`, {
          fileName: file.name,
          fileType: file.type,
        });
        const { uploadUrl, key } = urlRes.data.data;

        // 2. Upload the file directly to S3 (raw fetch, not through `api`)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Image upload to S3 failed");

        // 3. Save the record — lands in the same shared pool as customer photos
        const saveRes = await api.post(`/customer/${customerId}/media-library`, { key });
        const saved = saveRes.data.data;

        setImages((prev) => [
          { id: saved.id, url: saved.view_url, name: "Editor upload", uploaded_by: "editor" },
          ...prev,
        ]);
      }
      toast.success("Image(s) added to media library");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const totalPages = Math.max(1, Math.ceil(images.length / IMAGES_PER_PAGE));
  const currentImages = images.slice(
    (currentPage - 1) * IMAGES_PER_PAGE,
    currentPage * IMAGES_PER_PAGE
  );

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  // Open the per-image modal, pre-filled with whatever was saved before (if editing again)
  const openModalForImage = (image: UploadedImage) => {
    setActiveImage(image);
    setDraftSelections(assignments[image.id] ? { ...assignments[image.id] } : {});
  };

  const closeModal = () => {
    setActiveImage(null);
    setDraftSelections({});
  };

  // Checking a category adds it to the draft (with an empty id, revealing the dropdown)
  // Unchecking removes it and hides its dropdown
  const toggleCategory = (categoryId: string) => {
    setDraftSelections((prev) => {
      const next = { ...prev };
      if (categoryId in next) {
        delete next[categoryId];
      } else {
        next[categoryId] = "";
      }
      return next;
    });
  };

  const setCategoryId = (categoryId: string, value: string) => {
    setDraftSelections((prev) => ({ ...prev, [categoryId]: value }));
  };

  // Submit is only enabled once every checked category has an id chosen
  const canSubmit =
    Object.keys(draftSelections).length > 0 &&
    Object.values(draftSelections).every((value) => value !== "");

  const handleSubmit = async () => {
    if (!activeImage) return;
    setSubmitting(true);
    try {
      // One PUT per checked category — an image can sit on multiple boards at once
      await Promise.all(
        Object.entries(draftSelections).map(([categoryId, positionId]) => {
          const cat = CATEGORIES.find((c) => c.id === categoryId);
          if (!cat) return Promise.resolve();
          return api.put(`/customer/${customerId}/board-placement`, {
            board_type: cat.boardType,
            position_id: positionId,
            gallery_id: activeImage.id,
          });
        })
      );

      setAssignments((prev) => ({ ...prev, [activeImage.id]: draftSelections }));
      toast.success("Placement saved — now visible on both editor and customer sides");
      closeModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save placement");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="editordashboard-container">Loading media library...</div>;
  }

  return (
    <div className="editordashboard-container">
      <div className="Editormedialibrary">
        <BackButton />

        <div className="Editormedialibrary__header">
          <div className="Editormedialibrary__note">
            Note: Editor must select images in sequence for all categories.
          </div>
          <button
            className="Editormedialibrary__uploadButton"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Images"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="Editormedialibrary__fileInput"
          />
        </div>

        <div className="Editormedialibrary__grid">
          {currentImages.length === 0 ? (
            <div className="Editormedialibrary__empty">
              No Images Uploaded
            </div>
          ) : (
            currentImages.map((image) => {
              const imageAssignments = assignments[image.id];
              const assignedCategories = imageAssignments
                ? CATEGORIES.filter((cat) => cat.id in imageAssignments)
                : [];
              const isAssigned = assignedCategories.length > 0;

              return (
                <div
                  className={`Editormedialibrary__card${isAssigned ? " Editormedialibrary__card--selected" : ""
                    }`}
                  key={image.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openModalForImage(image)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openModalForImage(image);
                    }
                  }}
                >
                  <span
                    className={`Editormedialibrary__checkboxMark${isAssigned ? " Editormedialibrary__checkboxMark--checked" : ""
                      }`}
                  />

                  <img
                    src={image.url}
                    alt="Gallery photo"
                    className="Editormedialibrary__image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='100%25' height='100%25' fill='%23eceef5'/></svg>";
                    }}
                  />

                  {image.uploaded_by === "customer" && (
                    <span className="Editormedialibrary__sourceTag">Customer</span>
                  )}

                  {isAssigned && (
                    <div className="Editormedialibrary__tags">
                      {assignedCategories.map((cat) => (
                        <span
                          key={cat.id}
                          className="Editormedialibrary__tagDot"
                          style={{ background: cat.color }}
                          title={cat.label}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {images.length > 0 && (
          <div className="Editormedialibrary__footer">

            <button
              className="Editormedialibrary__paginationButton"
              onClick={handlePrevious}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>

            <span className="Editormedialibrary__page">
              {currentPage} / {totalPages}
            </span>

            <button
              className="Editormedialibrary__paginationButton"
              onClick={handleNext}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>

          </div>
        )}

      </div>

      {activeImage && (
        <div className="EditorMediaModal__overlay" onClick={closeModal}>
          <div className="EditorMediaModal" onClick={(e) => e.stopPropagation()}>
            <div className="EditorMediaModal__header">
              <div className="EditorMediaModal__headerInfo">
                <img
                  src={activeImage.url}
                  alt="Gallery photo"
                  className="EditorMediaModal__thumb"
                />
                <h3>Assign Image</h3>
              </div>
              <button
                className="EditorMediaModal__close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="EditorMediaModal__body">
              <div className="EditorMediaModal__note">
                Note: Editor must select images  id according to sequence for all categories.
              </div>

              <p className="EditorMediaModal__helper">
                Choose where this image should be used. You can select more than one.
              </p>

              <div className="EditorMediaModal__categoryList">
                {CATEGORIES.map((cat) => {
                  const isChecked = cat.id in draftSelections;

                  return (
                    <div key={cat.id} className="EditorMediaModal__categoryRow">
                      <label className="EditorMediaModal__categoryLabel">
                        <span
                          className={`EditorMediaModal__swatch${isChecked ? " EditorMediaModal__swatch--checked" : ""
                            }`}
                          style={isChecked ? { background: cat.color, borderColor: cat.color } : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCategory(cat.id)}
                          />
                        </span>
                        <span className="EditorMediaModal__categoryText">{cat.label}</span>
                      </label>

                      {isChecked && (
                        <div className="EditorMediaModal__idRow">
                          <label className="EditorMediaModal__idLabel">Select id</label>
                          <select
                            className="EditorMediaModal__select"
                            value={draftSelections[cat.id] || ""}
                            onChange={(e) => setCategoryId(cat.id, e.target.value)}
                          >
                            <option value="">Select id</option>
                            {cat.idOptions.map((idOpt) => (
                              <option key={idOpt} value={idOpt}>
                                {idOpt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="EditorMediaModal__footer">
              <button className="EditorMediaModal__cancelButton" onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button
                className="EditorMediaModal__applyButton"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editormedialibrary;
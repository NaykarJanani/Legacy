import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import "./StartJourneyPage.css";

interface DragPos {
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.1;

/**
 * Drag-to-pan support for the background image. Position is a pixel
 * offset applied via transform, so it never fights with object-fit/cover
 * or the responsive layout rules already in the CSS.
 */
const useDraggable = (enabled: boolean, initialPos: DragPos = { x: 0, y: 0 }) => {
  const [pos, setPos] = useState<DragPos>(initialPos);
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!enabled || !dragState.current) return;
    e.preventDefault();
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragState.current) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragState.current = null;
  };

  const reset = () => setPos({ x: 0, y: 0 });

  return { pos, setPos, onPointerDown, onPointerMove, onPointerUp, reset };
};

const StartJourneyPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────
  // CHANGED: this page edits ONE customer's content. This app passes the
  // customer along via React Router navigation state (not a URL param) —
  // Editorcardinnerpage.tsx already does:
  //   navigate("/editor/startjourney", { state: { customerId, ... } })
  // Editormedialibrary.tsx reads it the same way. We do too.
  // ─────────────────────────────────────────────────────────────────────
  const location = useLocation();
  const customerId = (location.state as any)?.customerId;

  // Edit mode toggle — flip this on to upload/reposition the background
  // image or edit the text, flip it off to lock the page back down.
  const [isEditing, setIsEditing] = useState(false);

  // Background image (falls back to the original static asset until replaced,
  // or until the saved version loads from the server)
  const [bgImage, setBgImage] = useState<string>(
    "/assets/userstartjourneyimg.png"
  );

  // The actual File object picked in this session — only set (and only sent
  // to S3) when the editor chooses a new image. `bgImage` above is just the
  // local preview (existing saved image, or a fresh local preview via FileReader).
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pan (drag) + zoom for the background image only
  const bgDrag = useDraggable(isEditing);
  const [bgScale, setBgScale] = useState(1);

  const resetImageAdjustments = () => {
    bgDrag.reset();
    setBgScale(1);
  };

  const zoomIn = () =>
    setBgScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(2)));
  const zoomOut = () =>
    setBgScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(2)));

  // Left-side editable text
  const [establishedLabel, setEstablishedLabel] = useState("Established");
  const [year, setYear] = useState("1998");
  const [experienceLine1, setExperienceLine1] = useState("27 Years of");
  const [experienceLine2, setExperienceLine2] = useState(
    "Excellence in Education"
  );
  const [quote, setQuote] = useState(
    "Education is the most powerful weapon which you can use to change the world."
  );

  // Load whatever is currently saved so the editor form starts prefilled
  // instead of always reverting to the hardcoded defaults above.
  // CHANGED: scoped to the current customer, and refetches if the editor
  // navigates to a different customer's page without a full remount.
  useEffect(() => {
    if (!customerId) {
      // Opened directly without coming from a customer's card — there's
      // nothing to load or save against. Send the editor back rather than
      // leaving the page stuck on "Loading...".
      toast.error("No project selected");
      navigate(-1);
      return;
    }
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/customer/${customerId}/start-journey`);
        const data = res.data?.data;
        if (!data || cancelled) return;

        if (data.image_url) setBgImage(data.image_url);
        if (data.established_label) setEstablishedLabel(data.established_label);
        if (data.year) setYear(data.year);
        if (data.experience_line1) setExperienceLine1(data.experience_line1);
        if (data.experience_line2) setExperienceLine2(data.experience_line2);
        if (data.quote) setQuote(data.quote);
        if (data.image_scale != null) setBgScale(Number(data.image_scale));
        if (data.image_pos_x != null || data.image_pos_y != null) {
          bgDrag.setPos({
            x: Number(data.image_pos_x ?? 0),
            y: Number(data.image_pos_y ?? 0),
          });
        }
      } catch (err) {
        console.error("Failed to load start journey content", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBgImage(reader.result);
        resetImageAdjustments(); // start fresh with the new image
      }
    };
    reader.readAsDataURL(file);
    setPendingFile(file);
    setSaveSuccess(false);

    e.target.value = "";
  };

  const handleStartJourney = () => {
    navigate("/editor/dashboard");
  };

  // Uploads a new image (if one was picked) then saves the image key + all
  // text fields together, so the user-side page can pick up both at once.
  // CHANGED: both calls now go to the per-customer URL.
  const handleSubmit = async () => {
    if (!customerId) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let key: string | undefined;

      if (pendingFile) {
        const urlRes = await api.post(
          `/customer/${customerId}/start-journey/upload-url`,
          {
            fileName: pendingFile.name,
            fileType: pendingFile.type,
          }
        );
        const { uploadUrl, key: uploadedKey } = urlRes.data.data;

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": pendingFile.type },
          body: pendingFile,
        });

        key = uploadedKey;
      }

      await api.put(`/customer/${customerId}/start-journey`, {
        key,
        established_label: establishedLabel,
        year,
        experience_line1: experienceLine1,
        experience_line2: experienceLine2,
        quote,
        image_scale: bgScale,
        image_pos_x: bgDrag.pos.x,
        image_pos_y: bgDrag.pos.y,
      });

      setPendingFile(null);
      setSaveSuccess(true);
    } catch (err) {
      console.error("Failed to save start journey content", err);
      setSaveError("Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Generic helper to keep contentEditable <-> state in sync on blur.
  // Merges the editable-affordance class with the element's own class
  // instead of overwriting it.
  const editableProps = (
    value: string,
    setValue: (v: string) => void,
    baseClassName?: string
  ) => ({
    contentEditable: isEditing,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) =>
      setValue(e.currentTarget.textContent ?? ""),
    className: [baseClassName, isEditing ? "is-editable" : ""]
      .filter(Boolean)
      .join(" "),
  });

  return (
    <div className="editordashboard-container">
      <section className="start-journey-page">
        <BackButton className="start-journey-page__back-button" />
        {/* Hidden file input used for the background image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Edit mode toggle */}
        <button
          type="button"
          className="start-journey-page__edit-toggle"
          onClick={async () => {
            if (isEditing) {
              // Leaving edit mode — persist whatever was changed instead of
              // silently discarding it. This was the actual cause of edits
              // reverting after a refresh: "Done" only toggled the UI state,
              // it never called handleSubmit().
              await handleSubmit();
            }
            setIsEditing((prev) => !prev);
          }}
          disabled={isLoading || isSaving}
        >
          {isLoading ? "Loading..." : isSaving ? "Saving..." : isEditing ? "Done" : "Edit"}
        </button>

        {/* Background Image — drag to pan, use +/- to zoom, only while editing */}
        <img
          src={bgImage}
          alt="Founder Banner"
          draggable={false}
          className={`start-journey-page__bg-image${isEditing ? " is-draggable-img" : ""
            }`}
          style={{
            transform: `translate(${bgDrag.pos.x}px, ${bgDrag.pos.y}px) scale(${bgScale})`,
          }}
          onPointerDown={bgDrag.onPointerDown}
          onPointerMove={bgDrag.onPointerMove}
          onPointerUp={bgDrag.onPointerUp}
        />

        {/* Overlay (decorative only — never intercepts clicks) */}
        <div className="start-journey-page__overlay" />

        {/* Image controls, only shown while editing */}
        {isEditing && (
          <div className="start-journey-page__image-controls">
            <button
              type="button"
              className="start-journey-page__upload-btn"
              onClick={handleUploadClick}
            >
              Upload image
            </button>

            <div className="start-journey-page__zoom-group">
              <button
                type="button"
                className="start-journey-page__zoom-btn"
                onClick={zoomOut}
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="start-journey-page__zoom-btn"
                onClick={zoomIn}
                aria-label="Zoom in"
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="start-journey-page__reset-btn"
              onClick={resetImageAdjustments}
            >
              Reset image
            </button>

            <button
              type="button"
              className="start-journey-page__upload-btn"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Submit"}
            </button>

            {saveSuccess && (
              <span style={{ color: "#1f9d6b", marginLeft: 8 }}>
                Saved — now visible on the user side.
              </span>
            )}
            {saveError && (
              <span style={{ color: "#c0392b", marginLeft: 8 }}>{saveError}</span>
            )}
          </div>
        )}

        {/* Established Section + Quote — stacked in normal flow inside one
    positioned wrapper, so the quote can never overlap the established
    block even when the year text grows on narrower screens. */}
        <div className="start-journey-page__intro">
          <div className="start-journey-page__established">
            <p
              {...editableProps(
                establishedLabel,
                setEstablishedLabel,
                "start-journey-page__established-label"
              )}
            >
              {establishedLabel}
            </p>

            <h2 {...editableProps(year, setYear, "start-journey-page__year")}>
              {year}
            </h2>

            <p className="start-journey-page__experience">
              <span {...editableProps(experienceLine1, setExperienceLine1)}>
                {experienceLine1}
              </span>
              <br />
              <span {...editableProps(experienceLine2, setExperienceLine2)}>
                {experienceLine2}
              </span>
            </p>
          </div>

          {/* Quote */}
          <div className="start-journey-page__quote">
            <p {...editableProps(quote, setQuote)}>{quote}</p>
            <div className="start-journey-page__line" />
          </div>
        </div>

        {/* Founder Info (left empty/commented as in the original — add back if needed) */}
        <div className="start-journey-page__founder" />

        {/* Play Button */}

        <div className="start-journey-page__play-wrapper">
          <button
            type="button"
            className="start-journey-page__play-btn"
            aria-disabled="true"
            onClick={(e) => e.preventDefault()}
          >
            <span className="start-journey-page__play-icon">▶</span>

            <span className="start-journey-page__tooltip">
              Let's Start your Journey
            </span>
          </button>
        </div>
      </section>
    </div>

  );
};

export default StartJourneyPage;

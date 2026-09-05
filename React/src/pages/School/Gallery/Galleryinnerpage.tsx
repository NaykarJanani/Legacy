import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../../../components/BackButton";
import './Galleryinnerpage.css'

/**
 * Galleryinnerpage.tsx
 * -----------------------------------------------------------------------
 * "Our Work" gallery hero section with two infinite marquee rows of images.
 * - Row 1 scrolls right -> left
 * - Row 2 scrolls left -> right
 * - Hovering a row pauses ONLY that row's animation
 * - Fully responsive: image sizes, gaps, and heights scale by breakpoint
 * - Class prefix: "gip-" (GalleryInnerPage) to avoid collisions with
 *   other stylesheets in the host project
 * - Images come from /user/gallery/chapter-images for the chapter passed
 *   in via the route (/school/galleryinner/:sessionId/:chapter)
 * -----------------------------------------------------------------------
 */

interface GalleryImage {
  id: number;
  src: string;
  alt: string;
}

interface ApiGalleryImage {
  id: number;
  view_url: string;
}

const API_BASE = `${(import.meta as any).env?.VITE_API_URL ?? "http://localhost:5002"}/api`;
const FALLBACK_IMG = "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80&auto=format&fit=crop";

function getToken(): string {
  return localStorage.getItem("token") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

const Galleryinnerpage: React.FC = () => {
  const { sessionId, chapter } = useParams<{ sessionId: string; chapter: string }>();
  const [rowOneImages, setRowOneImages] = useState<GalleryImage[]>([]);
  const [rowTwoImages, setRowTwoImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchImages() {
      if (!sessionId || !chapter) {
        setLoading(false);
        return;
      }
      try {
        const url = `${API_BASE}/user/gallery/chapter-images?session_id=${sessionId}&chapter=${encodeURIComponent(chapter)}`;
        const res = await fetch(url, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to fetch images");

        const images: GalleryImage[] = (json.data as ApiGalleryImage[]).map((img) => ({
          id: img.id,
          src: img.view_url,
          alt: "Uploaded gallery image",
        }));

        // Split into two rows for the marquee. Each photo belongs to exactly
        // one row — no reuse/fallback across rows, so a small gallery (even
        // a single photo) never gets duplicated into the other row.
        if (images.length === 0) {
          setRowOneImages([]);
          setRowTwoImages([]);
        } else {
          const mid = Math.ceil(images.length / 2);
          setRowOneImages(images.slice(0, mid));
          setRowTwoImages(images.slice(mid));
        }
      } catch (err) {
        console.error("Failed to load chapter images:", err);
        setRowOneImages([]);
        setRowTwoImages([]);
      } finally {
        setLoading(false);
      }
    }
    fetchImages();
  }, [sessionId, chapter]);

  const hasImages = rowOneImages.length > 0 || rowTwoImages.length > 0;

  return (
    <section className="gip-section" aria-label="Our Work Gallery">
      <BackButton />

      {/* ---------- Header ---------- */}
      <div className="gip-header">
        <div className="gip-heading-group">
          <h2 className="gip-title">{chapter ?? "Our Work"}</h2>
          <p className="gip-desc">
            Photos shared by you for this chapter.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="gip-loading">Loading images...</div>
      ) : !hasImages ? (
        <div className="gip-empty">
          <img src={FALLBACK_IMG} alt="No images yet" loading="lazy" />
          <p>No images uploaded for this chapter yet.</p>
        </div>
      ) : (
        <>
          {/* ---------- Row 1: scrolls right -> left ---------- */}
          <div className="gip-marquee-row gip-marquee-row--top">
            <div
              className={`gip-marquee-track${rowOneImages.length > 1 ? " gip-marquee-track--right" : ""
                }`}
            >
              {(rowOneImages.length > 1
                ? [...rowOneImages, ...rowOneImages]
                : rowOneImages
              ).map((img, idx) => (
                <div
                  className={`gip-card${idx % rowOneImages.length === 0 ? " gip-card--circle" : ""}`}
                  key={`row1-${img.id}-${idx}`}
                >
                  <img src={img.src} alt={img.alt} loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          {/* ---------- Row 2: scrolls left -> right (only when it has its own photos) ---------- */}
          {rowTwoImages.length > 0 && (
            <div className="gip-marquee-row gip-marquee-row--bottom">
              <div
                className={`gip-marquee-track${rowTwoImages.length > 1 ? " gip-marquee-track--left" : ""
                  }`}
              >
                {(rowTwoImages.length > 1
                  ? [...rowTwoImages, ...rowTwoImages]
                  : rowTwoImages
                ).map((img, idx) => (
                  <div className="gip-card" key={`row2-${img.id}-${idx}`}>
                    <img src={img.src} alt={img.alt} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default Galleryinnerpage;
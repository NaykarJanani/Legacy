import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PageFlip } from 'page-flip';
import * as pdfjsLib from 'pdfjs-dist';
import './AdminFlipbookViewer.css';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const AdminFlipbookViewer = () => {
    const location = useLocation();
    const book = location.state;

    const flipBookRef = useRef<HTMLDivElement>(null);
    const pageFlipRef = useRef<PageFlip | null>(null);
    const isInitialized = useRef(false); // ✅ prevent double init
    const [pages, setPages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    useEffect(() => {
        if (!book?.pdfUrl) return;

        let cancelled = false; // ✅ prevent stale state updates on double render

        const loadPDF = async () => {
            try {
                setLoading(true);

                const pdf = await pdfjsLib.getDocument({
                    url: book.pdfUrl,
                    withCredentials: false,
                }).promise;

                if (cancelled) return; // ✅ stop if component re-ran

                setTotalPages(pdf.numPages);
                const pageImages: string[] = [];

                // Some PDFs export each "page" as a left+right spread combined
                // into one wide page — split those into two separate flip-book
                // leaves so the page count matches the real book, not the PDF's
                // file layout. (Mirrors the logic in UserFlipbookPage.tsx.)
                const SPREAD_ASPECT_RATIO = 1.15; // width/height above this = spread (landscape-ish)

                for (let i = 1; i <= pdf.numPages; i++) {
                    if (cancelled) return; // ✅ stop mid-loop if re-ran

                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });

                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    const ctx = canvas.getContext('2d')!;
                    const renderContext = {
                        canvas,
                        canvasContext: ctx,
                        viewport,
                    };
                    await page.render(renderContext).promise;

                    const isSpread = canvas.width / canvas.height > SPREAD_ASPECT_RATIO;

                    if (isSpread) {
                        const halfWidth = canvas.width / 2;

                        const leftCanvas = document.createElement('canvas');
                        leftCanvas.width = halfWidth;
                        leftCanvas.height = canvas.height;
                        leftCanvas
                            .getContext('2d')!
                            .drawImage(canvas, 0, 0, halfWidth, canvas.height, 0, 0, halfWidth, canvas.height);

                        const rightCanvas = document.createElement('canvas');
                        rightCanvas.width = halfWidth;
                        rightCanvas.height = canvas.height;
                        rightCanvas
                            .getContext('2d')!
                            .drawImage(canvas, halfWidth, 0, halfWidth, canvas.height, 0, 0, halfWidth, canvas.height);

                        pageImages.push(leftCanvas.toDataURL('image/jpeg', 0.85));
                        pageImages.push(rightCanvas.toDataURL('image/jpeg', 0.85));
                    } else {
                        pageImages.push(canvas.toDataURL('image/jpeg', 0.85));
                    }
                }

                if (!cancelled) {
                    setTotalPages(pageImages.length);
                    setPages(pageImages);
                }

            } catch (err) {
                console.error('PDF load error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadPDF();

        return () => {
            cancelled = true; // ✅ cleanup on unmount/re-run
        };
    }, [book?.pdfUrl]);

    useEffect(() => {
        if (pages.length === 0 || !flipBookRef.current) return;
        if (isInitialized.current) return; // ✅ skip if already initialized

        isInitialized.current = true;

        const pageFlip = new PageFlip(flipBookRef.current, {
            width: 550,
            height: 733,
            size: 'stretch',
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

        pageFlip.on('flip', (e: any) => {
            setCurrentPage(e.data);
        });

        pageFlipRef.current = pageFlip;

        return () => {
            isInitialized.current = false;
            pageFlip.destroy();
            pageFlipRef.current = null;
        };
    }, [pages]);

    const handlePrev = useCallback(() => {
        if (pageFlipRef.current) {
            pageFlipRef.current.flipPrev();
        }
    }, []);

    const handleNext = useCallback(() => {
        if (pageFlipRef.current) {
            pageFlipRef.current.flipNext();
        }
    }, []);

    if (!book) return <h2>No Flipbook Data Found</h2>;

    return (
        <div className="viewer-container">
            <h1>{book.bookTitle}</h1>
            <p>Uploaded By: {book.userName}</p>

            {loading ? (
                <div className="loading-box">
                    <p>Loading flipbook... please wait</p>
                </div>
            ) : (
                <>
                    <div className="flipbook-wrapper">
                        <div ref={flipBookRef} />
                    </div>

                    <div className="flipbook-controls">
                        <button
                            onClick={handlePrev}
                            disabled={currentPage === 0}
                        >
                            ← Prev
                        </button>

                        <span>{currentPage + 1} / {totalPages}</span>

                        <button
                            onClick={handleNext}
                            disabled={currentPage >= totalPages - 1}
                        >
                            Next →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminFlipbookViewer;
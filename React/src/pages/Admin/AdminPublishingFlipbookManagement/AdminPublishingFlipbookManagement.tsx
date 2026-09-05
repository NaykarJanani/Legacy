import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../../services/api';
import { getUrgencyLevel, formatAge } from '../../../utils/publishRequestUrgency';
import './AdminPublishingFlipbookManagement.css';

interface FlipbookItem {
    id: number;
    userName: string;
    bookTitle: string;
    pdfUrl: string;
    status?: string;
    totalPages?: number;
    editorName?: string | null;
    updatedAt?: string;
}

interface PublishRequestRow {
    id: number;
    user_id: number;
    editor_id: number | null;
    status: string;
    created_at: string;
    customer_name: string;
    editor_name: string | null;
    editor_email: string | null;
}

const AdminPublishingFlipbookManagement = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState<PublishRequestRow[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [flipbooks, setFlipbooks] = useState<FlipbookItem[]>([]);
    const [loadingFlipbooks, setLoadingFlipbooks] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const res = await api.get('/flipbook-publish-requests');
                if (res.data.success) {
                    setRequests(res.data.data || []);
                } else {
                    toast.error(res?.data?.message || 'Failed to fetch publish requests');
                }
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Something went wrong');
            } finally {
                setLoadingRequests(false);
            }
        };

        fetchRequests();
        const interval = setInterval(fetchRequests, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchFlipbooks = async () => {
            try {
                const res = await api.get('/flipbooks');
                if (res.data.success) {
                    const mapped: FlipbookItem[] = (res.data.data || []).map((fb: any) => ({
                        id: fb.id,
                        userName: fb.customer_name,
                        bookTitle: fb.title || `${fb.customer_name}'s Legacy Book`,
                        pdfUrl: fb.pdf_url,
                        status: fb.status,
                        totalPages: fb.total_pages,
                        editorName: fb.editor_name,
                        updatedAt: fb.updated_at,
                    }));
                    setFlipbooks(mapped);
                } else {
                    toast.error(res?.data?.message || 'Failed to fetch flipbooks');
                }
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Something went wrong');
            } finally {
                setLoadingFlipbooks(false);
            }
        };

        fetchFlipbooks();
    }, []);

    const handleOpenFlipbook = (book: FlipbookItem) => {
        if (!book.pdfUrl) {
            toast.error('This flipbook has no viewable file yet');
            return;
        }
        navigate(`/Admin/FlipbookViewer/${book.id}`, {
            state: book,
        });
    };

    const [publishingId, setPublishingId] = useState<number | null>(null);

    const handleMarkPublished = async (id: number) => {
        try {
            setPublishingId(id);
            const res = await api.patch(`/flipbook-publish-requests/${id}/publish`);
            if (res.data.success) {
                setRequests((prev) => prev.filter((r) => r.id !== id));
                toast.success('Marked as published');
            } else {
                toast.error(res?.data?.message || 'Failed to update request');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Something went wrong');
        } finally {
            setPublishingId(null);
        }
    };

    return (
        <div className="flipbook-management-container">
            <h1 className="page-title">Publishing Flipbooks</h1>

            {/* ── PENDING PUBLISH REQUESTS (oversight across every editor) ── */}
            <div className="publishrequests-admin-section">
                <div className="publishrequests-admin-header">
                    <h2>Pending Publish Requests</h2>
                    <span>{requests.length} outstanding</span>
                </div>

                {!loadingRequests && requests.length === 0 && (
                    <div className="publishrequests-admin-empty">
                        No pending publish requests right now.
                    </div>
                )}

                {requests.length > 0 && (
                    <div className="publishrequests-admin-list">
                        {requests.map((req) => {
                            const urgency = getUrgencyLevel(req.created_at);
                            return (
                                <div
                                    className={`publishrequests-admin-row publishrequests-admin-row-${urgency}`}
                                    key={req.id}
                                >
                                    <div className="publishrequests-admin-icon">
                                        <BookOpen size={16} />
                                    </div>

                                    <div className="publishrequests-admin-info">
                                        <p>
                                            <strong>{req.customer_name}</strong> requested publish
                                        </p>
                                        <span>
                                            Assigned to{' '}
                                            {req.editor_name ? (
                                                <strong>{req.editor_name}</strong>
                                            ) : (
                                                'no editor found'
                                            )}
                                            {' · '}
                                            {req.status === 'acknowledged' ? 'seen, not yet published' : 'unseen'}
                                        </span>
                                    </div>

                                    <div className={`publishrequests-admin-age publishrequests-admin-age-${urgency}`}>
                                        {urgency === 'overdue' && <AlertCircle size={13} />}
                                        {formatAge(req.created_at)}
                                    </div>

                                    <button
                                        className="publishrequests-admin-publish-btn"
                                        disabled={publishingId === req.id}
                                        onClick={() => handleMarkPublished(req.id)}
                                    >
                                        <CheckCircle size={13} />
                                        Book Published
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flipbook-list">
                {loadingFlipbooks && (
                    <div className="publishrequests-admin-empty">Loading flipbooks…</div>
                )}

                {!loadingFlipbooks && flipbooks.length === 0 && (
                    <div className="publishrequests-admin-empty">
                        No flipbooks have been published yet.
                    </div>
                )}

                {flipbooks.map((book) => (
                    <div
                        key={book.id}
                        className="flipbook-card"
                        onClick={() => handleOpenFlipbook(book)}
                    >
                        <div className="user-avatar">
                            {book.userName.charAt(0)}
                        </div>

                        <div className="book-info">
                            <h3>{book.userName}</h3>
                            <p>{book.bookTitle}</p>
                            <span className="flipbook-card-meta">
                                {book.totalPages ? `${book.totalPages} pages` : ''}
                                {book.editorName ? ` · Edited by ${book.editorName}` : ''}
                                {book.status ? ` · ${book.status}` : ''}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminPublishingFlipbookManagement;
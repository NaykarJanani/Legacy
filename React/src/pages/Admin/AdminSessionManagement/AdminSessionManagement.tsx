import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    Edit2,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import './AdminSessionManagement.css';
import { useLoader } from '../../../context/LoaderContext';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import { confirmAlert } from '../../../utils/confirmAlert';
import * as XLSX from "xlsx";

// TypeScript interfaces matching your API response
interface Question {
    question_id: number;
    question: string;
    status: boolean;
    created_at: string;
    updated_at: string;
}

interface SubChapter {
    sub_session_id: number;
    title: string;
    questions?: Question[];
}

interface MainPoint {
    title: string;
    subChapters?: SubChapter[];
}

interface Session {
    session_id: number;
    title: string;
    seq: string;
    category: string;
    status: boolean;
    created_at: string;
    updated_at: string;
    mainPoints?: MainPoint[];
}

// Internal component interfaces for nested structure
interface NestedItem {
    id: string;
    title: string;
    status: boolean;
    children?: NestedItem[];
}

interface Topic {
    id: string;
    title: string;
    seq: string;
    number: number;
    isActive: boolean;
    children?: NestedItem[];
}

const AdminSessionManagement: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [sessions, setSessions] = useState<Session[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);


    const { showLoader, hideLoader } = useLoader();
    const navigate = useNavigate();
    const [mockApiData, setMockApiData] = useState<Session[]>();


    const getData = async () => {
        showLoader()
        try {
            const res = await api.get('/getSessions');
            if (res.data.success) {
                console.log(res.data.data);
                setMockApiData(res.data.data);

                setSessions(res.data.data);
                setTopics(transformApiDataToTopics(res.data.data));
            } else {
                toast.error(res?.data?.message || "Something went wrong");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Something went wrong");
        } finally {
            hideLoader();
        }

    }

    useEffect(() => {
        getData();
    }, [])



    // Transform API data to component format
    const transformApiDataToTopics = (apiData: Session[]): Topic[] => {
        return apiData.map((session, index) => {
            const children: NestedItem[] = session.mainPoints?.map((mainPoint, mainIndex) => {

    // SUB CHAPTERS
    const subChapterChildren: NestedItem[] = mainPoint.subChapters?.map((subChapter, subIndex) => {

        // QUESTIONS
        const questionChildren: NestedItem[] = subChapter.questions?.map((question) => ({
            id: `question-${question.question_id}`,
            title: question.question,
            status: question.status,
            children: undefined
        })) || [];

        return {
            id: `subchapter-${mainIndex}-${subIndex}`,
            title: subChapter.title,
            status: true,
            children: questionChildren
        };

    }) || [];

    return {
        id: `chapter-${mainIndex}`,
        title: mainPoint.title,
        status: true,
        children: subChapterChildren
    };

}) || [];

            return {
                id: `${session.session_id}`,
                seq: `${session.seq}`,
                title: session.title,
                number: index + 1,
                isActive: session.status,
                children: children.length > 0 ? children : undefined
            };
        });
    };



    const toggleItem = (itemId: string) => {
        setExpandedItems((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

   const handleToggle = async (topicId: string) => {

    try {

        const sessionId = parseInt(topicId);

        const currentSession = sessions.find(
            (s) => s.session_id === sessionId
        );

        if (!currentSession) return;

        const updatedStatus = !currentSession.status;

        // API CALL
        await api.post('/updateSessionStatus', {
            session_id: sessionId,
            status: updatedStatus
        });

        // UPDATE UI
        setTopics((prevTopics) =>
            prevTopics.map((topic) =>
                topic.id === topicId
                    ? { ...topic, isActive: updatedStatus }
                    : topic
            )
        );

        setSessions((prevSessions) =>
            prevSessions.map((session) =>
                session.session_id === sessionId
                    ? { ...session, status: updatedStatus }
                    : session
            )
        );

        toast.success("Status updated");

    } catch (err: any) {

        toast.error(
            err.response?.data?.message ||
            "Failed to update status"
        );

    }
};

    const handleNumberChange = async (topicId: string, newNumber: number) => {
        const confirm = await confirmAlert('Confirm.?', "");

        if (confirm) {
            try {
                showLoader()

                await api.post('/updateSessionSeq', { session_id: topicId, newNumber });

                getData();
            } catch (err: any) {
                toast.error(err.response?.data?.message || "Something went wrong");
            } finally {
                hideLoader();
            }
        }

    };

    
    const handleEdit = (topic: any) => {
    const rawSession = sessions.find(
        s => String(s.session_id) === String(topic.id)
    );

    if (!rawSession) {
        toast.error("Session data not found");
        return;
    }

    navigate('/Admin/SessionManagement/edit', {
        state: {
            session: rawSession,
            mode: 'edit'
        }
    });
};

    const handleAddSession = () => {
        navigate('/Admin/SessionManagement/Register');
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            showLoader();

            const data = event.target?.result;

            const workbook = XLSX.read(data, { type: 'binary' });

            const sheetName = workbook.SheetNames[0];

            const sheet = workbook.Sheets[sheetName];

            const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

            /*
                Structure:
                Session ->
                    category
                    chapters ->
                        subchapters ->
                            questions
            */

            const grouped = new Map<
                string,
                {
                    category: string;
                    chapters: Map<
                        string,
                        Map<string, string[]>
                    >;
                }
            >();

            jsonData.forEach((row) => {

                const session = row['Session']?.toString().trim();

                const category = row['Category']?.toString().trim().toLowerCase();

                const chapter = row['Chapter']?.toString().trim();

                const subChapter = row['SubChapter']?.toString().trim();

                const question = row['Question']?.toString().trim();

                if (
                    !session ||
                    !category ||
                    !chapter ||
                    !subChapter ||
                    !question
                ) {
                    return;
                }

                // Create session
                if (!grouped.has(session)) {
                    grouped.set(session, {
                        category,
                        chapters: new Map(),
                    });
                }

                const sessionData = grouped.get(session)!;

                // Create chapter
                if (!sessionData.chapters.has(chapter)) {
                    sessionData.chapters.set(chapter, new Map());
                }

                const subMap = sessionData.chapters.get(chapter)!;

                // Create subchapter
                if (!subMap.has(subChapter)) {
                    subMap.set(subChapter, []);
                }

                // Add question
                subMap.get(subChapter)!.push(question);
            });

            const importedSessions: any[] = [];

            grouped.forEach((sessionData, sessionName) => {

                const mainPoints: any[] = [];

                sessionData.chapters.forEach((subMap, chapterTitle) => {

                    const subChapters: any[] = [];

                    subMap.forEach((questions, subChapterTitle) => {

                        subChapters.push({
                            title: subChapterTitle,

                            subPoints: questions.map((q) => ({
                                title: q,
                            })),
                        });
                    });

                    mainPoints.push({
                        title: chapterTitle,
                        subChapters,
                    });
                });

                importedSessions.push({
                    sessionName,
                    category: sessionData.category,
                    mainPoints,
                });
            });

            await api.post('/addSession', {
                sessions: importedSessions,
            });

            toast.success(
                `Imported ${importedSessions.length} session(s) successfully`
            );

            getData();

        } catch (err: any) {

            toast.error(
                err.response?.data?.message || 'Import failed'
            );

        } finally {

            hideLoader();

            e.target.value = '';
        }
    };

    reader.readAsBinaryString(file);
};

    // Recursive search function
    const searchInNestedItems = (items: NestedItem[] | undefined, query: string): NestedItem[] | undefined => {
        if (!items || !query) return items;

        const lowerQuery = query.toLowerCase();
        const filtered: NestedItem[] = [];

        items.forEach((item) => {
            const matchesTitle = item.title.toLowerCase().includes(lowerQuery);
            const filteredChildren = searchInNestedItems(item.children, query);

            if (matchesTitle || (filteredChildren && filteredChildren.length > 0)) {
                filtered.push({
                    ...item,
                    children: filteredChildren,
                });
            }
        });

        return filtered.length > 0 ? filtered : undefined;
    };

    // Filter topics based on search
    const filteredTopics = searchQuery
        ? topics
            .map((topic) => {
                const matchesTitle = topic.title.toLowerCase().includes(searchQuery.toLowerCase());
                const filteredChildren = searchInNestedItems(topic.children, searchQuery);

                if (matchesTitle || (filteredChildren && filteredChildren.length > 0)) {
                    return {
                        ...topic,
                        children: filteredChildren,
                    };
                }
                return null;
            })
            .filter((topic: any): topic is Topic => topic !== null)
        : topics;

    // Recursive component for nested items with infinite depth support
    const NestedItemComponent: React.FC<{
        item: NestedItem;
        level: number;
    }> = ({ item, level }) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.has(item.id);

        return (
            <div className="nested-item">
                <div
                    className={`nested-item-header level-${level}`}
                    onClick={() => hasChildren && toggleItem(item.id)}
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                >
                    <div className="nested-item-left">
                        {hasChildren ? (
                            isExpanded ? (
                                <ChevronDown size={18} className="chevron-icon" />
                            ) : (
                                <ChevronRight size={18} className="chevron-icon" />
                            )
                        ) : (
                            <div className="chevron-placeholder"></div>
                        )}

                        <span className="nested-item-title" title={item.title}>
                            {item.title}
                        </span>
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="nested-children">
                        {item.children!.map((child) => (
                            <NestedItemComponent
                                key={child.id}
                                item={child}
                                level={level + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="session-management">
            <div className="container">
                {/* Header Section */}
                <div className="header">
                    <h1 className="title">Session Management</h1>
                </div>

                {/* Search and Add Button */}
                {/* Search and Add Button */}
<div className="action-bar">

    {/* LEFT SIDE SEARCH */}
    <div className="search-container">
        <Search className="search-icon" size={20} />

        <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
        />
    </div>

    {/* RIGHT SIDE */}
    <div className="addsessionbuttonclass">

        {/* BUTTONS */}
        <div className="button-row">

            {/* ADD SESSION BUTTON */}
            <button
                className="add-button add-session-btn"
                onClick={handleAddSession}
            >
                <Plus size={20} />
                <span>Add Session</span>
            </button>

            {/* IMPORT EXCEL BUTTON */}
            <label
                className="add-button"
                style={{ cursor: 'pointer' }}
            >
                <Plus size={20} />
                <span>Import Excel</span>

                <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleExcelUpload}
                />
            </label>

        </div>

        {/* SECOND LINE INFO */}
        <div className="excel-info">

            <p className="excel-title">
                Import Questions from Excel
            </p>

            <p className="excel-format">
    Required columns:
    <strong> Session </strong> |
    <strong> Category </strong> |
    <strong> Chapter </strong> |
    <strong> SubChapter </strong> |
    <strong> Question </strong>
</p>

        </div>

    </div>

</div>
                {/* Topics Section */}
                <div className="topics-section">
                    <h2 className="section-heading">Topics</h2>

                    {filteredTopics.length === 0 ? (
                        <div className="no-results">
                            No results found for "{searchQuery}"
                        </div>
                    ) : (
                        <div className="topics-list">
                            {filteredTopics.map((topic: any) => (
                                <div key={topic.id} className="topic-card">
                                    {/* Main Topic */}
                                    <div className="topic-header">
                                        <div className="topic-left">

                                            <h3 className="topic-title" title={topic.title}>
                                                {topic.title}
                                            </h3>
                                        </div>

                                        <div className="topic-actions">
                                            <select
                                                value={topic.seq}
                                                onChange={(e) => {
                                                    handleNumberChange(topic.id, parseInt(e.target.value))
                                                }
                                                }
                                                className="number-dropdown"
                                            >
                                                {Array.from({ length: sessions.length }, (_, i) => i + 1).map((num) => (
                                                    <option key={num} value={num}>
                                                        {num}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                className="icon-button edit-button"
                                                onClick={() => handleEdit(topic)}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={topic.isActive}
                                                    onChange={() => handleToggle(topic.id)}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Nested Children */}
                                    {topic.children && topic.children.length > 0 && (
                                        <div className="nested-container">
                                            {topic.children.map((child: any) => (
                                                <NestedItemComponent
                                                    key={child.id}
                                                    item={child}
                                                    level={0}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSessionManagement;

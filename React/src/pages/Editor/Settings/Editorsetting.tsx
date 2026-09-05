import React, { useRef, useState, useEffect } from "react";
import "./Editorsetting.css";
import api from "../../../services/api";
import { toast } from "react-toastify";
import { useAuth } from "../../../hooks/useAuth";

const EditorSetting: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedFile, setSelectedFile] = useState<string>("");
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const { updateUser } = useAuth();

    // ── real, backend-wired fields ──────────────────────────────────────────
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [language, setLanguage] = useState("English");
    const [timezone, setTimezone] = useState("IST");
    const [avatarKey, setAvatarKey] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string>("src/assets/child.jpg");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // The label for where the user is returning to
    const previousPageName = "All Projects"; 

    useEffect(() => {
        api.get("/profile")
            .then((res) => {
                const data = res.data.data;
                setUsername(data.username || "");
                setEmail(data.email || "");
                setDisplayName(data.display_name || "");
                setLanguage(data.language || "English");
                setTimezone(data.timezone || "IST");
                setAvatarKey(data.avatar_key || null);
                if (data.avatar_url) setAvatarUrl(data.avatar_url);
            })
            .catch(() => {
                toast.error("Failed to load profile");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!username.trim() || !email.trim()) {
            toast.error("Username and email are required");
            return;
        }
        setSaving(true);
        try {
            const res = await api.put("/profile", {
                username,
                email,
                display_name: displayName,
                language,
                timezone,
                avatar_key: avatarKey,
                ...(password.trim() !== "" ? { password } : {}),
            });
            const data = res.data.data;
            if (data.avatar_url) setAvatarUrl(data.avatar_url);

            // Push into shared auth state so the sidebar reflects the new
            // display name/username immediately — no reload required.
            updateUser({
                username: data.username,
                display_name: data.display_name,
            });

            toast.success("Profile updated");
            setPassword("");
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSelectedFile(file.name);
        setUploadingAvatar(true);

        try {
            // 1. Ask backend for a pre-signed S3 upload URL
            const urlRes = await api.post("/profile/avatar-upload-url", {
                fileName: file.name,
                fileType: file.type,
            });
            const { uploadUrl, key } = urlRes.data.data;

            // 2. Upload the file directly to S3 (raw fetch — NOT through the
            //    `api` instance, since that would rewrite this URL)
            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });
            if (!uploadRes.ok) throw new Error("Image upload to S3 failed");

            // 3. Preview immediately + remember the key for the next Save
            setAvatarKey(key);
            setAvatarUrl(URL.createObjectURL(file));
            toast.success("Avatar uploaded — click Save Changes to confirm");
        } catch (err: any) {
            toast.error(err.message || "Avatar upload failed");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleBackClick = () => {
        // Navigates back to the Biography Projects page
        window.history.back();
    };

    if (loading) {
        return <div className="editordashboard-container">Loading profile...</div>;
    }

    return (
        <div className="editordashboard-container">
            <div className="editorSetting-wrapper">
                
                {/* NAVIGATION BACK HEADER */}
                <div className="editorSetting-nav-header">
                    <button 
                        className="editorSetting-backBtn" 
                        onClick={handleBackClick}
                        aria-label={`Back to ${previousPageName}`}
                    >
                        <svg 
                            width="18" 
                            height="18" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        <span className="back-text">{previousPageName}</span>
                    </button>
                </div>

                <div className="editorSetting-container">
                    <h1 className="editorSetting-title">
                        Editor Profile Settings
                    </h1>

                    <div className="editorSetting-card">
                        <div className="editorSetting-headerRow">
                            <div className="editorSetting-profileInfo">
                                <h2 className="editorSetting-sectionTitle">
                                    Profile Information
                                </h2>
                            </div>

                            <div className="editorSetting-profileRow">
                                <div className="editorSetting-avatar">
                                    <img
                                        src={avatarUrl}
                                        alt="Profile"
                                        className="editorSetting-avatarImg"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* HIDDEN FILE INPUT */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="editorSetting-hiddenInput"
                            accept=".jpg,.jpeg,.png,.gif"
                            onChange={handleFileChange}
                        />

                        {/* FORM GRID */}
                        <div className="editorSetting-formGrid">
                            <div className="editorSetting-inputGroup">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="arthur_pendelton"
                                />
                            </div>

                            <div className="editorSetting-inputGroup">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="How you appear to others"
                                />
                            </div>

                            <div className="editorSetting-inputGroup">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="arthur@lifestory.com"
                                />
                            </div>

                            <div className="editorSetting-inputGroup">
                                <label>Language</label>
                                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                                    <option>English</option>
                                    <option>Hindi</option>
                                    <option>Gujarati</option>
                                </select>
                            </div>

                            <div className="editorSetting-inputGroup">
                                <label>New Password (leave blank to keep current)</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="editorSetting-inputGroup editorSetting-fullWidth">
                                <div className="editorSetting-uploadGrid">
                                    <div className="editorSetting-inputGroup">
                                        <label>Timezone</label>
                                        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                                            <option>UTC</option>
                                            <option>IST</option>
                                            <option>PST</option>
                                        </select>
                                    </div>

                                    <div className="editorSetting-inputGroup">
                                        <label>Upload File</label>
                                        <button
                                            type="button"
                                            className="editorSetting-uploadBtn editorSetting-uploadFullBtn"
                                            onClick={handleFileClick}
                                            disabled={uploadingAvatar}
                                        >
                                            {uploadingAvatar ? "Uploading..." : (selectedFile || "Choose File")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="editorSetting-buttonRow">
                            <button 
                                className="editorSetting-cancelBtn" 
                                onClick={handleBackClick}
                            >
                                Cancel
                            </button>
                            <button
                                className="editorSetting-saveBtn"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditorSetting;
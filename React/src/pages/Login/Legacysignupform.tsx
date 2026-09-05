import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import type { ChangeEvent } from "react";
import "./Legacysignupform.css";

// ─── Types ───────────────────────────────────────────────────────────────────
type UserCategory = "MSME" | "School" | "Temple" | "Village" | "";
type Gender = "Male" | "Female" | "Other" | "Prefer not to say" | "";
type Language =
    | "Hindi"
    | "English"
    | "Gujarati"
    | "Marathi"
    | "Tamil"
    | "Telugu"
    | "Kannada"
    | "Bengali"
    | "Other"
    | "";

interface ConsentState {
    identity: boolean;
    mediaCollect: boolean;
    mediaUse: boolean;
    photoRelease: boolean;
    editingUnderstanding: boolean;
    publicSharing: boolean;
    dataStorage: boolean;
    dataRetention: boolean;
    voluntary: boolean;
    finalDeclaration: boolean;
}

interface FormData {
    fullName: string;
    dob: string;
    age: string;
    gender: Gender;
    mobile: string;
    email: string;
    village: string;
    city: string;
    district: string;
    state: string;
    language: Language;
    pinCode: string;
    profilePhoto: File | null;
    userCategory: UserCategory;
    entityName: string;
    username: string;
    password: string;
    confirmPassword: string;
    consent: ConsentState;
}



// ─── Helpers ─────────────────────────────────────────────────────────────────
const calcAge = (dob: string): string => {
    if (!dob) return "";
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? String(age) : "";
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const SectionHeader = ({
    number,
    title,
    icon,
}: {
    number: string;
    title: string;
    icon: string;
}) => (
    <div className="legacy-section-header">
        <span className="legacy-section-number">{number}</span>
        <span className="legacy-section-icon">{icon}</span>
        <h2 className="legacy-section-title">{title}</h2>
        <div className="legacy-section-rule" />
    </div>
);

const Field = ({
    label,
    required,
    children,
    hint,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    hint?: string;
}) => (
    <div className="legacy-field">
        <label className="legacy-field-label">
            {label}
            {required && <span className="legacy-required">*</span>}
        </label>
        {children}
        {hint && <span className="legacy-field-hint">{hint}</span>}
    </div>
);

const ConsentItem = ({
    id,
    checked,
    onChange,
    children,
}: {
    id: string;
    checked: boolean;
    onChange: () => void;
    children: React.ReactNode;
}) => (
    <label
        className={`legacy-consent-item${checked ? " legacy-consent-item--checked" : ""}`}
        htmlFor={id}
    >
        <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={onChange}
            className="legacy-consent-checkbox"
        />
        <span className="legacy-consent-check-visual">
            {checked && (
                <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M1 5L4.5 8.5L11 1.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </span>
        <span className="legacy-consent-text">{children}</span>
    </label>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LegacySignupForm() {
     const navigate = useNavigate();
    const fileRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [form, setForm] = useState<FormData>({
        fullName: "",
        dob: "",
        age: "",
        gender: "",
        mobile: "",
        email: "",
        village: "",
        city: "",
        district: "",
        state: "",
        language: "",
        pinCode: "",
        profilePhoto: null,
        userCategory: "",
        entityName: "",
        username: "",
        password: "",
        confirmPassword: "",
        consent: {
            identity: false,
            mediaCollect: false,
            mediaUse: false,
            photoRelease: false,
            editingUnderstanding: false,
            publicSharing: false,
            dataStorage: false,
            dataRetention: false,
            voluntary: false,
            finalDeclaration: false,
        },
    });

    const set = (key: keyof Omit<FormData, "consent" | "profilePhoto">, value: string) =>
        setForm((p) => ({ ...p, [key]: value }));

    const setConsent = (key: keyof ConsentState) =>
        setForm((p) => ({
            ...p,
            consent: { ...p.consent, [key]: !p.consent[key] },
        }));

    const handleDob = (val: string) => {
        setForm((p) => ({ ...p, dob: val, age: calcAge(val) }));
    };

    const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setForm((p) => ({ ...p, profilePhoto: file }));
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const allConsentsChecked = Object.values(form.consent).every(Boolean);
    const consentCount = Object.values(form.consent).filter(Boolean).length;
    const consentTotal = Object.keys(form.consent).length;

    const handleSubmit = async () => {
  if (!allConsentsChecked) return alert("Please accept all consent declarations.");
  if (form.password !== form.confirmPassword) return alert("Passwords do not match.");
  if (!form.userCategory) return alert("Please select a user category.");
  if (!form.entityName.trim()) return alert("Please enter the entity name.");

  // map form category → backend category value
  const categoryMap: Record<string, string> = {
  MSME: "msme",
  School: "school",
  Temple: "temple",
  Village: "village",
};

  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL || "http://localhost:5002"}/register`,
      {
        name:       form.fullName,
        email:      form.email,
        contact:    form.mobile,
        industry:   form.userCategory,
        entityName: form.entityName.trim(),
        website:    "",
        year:       new Date().getFullYear().toString(),
        pincode:    form.pinCode,
        address:    `${form.village} ${form.city}`.trim() || form.state,
        state:      form.state,
        district:   form.district,
        category:   categoryMap[form.userCategory] ?? "msme",
        username: form.username,
        password:   form.password,
      }
    );

    if (res.data.success) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert(res.data.message || "Registration failed. Please try again.");
    }
  } catch (err: any) {
    alert(err.response?.data?.message || "Something went wrong. Please try again.");
  }
};  
    // ── Success screen ──
    if (submitted) {
        return (
            <div className="legacy-page">
                <div className="legacy-success-card">
                    <div className="legacy-success-seal">✦</div>
                    <h2 className="legacy-success-title">Registration Submitted</h2>
                    <p className="legacy-success-body">
                        Welcome to the Legacy Project, <strong>{form.fullName}</strong>. Your story is now
                        part of something enduring.
                    </p>
                  
<button className="legacy-btn-secondary" onClick={() => navigate("/login")}>
    Go to Login →
</button>
                </div>
            </div>
        );
    }

    return (
        <div className="legacy-page">
            {/* ── Header ── */}
            <header className="legacy-form-header">
                <div className="legacy-header-emblem">✦</div>
                <h1 className="legacy-form-title">Legacy Project</h1>
                <p className="legacy-form-subtitle">Registration &amp; Consent Form</p>
                <div className="legacy-header-ornament" />
            </header>

            <div className="legacy-form-body">

                {/* ── Section 1: Basic Details ── */}
                <section className="legacy-form-section">
                    <SectionHeader number="01" title="Basic Details" icon="👤" />

                    <div className="legacy-grid-2">
                        <Field label="Full Name" required>
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="As per official records"
                                value={form.fullName}
                                onChange={(e) => set("fullName", e.target.value)}
                            />
                        </Field>

                        <Field label="Date of Birth" required>
                            <input
                                className="legacy-input"
                                type="date"
                                value={form.dob}
                                onChange={(e) => handleDob(e.target.value)}
                                max={new Date().toISOString().split("T")[0]}
                            />
                        </Field>

                        <Field label="Age">
                            <input
                                className="legacy-input legacy-input--readonly"
                                type="text"
                                value={form.age}
                                readOnly
                                placeholder="Auto-calculated"
                            />
                        </Field>

                        <Field label="Gender" required>
                            <select
                                className="legacy-input"
                                value={form.gender}
                                onChange={(e) => set("gender", e.target.value as Gender)}
                            >
                                <option value="">Select gender</option>
                                {["Male", "Female", "Other", "Prefer not to say"].map((g) => (
                                    <option key={g}>{g}</option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Mobile Number" required>
                            <input
                                className="legacy-input"
                                type="tel"
                                placeholder="+91 XXXXX XXXXX"
                                maxLength={13}
                                value={form.mobile}
                                onChange={(e) =>
                                    set("mobile", e.target.value.replace(/[^\d+\s-]/g, ""))
                                }
                            />
                        </Field>

                        <Field label="Email Address" required>
                            <input
                                className="legacy-input"
                                type="email"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={(e) => set("email", e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="legacy-field-group-label">Address</div>

                    <div className="legacy-grid-2">
                        <Field label="Village">
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="Village name"
                                value={form.village}
                                onChange={(e) => set("village", e.target.value)}
                            />
                        </Field>

                        <Field label="City">
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="City"
                                value={form.city}
                                onChange={(e) => set("city", e.target.value)}
                            />
                        </Field>

                        <Field label="District">
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="District"
                                value={form.district}
                                onChange={(e) => set("district", e.target.value)}
                            />
                        </Field>

                        <Field label="State" required>
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="State"
                                value={form.state}
                                onChange={(e) => set("state", e.target.value)}
                            />
                        </Field>

                        <Field label="PIN Code" required>
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="6-digit PIN"
                                maxLength={6}
                                value={form.pinCode}
                                onChange={(e) => set("pinCode", e.target.value.replace(/\D/g, ""))}
                            />
                        </Field>

                        <Field label="Language" required>
                            <select
                                className="legacy-input"
                                value={form.language}
                                onChange={(e) => set("language", e.target.value as Language)}
                            >
                                <option value="">Select language</option>
                                {[
                                    "Hindi", "English", "Gujarati", "Marathi",
                                    "Tamil", "Telugu", "Kannada", "Bengali", "Other",
                                ].map((l) => (
                                    <option key={l}>{l}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {/* Profile Photo */}
                    <Field label="Profile Photo" hint="Optional · JPG or PNG · Max 2 MB">
                        <div className="legacy-photo-upload" onClick={() => fileRef.current?.click()}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Profile preview" className="legacy-photo-preview" />
                            ) : (
                                <div className="legacy-photo-placeholder">
                                    <span className="legacy-photo-icon">📷</span>
                                    <span className="legacy-photo-cta">Click to upload photo</span>
                                </div>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png"
                                style={{ display: "none" }}
                                onChange={handlePhoto}
                            />
                        </div>
                        {photoPreview && (
                            <button
                                className="legacy-btn-ghost-sm"
                                onClick={() => {
                                    setPhotoPreview(null);
                                    setForm((p) => ({ ...p, profilePhoto: null }));
                                    if (fileRef.current) fileRef.current.value = "";
                                }}
                            >
                                Remove photo
                            </button>
                        )}
                    </Field>
                </section>

                {/* ── Section 2: User Category ── */}
                <section className="legacy-form-section">
                    <SectionHeader number="02" title="User Category" icon="🏷️" />
                    <p className="legacy-section-note">
                        Select the category that best describes you or your organisation.
                    </p>

                    <div className="legacy-category-grid">
                        {(
                            [
                                { key: "MSME", label: "MSME", sub: "Small Business Owner" },
                                { key: "School", label: "School", sub: "Educational Institution" },
                                { key: "Temple", label: "Temple", sub: "Religious Place" },
                                 { key: "Village", label: "Village", sub: "Community / Rural Area" },
                                
                            ] as const
                        ).map((cat) => (
                            <button
                                key={cat.key}
                                type="button"
                                className={`legacy-category-card${form.userCategory === cat.key ? " legacy-category-card--selected" : ""
                                    }`}
                                onClick={() => setForm((p) => ({ ...p, userCategory: cat.key  as UserCategory,}))}
                            >
                                <span className="legacy-cat-label">{cat.label}</span>
                                <span className="legacy-cat-sub">{cat.sub}</span>
                                <span className="legacy-cat-check">
                                    {form.userCategory === cat.key ? "✦" : ""}
                                </span>
                            </button>
                        ))}
                    </div>

                    {form.userCategory && (
                        <div className="legacy-grid-2">
                            <Field
                                label={
                                    {
                                        School: "School Name",
                                        MSME: "Business Name",
                                        Temple: "Temple Name",
                                        Village: "Village Name",
                                    }[form.userCategory]
                                }
                                required
                            >
                                <input
                                    className="legacy-input"
                                    type="text"
                                    placeholder={`Enter ${
                                        {
                                            School: "school name",
                                            MSME: "business name",
                                            Temple: "temple name",
                                            Village: "village name",
                                        }[form.userCategory]
                                    }`}
                                    value={form.entityName}
                                    onChange={(e) => set("entityName", e.target.value)}
                                />
                            </Field>
                        </div>
                    )}
                </section>

                {/* ── Section 3: Account Security ── */}
                <section className="legacy-form-section">
                    <SectionHeader number="03" title="Account Security" icon="🔐" />

                    <div className="legacy-grid-2">
                        <Field label="Username" required hint="Unique identifier for your account">
                            <input
                                className="legacy-input"
                                type="text"
                                placeholder="Choose a username"
                                value={form.username}
                                onChange={(e) => set("username", e.target.value.replace(/\s/g, ""))}
                            />
                        </Field>

                        <div /> {/* spacer */}

                        <Field label="Password" required hint="Minimum 8 characters">
                            <div className="legacy-input-password-wrap">
                                <input
                                    className="legacy-input"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a strong password"
                                    value={form.password}
                                    onChange={(e) => set("password", e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="legacy-eye-btn"
                                    onClick={() => setShowPassword((p) => !p)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </Field>

                        <Field label="Confirm Password" required>
                            <div className="legacy-input-password-wrap">
                                <input
                                    className={`legacy-input${form.confirmPassword && form.password !== form.confirmPassword
                                            ? " legacy-input--error"
                                            : ""
                                        }`}
                                    type={showConfirm ? "text" : "password"}
                                    placeholder="Re-enter your password"
                                    value={form.confirmPassword}
                                    onChange={(e) => set("confirmPassword", e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="legacy-eye-btn"
                                    onClick={() => setShowConfirm((p) => !p)}
                                    tabIndex={-1}
                                >
                                    {showConfirm ? "🙈" : "👁️"}
                                </button>
                            </div>
                            {form.confirmPassword && form.password !== form.confirmPassword && (
                                <span className="legacy-error-msg">Passwords do not match</span>
                            )}
                        </Field>
                    </div>
                </section>

                {/* ── Section 4: Consent & Declaration ── */}
                <section className="legacy-form-section legacy-consent-section">
                    <SectionHeader number="04" title="Consent &amp; Declaration" icon="📜" />

                    {/* 1. Identity */}
                    <div className="legacy-consent-group">
                        <h3 className="legacy-consent-group-title">1. Identity &amp; Information Consent</h3>
                        <ConsentItem id="identity" checked={form.consent.identity} onChange={() => setConsent("identity")}>
                            I confirm that all information provided by me in this form is true, accurate, and
                            complete to the best of my knowledge.
                        </ConsentItem>
                    </div>

                    {/* 2. Media */}
                    <div className="legacy-consent-group">
                        <h3 className="legacy-consent-group-title">2. Media &amp; Content Usage Consent</h3>
                        <ConsentItem id="mediaCollect" checked={form.consent.mediaCollect} onChange={() => setConsent("mediaCollect")}>
                            I give consent to the Legacy Project platform to collect, store, and use my submitted
                            information, including my name, photographs, stories, documents, and other content
                            provided by me.
                        </ConsentItem>
                        <div className="legacy-consent-sublist">
                            <p className="legacy-consent-sublist-label">I understand my content may be used for:</p>
                            <ul>
                                <li>Biography creation and publication</li>
                                <li>Digital or printed legacy documentation</li>
                                <li>Educational, archival, and historical purposes</li>
                                <li>Platform storytelling and awareness initiatives</li>
                            </ul>
                        </div>
                        <ConsentItem id="mediaUse" checked={form.consent.mediaUse} onChange={() => setConsent("mediaUse")}>
                            I have read and understood the above media and content usage terms.
                        </ConsentItem>
                    </div>

                    {/* 3. Photo Release */}
                    <div className="legacy-consent-group">
                        <h3 className="legacy-consent-group-title">3. Photo &amp; Media Release Consent</h3>
                        <ConsentItem id="photoRelease" checked={form.consent.photoRelease} onChange={() => setConsent("photoRelease")}>
                            I allow the use of my photographs, videos, or any media submitted by me for
                            publication in legacy books, digital archives, and promotional or informational
                            materials related to the Legacy Project.
                        </ConsentItem>
                    </div>

                    {/* 4. Sharing */}
                    <div className="legacy-consent-group">
                        <h3 className="legacy-consent-group-title">4. Sharing &amp; Publication Consent</h3>
                        <ConsentItem id="editingUnderstanding" checked={form.consent.editingUnderstanding} onChange={() => setConsent("editingUnderstanding")}>
                            I understand that my information may be edited for clarity, formatting, or
                            presentation purposes, but the core meaning will not be altered.
                        </ConsentItem>
                        <ConsentItem id="publicSharing" checked={form.consent.publicSharing} onChange={() => setConsent("publicSharing")}>
                            I agree that selected information may be publicly shared as part of community or
                            legacy storytelling.
                        </ConsentItem>
                    </div>

                    {/* 5. Data Storage */}
                    <div className="legacy-consent-group">
                        <h3 className="legacy-consent-group-title">5. Data Storage &amp; Security Consent</h3>
                        <ConsentItem id="dataStorage" checked={form.consent.dataStorage} onChange={() => setConsent("dataStorage")}>
                            I understand that my data will be securely stored and used only for purposes related
                            to the Legacy Project.
                        </ConsentItem>
                        <ConsentItem id="dataRetention" checked={form.consent.dataRetention} onChange={() => setConsent("dataRetention")}>
                            I acknowledge that my data may be retained for long-term archival purposes unless I
                            request deletion as per platform policy.
                        </ConsentItem>
                    </div>

                    {/* 6. Voluntary */}
                    <div className="legacy-consent-group">
                        <h3 className="legacy-consent-group-title">6. Voluntary Participation</h3>
                        <ConsentItem id="voluntary" checked={form.consent.voluntary} onChange={() => setConsent("voluntary")}>
                            I confirm that my participation is completely voluntary and I can withdraw my consent
                            at any time by contacting the platform.
                        </ConsentItem>
                    </div>

                    {/* 7. Final Declaration */}
                    <div className="legacy-consent-group legacy-consent-group--final">
                        <h3 className="legacy-consent-group-title">7. Final Declaration</h3>
                        <ConsentItem id="finalDeclaration" checked={form.consent.finalDeclaration} onChange={() => setConsent("finalDeclaration")}>
                            I agree to all the terms and conditions mentioned above and authorise the Legacy
                            Project to use my submitted information accordingly.
                        </ConsentItem>
                    </div>

                    {/* Progress bar */}
                    <div className="legacy-consent-progress">
                        <span className="legacy-consent-count">
                            {consentCount} / {consentTotal} declarations accepted
                        </span>
                        <div className="legacy-consent-bar">
                            <div
                                className="legacy-consent-fill"
                                style={{ width: `${(consentCount / consentTotal) * 100}%` }}
                            />
                        </div>
                    </div>
                </section>

                {/* ── Submit ── */}
                <div className="legacy-form-footer">
                    <button
                        type="button"
                        className={`legacy-btn-submit${!allConsentsChecked ? " legacy-btn-submit--disabled" : ""}`}
                        onClick={handleSubmit}
                    >
                        Submit Registration ✦
                    </button>
                    <p className="legacy-footer-note">
                        By submitting, you confirm this registration is voluntary and truthful.
                    </p>
                </div>

            </div>
        </div>
    );
}

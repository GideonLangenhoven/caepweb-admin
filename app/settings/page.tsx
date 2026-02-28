"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useBusinessContext } from "../../components/BusinessContext";

var BOOKING_URL = "https://capekayak-booking-sk1r.vercel.app";

interface Tour {
    id: string;
    name: string;
    description: string | null;
    base_price_per_person: number | null;
    duration_minutes: number | null;
    active: boolean;
    sort_order: number | null;
    image_url: string | null;
    hidden: boolean;
}

export default function SettingsPage() {
    var { businessId } = useBusinessContext();
    var [admins, setAdmins] = useState<any[]>([]);
    var [loading, setLoading] = useState(true);
    var [role, setRole] = useState<string | null>(null);

    // New Admin Form
    var [newEmail, setNewEmail] = useState("");
    var [newPass, setNewPass] = useState("");
    var [adding, setAdding] = useState(false);
    var [error, setError] = useState("");

    // Tours state
    var [tours, setTours] = useState<Tour[]>([]);
    var [editingTour, setEditingTour] = useState<Tour | null>(null);
    var [tourForm, setTourForm] = useState({ name: "", description: "", price: "", duration: "", sort_order: "0", active: true, image_url: "" });
    var [tourSaving, setTourSaving] = useState(false);
    var [tourError, setTourError] = useState("");

    // Site Settings State
    var [siteSettings, setSiteSettings] = useState({
        directions: "",
        terms_conditions: "",
        privacy_policy: "Cookies help us deliver our services. By using our services, you agree to our use of cookies. OK Cape Kayak Adventures Privacy Policy\nThank you for visiting our web site...",
        cookies_policy: "COOKIES\nCookies are small text files which are downloaded to your computer...",
        color_main: "#0f5dd7",
        color_secondary: "#101828",
        color_cta: "#0c8a59",
        chatbot_avatar: "https://lottie.host/f88dfbd9-9fbb-43af-9ac4-400d4f0b96ae/tc9tMgAjqf.lottie"
    });
    var [siteSaving, setSiteSaving] = useState(false);
    var [siteMessage, setSiteMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        var r = localStorage.getItem("ck_admin_role");
        setRole(r);
        if (r === "MAIN_ADMIN") {
            fetchAdmins();
            fetchTours();
            fetchSiteSettings();
        } else {
            setLoading(false);
        }

        if (!document.getElementById("dotlottie-script")) {
            var script = document.createElement("script");
            script.id = "dotlottie-script";
            script.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js";
            script.type = "module";
            document.head.appendChild(script);
        }
    }, []);

    async function fetchAdmins() {
        setLoading(true);
        var { data, error } = await supabase.from("admin_users").select("id, email, role, created_at").eq("business_id", businessId).order("created_at");
        if (data) setAdmins(data);
        setLoading(false);
    }

    async function sha256(str: string) {
        var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    async function handleAddAdmin(e: React.FormEvent) {
        e.preventDefault();
        if (!newEmail || !newPass) return setError("Email and Password required");
        if (admins.length >= 10) return setError("Maximum of 10 admins allowed");

        setAdding(true);
        setError("");

        var hash = await sha256(newPass);

        var adminEmail = newEmail.trim().toLowerCase();
        var { error: insertErr } = await supabase.from("admin_users").insert({
            email: adminEmail,
            password_hash: hash,
            role: "ADMIN",
            business_id: businessId
        });

        if (insertErr) {
            setAdding(false);
            if (insertErr.code === "23505") setError("Email already exists");
            else setError("Failed to add admin: " + insertErr.message);
            return;
        }

        // Send welcome email with temp password and change-password link
        try {
            var baseUrl = window.location.origin;
            await supabase.functions.invoke("send-email", {
                body: {
                    type: "ADMIN_WELCOME",
                    data: {
                        email: adminEmail,
                        temp_password: newPass,
                        change_password_url: baseUrl + "/change-password",
                    },
                },
            });
        } catch (emailErr) {
            console.error("Welcome email failed:", emailErr);
        }

        setAdding(false);
        setNewEmail("");
        setNewPass("");
        fetchAdmins();
    }

    async function fetchTours() {
        var { data } = await supabase.from("tours").select("*").eq("business_id", businessId).order("sort_order", { ascending: true });
        setTours((data || []) as Tour[]);
    }

    function resetTourForm() {
        setEditingTour(null);
        setTourForm({ name: "", description: "", price: "", duration: "", sort_order: "0", active: true, image_url: "" });
        setTourError("");
    }

    function startEditTour(t: Tour) {
        setEditingTour(t);
        setTourForm({
            name: t.name,
            description: t.description || "",
            price: String(t.base_price_per_person || ""),
            duration: String(t.duration_minutes || ""),
            sort_order: String(t.sort_order || 0),
            active: t.active,
            image_url: t.image_url || "",
        });
        setTourError("");
    }

    async function handleSaveTour(e: React.FormEvent) {
        e.preventDefault();
        if (!tourForm.name.trim()) return setTourError("Name is required");
        if (!tourForm.price || Number(tourForm.price) <= 0) return setTourError("Price must be greater than 0");
        if (!tourForm.duration || Number(tourForm.duration) <= 0) return setTourError("Duration is required");

        setTourSaving(true);
        setTourError("");

        var payload = {
            name: tourForm.name.trim(),
            description: tourForm.description.trim() || null,
            base_price_per_person: Number(tourForm.price),
            duration_minutes: Number(tourForm.duration),
            sort_order: Number(tourForm.sort_order) || 0,
            active: tourForm.active,
            image_url: tourForm.image_url.trim() || null,
        };

        if (editingTour) {
            var { error: upErr } = await supabase.from("tours").update(payload).eq("id", editingTour.id);
            if (upErr) { setTourError("Failed: " + upErr.message); setTourSaving(false); return; }
        } else {
            var { error: inErr } = await supabase.from("tours").insert({ ...payload, business_id: businessId });
            if (inErr) { setTourError("Failed: " + inErr.message); setTourSaving(false); return; }
        }

        setTourSaving(false);
        resetTourForm();
        fetchTours();
    }

    async function handleDeleteTour(id: string, name: string) {
        if (!confirm("Delete \"" + name + "\"? This cannot be undone.")) return;
        await supabase.from("tours").delete().eq("id", id);
        if (editingTour?.id === id) resetTourForm();
        fetchTours();
    }

    async function handleToggleTour(t: Tour) {
        await supabase.from("tours").update({ active: !t.active }).eq("id", t.id);
        fetchTours();
    }

    async function handleToggleHidden(t: Tour) {
        await supabase.from("tours").update({ hidden: !t.hidden }).eq("id", t.id);
        fetchTours();
    }

    async function handleDelete(id: string, adminRole: string) {
        if (adminRole === "MAIN_ADMIN") return alert("Cannot delete the Main Admin");
        if (!confirm("Are you sure you want to remove this admin?")) return;

        await supabase.from("admin_users").delete().eq("id", id);
        fetchAdmins();
    }

    async function fetchSiteSettings() {
        var { data } = await supabase.from("businesses").select("*").eq("id", businessId).maybeSingle();
        if (data) {
            setSiteSettings({
                directions: data.directions || "",
                terms_conditions: data.terms_conditions || "",
                privacy_policy: data.privacy_policy || "Cookies help us deliver our services...",
                cookies_policy: data.cookies_policy || "COOKIES\nCookies are small text files...",
                color_main: data.color_main || "#0f5dd7",
                color_secondary: data.color_secondary || "#101828",
                color_cta: data.color_cta || "#0c8a59",
                chatbot_avatar: data.chatbot_avatar || "https://lottie.host/f88dfbd9-9fbb-43af-9ac4-400d4f0b96ae/tc9tMgAjqf.lottie"
            });
        }
    }

    async function handleSaveSiteSettings(e: React.FormEvent) {
        e.preventDefault();
        setSiteSaving(true);
        setSiteMessage({ type: "", text: "" });

        // Get the single business row that exists
        var { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
        if (!biz) {
            setSiteMessage({ type: "error", text: "No business record found to update." });
            setSiteSaving(false);
            return;
        }

        var { error } = await supabase.from("businesses").update({
            directions: siteSettings.directions,
            terms_conditions: siteSettings.terms_conditions,
            privacy_policy: siteSettings.privacy_policy,
            cookies_policy: siteSettings.cookies_policy,
            color_main: siteSettings.color_main,
            color_secondary: siteSettings.color_secondary,
            color_cta: siteSettings.color_cta,
            chatbot_avatar: siteSettings.chatbot_avatar
        }).eq("id", biz.id);

        if (error) {
            setSiteMessage({ type: "error", text: "Error saving: " + error.message });
        } else {
            setSiteMessage({ type: "success", text: "Site settings saved successfully!" });
            setTimeout(() => setSiteMessage({ type: "", text: "" }), 3000);
        }
        setSiteSaving(false);
    }

    if (loading) return <div className="p-8 ui-text-muted">Loading settings...</div>;

    if (role !== "MAIN_ADMIN") {
        return (
            <div className="max-w-2xl">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--ck-text-strong)] mb-6">Settings</h1>
                <div className="ui-surface rounded-2xl p-6 border border-[var(--ck-border-subtle)] text-center">
                    <p className="ui-text-muted">You do not have permission to view or manage admin settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ck-text-strong)] mb-6">Settings</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Admin List */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-[var(--ck-text-strong)]">Admin Users</h2>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-[var(--ck-bg-subtle)] text-[var(--ck-text-muted)]">
                            {admins.length} / 10
                        </span>
                    </div>

                    <div className="ui-surface rounded-2xl border border-[var(--ck-border-subtle)] overflow-hidden">
                        <div className="divide-y divide-[var(--ck-border-subtle)]">
                            {admins.map(a => (
                                <div key={a.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-[var(--ck-text-strong)] text-sm">{a.email}</div>
                                        <div className="text-xs text-[var(--ck-text-muted)] mt-0.5">
                                            {a.role === "MAIN_ADMIN" ? "Main Admin" : "Admin"} • Added {new Date(a.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    {a.role !== "MAIN_ADMIN" && (
                                        <button onClick={() => handleDelete(a.id, a.role)} className="text-[var(--ck-danger)] text-sm font-medium hover:underline">
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                            {admins.length === 0 && <div className="p-4 text-center text-sm ui-text-muted">No admins found</div>}
                        </div>
                    </div>
                </div>

                {/* Add Admin Form */}
                <div>
                    <h2 className="text-lg font-semibold text-[var(--ck-text-strong)] mb-4">Add New Admin</h2>
                    <form onSubmit={handleAddAdmin} className="ui-surface rounded-2xl border border-[var(--ck-border-subtle)] p-5 space-y-4">
                        {admins.length >= 10 ? (
                            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm">
                                You have reached the maximum limit of 10 admin users.
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Email Address</label>
                                    <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                        className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="admin@example.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Temporary Password</label>
                                    <input type="text" required value={newPass} onChange={e => setNewPass(e.target.value)}
                                        className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Enter a secure password" />
                                </div>
                                {error && <div className="text-xs text-[var(--ck-danger)] font-medium">{error}</div>}
                                <button type="submit" disabled={adding} className="w-full rounded-xl bg-[var(--ck-text-strong)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                                    {adding ? "Adding..." : "Add Admin"}
                                </button>
                            </>
                        )}
                    </form>
                </div>

            </div>

            {/* ── Tours / Activities ── */}
            <div className="mt-10">
                <h2 className="text-lg font-semibold text-[var(--ck-text-strong)] mb-4">Tours &amp; Activities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Tour List */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-[var(--ck-text-muted)]">{tours.length} tour{tours.length !== 1 ? "s" : ""}</span>
                            <button onClick={resetTourForm} className="text-xs font-medium text-[var(--ck-accent)] hover:underline">+ New Tour</button>
                        </div>
                        <div className="ui-surface rounded-2xl border border-[var(--ck-border-subtle)] overflow-hidden">
                            <div className="divide-y divide-[var(--ck-border-subtle)]">
                                {tours.map(t => (
                                    <div key={t.id} className={"p-4 cursor-pointer transition-colors " + (editingTour?.id === t.id ? "bg-blue-50" : "hover:bg-[var(--ck-bg)]")}
                                        onClick={() => startEditTour(t)}>
                                        <div className="flex gap-3">
                                            {t.image_url && (
                                                <img src={t.image_url} alt={t.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-sm text-[var(--ck-text-strong)]">{t.name}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        {t.hidden && (
                                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Hidden</span>
                                                        )}
                                                        <span className={"text-xs font-medium px-2 py-0.5 rounded-full " + (t.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                                                            {t.active ? "Active" : "Inactive"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-[var(--ck-text-muted)]">
                                                    R{t.base_price_per_person || 0}/person · {t.duration_minutes || "—"} min · Order: {t.sort_order || 0}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleTour(t); }}
                                                className={"text-xs font-medium hover:underline " + (t.active ? "text-orange-600" : "text-emerald-600")}>
                                                {t.active ? "Deactivate" : "Activate"}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleHidden(t); }}
                                                className={"text-xs font-medium hover:underline " + (t.hidden ? "text-[var(--ck-accent)]" : "text-amber-600")}>
                                                {t.hidden ? "Show" : "Hide"}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTour(t.id, t.name); }}
                                                className="text-xs font-medium text-[var(--ck-danger)] hover:underline">Delete</button>
                                            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-xs font-medium text-[var(--ck-accent)] hover:underline ml-auto">Book Page &rarr;</a>
                                        </div>
                                    </div>
                                ))}
                                {tours.length === 0 && <div className="p-4 text-center text-sm ui-text-muted">No tours yet. Add your first activity.</div>}
                            </div>
                        </div>
                    </div>

                    {/* Add / Edit Tour Form */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ck-text-strong)] mb-3">
                            {editingTour ? "Edit Tour" : "Add New Tour"}
                        </h3>
                        <form onSubmit={handleSaveTour} className="ui-surface rounded-2xl border border-[var(--ck-border-subtle)] p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Tour Name</label>
                                <input type="text" required value={tourForm.name} onChange={e => setTourForm({ ...tourForm, name: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="e.g. Sunset Paddle" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Description</label>
                                <textarea required value={tourForm.description} onChange={e => setTourForm({ ...tourForm, description: e.target.value })}
                                    rows={3} className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                                    placeholder="Describe this activity..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Image URL</label>
                                <input type="url" value={tourForm.image_url} onChange={e => setTourForm({ ...tourForm, image_url: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="https://i.ibb.co/..." />
                                <p className="text-xs text-[var(--ck-text-muted)] mt-1">Upload your image at <a href="https://imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ck-accent)] hover:underline">imgbb.com</a> and paste the direct link here.</p>
                                {tourForm.image_url && (
                                    <img src={tourForm.image_url} alt="Preview" className="mt-2 w-full max-w-[160px] aspect-square object-cover rounded-lg border border-[var(--ck-border-subtle)]" />
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Price per Person (R)</label>
                                    <input type="number" required min="1" step="1" value={tourForm.price}
                                        onChange={e => setTourForm({ ...tourForm, price: e.target.value })}
                                        className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="600" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Duration (minutes)</label>
                                    <input type="number" required min="1" step="1" value={tourForm.duration}
                                        onChange={e => setTourForm({ ...tourForm, duration: e.target.value })}
                                        className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="90" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Sort Order</label>
                                    <input type="number" min="0" step="1" value={tourForm.sort_order}
                                        onChange={e => setTourForm({ ...tourForm, sort_order: e.target.value })}
                                        className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="0" />
                                </div>
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={tourForm.active} onChange={e => setTourForm({ ...tourForm, active: e.target.checked })}
                                            className="w-4 h-4 rounded border-gray-300 text-[var(--ck-accent)] focus:ring-[var(--ck-accent)]" />
                                        <span className="text-sm text-[var(--ck-text-strong)]">Active</span>
                                    </label>
                                </div>
                            </div>

                            {tourError && <div className="text-xs text-[var(--ck-danger)] font-medium">{tourError}</div>}

                            <div className="flex gap-3">
                                <button type="submit" disabled={tourSaving}
                                    className="flex-1 rounded-xl bg-[var(--ck-text-strong)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                                    {tourSaving ? "Saving..." : editingTour ? "Update Tour" : "Add Tour"}
                                </button>
                                {editingTour && (
                                    <button type="button" onClick={resetTourForm}
                                        className="px-4 rounded-xl border border-[var(--ck-border-subtle)] text-sm font-medium text-[var(--ck-text-muted)] hover:bg-[var(--ck-bg)]">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                </div>
            </div>

            {/* ── Site Configuration ── */}
            <div className="mt-10 border-t border-[var(--ck-border-subtle)] pt-10 pb-20">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--ck-text-strong)]">Booking Site Configuration</h2>
                        <p className="text-xs text-[var(--ck-text-muted)] mt-1">These settings directly affect the public booking page.</p>
                    </div>
                </div>

                <form onSubmit={handleSaveSiteSettings} className="ui-surface rounded-2xl border border-[var(--ck-border-subtle)] p-6 space-y-8">

                    {/* Legal & Text Policies */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ck-text-strong)] mb-4 pb-2 border-b border-[var(--ck-border-subtle)]">Policies &amp; Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Directions &amp; Meeting Info</label>
                                <textarea value={siteSettings.directions} onChange={e => setSiteSettings({ ...siteSettings, directions: e.target.value })}
                                    rows={10} className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none resize-y"
                                    placeholder="Enter how to find the location..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Terms &amp; Conditions</label>
                                <textarea value={siteSettings.terms_conditions} onChange={e => setSiteSettings({ ...siteSettings, terms_conditions: e.target.value })}
                                    rows={10} className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none resize-y"
                                    placeholder="Enter T&C's..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Privacy Policy</label>
                                <textarea value={siteSettings.privacy_policy} onChange={e => setSiteSettings({ ...siteSettings, privacy_policy: e.target.value })}
                                    rows={10} className="ui-control w-full px-3 py-2 text-xs text-gray-600 rounded-lg outline-none resize-y" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Cookies Policy</label>
                                <textarea value={siteSettings.cookies_policy} onChange={e => setSiteSettings({ ...siteSettings, cookies_policy: e.target.value })}
                                    rows={10} className="ui-control w-full px-3 py-2 text-xs text-gray-600 rounded-lg outline-none resize-y" />
                            </div>
                        </div>
                    </div>

                    {/* Branding Colors */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ck-text-strong)] mb-4 pb-2 border-b border-[var(--ck-border-subtle)]">Theme Colors</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Main Color</label>
                                <div className="flex bg-[var(--ck-surface)] rounded-lg border border-[var(--ck-border-subtle)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ck-accent)]">
                                    <input type="color" value={siteSettings.color_main} onChange={e => setSiteSettings({ ...siteSettings, color_main: e.target.value })}
                                        className="h-10 w-12 p-1 bg-transparent cursor-pointer border-r border-[var(--ck-border-subtle)]" />
                                    <input type="text" value={siteSettings.color_main} onChange={e => setSiteSettings({ ...siteSettings, color_main: e.target.value })}
                                        className="flex-1 w-full px-3 py-2 text-sm outline-none uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Secondary Color</label>
                                <div className="flex bg-[var(--ck-surface)] rounded-lg border border-[var(--ck-border-subtle)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ck-accent)]">
                                    <input type="color" value={siteSettings.color_secondary} onChange={e => setSiteSettings({ ...siteSettings, color_secondary: e.target.value })}
                                        className="h-10 w-12 p-1 bg-transparent cursor-pointer border-r border-[var(--ck-border-subtle)]" />
                                    <input type="text" value={siteSettings.color_secondary} onChange={e => setSiteSettings({ ...siteSettings, color_secondary: e.target.value })}
                                        className="flex-1 w-full px-3 py-2 text-sm outline-none uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Call To Action</label>
                                <div className="flex bg-[var(--ck-surface)] rounded-lg border border-[var(--ck-border-subtle)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ck-accent)]">
                                    <input type="color" value={siteSettings.color_cta} onChange={e => setSiteSettings({ ...siteSettings, color_cta: e.target.value })}
                                        className="h-10 w-12 p-1 bg-transparent cursor-pointer border-r border-[var(--ck-border-subtle)]" />
                                    <input type="text" value={siteSettings.color_cta} onChange={e => setSiteSettings({ ...siteSettings, color_cta: e.target.value })}
                                        className="flex-1 w-full px-3 py-2 text-sm outline-none uppercase" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chatbot Avatar */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ck-text-strong)] mb-4 pb-2 border-b border-[var(--ck-border-subtle)]">Chatbot Avatar</h3>
                        <div className="flex flex-wrap gap-4">
                            {[
                                "https://lottie.host/f88dfbd9-9fbb-43af-9ac4-400d4f0b96ae/tc9tMgAjqf.lottie",
                                "https://lottie.host/b37e717c-85a0-4b3a-85ac-da0d0c21d0ce/6y2qqYBhTF.lottie",
                                "https://lottie.host/e1aecbea-cf94-47e8-aae2-5f59c567c6d9/zHX4Roi2Eb.lottie",
                                "https://lottie.host/deee1aa7-f9b1-4869-8191-b9dccacb0017/Inaq5Gmhwf.lottie"
                            ].map(url => {
                                const isSelected = siteSettings.chatbot_avatar === url;
                                return (
                                    <div key={url}
                                        onClick={() => setSiteSettings({ ...siteSettings, chatbot_avatar: url })}
                                        className={"relative cursor-pointer transition-all hover:scale-105 rounded-xl p-1 " + (isSelected ? "bg-[var(--ck-accent)] ring-2 ring-offset-2 ring-[var(--ck-accent)]" : "bg-transparent")}
                                    >
                                        <div className="w-16 h-16 bg-[var(--ck-surface)] rounded-lg flex items-center justify-center shadow-inner overflow-hidden border border-[var(--ck-border-subtle)]"
                                            dangerouslySetInnerHTML={{ __html: `<dotlottie-wc src="${url}" style="width: 100%; height: 100%" autoplay loop></dotlottie-wc>` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Save Footer */}
                    <div className="pt-4 border-t border-[var(--ck-border-subtle)] flex items-center justify-between">
                        <div>
                            {siteMessage.text && (
                                <span className={"text-sm font-medium " + (siteMessage.type === "error" ? "text-[var(--ck-danger)]" : "text-[var(--ck-success)]")}>
                                    {siteMessage.text}
                                </span>
                            )}
                        </div>
                        <button type="submit" disabled={siteSaving}
                            className="rounded-xl px-8 bg-[var(--ck-text-strong)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                            {siteSaving ? "Saving..." : "Save Site Settings"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

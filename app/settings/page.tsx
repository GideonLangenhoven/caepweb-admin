"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useBusinessContext } from "../../components/BusinessContext";
import RichTextEditor from "../../components/RichTextEditor";
import { fetchUsageSnapshot, type UsageSnapshot } from "../lib/billing";

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
    var [tourForm, setTourForm] = useState({ name: "", description: "", price: "", duration: "", sort_order: "0", active: true, image_url: "", default_capacity: "10", slotStartDate: "", slotEndDate: "", slotTimes: [""] as string[], slotDays: [0, 1, 2, 3, 4, 5, 6] as number[] });
    var [tourSaving, setTourSaving] = useState(false);
    var [tourError, setTourError] = useState("");
    var [slotMessage, setSlotMessage] = useState("");
    var [slotGenerating, setSlotGenerating] = useState(false);
    var [tourSlotCounts, setTourSlotCounts] = useState<Record<string, number>>({});

    // Site Settings State
    var [siteSettings, setSiteSettings] = useState({
        directions: "",
        terms_conditions: "",
        privacy_policy: "Cookies help us deliver our services. By using our services, you agree to our use of cookies. OK Cape Kayak Adventures Privacy Policy\nThank you for visiting our web site...",
        cookies_policy: "COOKIES\nCookies are small text files which are downloaded to your computer...",
        color_main: "#0f5dd7",
        color_secondary: "#101828",
        color_cta: "#0c8a59",
        color_bg: "#f5f5f5",
        color_nav: "#ffffff",
        color_hover: "#48cfad",
        chatbot_avatar: "https://lottie.host/f88dfbd9-9fbb-43af-9ac4-400d4f0b96ae/tc9tMgAjqf.lottie",
        hero_eyebrow: "",
        hero_title: "",
        hero_subtitle: "",
        business_name: "",
        business_tagline: "",
        logo_url: ""
    });
    var [siteSaving, setSiteSaving] = useState(false);
    var [siteMessage, setSiteMessage] = useState({ type: "", text: "" });
    var [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | null>(null);

    useEffect(() => {
        var r = localStorage.getItem("ck_admin_role");
        setRole(r);
        if (r === "MAIN_ADMIN") {
            fetchAdmins();
            fetchTours();
            fetchSiteSettings();
            fetchPlanUsage();
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
    }, [businessId]);

    async function fetchAdmins() {
        setLoading(true);
        var { data, error } = await supabase.from("admin_users").select("id, email, role, created_at").eq("business_id", businessId).order("created_at");
        if (data) setAdmins(data);
        setLoading(false);
    }

    async function fetchPlanUsage() {
        try {
            var usage = await fetchUsageSnapshot(businessId);
            setUsageSnapshot(usage);
        } catch (e) {
            console.error("Failed to load plan usage:", e);
            setUsageSnapshot(null);
        }
    }

    async function sha256(str: string) {
        var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    async function handleAddAdmin(e: React.FormEvent) {
        e.preventDefault();
        if (!newEmail || !newPass) return setError("Email and Password required");
        var seatLimit = usageSnapshot?.seat_limit || 10;
        if (admins.length >= seatLimit) return setError("Admin seat limit reached for your current plan (" + seatLimit + "). Upgrade to add more admins.");

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
        fetchPlanUsage();
    }

    async function fetchTours() {
        var { data } = await supabase.from("tours").select("*").eq("business_id", businessId).order("sort_order", { ascending: true });
        setTours((data || []) as Tour[]);
        if (data && data.length > 0) {
            fetchSlotCounts(data.map((t: any) => t.id));
        }
    }

    async function fetchSlotCounts(tourIds: string[]) {
        var now = new Date().toISOString();
        var counts: Record<string, number> = {};
        for (var tid of tourIds) {
            var { count } = await supabase.from("slots").select("id", { count: "exact", head: true }).eq("tour_id", tid).eq("status", "OPEN").gte("start_time", now);
            counts[tid] = count || 0;
        }
        setTourSlotCounts(counts);
    }

    var [dragIdx, setDragIdx] = useState<number | null>(null);

    function resetTourForm() {
        setEditingTour(null);
        setTourForm({ name: "", description: "", price: "", duration: "", sort_order: "0", active: true, image_url: "", default_capacity: "10", slotStartDate: "", slotEndDate: "", slotTimes: [""], slotDays: [0, 1, 2, 3, 4, 5, 6] });
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
            default_capacity: String((t as any).default_capacity || 10),
            slotStartDate: "",
            slotEndDate: "",
            slotTimes: [""],
            slotDays: [0, 1, 2, 3, 4, 5, 6],
        });
        setTourError("");
    }

    var DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function toggleDay(day: number) {
        setTourForm(prev => {
            var days = prev.slotDays.includes(day) ? prev.slotDays.filter(d => d !== day) : [...prev.slotDays, day];
            return { ...prev, slotDays: days };
        });
    }

    async function generateSlotsForTour(tourId: string) {
        var validTimes = tourForm.slotTimes.filter(t => t.trim() !== "");
        if (!tourForm.slotStartDate || !tourForm.slotEndDate || validTimes.length === 0) {
            setTourError("Please fill in start date, end date, and at least one start time.");
            return 0;
        }
        if (tourForm.slotDays.length === 0) {
            setTourError("Please select at least one day of the week.");
            return 0;
        }

        var slots: any[] = [];
        var start = new Date(tourForm.slotStartDate + "T00:00:00");
        var end = new Date(tourForm.slotEndDate + "T00:00:00");
        var capacity = Number(tourForm.default_capacity) || 10;

        for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (!tourForm.slotDays.includes(d.getDay())) continue;

            var localDateStr = d.toISOString().split("T")[0];

            for (var ti = 0; ti < validTimes.length; ti++) {
                var localDateTime = localDateStr + "T" + validTimes[ti] + ":00";
                var localDate = new Date(localDateTime);
                localDate.setHours(localDate.getHours() - 2);
                var utcStart = localDate.toISOString();

                slots.push({
                    business_id: businessId,
                    tour_id: tourId,
                    start_time: utcStart,
                    capacity_total: capacity,
                    booked: 0,
                    held: 0,
                    status: "OPEN",
                });
            }
        }

        if (slots.length === 0) {
            setTourError("No slots to create — no matching days in the selected date range.");
            return 0;
        }

        var { error: slotErr } = await supabase.from("slots").insert(slots);
        if (slotErr) {
            setTourError("Slots failed: " + slotErr.message);
            return 0;
        }
        return slots.length;
    }

    async function handleGenerateSlots() {
        if (!editingTour) return;
        setSlotGenerating(true);
        setTourError("");
        setSlotMessage("");
        var count = await generateSlotsForTour(editingTour.id);
        if (count > 0) {
            setSlotMessage(count + " slot" + (count !== 1 ? "s" : "") + " generated for " + editingTour.name + "!");
            setTimeout(() => setSlotMessage(""), 5000);
            fetchSlotCounts(tours.map(t => t.id));
        }
        setSlotGenerating(false);
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
            default_capacity: Number(tourForm.default_capacity) || 10,
        };

        if (editingTour) {
            var { error: upErr } = await supabase.from("tours").update(payload).eq("id", editingTour.id);
            if (upErr) { setTourError("Failed: " + upErr.message); setTourSaving(false); return; }
        } else {
            var { data: newTour, error: inErr } = await supabase.from("tours").insert({ ...payload, business_id: businessId }).select().single();
            if (inErr) { setTourError("Failed: " + inErr.message); setTourSaving(false); return; }

            // Auto-generate slots if date range and time are provided
            if (newTour && tourForm.slotStartDate && tourForm.slotEndDate && tourForm.slotTimes.some(t => t.trim() !== "")) {
                var count = await generateSlotsForTour(newTour.id);
                if (count > 0) {
                    setSlotMessage("Tour created with " + count + " slot" + (count !== 1 ? "s" : "") + " generated!");
                    setTimeout(() => setSlotMessage(""), 5000);
                }
            }
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

    async function handleDrop(targetIdx: number) {
        if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
        var reordered = [...tours];
        var [moved] = reordered.splice(dragIdx, 1);
        reordered.splice(targetIdx, 0, moved);
        setTours(reordered);
        setDragIdx(null);
        for (var i = 0; i < reordered.length; i++) {
            await supabase.from("tours").update({ sort_order: i }).eq("id", reordered[i].id);
        }
    }

    async function handleDelete(id: string, adminRole: string) {
        if (adminRole === "MAIN_ADMIN") return alert("Cannot delete the Main Admin");
        if (!confirm("Are you sure you want to remove this admin?")) return;

        await supabase.from("admin_users").delete().eq("id", id);
        fetchAdmins();
        fetchPlanUsage();
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
                color_bg: data.color_bg || "#f5f5f5",
                color_nav: data.color_nav || "#ffffff",
                color_hover: data.color_hover || "#48cfad",
                chatbot_avatar: data.chatbot_avatar || "https://lottie.host/f88dfbd9-9fbb-43af-9ac4-400d4f0b96ae/tc9tMgAjqf.lottie",
                hero_eyebrow: data.hero_eyebrow || "",
                hero_title: data.hero_title || "",
                hero_subtitle: data.hero_subtitle || "",
                business_name: data.business_name || "",
                business_tagline: data.business_tagline || "",
                logo_url: data.logo_url || ""
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
            color_bg: siteSettings.color_bg,
            color_nav: siteSettings.color_nav,
            color_hover: siteSettings.color_hover,
            chatbot_avatar: siteSettings.chatbot_avatar,
            hero_eyebrow: siteSettings.hero_eyebrow || null,
            hero_title: siteSettings.hero_title || null,
            hero_subtitle: siteSettings.hero_subtitle || null,
            business_name: siteSettings.business_name || null,
            business_tagline: siteSettings.business_tagline || null,
            logo_url: siteSettings.logo_url || null
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
                            {admins.length} / {usageSnapshot?.seat_limit || 10}
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
                        {admins.length >= (usageSnapshot?.seat_limit || 10) ? (
                            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm">
                                You have reached the admin seat limit for your plan ({usageSnapshot?.seat_limit || 10}).
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
                                {tours.map((t, idx) => (
                                    <div key={t.id}
                                        draggable
                                        onDragStart={() => setDragIdx(idx)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDrop(idx)}
                                        className={"p-4 cursor-pointer transition-colors " + (dragIdx === idx ? "opacity-40 " : "") + (editingTour?.id === t.id ? "bg-blue-50" : "hover:bg-[var(--ck-bg)]")}
                                        onClick={() => startEditTour(t)}>
                                        <div className="flex gap-3">
                                            <div className="flex items-center shrink-0 cursor-grab active:cursor-grabbing text-[var(--ck-text-muted)] hover:text-[var(--ck-text-strong)]" title="Drag to reorder">
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" /><circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" /><circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" /></svg>
                                            </div>
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
                                                    R{t.base_price_per_person || 0}/person · {t.duration_minutes || "—"} min · <span className={tourSlotCounts[t.id] ? "text-emerald-600" : "text-orange-500"}>{tourSlotCounts[t.id] ?? "…"} upcoming slot{tourSlotCounts[t.id] !== 1 ? "s" : ""}</span>
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
                                <label className="block text-xs font-medium text-[var(--ck-text-strong)] mb-1">Image URL</label>
                                <input type="url" value={tourForm.image_url} onChange={e => setTourForm({ ...tourForm, image_url: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Paste any image URL here..." />
                                <p className="text-xs text-[var(--ck-text-muted)] mt-1">Paste any direct image link here, or upload your image at <a href="https://imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ck-accent)] hover:underline">imgbb.com</a> if you don't have a link.</p>
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
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Default Capacity</label>
                                    <input type="number" min="1" step="1" value={tourForm.default_capacity}
                                        onChange={e => setTourForm({ ...tourForm, default_capacity: e.target.value })}
                                        className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="10" />
                                    <p className="text-xs text-[var(--ck-text-muted)] mt-1">Max people per slot</p>
                                </div>
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={tourForm.active} onChange={e => setTourForm({ ...tourForm, active: e.target.checked })}
                                            className="w-4 h-4 rounded border-gray-300 text-[var(--ck-accent)] focus:ring-[var(--ck-accent)]" />
                                        <span className="text-sm text-[var(--ck-text-strong)]">Active</span>
                                    </label>
                                </div>
                            </div>

                            {/* Slot Generation */}
                            <div className="border-t border-[var(--ck-border-subtle)] pt-4">
                                <label className="block text-xs font-semibold text-[var(--ck-text-strong)] mb-1">
                                    {editingTour ? "Generate Slots" : "Auto-generate Slots (optional)"}
                                </label>
                                {editingTour && (
                                    <p className="text-xs text-emerald-600 font-medium mb-2">{tourSlotCounts[editingTour.id] ?? 0} upcoming open slots</p>
                                )}
                                <p className="text-xs text-[var(--ck-text-muted)] mb-3">Creates one slot per selected day in the date range. Edit individual slots on the Slots page.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Start Date</label>
                                        <input type="date" value={tourForm.slotStartDate} onChange={e => setTourForm({ ...tourForm, slotStartDate: e.target.value })}
                                            className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">End Date</label>
                                        <input type="date" value={tourForm.slotEndDate} onChange={e => setTourForm({ ...tourForm, slotEndDate: e.target.value })}
                                            min={tourForm.slotStartDate || undefined}
                                            className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Start Time{tourForm.slotTimes.length > 1 ? "s" : ""} (SAST)</label>
                                    <div className="space-y-2">
                                        {tourForm.slotTimes.map((t, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input type="time" value={t} onChange={e => { var times = [...tourForm.slotTimes]; times[idx] = e.target.value; setTourForm({ ...tourForm, slotTimes: times }); }}
                                                    className="ui-control flex-1 px-3 py-2 text-sm rounded-lg outline-none" />
                                                {tourForm.slotTimes.length > 1 && (
                                                    <button type="button" onClick={() => { var times = tourForm.slotTimes.filter((_, i) => i !== idx); setTourForm({ ...tourForm, slotTimes: times }); }}
                                                        className="text-[var(--ck-danger)] hover:bg-red-50 rounded-lg p-1.5" title="Remove time">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setTourForm({ ...tourForm, slotTimes: [...tourForm.slotTimes, ""] })}
                                        className="mt-1.5 text-xs font-medium text-[var(--ck-accent)] hover:underline">+ Add another time slot</button>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Days of the Week</label>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {DAY_LABELS.map((label, idx) => (
                                            <button key={idx} type="button" onClick={() => toggleDay(idx)}
                                                className={"px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors " + (tourForm.slotDays.includes(idx) ? "bg-[var(--ck-text-strong)] text-[var(--ck-surface)] border-[var(--ck-text-strong)]" : "bg-white text-[var(--ck-text-muted)] border-[var(--ck-border-subtle)] hover:border-[var(--ck-text-muted)]")}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 mt-1.5">
                                        <button type="button" onClick={() => setTourForm(prev => ({ ...prev, slotDays: [0, 1, 2, 3, 4, 5, 6] }))} className="text-[10px] text-[var(--ck-accent)] hover:underline">All</button>
                                        <button type="button" onClick={() => setTourForm(prev => ({ ...prev, slotDays: [1, 2, 3, 4, 5] }))} className="text-[10px] text-[var(--ck-accent)] hover:underline">Weekdays</button>
                                        <button type="button" onClick={() => setTourForm(prev => ({ ...prev, slotDays: [0, 6] }))} className="text-[10px] text-[var(--ck-accent)] hover:underline">Weekends</button>
                                        <button type="button" onClick={() => setTourForm(prev => ({ ...prev, slotDays: [] }))} className="text-[10px] text-[var(--ck-text-muted)] hover:underline">None</button>
                                    </div>
                                </div>
                                {editingTour && (
                                    <button type="button" onClick={handleGenerateSlots} disabled={slotGenerating || !tourForm.slotStartDate || !tourForm.slotEndDate || !tourForm.slotTimes.some(t => t.trim() !== "") || tourForm.slotDays.length === 0}
                                        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                        {slotGenerating ? "Generating..." : "Generate Slots for " + editingTour.name}
                                    </button>
                                )}
                            </div>

                            {tourError && <div className="text-xs text-[var(--ck-danger)] font-medium">{tourError}</div>}
                            {slotMessage && <div className="text-xs text-[var(--ck-success)] font-medium">{slotMessage}</div>}

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
                                <RichTextEditor value={siteSettings.directions} onChange={v => setSiteSettings({ ...siteSettings, directions: v })} rows={10} placeholder="Enter how to find the location..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Terms &amp; Conditions</label>
                                <RichTextEditor value={siteSettings.terms_conditions} onChange={v => setSiteSettings({ ...siteSettings, terms_conditions: v })} rows={10} placeholder="Enter T&C's..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Privacy Policy</label>
                                <RichTextEditor value={siteSettings.privacy_policy} onChange={v => setSiteSettings({ ...siteSettings, privacy_policy: v })} rows={10} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Cookies Policy</label>
                                <RichTextEditor value={siteSettings.cookies_policy} onChange={v => setSiteSettings({ ...siteSettings, cookies_policy: v })} rows={10} />
                            </div>
                        </div>
                    </div>

                    {/* Branding & Hero Text */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ck-text-strong)] mb-4 pb-2 border-b border-[var(--ck-border-subtle)]">Branding &amp; Hero Text</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Business Name</label>
                                <input type="text" value={siteSettings.business_name} onChange={e => setSiteSettings({ ...siteSettings, business_name: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Cape Kayak Adventures" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Business Tagline</label>
                                <input type="text" value={siteSettings.business_tagline} onChange={e => setSiteSettings({ ...siteSettings, business_tagline: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Cape Town's Original Since 1994" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Logo URL</label>
                                <input type="url" value={siteSettings.logo_url} onChange={e => setSiteSettings({ ...siteSettings, logo_url: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="https://i.ibb.co/your-logo.png" />
                                <p className="text-xs text-[var(--ck-text-muted)] mt-1">Leave empty to use default emoji. Upload at <a href="https://imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--ck-accent)] hover:underline">imgbb.com</a></p>
                                {siteSettings.logo_url && (
                                    <img src={siteSettings.logo_url} alt="Logo preview" className="mt-2 h-10 object-contain rounded border border-[var(--ck-border-subtle)]" />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Hero Eyebrow</label>
                                <input type="text" value={siteSettings.hero_eyebrow} onChange={e => setSiteSettings({ ...siteSettings, hero_eyebrow: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Cape Town Sea Kayaking" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Hero Title</label>
                                <input type="text" value={siteSettings.hero_title} onChange={e => setSiteSettings({ ...siteSettings, hero_title: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Find Your Perfect Paddle" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Hero Subtitle</label>
                                <input type="text" value={siteSettings.hero_subtitle} onChange={e => setSiteSettings({ ...siteSettings, hero_subtitle: e.target.value })}
                                    className="ui-control w-full px-3 py-2 text-sm rounded-lg outline-none" placeholder="Explore the Atlantic coastline by kayak with Cape Town's original guided team." />
                            </div>
                        </div>
                    </div>

                    {/* Branding Colors */}
                    <div>
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--ck-border-subtle)]">
                            <h3 className="text-sm font-semibold text-[var(--ck-text-strong)]">Theme Colors</h3>
                            <select
                                className="ui-control px-3 py-1 text-xs rounded-lg outline-none cursor-pointer bg-[var(--ck-surface)] border border-[var(--ck-border-subtle)]"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    const palettes: Record<string, any> = {
                                        "Gentle Sea Breeze": { color_main: "#1F7A8C", color_secondary: "#022B3A", color_cta: "#1F7A8C", color_bg: "#E1E5F2", color_nav: "#FFFFFF", color_hover: "#BFDBF7" },
                                        "Earthy Green": { color_main: "#52796F", color_secondary: "#2F3E46", color_cta: "#52796F", color_bg: "#CAD2C5", color_nav: "#F2F4F0", color_hover: "#84A98C" },
                                        "Cherry Blossom": { color_main: "#BD632F", color_secondary: "#273E47", color_cta: "#A4243B", color_bg: "#D8C99B", color_nav: "#F8F5EE", color_hover: "#D8973C" },
                                        "Soft Sand": { color_main: "#D5BDAF", color_secondary: "#4A4036", color_cta: "#D5BDAF", color_bg: "#F5EBE0", color_nav: "#FFFFFF", color_hover: "#D6CCC2" },
                                        "Golden Summer Fields": { color_main: "#D4A373", color_secondary: "#3D4A27", color_cta: "#D4A373", color_bg: "#FEFAE0", color_nav: "#FFFFFF", color_hover: "#E9EDC9" }
                                    };
                                    if (palettes[val]) setSiteSettings(prev => ({ ...prev, ...palettes[val] }));
                                    // Reset select back to default label after applying
                                    e.target.value = "";
                                }}
                            >
                                <option value="">Select a Palette...</option>
                                <option value="Gentle Sea Breeze">Gentle Sea Breeze</option>
                                <option value="Earthy Green">Earthy Green</option>
                                <option value="Cherry Blossom">Cherry Blossom</option>
                                <option value="Soft Sand">Soft Sand</option>
                                <option value="Golden Summer Fields">Golden Summer Fields</option>
                            </select>
                        </div>
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
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Page Background</label>
                                <div className="flex bg-[var(--ck-surface)] rounded-lg border border-[var(--ck-border-subtle)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ck-accent)]">
                                    <input type="color" value={siteSettings.color_bg} onChange={e => setSiteSettings({ ...siteSettings, color_bg: e.target.value })}
                                        className="h-10 w-12 p-1 bg-transparent cursor-pointer border-r border-[var(--ck-border-subtle)]" />
                                    <input type="text" value={siteSettings.color_bg} onChange={e => setSiteSettings({ ...siteSettings, color_bg: e.target.value })}
                                        className="flex-1 w-full px-3 py-2 text-sm outline-none uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Navigation Bar</label>
                                <div className="flex bg-[var(--ck-surface)] rounded-lg border border-[var(--ck-border-subtle)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ck-accent)]">
                                    <input type="color" value={siteSettings.color_nav} onChange={e => setSiteSettings({ ...siteSettings, color_nav: e.target.value })}
                                        className="h-10 w-12 p-1 bg-transparent cursor-pointer border-r border-[var(--ck-border-subtle)]" />
                                    <input type="text" value={siteSettings.color_nav} onChange={e => setSiteSettings({ ...siteSettings, color_nav: e.target.value })}
                                        className="flex-1 w-full px-3 py-2 text-sm outline-none uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--ck-text-muted)] mb-1">Card Hover Overlay</label>
                                <div className="flex bg-[var(--ck-surface)] rounded-lg border border-[var(--ck-border-subtle)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ck-accent)]">
                                    <input type="color" value={siteSettings.color_hover} onChange={e => setSiteSettings({ ...siteSettings, color_hover: e.target.value })}
                                        className="h-10 w-12 p-1 bg-transparent cursor-pointer border-r border-[var(--ck-border-subtle)]" />
                                    <input type="text" value={siteSettings.color_hover} onChange={e => setSiteSettings({ ...siteSettings, color_hover: e.target.value })}
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

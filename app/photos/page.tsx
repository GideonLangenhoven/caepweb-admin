"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBusinessContext } from "../../components/BusinessContext";

var SU = process.env.NEXT_PUBLIC_SUPABASE_URL!;
var SK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}

type SlotGroup = { date: string; label: string; slots: any[] };

export default function PhotosPage() {
  var { businessId } = useBusinessContext();
  var [slots, setSlots] = useState<SlotGroup[]>([]);
  var [selectedSlot, setSelectedSlot] = useState<any>(null);
  var [urls, setUrls] = useState<string[]>([""]);
  var [sending, setSending] = useState(false);
  var [result, setResult] = useState<any>(null);
  var [sentHistory, setSentHistory] = useState<any[]>([]);

  useEffect(() => { loadSlots(); loadHistory(); }, [businessId]);

  async function loadSlots() {
    var past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var now = new Date().toISOString();
    var { data } = await supabase.from("slots")
      .select("id, start_time, booked, tours(name)")
      .eq("business_id", businessId)
      .gt("booked", 0)
      .lt("start_time", now)
      .gt("start_time", past)
      .order("start_time", { ascending: false });
    var groups: Record<string, SlotGroup> = {};
    for (var s of (data || [])) {
      var d = new Date(s.start_time).toISOString().split("T")[0];
      if (!groups[d]) groups[d] = { date: d, label: fmtDate(s.start_time), slots: [] };
      groups[d].slots.push(s);
    }
    setSlots(Object.values(groups));
  }

  async function loadHistory() {
    var { data } = await supabase.from("trip_photos")
      .select("id, photo_url, uploaded_at, slots(start_time, tours(name))")
      .eq("business_id", businessId)
      .order("uploaded_at", { ascending: false })
      .limit(20);
    setSentHistory(data || []);
  }

  function addUrl() { setUrls([...urls, ""]); }
  function removeUrl(i: number) { setUrls(urls.filter((_, idx) => idx !== i)); }
  function updateUrl(i: number, v: string) { var n = [...urls]; n[i] = v; setUrls(n); }

  async function sendPhotos() {
    if (!selectedSlot) { alert("Select a trip slot first"); return; }
    var validUrls = urls.filter(u => u.trim().length > 0);
    if (validUrls.length === 0) { alert("Add at least one photo URL"); return; }
    if (!confirm("Send photos + thank-you email to all guests on this trip?")) return;

    setSending(true);
    setResult(null);
    try {
      var tourName = (selectedSlot as any).tours?.name || "kayak trip";
      var photoLink = validUrls.length === 1 ? validUrls[0] : validUrls[0];

      // Fetch bookings for this slot
      var { data: bookings } = await supabase.from("bookings")
        .select("id, customer_name, phone, email, status")
        .eq("business_id", businessId)
        .eq("slot_id", selectedSlot.id)
        .in("status", ["PAID", "CONFIRMED", "COMPLETED"]);

      var sent = 0;
      for (var b of (bookings || [])) {
        // Send WhatsApp with photo links
        if (b.phone) {
          var waMsg = "Hi " + (b.customer_name?.split(" ")[0] || "there") +
            "! 📸 Thank you for joining us on the " + tourName +
            "! Here are your trip photos:\n\n" +
            validUrls.join("\n") +
            "\n\nWe hope you had an amazing time and would love to see you again! Book your next adventure at booking-mu-steel.vercel.app";
          try {
            await fetch(SU + "/functions/v1/send-whatsapp-text", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
              body: JSON.stringify({ to: b.phone, message: waMsg }),
            });
          } catch { }
        }

        // Send thank-you email with photo link
        if (b.email) {
          try {
            await fetch(SU + "/functions/v1/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
              body: JSON.stringify({
                type: "TRIP_PHOTOS",
                data: {
                  email: b.email,
                  customer_name: b.customer_name || "Guest",
                  tour_name: tourName,
                  photo_url: photoLink,
                },
              }),
            });
          } catch { }
        }
        sent++;
      }

      // Log to trip_photos
      for (var url of validUrls) {
        await supabase.from("trip_photos").insert({ slot_id: selectedSlot.id, photo_url: url, business_id: businessId });
      }

      setResult({ sent });
      if (sent > 0) { setUrls([""]); setSelectedSlot(null); }
      loadHistory();
    } catch (e) { setResult({ error: String(e) }); }
    setSending(false);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">📸 Trip Photos</h1>
      <p className="text-sm text-gray-500">Send trip photos and a thank-you email to guests. Select a recent trip and add photo URLs.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Select Trip */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Select Trip (Last 7 Days)</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-gray-400">No recent trips with bookings.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {slots.map(group => (
                <div key={group.date}>
                  <p className="text-xs font-semibold text-gray-400 mb-1">{group.label}</p>
                  {group.slots.map(s => {
                    var isSelected = selectedSlot?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => setSelectedSlot(s)}
                        className={"w-full text-left flex items-center gap-3 p-3 rounded-lg border mb-1 transition-colors " +
                          (isSelected ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200")}>
                        <span className={"w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs " +
                          (isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300")}>
                          {isSelected ? "✓" : ""}
                        </span>
                        <div>
                          <p className="font-semibold text-sm">{(s as any).tours?.name}</p>
                          <p className="text-xs text-gray-400">{fmtTime(s.start_time)} · {s.booked} guests</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Photo URLs + Send */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold mb-3">Photo URLs</h2>
            <p className="text-xs text-gray-400 mb-3">Upload photos to Google Drive, Dropbox, or any host and paste the share links here.</p>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input type="text" value={u} onChange={e => updateUrl(i, e.target.value)}
                    placeholder="https://drive.google.com/file/..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  {urls.length > 1 && (
                    <button onClick={() => removeUrl(i)} className="shrink-0 px-2 py-2 text-sm text-gray-400 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addUrl} className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-800">+ Add another photo</button>
          </div>

          <button onClick={sendPhotos} disabled={sending || !selectedSlot || urls.every(u => !u.trim())}
            className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
            {sending ? "Sending..." : "📸 Send Photos & Thank You to " + (selectedSlot?.booked || 0) + " Guests"}
          </button>

          {result && (
            <div className={"text-sm p-3 rounded-lg " + (result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
              {result.error ? "Error: " + result.error : "✅ Photos & thank-you email sent to " + result.sent + " guests!"}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {sentHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Recently Sent</h2>
          <div className="space-y-2 max-h-48 overflow-auto">
            {sentHistory.map(p => (
              <div key={p.id} className="flex flex-col gap-1 border-b border-gray-50 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="text-gray-400">📸</span>
                <span className="flex-1 truncate text-blue-600 text-xs">{p.photo_url}</span>
                <span className="text-xs text-gray-400">{new Date(p.uploaded_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

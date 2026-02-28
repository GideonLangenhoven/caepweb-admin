"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DatePicker } from "../../components/DatePicker";
import { useBusinessContext } from "../../components/BusinessContext";
import CalendarHeader from "../../components/CalendarHeader";
import WeekView from "../../components/WeekView";
import DayView from "../../components/DayView";
import { Slot } from "../../components/WeekView";

const SU = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export default function Slots() {
  const { businessId } = useBusinessContext();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");

  // Individual Edit State
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [editForm, setEditForm] = useState({ capacity: 0, price: "", status: "OPEN", time: "" });
  const [saving, setSaving] = useState(false);

  // Bulk Edit State
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    startDate: "",
    endDate: "",
    tourId: "ALL",
    capacity: "",
    price: "",
    newTime: "",
  });
  const [savingBulk, setSavingBulk] = useState(false);
  const [cancellingWeather, setCancellingWeather] = useState(false);

  // Add Slot State
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [addForm, setAddForm] = useState({
    tourId: "",
    time: "06:00",
    startDate: "",
    endDate: "",
    capacity: "12",
    price: "",
  });
  const [savingAdd, setSavingAdd] = useState(false);

  async function cancelSlotWeather(slot: Slot) {
    const slotLabel = new Date(slot.start_time).toLocaleString("en-ZA", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
    }) + " — " + (slot.tours?.name || "Tour");

    if (!confirm(`Cancel "${slotLabel}" due to weather?\n\nThis will:\n• Close the slot\n• Cancel all bookings on this slot\n• Queue full refunds for all paid bookings\n• Notify customers via WhatsApp & email`)) return;

    setCancellingWeather(true);
    try {
      // 1. Close the slot
      await supabase.from("slots").update({ status: "CLOSED" }).eq("id", slot.id);

      // 2. Fetch all active bookings on this slot
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, customer_name, phone, email, qty, total_amount, status, yoco_checkout_id, tours(name), slots(start_time)")
        .eq("business_id", businessId)
        .eq("slot_id", slot.id)
        .in("status", ["PAID", "CONFIRMED", "HELD", "PENDING"]);

      const affected = bookings || [];
      let refundCount = 0;

      for (const b of affected) {
        const isPaidBooking = ["PAID", "CONFIRMED"].includes(b.status);
        const refundAmount = isPaidBooking ? Number(b.total_amount || 0) : 0;

        // Cancel the booking with weather reason + queue 100% refund
        await supabase.from("bookings").update({
          status: "CANCELLED",
          cancellation_reason: "Weather cancellation by admin",
          cancelled_at: new Date().toISOString(),
          ...(isPaidBooking && refundAmount > 0 ? {
            refund_status: "REQUESTED",
            refund_amount: refundAmount,
            refund_notes: "100% refund — weather cancellation",
          } : {}),
        }).eq("id", b.id);

        if (isPaidBooking && refundAmount > 0) refundCount++;

        // Release slot capacity
        const slotData = await supabase.from("slots").select("booked, held").eq("id", slot.id).single();
        if (slotData.data) {
          await supabase.from("slots").update({
            booked: Math.max(0, slotData.data.booked - b.qty),
            held: Math.max(0, (slotData.data.held || 0) - (b.status === "HELD" ? b.qty : 0)),
          }).eq("id", slot.id);
        }

        // Convert any active holds
        await supabase.from("holds").update({ status: "CANCELLED" }).eq("booking_id", b.id).eq("status", "ACTIVE");

        const ref = b.id.substring(0, 8).toUpperCase();
        const tourName = (b as any).tours?.name || "Tour";
        const startTime = (b as any).slots?.start_time
          ? new Date((b as any).slots.start_time).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })
          : "";

        // Notify customer via WhatsApp
        if (b.phone) {
          try {
            await fetch(SU + "/functions/v1/send-whatsapp-text", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
              body: JSON.stringify({
                to: b.phone,
                message: "⛈ *Trip Cancelled — Weather*\n\n" +
                  "Hi " + (b.customer_name?.split(" ")[0] || "there") + ", unfortunately your " + tourName + " on " + startTime +
                  " has been cancelled due to weather conditions.\n\n" +
                  "📋 Ref: " + ref + "\n" +
                  (isPaidBooking && refundAmount > 0
                    ? "💰 A *full refund of R" + refundAmount + "* has been submitted — expect it within 5–7 business days.\n\n"
                    : "\n") +
                  "You're welcome to rebook anytime — just type *book* 🛶",
              }),
            });
          } catch (e) { console.error("WA notify err:", e); }
        }

        // Notify customer via email
        if (b.email) {
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "CANCELLATION",
                data: {
                  email: b.email,
                  customer_name: b.customer_name,
                  ref,
                  tour_name: tourName,
                  start_time: startTime,
                  reason: "weather conditions",
                  refund_amount: isPaidBooking && refundAmount > 0 ? refundAmount : null,
                },
              },
            });
          } catch (e) { console.error("Email notify err:", e); }
        }
      }

      alert(`Weather cancellation complete.\n\n• ${affected.length} booking(s) cancelled\n• ${refundCount} refund(s) queued for approval\n\nProcess refunds on the Refunds page.`);
      setSelectedSlot(null);
      load();
    } catch (err) {
      alert("Weather cancellation failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setCancellingWeather(false);
  }

  useEffect(() => { loadTours(); }, [businessId]);
  useEffect(() => { load(); }, [currentDate, viewMode, businessId]);

  async function loadTours() {
    const { data } = await supabase.from("tours").select("id, name, business_id").eq("business_id", businessId).order("name");
    if (data) setTours(data);
  }

  async function load() {
    setLoading(true);

    // Calculate time range based on view mode
    let start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    let end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);

    if (viewMode === "week") {
      const day = start.getDay();
      // Adjust to Monday start (0=Sun, 1=Mon...6=Sat)
      // If Sun(0), Monday is -6 days away. If Mon(1), 0 days away. If Tue(2), -1 day away.
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      // End of week is start + 6 days
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    const { data } = await supabase.from("slots")
      .select("id, start_time, capacity_total, booked, held, status, price_per_person_override, tour_id, tours(id, name)")
      .eq("business_id", businessId)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time", { ascending: true });

    const normalized = (data || []).map((d: any) => ({
      ...d,
      tours: Array.isArray(d.tours) ? d.tours[0] : d.tours,
    }));

    setSlots(normalized as Slot[]);
    setLoading(false);
  }

  function handleSlotClick(slot: Slot) {
    setSelectedSlot(slot);

    // Extract local time from the UTC timestamp (SAST is UTC+2)
    const sastDate = new Date(new Date(slot.start_time).getTime() + 2 * 60 * 60 * 1000);
    const hrs = String(sastDate.getUTCHours()).padStart(2, "0");
    const mins = String(sastDate.getUTCMinutes()).padStart(2, "0");

    setEditForm({
      capacity: slot.capacity_total,
      price: slot.price_per_person_override !== null ? String(slot.price_per_person_override) : "",
      status: slot.status,
      time: `${hrs}:${mins}`,
    });
  }

  async function saveSlotEdit() {
    if (!selectedSlot) return;
    if (!editForm.time) {
      alert("Please enter a valid time.");
      return;
    }

    setSaving(true);

    const priceVal = editForm.price.trim() === "" ? null : Number(editForm.price);

    // Compute new UTC timestamp based on old date + new time
    const [newHours, newMins] = editForm.time.split(":").map(Number);
    const oldSastDate = new Date(new Date(selectedSlot.start_time).getTime() + 2 * 60 * 60 * 1000);

    // Store original hours/mins to check if time actually changed
    const originalHrs = oldSastDate.getUTCHours();
    const originalMins = oldSastDate.getUTCMinutes();
    const timeChanged = (originalHrs !== newHours || originalMins !== newMins);

    oldSastDate.setUTCHours(newHours, newMins, 0, 0); // Apply new local time
    const newUtcTime = new Date(oldSastDate.getTime() - 2 * 60 * 60 * 1000); // Back to UTC

    try {
      // Always update the single slot we clicked
      let { error: singleUpdateError } = await supabase
        .from("slots")
        .update({
          capacity_total: Number(editForm.capacity) || selectedSlot.capacity_total,
          price_per_person_override: priceVal,
          status: editForm.status,
          start_time: newUtcTime.toISOString()
        })
        .eq("id", selectedSlot.id);

      if (singleUpdateError) throw singleUpdateError;

      // If time changed, auto-update all targeted future slots for this tour matching the old time
      if (timeChanged) {
        const oldTimeString = `${String(originalHrs).padStart(2, "0")}:${String(originalMins).padStart(2, "0")}`;
        const newTimeString = `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;

        if (confirm(`Would you also like to move ALL future ${oldTimeString} slots across all days to ${newTimeString}?`)) {
          // Fetch all slots for this tour that happen AFTER the original select slot's UTC time.
          const targetTourId = (selectedSlot as any).tour_id || (selectedSlot.tours as any)?.id;
          const { data: futureSlots, error: futureErr } = await supabase
            .from("slots")
            .select("id, start_time")
            .eq("tour_id", targetTourId)
            .gt("start_time", selectedSlot.start_time);

          if (futureErr) throw futureErr;

          if (futureSlots) {
            const promises = futureSlots.map(slot => {
              // Extract SAST time of future slot
              const slotSastDate = new Date(new Date(slot.start_time).getTime() + 2 * 60 * 60 * 1000);
              const slotHrs = slotSastDate.getUTCHours();
              const slotMins = slotSastDate.getUTCMinutes();

              // Only update if it matches the EXACT original local time (e.g. 07:00)
              if (slotHrs === originalHrs && slotMins === originalMins) {
                slotSastDate.setUTCHours(newHours, newMins, 0, 0); // shift to new time
                const slotNewUtc = new Date(slotSastDate.getTime() - 2 * 60 * 60 * 1000);

                return supabase.from("slots").update({
                  start_time: slotNewUtc.toISOString()
                }).eq("id", slot.id);
              }
              return null;
            }).filter(Boolean); // remove nulls

            if (promises.length > 0) {
              await Promise.all(promises);
              alert(`Successfully moved ${promises.length} future slots to ${newTimeString}.`);
            }
          }
        }
      }

      setSelectedSlot(null);
      load();
    } catch (err: any) {
      alert("Error saving slot: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBulkEdit() {
    if (!bulkForm.startDate || !bulkForm.endDate) {
      alert("Please select a start and end date.");
      return;
    }

    if (bulkForm.capacity === "" && bulkForm.price === "" && bulkForm.newTime === "") {
      alert("Please enter a new capacity, price, or time to apply.");
      return;
    }

    setSavingBulk(true);

    const baseUpdates: any = {};
    if (bulkForm.capacity !== "") baseUpdates.capacity_total = Number(bulkForm.capacity);
    if (bulkForm.price !== "") baseUpdates.price_per_person_override = bulkForm.price === "NULL" ? null : Number(bulkForm.price);

    try {
      if (bulkForm.newTime !== "") {
        // Need to fetch slots to manually calculate new start_time keeping the same date
        let fetchQuery = supabase
          .from("slots")
          .select("id, start_time")
          .gte("start_time", `${bulkForm.startDate}T00:00:00`)
          .lte("start_time", `${bulkForm.endDate}T23:59:59`);

        if (bulkForm.tourId !== "ALL") fetchQuery = fetchQuery.eq("tour_id", bulkForm.tourId);

        const { data: slotsToUpdate, error: fetchErr } = await fetchQuery;
        if (fetchErr) throw fetchErr;

        if (slotsToUpdate) {
          const [newHours, newMins] = bulkForm.newTime.split(":").map(Number);
          const promises = slotsToUpdate.map(slot => {
            // SAST is UTC+2. Shift time by +2 hours to get wall-clock UTC equivalent.
            const sastDate = new Date(new Date(slot.start_time).getTime() + 2 * 60 * 60 * 1000);
            sastDate.setUTCHours(newHours, newMins, 0, 0); // Set new wall clock time

            // Convert back to true UTC
            const finalUtcTime = new Date(sastDate.getTime() - 2 * 60 * 60 * 1000);

            return supabase.from("slots").update({
              ...baseUpdates,
              start_time: finalUtcTime.toISOString()
            }).eq("id", slot.id);
          });

          await Promise.all(promises);
        }
      } else {
        // Simple update across all matches
        let query = supabase
          .from("slots")
          .update(baseUpdates)
          .gte("start_time", `${bulkForm.startDate}T00:00:00`)
          .lte("start_time", `${bulkForm.endDate}T23:59:59`);

        if (bulkForm.tourId !== "ALL") {
          query = query.eq("tour_id", bulkForm.tourId);
        }

        const { error } = await query;
        if (error) throw error;
      }

      setShowBulkEdit(false);
      setBulkForm({ startDate: "", endDate: "", tourId: "ALL", capacity: "", price: "", newTime: "" });
      alert("Bulk update applied successfully!");
      load();
    } catch (err: any) {
      alert("Error applying bulk update: " + err.message);
    } finally {
      setSavingBulk(false);
    }
  }

  async function saveAddSlot() {
    if (!addForm.tourId) { alert("Please select a tour."); return; }
    if (!addForm.startDate || !addForm.endDate) { alert("Please select start and end dates."); return; }
    if (!addForm.time) { alert("Please enter a time."); return; }
    if (!addForm.capacity || Number(addForm.capacity) <= 0) { alert("Please enter a valid capacity."); return; }

    setSavingAdd(true);

    const [hours, mins] = addForm.time.split(":").map(Number);
    const priceOverride = addForm.price.trim() === "" ? null : Number(addForm.price);

    const start = new Date(addForm.startDate + "T00:00:00");
    const end = new Date(addForm.endDate + "T00:00:00");
    const rows: any[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const slotTime = new Date(d);
      slotTime.setHours(hours, mins, 0, 0);
      // Convert SA local to UTC — SA is UTC+2
      const utcTime = new Date(slotTime.getTime() - 2 * 60 * 60 * 1000);

      rows.push({
        tour_id: addForm.tourId,
        start_time: utcTime.toISOString(),
        capacity_total: Number(addForm.capacity),
        booked: 0,
        held: 0,
        status: "OPEN",
        price_per_person_override: priceOverride,
        business_id: businessId,
      });
    }

    if (rows.length === 0) { alert("No dates in the selected range."); setSavingAdd(false); return; }

    const { error } = await supabase.from("slots").insert(rows);
    setSavingAdd(false);

    if (error) {
      alert("Error creating slots: " + error.message);
    } else {
      setShowAddSlot(false);
      setAddForm({ tourId: "", time: "06:00", startDate: "", endDate: "", capacity: "12", price: "" });
      alert(rows.length + " slot(s) created successfully!");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">Slot Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { if (tours.length > 0) setAddForm(f => ({ ...f, tourId: f.tourId || tours[0].id })); setShowAddSlot(true); }}
            className="px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            + Add Slot
          </button>
          <button
            onClick={() => setShowBulkEdit(true)}
            className="px-3 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Bulk Edit
          </button>
        </div>
      </div>

      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onDateChange={setCurrentDate}
        onViewModeChange={setViewMode}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        viewMode === "week" ? (
          <WeekView
            slots={slots}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
          />
        ) : (
          <DayView
            slots={slots}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
          />
        )
      )}

      {selectedSlot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-auto p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-1">Edit Slot</h3>
            <p className="text-sm text-gray-500 mb-4">
              {new Date(selectedSlot.start_time).toLocaleString("en-ZA", {
                weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg"
              })} — {selectedSlot.tours?.name}
            </p>

            <div className="space-y-4">
              <label className="block text-sm text-gray-600">
                Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </label>

              <label className="block text-sm text-gray-600">
                Time
                <input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm text-gray-600">
                Max Capacity
                <input
                  type="number"
                  min="0"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm text-gray-600">
                Price Override (ZAR)
                <span className="block text-xs text-gray-400 mb-1">Leave blank to use the default tour base amount.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 600"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => cancelSlotWeather(selectedSlot)}
                disabled={cancellingWeather || saving || selectedSlot.status === "CLOSED"}
                className="px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50"
              >
                {cancellingWeather ? "Cancelling..." : "⛈ Cancel Weather"}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSlotEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK EDIT MODAL */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-auto p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-1">Bulk Edit Slots</h3>
            <p className="text-sm text-gray-500 mb-4">
              Apply new capacities or base amounts to multiple slots at once.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm text-gray-600">
                  Start Date
                  <div className="mt-1">
                    <DatePicker value={bulkForm.startDate} onChange={(val) => setBulkForm({ ...bulkForm, startDate: val })} className="py-2.5 w-full border-gray-300" />
                  </div>
                </label>
                <label className="block text-sm text-gray-600">
                  End Date (Inclusive)
                  <div className="mt-1">
                    <DatePicker value={bulkForm.endDate} onChange={(val) => setBulkForm({ ...bulkForm, endDate: val })} className="py-2.5 w-full border-gray-300" />
                  </div>
                </label>
              </div>

              <label className="block text-sm text-gray-600">
                Tour
                <select
                  value={bulkForm.tourId}
                  onChange={(e) => setBulkForm({ ...bulkForm, tourId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="ALL">All Tours</option>
                  {tours.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-gray-600">
                New Time
                <span className="block text-xs text-gray-400 mb-1">Leave blank to keep existing times.</span>
                <input
                  type="time"
                  value={bulkForm.newTime}
                  onChange={(e) => setBulkForm({ ...bulkForm, newTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm text-gray-600">
                New Max Capacity
                <span className="block text-xs text-gray-400 mb-1">Leave blank to keep existing capacities.</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 24"
                  value={bulkForm.capacity}
                  onChange={(e) => setBulkForm({ ...bulkForm, capacity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm text-gray-600">
                New Base Price (ZAR)
                <span className="block text-xs text-gray-400 mb-1">Leave blank to keep existing prices. Type "NULL" to reset to default base amount.</span>
                <input
                  type="text"
                  placeholder="e.g. 650 or NULL"
                  value={bulkForm.price}
                  onChange={(e) => setBulkForm({ ...bulkForm, price: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkEdit(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveBulkEdit}
                disabled={savingBulk || !bulkForm.startDate || !bulkForm.endDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {savingBulk ? "Applying..." : "Apply Bulk Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SLOT MODAL */}
      {showAddSlot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-auto p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-1">Add New Slots</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create slots for a time across a date range.
            </p>

            <div className="space-y-4">
              <label className="block text-sm text-gray-600">
                Tour
                <select
                  value={addForm.tourId}
                  onChange={(e) => setAddForm({ ...addForm, tourId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Select a tour...</option>
                  {tours.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-gray-600">
                Time (SA Time)
                <input
                  type="time"
                  value={addForm.time}
                  onChange={(e) => setAddForm({ ...addForm, time: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm text-gray-600">
                  Start Date
                  <div className="mt-1">
                    <DatePicker value={addForm.startDate} onChange={(val) => setAddForm({ ...addForm, startDate: val })} className="py-2.5 w-full border-gray-300" />
                  </div>
                </label>
                <label className="block text-sm text-gray-600">
                  End Date
                  <div className="mt-1">
                    <DatePicker value={addForm.endDate} onChange={(val) => setAddForm({ ...addForm, endDate: val })} className="py-2.5 w-full border-gray-300" />
                  </div>
                </label>
              </div>

              <label className="block text-sm text-gray-600">
                Max Capacity
                <input
                  type="number"
                  min="1"
                  value={addForm.capacity}
                  onChange={(e) => setAddForm({ ...addForm, capacity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block text-sm text-gray-600">
                Price Override (ZAR)
                <span className="block text-xs text-gray-400 mb-1">Leave blank to use the tour&apos;s default price.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 600"
                  value={addForm.price}
                  onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAddSlot(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveAddSlot}
                disabled={savingAdd || !addForm.tourId || !addForm.startDate || !addForm.endDate}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {savingAdd ? "Creating..." : "Create Slots"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBusinessContext } from "../../components/BusinessContext";

const SU = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}

export default function Weather() {
  const { businessId } = useBusinessContext();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("weather conditions");

  useEffect(() => { load(); }, [businessId]);

  async function load() {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { data } = await supabase.from("slots")
      .select("id, start_time, capacity_total, booked, held, status, tours(name)")
      .eq("business_id", businessId)
      .gt("start_time", now.toISOString())
      .lt("start_time", in48h.toISOString())
      .gt("booked", 0)
      .eq("status", "OPEN")
      .order("start_time", { ascending: true });
    setSlots(data || []);
    setLoading(false);
  }

  async function cancelSlot(slotId: string) {
    if (!confirm("This will cancel ALL bookings on this slot, send WhatsApp + email notifications to all customers, and queue full refunds. Continue?")) return;
    setCancelling(slotId);

    try {
      // 1. Close the slot
      await supabase.from("slots").update({ status: "CLOSED" }).eq("id", slotId);

      // 2. Fetch all active bookings for this slot
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, customer_name, phone, email, qty, total_amount, status, tours(name), slots(start_time)")
        .eq("business_id", businessId)
        .eq("slot_id", slotId)
        .in("status", ["PAID", "CONFIRMED", "HELD", "PENDING"]);

      const affected = bookings || [];
      let notified = 0;

      for (const b of affected) {
        const isPaid = ["PAID", "CONFIRMED"].includes(b.status);
        const refundAmount = isPaid ? Number(b.total_amount || 0) : 0;

        // Cancel booking + queue 100% refund
        await supabase.from("bookings").update({
          status: "CANCELLED",
          cancellation_reason: "Weather cancellation: " + reason,
          cancelled_at: new Date().toISOString(),
          ...(isPaid && refundAmount > 0 ? {
            refund_status: "REQUESTED",
            refund_amount: refundAmount,
            refund_notes: "100% refund — weather cancellation",
          } : {}),
        }).eq("id", b.id);

        // Release slot capacity
        const slotData = await supabase.from("slots").select("booked, held").eq("id", slotId).single();
        if (slotData.data) {
          await supabase.from("slots").update({
            booked: Math.max(0, slotData.data.booked - b.qty),
            held: Math.max(0, (slotData.data.held || 0) - (b.status === "HELD" ? b.qty : 0)),
          }).eq("id", slotId);
        }

        // Cancel active holds
        await supabase.from("holds").update({ status: "CANCELLED" }).eq("booking_id", b.id).eq("status", "ACTIVE");

        const ref = b.id.substring(0, 8).toUpperCase();
        const tourName = (b as any).tours?.name || "Tour";
        const startTime = (b as any).slots?.start_time
          ? fmtTime((b as any).slots.start_time)
          : "";

        // Send WhatsApp to this customer
        if (b.phone) {
          try {
            await fetch(SU + "/functions/v1/send-whatsapp-text", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
              body: JSON.stringify({
                to: b.phone,
                message: "\u26C8 *Trip Cancelled \u2014 Weather*\n\n" +
                  "Hi " + (b.customer_name?.split(" ")[0] || "there") + ", unfortunately your " + tourName + " on " + startTime +
                  " has been cancelled due to " + reason + ".\n\n" +
                  "\uD83D\uDCCB Ref: " + ref + "\n" +
                  (isPaid && refundAmount > 0
                    ? "\uD83D\uDCB0 A *full refund of R" + refundAmount + "* has been submitted \u2014 expect it within 5\u20137 business days.\n\n"
                    : "\n") +
                  "You\u2019re welcome to rebook anytime \u2014 just type *book* \uD83D\uDEF6",
              }),
            });
          } catch (e) { console.error("WA notify err:", e); }
        }

        // Send cancellation email to this customer
        if (b.email) {
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "CANCELLATION",
                data: {
                  email: b.email,
                  customer_name: b.customer_name || "Guest",
                  ref,
                  tour_name: tourName,
                  start_time: startTime,
                  reason,
                  refund_amount: isPaid && refundAmount > 0 ? refundAmount : null,
                },
              },
            });
          } catch (e) { console.error("Email notify err:", e); }
        }

        notified++;
      }

      alert("Done! " + notified + " customer(s) cancelled & notified.\n\nProcess refunds on the Refunds page.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }

    setCancelling(null);
    load();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Weather Cancellations</h2>
      <p className="text-gray-500 text-sm">Cancel trips due to bad weather. All customers will be notified via WhatsApp and email, and full refunds will be queued.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm text-gray-600">Reason:</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md" />
      </div>
      {loading ? <p className="text-gray-500">Loading...</p> : slots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">No upcoming slots with bookings in next 48 hours.</div>
      ) : (
        <div className="space-y-3">
          {slots.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold">{s.tours?.name}</p>
                <p className="text-sm text-gray-500">{fmtTime(s.start_time)}</p>
                <p className="text-sm text-gray-500">{s.booked} booked · {s.capacity_total} capacity</p>
              </div>
              <button onClick={() => cancelSlot(s.id)} disabled={cancelling === s.id}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap sm:w-auto">
                {cancelling === s.id ? "Cancelling..." : "⛈ Cancel & Notify All"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

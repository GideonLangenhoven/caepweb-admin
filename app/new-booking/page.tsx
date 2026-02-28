"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { DatePicker } from "../../components/DatePicker";
import { useBusinessContext } from "../../components/BusinessContext";

interface Tour {
  id: string;
  name: string;
  business_id: string | null;
  base_price_per_person: number | null;
  peak_price_per_person: number | null;
}

interface Slot {
  id: string;
  start_time: string;
  capacity_total: number;
  booked: number;
  status: string;
  tour_id: string;
  price_per_person_override: number | null;
  tours: { name?: string } | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  });
}

function fmtCurrency(v: number) {
  return "R" + v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayInput() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}

function normalizePhone(phone: string): string {
  let clean = phone.replace(/[\s\-\+\(\)]/g, "");
  if (clean.startsWith("0")) {
    clean = "27" + clean.substring(1);
  }
  return clean;
}

function dayRange(dateInput: string) {
  const start = new Date(`${dateInput}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export default function NewBookingPage() {
  const { businessId } = useBusinessContext();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTourId, setSelectedTourId] = useState("");
  const [bookingDate, setBookingDate] = useState(todayInput());
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [adults, setAdults] = useState("0");
  const [children, setChildren] = useState("0");
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed" | "manual">("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");

  function formatSupabaseError(err: { message?: string; details?: string; hint?: string; code?: string } | null) {
    if (!err) return "Unknown error";
    const bits = [err.message, err.details, err.hint, err.code].filter(Boolean);
    return bits.join(" | ");
  }

  async function loadTours() {
    setLoadingTours(true);
    const { data } = await supabase
      .from("tours")
      .select("id, name, business_id, base_price_per_person, peak_price_per_person")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    const rows = (data || []) as Tour[];
    setTours(rows);
    if (!selectedTourId && rows[0]?.id) setSelectedTourId(rows[0].id);
    setLoadingTours(false);
  }

  async function loadSlots() {
    if (!bookingDate) return;
    setLoadingSlots(true);
    const { startIso, endIso } = dayRange(bookingDate);
    let query = supabase
      .from("slots")
      .select("id, start_time, capacity_total, booked, status, tour_id, price_per_person_override, tours(name)")
      .eq("business_id", businessId)
      .gte("start_time", startIso)
      .lt("start_time", endIso)
      .eq("status", "OPEN")
      .order("start_time", { ascending: true });
    if (selectedTourId) query = query.eq("tour_id", selectedTourId);
    const { data } = await query;
    setSlots((data || []) as Slot[]);
    setSelectedSlotId("");
    setLoadingSlots(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      loadTours();
    }, 0);
    return () => clearTimeout(t);
  }, [businessId]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadSlots();
    }, 0);
    return () => clearTimeout(t);
  }, [bookingDate, selectedTourId, businessId]);

  const selectedTour = useMemo(() => tours.find((t) => t.id === selectedTourId) || null, [tours, selectedTourId]);
  const selectedSlot = useMemo(() => slots.find((s) => s.id === selectedSlotId) || null, [slots, selectedSlotId]);
  const qty = Math.max(0, Number(adults) || 0) + Math.max(0, Number(children) || 0);
  const unitPrice = Number(
    selectedSlot?.price_per_person_override ??
    selectedTour?.peak_price_per_person ??
    selectedTour?.base_price_per_person ??
    0
  );
  const baseTotal = qty * unitPrice;
  const discountNum = Math.max(0, Number(discountValue) || 0);
  const discountAmount = discountType === "percent"
    ? Math.round(baseTotal * discountNum / 100 * 100) / 100
    : discountType === "fixed"
      ? Math.min(discountNum, baseTotal)
      : 0;
  const totalAmount = discountType === "manual"
    ? Math.max(0, discountNum)
    : Math.max(0, baseTotal - discountAmount);
  const availableSlots = slots.filter((s) => Math.max((s.capacity_total || 0) - (s.booked || 0), 0) > 0);
  const availableSeats = availableSlots.reduce((sum, s) => sum + Math.max((s.capacity_total || 0) - (s.booked || 0), 0), 0);

  async function createBooking() {
    if (!selectedTourId || !bookingDate || !selectedSlotId || qty <= 0 || !customerName.trim() || !mobile.trim() || !email.trim()) {
      alert("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    setResult("");
    try {
      const bookingId = crypto.randomUUID();
      const insertPayload: Record<string, unknown> = {
        id: bookingId,
        business_id: businessId,
        tour_id: selectedTourId,
        slot_id: selectedSlotId,
        customer_name: customerName.trim(),
        phone: normalizePhone(mobile),
        email: email.trim().toLowerCase(),
        qty,
        unit_price: unitPrice,
        total_amount: totalAmount,
        status,
        source: "ADMIN",
      };

      if (discountType !== "none" && discountType !== "manual") {
        insertPayload.original_total = baseTotal;
        insertPayload.discount_type = discountType === "percent" ? "PERCENT" : "FIXED";
        insertPayload.discount_percent = discountType === "percent" ? discountNum : 0;
      } else if (discountType === "manual") {
        insertPayload.original_total = baseTotal;
        insertPayload.discount_type = "MANUAL";
      }

      const { error: insertError } = await supabase.from("bookings").insert(insertPayload);
      if (insertError) {
        setSubmitting(false);
        alert("Booking creation failed: " + formatSupabaseError(insertError));
        return;
      }

      const ref = bookingId.substring(0, 8).toUpperCase();
      const slotObj = slots.find((s) => s.id === selectedSlotId);
      const tourObj = tours.find((t) => t.id === selectedTourId);
      const slotTimeLabel = slotObj?.start_time
        ? new Date(slotObj.start_time).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })
        : "TBC";
      const mapsUrl = "https://www.google.com/maps?q=-33.899368,18.411569";

      // Only send confirmation email + WhatsApp for completed bookings (PAID/CONFIRMED).
      // PENDING/HELD bookings will get confirmed by the Yoco webhook after payment.
      if (status === "PAID" || status === "CONFIRMED") {
        if (email.trim()) {
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "BOOKING_CONFIRM",
                data: {
                  email: email.trim().toLowerCase(),
                  customer_name: customerName.trim(),
                  ref,
                  tour_name: tourObj?.name || "Tour",
                  start_time: slotTimeLabel,
                  qty,
                  total_amount: totalAmount.toFixed(2),
                },
              },
            });
          } catch (e) {
            console.error("Confirmation email failed:", e);
          }
        }

        if (mobile.trim()) {
          try {
            await supabase.functions.invoke("send-whatsapp-text", {
              body: {
                to: normalizePhone(mobile),
                message: "\u{1F389} *Booking Confirmed!*\n\n" +
                  "\u{1F4CB} Ref: " + ref + "\n" +
                  "\u{1F6F6} " + (tourObj?.name || "Tour") + "\n" +
                  "\u{1F4C5} " + slotTimeLabel + "\n" +
                  "\u{1F465} " + qty + " people\n" +
                  "\u{1F4B0} R" + totalAmount.toFixed(2) + "\n\n" +
                  "\u{1F4CD} *Meeting Point:*\nThree Anchor Bay, Beach Road, Sea Point\nCape Town, Western Cape\nArrive 15 min early\n\n" +
                  "\u{1F5FA} " + mapsUrl + "\n\n" +
                  "\u{1F392} *Bring:* Sunscreen, hat, towel, water bottle\n\n" +
                  "We can\u2019t wait to see you! \u{1F30A}",
              },
            });
          } catch (e) {
            console.error("WhatsApp confirmation failed:", e);
          }
        }
      }

      setResult(`Booking created successfully! Ref: ${ref}`);

      setCustomerName("");
      setMobile("");
      setEmail("");
      setAdults("0");
      setChildren("0");
      setSelectedSlotId("");
      setDiscountType("none");
      setDiscountValue("0");
      loadSlots();
    } catch (err: unknown) {
      alert("Booking creation failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">➕ New Booking</h2>
        <p className="text-sm text-gray-500">Create manual bookings and send confirmation with payment link.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-xl font-medium text-gray-700">Activity Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-gray-600">
            To attend
            <select
              value={selectedTourId}
              onChange={(e) => setSelectedTourId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Please select a service</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-600">
            On
            <div className="mt-1">
              <DatePicker value={bookingDate} onChange={setBookingDate} className="py-2 w-full border-gray-300" />
            </div>
          </label>

          <label className="text-sm text-gray-600">
            Adults
            <select
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {[...Array(51)].map((_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-600">
            Children
            <select
              value={children}
              onChange={(e) => setChildren(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {[...Array(51)].map((_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-base font-semibold text-gray-700">Customer Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm text-gray-600">
            Full Name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            Mobile Number
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-700">Slot Availability</h3>
          <p className="text-xs text-gray-500">
            {loadingSlots ? "Loading slots..." : `${availableSlots.length} slots available · ${availableSeats} seats open`}
          </p>
        </div>

        <label className="text-sm text-gray-600">
          Select slot time
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Choose slot</option>
            {availableSlots.map((slot) => {
              const available = Math.max((slot.capacity_total || 0) - (slot.booked || 0), 0);
              return (
                <option key={slot.id} value={slot.id}>
                  {fmtTime(slot.start_time)} · {available} seats available
                </option>
              );
            })}
          </select>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="text-xs text-gray-500">Qty</p>
            <p className="font-semibold">{qty}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="text-xs text-gray-500">Unit Price</p>
            <p className="font-semibold">{fmtCurrency(unitPrice)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="text-xs text-gray-500">Base Total</p>
            <p className="font-semibold">{fmtCurrency(baseTotal)}</p>
          </div>
          <label className="rounded-lg bg-gray-50 p-3 text-sm">
            <span className="text-xs text-gray-500">Payment status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
              <option value="PENDING">PENDING</option>
              <option value="HELD">HELD</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PAID">PAID</option>
            </select>
          </label>
        </div>
      </div>

      {/* Discount / Price Override */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-base font-semibold text-gray-700">Discount &amp; Price Adjustment</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm text-gray-600">
            Adjustment type
            <select
              value={discountType}
              onChange={(e) => { setDiscountType(e.target.value as "none" | "percent" | "fixed" | "manual"); setDiscountValue("0"); }}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="none">No discount</option>
              <option value="percent">% Discount</option>
              <option value="fixed">Fixed amount off</option>
              <option value="manual">Manual price override</option>
            </select>
          </label>

          {discountType !== "none" && (
            <label className="text-sm text-gray-600">
              {discountType === "percent" ? "Discount %" : discountType === "fixed" ? "Amount off (R)" : "Override price (R)"}
              <input
                type="number"
                min={0}
                max={discountType === "percent" ? 100 : undefined}
                step={discountType === "percent" ? 1 : 0.01}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          )}

        </div>

        {discountType !== "none" && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-amber-50 px-4 py-3 text-sm">
            <span className="text-gray-500">Base: <span className="line-through">{fmtCurrency(baseTotal)}</span></span>
            {discountType !== "manual" && <span className="text-red-600 font-medium">− {fmtCurrency(discountAmount)}</span>}
            <span className="text-gray-800 font-bold text-base">→ Final: {fmtCurrency(totalAmount)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={createBooking}
          disabled={submitting || loadingTours || loadingSlots}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Creating..." : `Create Booking · ${fmtCurrency(totalAmount)}`}
        </button>
      </div>

      {result && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{result}</div>}
    </div>
  );
}

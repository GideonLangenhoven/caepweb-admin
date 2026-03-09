"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AvailabilityCalendar from "../../components/AvailabilityCalendar";
import { useBusinessContext } from "../../components/BusinessContext";
import { fetchUsageSnapshot, type UsageSnapshot } from "../lib/billing";

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

function isValidSAPhone(phone: string): boolean {
  const clean = normalizePhone(phone);
  return clean.startsWith("27") && clean.length >= 11 && clean.length <= 12;
}

function dayRange(dateInput: string) {
  const start = new Date(`${dateInput}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export default function NewBookingPage() {
  const router = useRouter();
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
  const [holdHours, setHoldHours] = useState("24");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed" | "manual">("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [missingField, setMissingField] = useState<string | null>(null);
  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | null>(null);

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
    try {
      const usage = await fetchUsageSnapshot(businessId);
      setUsageSnapshot(usage);
    } catch (e: any) {
      setUsageSnapshot(null);
    }
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
  const availableSlots = slots.filter((s) => {
    const avail = Math.max((s.capacity_total || 0) - (s.booked || 0), 0);
    return avail > 0 && (qty <= 0 || avail >= qty);
  });
  const availableSeats = availableSlots.reduce((sum, s) => sum + Math.max((s.capacity_total || 0) - (s.booked || 0), 0), 0);

  async function createBooking() {
    setMissingField(null);
    const missingFields = [];

    if (!selectedTourId) missingFields.push("tour");
    if (!bookingDate) missingFields.push("date");
    if (!selectedSlotId) missingFields.push("slot");
    if (qty <= 0) missingFields.push("pax");
    if (!customerName.trim()) missingFields.push("name");

    // International mobile validation
    const mobileTrimmed = mobile.trim();
    if (!mobileTrimmed) {
      missingFields.push("mobile");
    } else if (!/^\+(\d{1,3})/.test(mobileTrimmed)) {
      missingFields.push("mobile_format");
    }

    if (!email.trim()) missingFields.push("email");

    if (missingFields.length > 0) {
      setMissingField(missingFields[0]);
      if (missingFields.includes("mobile_format")) {
        alert(`Please include the correct international country code for the mobile number (e.g. +27, +44, etc).`);
      }
      return;
    }

    // Warn if SA phone number looks invalid (should be 11+ digits after normalization)
    const normalizedMobile = normalizePhone(mobileTrimmed);
    if (normalizedMobile.startsWith("27") && normalizedMobile.length < 11) {
      if (!confirm("The mobile number looks too short for a South African number (" + normalizedMobile + "). A valid SA number should be like +27 71 234 5678.\n\nContinue anyway?")) {
        return;
      }
    }

    if (status === "PAID" && totalAmount > 0) {
      try {
        const latestUsage = await fetchUsageSnapshot(businessId);
        setUsageSnapshot(latestUsage);
        if (latestUsage && !latestUsage.uncapped_flag && (latestUsage.remaining || 0) <= 0) {
          const goToBilling = confirm("Paid booking cap reached for this month. Open Plans & Billing to buy a top-up or upgrade?");
          if (goToBilling) router.push("/billing");
          return;
        }
      } catch (e) {
        console.error("Failed to check booking cap:", e);
      }
    }

    setSubmitting(true);
    setResult("");
    try {
      const bookingId = crypto.randomUUID();
      const adminName = localStorage.getItem("ck_admin_name") || localStorage.getItem("ck_admin_email") || "Admin";
      const adminEmail = localStorage.getItem("ck_admin_email") || "";
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
        created_by_admin_name: adminName,
        created_by_admin_email: adminEmail,
      };

      // Set payment deadline for PENDING bookings based on hold duration
      if (status === "PENDING") {
        insertPayload.payment_deadline = new Date(Date.now() + Number(holdHours) * 3600000).toISOString();
      }

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
      const tourDateLabel = slotObj?.start_time
        ? new Date(slotObj.start_time).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" })
        : "TBC";
      const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Cape+Kayak+Adventures%2C+180+Beach+Rd%2C+Three+Anchor+Bay%2C+Cape+Town%2C+8005";

      // ── Create invoice for every booking ──
      let invoiceNumber = ref;
      try {
        const invNumRes = await supabase.rpc("next_invoice_number");
        invoiceNumber = invNumRes.data || ref;
        const subtotal = baseTotal;
        const discountAmt = Math.max(0, subtotal - totalAmount);

        const invPayload: Record<string, unknown> = {
          business_id: businessId,
          booking_id: bookingId,
          invoice_number: invoiceNumber,
          customer_name: customerName.trim(),
          customer_email: email.trim().toLowerCase(),
          customer_phone: normalizePhone(mobile),
          tour_name: tourObj?.name || "Tour",
          tour_date: slotObj?.start_time || null,
          qty,
          unit_price: unitPrice,
          subtotal,
          total_amount: totalAmount,
          payment_method: status === "PAID" ? "Admin (Manual)" : "Pending",
          discount_type: discountType !== "none" ? (discountType === "percent" ? "PERCENT" : discountType === "fixed" ? "FIXED" : "MANUAL") : null,
          discount_percent: discountType === "percent" ? discountNum : 0,
          discount_amount: discountAmt,
        };

        const { data: invData } = await supabase.from("invoices").insert(invPayload).select("id").single();
        if (invData?.id) {
          await supabase.from("bookings").update({ invoice_id: invData.id }).eq("id", bookingId);
        }
      } catch (invErr) {
        console.error("Invoice creation failed:", invErr);
      }

      // ── Auto-send payment link for PENDING bookings ──
      let paymentLinkSent = false;
      if (status === "PENDING" && email.trim() && totalAmount > 0) {
        try {
          const checkoutRes = await supabase.functions.invoke("create-checkout", {
            body: {
              amount: totalAmount,
              booking_id: bookingId,
              type: "BOOKING",
              customer_name: customerName.trim(),
              qty,
            },
          });
          const checkoutData = checkoutRes.data;
          if (checkoutRes.error) {
            console.error("Auto payment link failed (checkout):", checkoutRes.error);
          } else if (checkoutData?.redirectUrl) {
            // Send payment link email
            try {
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "PAYMENT_LINK",
                  data: {
                    email: email.trim().toLowerCase(),
                    customer_name: customerName.trim(),
                    ref,
                    tour_name: tourObj?.name || "Tour",
                    tour_date: tourDateLabel,
                    qty,
                    total_amount: totalAmount.toFixed(2),
                    payment_url: checkoutData.redirectUrl,
                  },
                },
              });
              paymentLinkSent = true;
            } catch (emailErr) {
              console.error("Payment link email failed:", emailErr);
            }

            // Send WhatsApp with payment link
            if (mobile.trim()) {
              try {
                const firstName = customerName.trim().split(" ")[0] || "there";
                await supabase.functions.invoke("send-whatsapp-text", {
                  body: {
                    to: normalizePhone(mobile),
                    message:
                      "Hi " + firstName + "!\n\n" +
                      "Here\u2019s your payment link to confirm your booking:\n\n" +
                      "\u{1F6F6} " + (tourObj?.name || "Tour") + "\n" +
                      "\u{1F4C5} " + slotTimeLabel + "\n" +
                      "\u{1F465} " + qty + " people\n" +
                      "\u{1F4B0} R" + totalAmount.toFixed(2) + "\n\n" +
                      "\u{1F517} Pay here: " + checkoutData.redirectUrl + "\n\n" +
                      "\u23F0 Please complete payment within " + holdHours + " hours to secure your spot.",
                  },
                });
              } catch (waErr) {
                console.error("Payment link WhatsApp failed:", waErr);
              }
            }
          }
        } catch (err) {
          console.error("Auto payment link flow failed:", err);
        }
      }

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

          // Send invoice email with pro forma PDF attachment
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "INVOICE",
                data: {
                  email: email.trim().toLowerCase(),
                  customer_name: customerName.trim(),
                  customer_email: email.trim().toLowerCase(),
                  invoice_number: invoiceNumber,
                  invoice_date: tourDateLabel,
                  tour_name: tourObj?.name || "Tour",
                  tour_date: tourDateLabel,
                  qty,
                  unit_price: unitPrice.toFixed(2),
                  subtotal: baseTotal.toFixed(2),
                  total_amount: totalAmount.toFixed(2),
                  payment_method: "Admin (Manual)",
                  payment_reference: ref,
                },
              },
            });
          } catch (e) {
            console.error("Invoice email failed:", e);
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
                  "\u{1F4CD} *Meeting Point:*\nCape Kayak Adventures\n180 Beach Rd, Three Anchor Bay\nCape Town, 8005\nArrive 15 min early\n\n" +
                  "\u{1F5FA} " + mapsUrl + "\n\n" +
                  "\u{1F392} *Bring:* Sunscreen, hat, towel, water bottle\n\n" +
                  "\u{1F4DD} *Manage Your Booking:*\nhttps://booking-mu-steel.vercel.app/my-bookings\n\n" +
                  "We can\u2019t wait to see you! \u{1F30A}",
              },
            });
          } catch (e) {
            console.error("WhatsApp confirmation failed:", e);
          }
        }
      }

      alert(
        status === "PENDING" && paymentLinkSent
          ? `Booking created! Ref: ${ref} \u2014 Payment link emailed to ${email.trim().toLowerCase()}`
          : status === "PENDING"
            ? `Booking created! Ref: ${ref} \u2014 Payment link could not be sent (re-send from bookings page)`
            : `Booking created successfully! Ref: ${ref}`
      );
      router.push("/bookings");

      setCustomerName("");
      setMobile("");
      setEmail("");
      setAdults("0");
      setChildren("0");
      setSelectedSlotId("");
      setDiscountType("none");
      setDiscountValue("0");
      loadSlots();
      if (status === "PAID" && totalAmount > 0) {
        try {
          const updatedUsage = await fetchUsageSnapshot(businessId);
          setUsageSnapshot(updatedUsage);
        } catch (e) {
          console.error("Failed to refresh usage:", e);
        }
      }
    } catch (err: unknown) {
      alert("Booking creation failed: " + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">➕ New Booking</h2>
        <p className="text-sm text-gray-500">Create manual bookings and send confirmation with payment link.</p>
        {usageSnapshot && (
          <p className="mt-2 text-xs text-gray-500">
            Current month usage: {usageSnapshot.paid_bookings_count} paid bookings
            {usageSnapshot.uncapped_flag ? " (uncapped plan)." : ` / ${usageSnapshot.total_quota || 0}. Remaining: ${usageSnapshot.remaining || 0}.`}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-xl font-medium text-gray-700">Activity Details</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          {/* Left: tour + pax selectors */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm text-gray-600">
              To attend <span className="text-red-500">*</span>
              <select
                value={selectedTourId}
                onChange={(e) => { setSelectedTourId(e.target.value); setMissingField(null); }}
                className={`mt-1 w-full rounded border ${missingField === "tour" ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-gray-300"} px-3 py-2 text-sm transition-colors`}
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
              Adults <span className="text-red-500">*</span>
              <select
                value={adults}
                onChange={(e) => { setAdults(e.target.value); setMissingField(null); }}
                className={`mt-1 w-full rounded border ${missingField === "pax" ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-gray-300"} px-3 py-2 text-sm transition-colors`}
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
                onChange={(e) => { setChildren(e.target.value); setMissingField(null); }}
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

          {/* Right: availability calendar */}
          <div className="flex w-full flex-col items-center lg:max-w-[340px]">
            <label className={`text-sm mb-1 self-start ${missingField === "date" ? "text-red-500 font-medium" : "text-gray-600"}`}>Select date <span className="text-red-500">*</span></label>
            <div className={`w-full overflow-x-auto rounded-xl transition-colors ${missingField === "date" ? "ring-2 ring-red-500" : ""}`}>
              <AvailabilityCalendar
                value={bookingDate}
                onChange={(v) => { setBookingDate(v); setMissingField(null); }}
                tourId={selectedTourId}
                businessId={businessId}
                minQty={qty}
              />
            </div>

            {/* Slot color legend */}
            {availableSlots.length > 0 && (
              <div className="mt-4 flex w-full flex-col gap-2 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time Slots Available</p>
                {availableSlots.slice(0, 4).map((slot, i) => {
                  const available = Math.max((slot.capacity_total || 0) - (slot.booked || 0), 0);
                  const color = ["#10b981", "#a855f7", "#f59e0b", "#3b82f6"][i] || "#9ca3af";
                  return (
                    <div key={slot.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <span style={{ backgroundColor: color }} className="w-3 h-3 rounded-full shrink-0"></span>
                      <span className="font-medium">{available} available</span>
                      <span className="text-gray-500">for the {fmtTime(slot.start_time)} slot</span>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-base font-semibold text-gray-700">Customer Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm text-gray-600">
            Full Name <span className="text-red-500">*</span>
            <input
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setMissingField(null); }}
              placeholder="Gideon Langenhoven"
              className={`mt-1 w-full rounded border ${missingField === "name" ? "border-red-500 ring-1 ring-red-500 bg-red-50/10 placeholder:text-red-300" : "border-gray-300"} px-3 py-2 text-sm transition-colors`}
            />
          </label>
          <label className="text-sm text-gray-600">
            Mobile Number <span className="text-red-500">*</span>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => { setMobile(e.target.value); setMissingField(null); }}
              placeholder="+27 82 123 4567"
              className={`mt-1 w-full rounded border ${missingField === "mobile" || missingField === "mobile_format" ? "border-red-500 ring-1 ring-red-500 bg-red-50/10 placeholder:text-red-300" : "border-gray-300"} px-3 py-2 text-sm transition-colors`}
            />
            {(missingField === "mobile_format") && (
              <p className="text-xs text-red-500 mt-1">International format required (e.g. +27)</p>
            )}
          </label>
          <label className="text-sm text-gray-600">
            Email <span className="text-red-500">*</span>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMissingField(null); }}
              placeholder="gidslang89@gmail.com"
              className={`mt-1 w-full rounded border ${missingField === "email" ? "border-red-500 ring-1 ring-red-500 bg-red-50/10 placeholder:text-red-300" : "border-gray-300"} px-3 py-2 text-sm transition-colors`}
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
          Select slot time <span className="text-red-500">*</span>
          <select
            value={selectedSlotId}
            onChange={(e) => { setSelectedSlotId(e.target.value); setMissingField(null); }}
            className={`mt-1 w-full rounded border ${missingField === "slot" ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-gray-300"} px-3 py-2 text-sm transition-colors`}
          >
            <option value="">{availableSlots.length > 0 ? "Choose slot" : "No slots available"}</option>
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

        <div className={`mt-4 grid grid-cols-1 gap-3 ${status === "PENDING" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
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
          {status === "PENDING" && (
            <label className="rounded-lg bg-gray-50 p-3 text-sm">
              <span className="text-xs text-gray-500">Hold booking for</span>
              <select value={holdHours} onChange={(e) => setHoldHours(e.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="36">36 hours</option>
                <option value="48">48 hours</option>
              </select>
            </label>
          )}
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

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button
          onClick={createBooking}
          disabled={submitting || loadingTours || loadingSlots}
          className="w-full rounded-lg bg-[#0f595e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0b4347] disabled:opacity-50 transition-colors shadow-sm sm:w-auto"
        >
          {submitting ? "Processing..." : `Create Booking · ${fmtCurrency(totalAmount)}`}
        </button>
      </div>
    </div>
  );
}

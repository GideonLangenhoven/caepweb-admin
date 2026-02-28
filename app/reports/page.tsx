"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { DatePicker } from "../../components/DatePicker";
import { useBusinessContext } from "../../components/BusinessContext";

function fmtCurrency(n: number) {
  return "R" + Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Johannesburg" }).format(new Date());
}

function monthStartStr() {
  const d = new Date();
  d.setDate(1);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Johannesburg" }).format(d);
}

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-700",
  HELD: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

export default function Reports() {
  const { businessId } = useBusinessContext();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(monthStartStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [filterBy, setFilterBy] = useState<"slot" | "created">("slot");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [sortCol, setSortCol] = useState<"created_at" | "slot_time" | "total_amount">("slot_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  async function loadReport() {
    setLoading(true);
    const startIso = startDate + "T00:00:00+02:00";
    const endIso = endDate + "T23:59:59+02:00";

    let slotIds: string[] | null = null;
    if (filterBy === "slot") {
      // Two-step: first get slot IDs in the date range, then query bookings
      const { data: slotRows } = await supabase
        .from("slots")
        .select("id")
        .eq("business_id", businessId)
        .gte("start_time", startIso)
        .lte("start_time", endIso);
      slotIds = (slotRows || []).map((s: any) => s.id);
      if (slotIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("bookings")
      .select("id, customer_name, phone, email, qty, unit_price, total_amount, original_total, discount_type, discount_percent, status, yoco_payment_id, source, created_at, tours(name), slots(start_time)")
      .eq("business_id", businessId);

    if (filterBy === "slot" && slotIds) {
      query = query.in("slot_id", slotIds);
    } else {
      query = query.gte("created_at", startIso).lte("created_at", endIso);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);
    if (error) console.error("Report load error:", error);
    setBookings((data || []).map((b: any) => ({
      ...b,
      tours: Array.isArray(b.tours) ? b.tours[0] || null : b.tours,
      slots: Array.isArray(b.slots) ? b.slots[0] || null : b.slots,
    })));
    setLoading(false);
  }

  useEffect(() => { loadReport(); }, [startDate, endDate, filterBy, businessId]);

  const filtered = useMemo(() => {
    let rows = filterStatus === "ALL" ? bookings : bookings.filter(b => b.status === filterStatus);
    rows = [...rows].sort((a, b) => {
      let av: any, bv: any;
      if (sortCol === "slot_time") {
        av = a.slots?.start_time || a.created_at;
        bv = b.slots?.start_time || b.created_at;
      } else if (sortCol === "total_amount") {
        av = Number(a.total_amount || 0);
        bv = Number(b.total_amount || 0);
      } else {
        av = a.created_at;
        bv = b.created_at;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [bookings, filterStatus, sortCol, sortDir]);

  const summary = useMemo(() => {
    const paid = filtered.filter(b => ["PAID", "COMPLETED", "CONFIRMED"].includes(b.status));
    return {
      total: filtered.length,
      pax: filtered.reduce((s, b) => s + Number(b.qty || 0), 0),
      revenue: paid.reduce((s, b) => s + Number(b.total_amount || 0), 0),
      pending: filtered.filter(b => b.status === "PENDING").length,
      cancelled: filtered.filter(b => b.status === "CANCELLED").length,
    };
  }, [filtered]);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function sortIcon(col: typeof sortCol) {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function downloadCSV() {
    const headers = [
      "Ref", "Booked At", "Customer Name", "Phone", "Email",
      "Tour", "Slot Date", "Slot Time",
      "Qty", "Unit Price", "Original Total", "Discount Type", "Discount %",
      "Total Amount", "Status", "Source", "Payment Ref",
    ];
    const rows = filtered.map(b => [
      b.id.substring(0, 8).toUpperCase(),
      fmtDateTime(b.created_at),
      b.customer_name || "",
      b.phone || "",
      b.email || "",
      b.tours?.name || "",
      b.slots?.start_time ? fmtDate(b.slots.start_time) : "",
      b.slots?.start_time ? fmtTime(b.slots.start_time) : "",
      b.qty || 0,
      Number(b.unit_price || 0).toFixed(2),
      Number(b.original_total || b.total_amount || 0).toFixed(2),
      b.discount_type || "",
      b.discount_percent || 0,
      Number(b.total_amount || 0).toFixed(2),
      b.status || "",
      b.source || "",
      b.yoco_payment_id || "",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">📊 Reports</h2>
          <p className="text-sm text-gray-500">All bookings — filter by tour date or booking date, download as CSV.</p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={filtered.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          ⬇ Download CSV ({filtered.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm text-gray-600">
          Filter by
          <select value={filterBy} onChange={e => setFilterBy(e.target.value as "slot" | "created")}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm">
            <option value="slot">Tour date</option>
            <option value="created">Booking date</option>
          </select>
        </label>
        <label className="text-sm text-gray-600 flex flex-col gap-1">
          From
          <DatePicker value={startDate} onChange={setStartDate} />
        </label>
        <label className="text-sm text-gray-600 flex flex-col gap-1">
          To
          <DatePicker alignRight={true} value={endDate} onChange={setEndDate} />
        </label>
        <label className="text-sm text-gray-600">
          Status
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm">
            <option value="ALL">All Statuses</option>
            <option value="PAID">PAID</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PENDING">PENDING</option>
            <option value="HELD">HELD</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <button onClick={loadReport} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Bookings", value: summary.total },
          { label: "Pax", value: summary.pax },
          { label: "Revenue", value: fmtCurrency(summary.revenue) },
          { label: "Pending", value: summary.pending },
          { label: "Cancelled", value: summary.cancelled },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-xl font-bold text-gray-800">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          No bookings found for this period.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Ref</th>
                <th className="p-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort("slot_time")}>
                  Tour Date {sortIcon("slot_time")}
                </th>
                <th className="p-3">Customer</th>
                <th className="hidden p-3 md:table-cell">Contact</th>
                <th className="hidden p-3 lg:table-cell">Tour</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 cursor-pointer text-right hover:text-blue-600" onClick={() => toggleSort("total_amount")}>
                  Total {sortIcon("total_amount")}
                </th>
                <th className="hidden p-3 lg:table-cell">Discount</th>
                <th className="p-3">Status</th>
                <th className="hidden p-3 xl:table-cell cursor-pointer hover:text-blue-600" onClick={() => toggleSort("created_at")}>
                  Booked {sortIcon("created_at")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => {
                const hasDiscount = b.discount_type && b.discount_type !== "none";
                return (
                  <tr key={b.id} className="hover:bg-gray-50/60">
                    <td className="p-3 font-mono text-xs text-gray-500">{b.id.substring(0, 8).toUpperCase()}</td>
                    <td className="p-3 whitespace-nowrap">
                      {b.slots?.start_time ? (
                        <span>
                          <span className="font-medium">{fmtDate(b.slots.start_time)}</span>
                          <span className="ml-1 text-gray-400 text-xs">{fmtTime(b.slots.start_time)}</span>
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{b.customer_name || "—"}</p>
                    </td>
                    <td className="hidden p-3 md:table-cell">
                      <p className="text-xs text-gray-500">{b.phone || "—"}</p>
                      <p className="text-xs text-gray-400">{b.email || "—"}</p>
                    </td>
                    <td className="hidden p-3 lg:table-cell text-gray-600">{b.tours?.name || "—"}</td>
                    <td className="p-3 text-right">{b.qty}</td>
                    <td className="p-3 text-right">
                      {hasDiscount && b.original_total ? (
                        <div>
                          <p className="line-through text-xs text-gray-400">{fmtCurrency(Number(b.original_total))}</p>
                          <p className="font-semibold text-emerald-700">{fmtCurrency(Number(b.total_amount || 0))}</p>
                        </div>
                      ) : (
                        <p className="font-semibold">{fmtCurrency(Number(b.total_amount || 0))}</p>
                      )}
                    </td>
                    <td className="hidden p-3 lg:table-cell text-xs text-gray-500">
                      {hasDiscount ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 font-medium">
                          {b.discount_type === "PERCENT" ? `${b.discount_percent}% off` :
                            b.discount_type === "FIXED" ? "Fixed" :
                              b.discount_type === "MANUAL" ? "Manual" : b.discount_type}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-600"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="hidden p-3 xl:table-cell text-xs text-gray-400 whitespace-nowrap">
                      {fmtDateTime(b.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                <td colSpan={5} className="p-3 text-gray-500 text-xs">Totals ({filtered.length} bookings)</td>
                <td className="p-3 text-right">{summary.pax}</td>
                <td className="p-3 text-right text-emerald-700">{fmtCurrency(summary.revenue)}</td>
                <td colSpan={3} className="p-3 text-xs text-gray-400">paid/confirmed/completed only</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

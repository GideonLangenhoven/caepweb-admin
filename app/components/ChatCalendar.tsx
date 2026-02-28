"use client";
import { useState } from "react";

type CalendarProps = {
  availableDates: { date: string; label: string; slots: unknown[] }[];
  onSelectDate: (date: string) => void;
};

type CalendarCell = {
  day: number;
  date: string;
  isPast: boolean;
  hasSlots: boolean;
} | null;

export default function ChatCalendar({ availableDates, onSelectDate }: CalendarProps) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const availSet = new Set(availableDates.map((d) => d.date));

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  const canPrev = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth > now.getMonth());
  const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const canNext = new Date(viewYear, viewMonth + 1, 1) < maxDate;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = viewYear + "-" + String(viewMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const isPast = new Date(dateStr) < new Date(now.toISOString().split("T")[0]);
    const hasSlots = availSet.has(dateStr);
    cells.push({ day: d, date: dateStr, isPast, hasSlots });
  }

  return (
    <div className="ml-9 mt-2 surface p-3" style={{ width: "260px" }}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={prevMonth} disabled={!canPrev} className="h-7 w-7 rounded-lg text-sm text-[color:var(--textMuted)] hover:bg-[color:var(--surface2)] disabled:opacity-20">◀</button>
        <span className="text-xs font-semibold text-[color:var(--text)]">{monthName}</span>
        <button onClick={nextMonth} disabled={!canNext} className="h-7 w-7 rounded-lg text-sm text-[color:var(--textMuted)] hover:bg-[color:var(--surface2)] disabled:opacity-20">▶</button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {dayNames.map((dn) => <div key={dn} className="py-0.5 text-center text-[10px] font-medium text-[color:var(--textMuted)]">{dn}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <div key={"e" + i} />;
          if (c.isPast || !c.hasSlots) {
            return <div key={c.date} className="rounded-lg py-1.5 text-center text-[11px] text-[color:var(--textMuted)]/35">{c.day}</div>;
          }
          return (
            <button key={c.date} onClick={() => onSelectDate(c.date)}
              className="relative rounded-lg py-1.5 text-center text-[11px] font-semibold text-[color:var(--text)] hover:bg-[color:var(--accentSoft)] hover:text-[color:var(--accent)] transition-colors">
              {c.day}
              <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[color:var(--success)]"></span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-[color:var(--textMuted)]">Dots indicate available dates.</p>
    </div>
  );
}

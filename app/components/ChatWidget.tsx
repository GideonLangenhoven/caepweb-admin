"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import ChatCalendar from "./ChatCalendar";

type ChatButton = { value: string; label: string };
type ChatDate = { date: string; label: string; slots: unknown[] };

type Msg = {
  role: "user" | "bot";
  text: string;
  buttons?: ChatButton[];
  paymentUrl?: string;
  calendar?: ChatDate[];
};

type ChatResponse = {
  reply?: string;
  buttons?: ChatButton[];
  paymentUrl?: string;
  calendar?: ChatDate[];
  state?: unknown;
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [st, setSt] = useState<unknown>({ step: "IDLE" });
  const endRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const greeted = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  useEffect(() => {
    if (open && !greeted.current) {
      greeted.current = true;
      setTimeout(() => {
        setTyping(true);
        setTimeout(() => {
          setTyping(false);
          setMsgs([{ role: "bot", text: "Hi there! 🛶 How can I help?" }]);
        }, 900 + Math.random() * 500);
      }, 400);
    }
    if (open) setTimeout(() => inRef.current?.focus(), 100);
  }, [open]);

  async function send(ovr?: string) {
    const msg = ovr || input.trim();
    if (!msg || typing) return;

    const isBtn = msg.startsWith("btn:");
    let displayMsg = msg;

    if (isBtn) {
      const lastBot = [...msgs].reverse().find((m) => m.buttons || m.calendar);
      if (lastBot?.buttons) {
        const bm = lastBot.buttons.find((b) => "btn:" + b.value === msg);
        if (bm) displayMsg = bm.label;
      }
      if (lastBot?.calendar && msg.startsWith("btn:2")) {
        const cd = lastBot.calendar.find((d) => "btn:" + d.date === msg);
        if (cd) displayMsg = cd.label;
      }
    }

    const newM: Msg[] = [...msgs, { role: "user", text: displayMsg }];
    setMsgs(newM);
    setInput("");
    setTyping(true);

    try {
      const hist = newM.slice(-12).map((m) => ({ role: m.role, text: m.text }));
      const res = await supabase.functions.invoke("web-chat", {
        body: { messages: hist.slice(0, -1), message: msg, state: st },
      });
      const d = (res.data || {}) as ChatResponse;
      setSt(d.state ?? st);
      const delay = 800 + Math.min((d.reply || "").length * 6, 1500) + Math.random() * 500;

      setTimeout(() => {
        setTyping(false);
        setMsgs((prev) => [...prev, {
          role: "bot",
          text: d.reply || "Try again?",
          buttons: d.buttons || undefined,
          paymentUrl: d.paymentUrl || undefined,
          calendar: d.calendar || undefined,
        }]);
      }, delay);
    } catch {
      setTimeout(() => {
        setTyping(false);
        setMsgs((prev) => [...prev, { role: "bot", text: "Sorry, try that again?" }]);
      }, 800);
    }
  }

  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center">
          <style>{`@keyframes bookPulse{0%,100%{opacity:1;transform:translateX(-50%) scale(1)}50%{opacity:.7;transform:translateX(-50%) scale(1.05)}}`}</style>
          <span
            className="absolute -top-9 left-1/2 whitespace-nowrap rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold text-white shadow-md"
            style={{ animation: "bookPulse 2s ease-in-out infinite" }}
          >
            Book here
          </span>
          <button
            onClick={() => setOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--accent)] text-white shadow-lg transition-all hover:scale-105 hover:bg-[color:var(--accentHover)]"
            aria-label="Open chat"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      )}

      {open && (
        <div className="panel-enter fixed bottom-6 right-6 z-50 flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-lg)]">
          <style>{`@keyframes bl{0%,80%,100%{opacity:0}40%{opacity:1}}`}</style>

          <div className="shrink-0 bg-[color:var(--accent)] p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg">🛶</div>
                <div>
                  <p className="text-sm font-semibold">Cape Kayak</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--success)]"></span>
                    <p className="text-xs text-white/75">Online</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close chat">✕</button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto bg-[color:var(--surface2)] p-4">
            {msgs.map((m, i) => (
              <div key={i}>
                <div className={"flex " + (m.role === "user" ? "justify-end" : "justify-start") + " panel-enter"}>
                  {m.role === "bot" && <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-xs text-white">🛶</div>}
                  <div className={"max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " + (m.role === "user" ? "rounded-br-md bg-[color:var(--accent)] text-white" : "rounded-bl-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm")}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>

                {m.paymentUrl && (
                  <div className="ml-9 mt-2">
                    <a href={m.paymentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary px-5 py-2.5 no-underline">💳 Complete Payment</a>
                    <p className="mt-1 text-xs">Spots are held for 15 minutes.</p>
                  </div>
                )}

                {m.calendar && m.calendar.length > 0 && (
                  <ChatCalendar availableDates={m.calendar} onSelectDate={(date) => send("btn:" + date)} />
                )}

                {m.buttons && m.buttons.length > 0 && (!m.calendar || m.calendar.length === 0) && (
                  <div className="ml-9 mt-2 flex flex-col gap-1.5">
                    {m.buttons.map((b, j) => (
                      <button key={j} onClick={() => send("btn:" + b.value)} className="surface px-3 py-2.5 text-left text-xs font-medium text-[color:var(--text)] hover:border-[color:var(--accent)]">{b.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="panel-enter flex justify-start">
                <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-xs text-white">🛶</div>
                <div className="rounded-2xl rounded-bl-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--textMuted)]" style={{ animation: "bl 1.4s infinite 0s" }} />
                    <span className="h-2 w-2 rounded-full bg-[color:var(--textMuted)]" style={{ animation: "bl 1.4s infinite .2s" }} />
                    <span className="h-2 w-2 rounded-full bg-[color:var(--textMuted)]" style={{ animation: "bl 1.4s infinite .4s" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="flex gap-2">
              <input
                ref={inRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message..."
                disabled={typing}
                className="field flex-1 py-2.5 disabled:opacity-50"
              />
              <button onClick={() => send()} disabled={!input.trim() || typing} className="btn btn-primary h-10 w-10 shrink-0 px-0" aria-label="Send message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

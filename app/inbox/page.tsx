"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useBusinessContext } from "../../components/BusinessContext";

function MessageList({
  messages,
  endRef,
  fmtTime,
  fmtDate,
}: {
  messages: any[];
  endRef: React.RefObject<HTMLDivElement | null>;
  fmtTime: (iso: string) => string;
  fmtDate: (iso: string) => string;
}) {
  return (
    <>
      {messages.map((m: any, i: number) => {
        const isAdmin = m.direction === "OUT";
        const showDate = i === 0 || fmtDate(m.created_at) !== fmtDate(messages[i - 1].created_at);
        return (
          <div key={m.id}>
            {showDate && (
              <div className="text-center my-2">
                <span className="bg-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full">{fmtDate(m.created_at)}</span>
              </div>
            )}
            <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${isAdmin
                ? "bg-blue-600 text-white rounded-br-md"
                : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                }`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`text-xs mt-1 ${isAdmin ? "text-blue-200" : "text-gray-400"}`}>
                  {fmtTime(m.created_at)} · {m.sender || (isAdmin ? "Admin" : "Customer")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </>
  );
}

export default function Inbox() {
  const { businessId } = useBusinessContext();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"inbox" | "history">("inbox");

  // Inbox state
  const [convos, setConvos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const autoSelectedRef = useRef(false);

  // Chat History state
  const [historyConvos, setHistoryConvos] = useState<any[]>([]);
  const [historySelected, setHistorySelected] = useState<any>(null);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyLoadedRef = useRef(false);
  const historyChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConvos(); }, [businessId]);

  // Auto-select conversation from ?phone= query param
  useEffect(() => {
    if (autoSelectedRef.current || loading || convos.length === 0) return;
    const phone = searchParams.get("phone");
    if (!phone) return;
    const match = convos.find((c: any) => c.phone === phone);
    if (match) {
      setSelected(match);
      autoSelectedRef.current = true;
    }
  }, [convos, loading, searchParams]);

  useEffect(() => {
    if (activeTab === "history" && !historyLoadedRef.current) {
      loadHistoryConvos();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selected) return;

    loadMessages(selected.phone);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel("inbox-chat-" + Date.now())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
      }, (payload: any) => {
        if (payload.new.phone === selected.phone) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      })
      .subscribe((status: string) => {
        console.log("Realtime status:", status);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    historyChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyMessages]);

  // Polling fallback for inbox
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      loadMessages(selected.phone);
    }, 3000);
    return () => clearInterval(interval);
  }, [selected]);

  async function loadConvos() {
    const { data } = await supabase.from("conversations")
      .select("id, phone, customer_name, email, status, current_state, updated_at")
      .eq("business_id", businessId)
      .eq("status", "HUMAN")
      .order("updated_at", { ascending: false });
    setConvos(data || []);
    setLoading(false);
  }

  async function loadHistoryConvos() {
    setHistoryLoading(true);
    const { data } = await supabase.from("conversations")
      .select("id, phone, customer_name, email, status, current_state, updated_at")
      .eq("business_id", businessId)
      .neq("status", "HUMAN")
      .order("updated_at", { ascending: false })
      .limit(500);
    setHistoryConvos(data || []);
    setHistoryLoading(false);
    historyLoadedRef.current = true;
  }

  async function loadMessages(phone: string) {
    const { data } = await supabase.from("chat_messages")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1000);
    setMessages((data || []).reverse());
  }

  async function loadHistoryMessages(phone: string) {
    const { data } = await supabase.from("chat_messages")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1000);
    setHistoryMessages((data || []).reverse());
  }

  async function sendReply() {
    if (!selected || !reply.trim() || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);

    try {
      const res = await supabase.functions.invoke("admin-reply", {
        body: { phone: selected.phone, message: reply },
      });
      if (res.error) {
        alert("Error sending: " + res.error.message);
      } else if (res.data && res.data.ok === false) {
        let msg = res.data.error || "Unknown Error";
        if (res.data.details?.error?.error_data?.details) {
          msg += "\nDetails: " + res.data.details.error.error_data.details;
        } else if (res.data.details?.error?.message) {
          msg += "\nDetails: " + res.data.details.error.message;
        }
        alert("Couldn't send WhatsApp message:\n" + msg);
      } else {
        setReply("");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function returnToBot(id: string, phone: string) {
    if (!phone) return;
    try {
      const res = await supabase.functions.invoke("admin-reply", {
        body: { action: "return_to_bot", phone: phone, message: "RETURN" }, // passing dummy message to bypass missing message check just in case, but the edge function checks action first anyway
      });
      if (res.error) {
        alert("Error returning to bot: " + res.error.message);
      } else if (res.data && res.data.ok === false) {
        alert("Error returning to bot: " + res.data.error);
      } else {
        setSelected(null);
        setMessages([]);
        loadConvos();
        window.dispatchEvent(new Event("inbox-updated"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendingRef.current) {
        sendReply();
      }
    }
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab header */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`text-2xl font-bold px-1 pb-0.5 border-b-2 transition-colors mr-1 ${activeTab === "inbox"
            ? "border-blue-600 text-gray-900"
            : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
        >
          Inbox
          {convos.length > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5 align-middle">
              {convos.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`text-2xl font-bold px-1 pb-0.5 border-b-2 transition-colors ${activeTab === "history"
            ? "border-blue-600 text-gray-900"
            : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
        >
          Chat History
        </button>
      </div>

      {/* ── Inbox Tab ── */}
      {activeTab === "inbox" && (
        loading ? <p className="text-gray-500">Loading...</p> : (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Conversation list — hidden on mobile when a chat is selected */}
            <div className={`w-full md:w-72 shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden ${selected ? "hidden md:flex" : "flex"}`}>
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <p className="text-sm font-medium text-gray-600">{convos.length} waiting</p>
              </div>
              <div className="flex-1 overflow-auto">
                {convos.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">No conversations waiting ✓</p>
                ) : convos.map((c: any) => (
                  <div key={c.id} onClick={() => setSelected(c)}
                    className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"}`}>
                    <p className="font-semibold text-sm">{c.customer_name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(c.updated_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat panel — full width on mobile */}
            {selected ? (
              <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                  <button onClick={() => setSelected(null)} className="md:hidden shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium hover:bg-gray-50">
                    ← Back
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{selected.customer_name || selected.phone}</p>
                    <p className="text-xs text-gray-500 truncate">{selected.phone} · {selected.email || "no email"}</p>
                  </div>
                  <button onClick={() => returnToBot(selected.id, selected.phone)}
                    className="shrink-0 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
                    Return to Bot
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50">
                  {messages.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm mt-8">No messages yet. The customer&apos;s next message will appear here.</p>
                  ) : (
                    <MessageList messages={messages} endRef={chatEndRef} fmtTime={fmtTime} fmtDate={fmtDate} />
                  )}
                </div>

                <div className="p-3 border-t border-gray-200 bg-white">
                  <div className="flex gap-2">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={handleKeyDown}
                      rows={2} placeholder="Type your reply... (Enter to send)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <button onClick={sendReply} disabled={sending || !reply.trim()}
                      className="bg-green-600 text-white px-4 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 self-end">
                      {sending ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center bg-white rounded-xl border border-gray-200">
                <p className="text-gray-400">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Chat History Tab ── */}
      {activeTab === "history" && (
        historyLoading ? <p className="text-gray-500">Loading...</p> : (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Past conversation list — hidden on mobile when a chat is selected */}
            <div className={`w-full md:w-72 shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden ${historySelected ? "hidden md:flex" : "flex"}`}>
              <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">{historyConvos.length} conversations</p>
                <button onClick={loadHistoryConvos} className="text-xs text-blue-600 hover:underline">Refresh</button>
              </div>
              <div className="flex-1 overflow-auto">
                {historyConvos.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">No chat history yet</p>
                ) : historyConvos.map((c: any) => (
                  <div key={c.id} onClick={() => { setHistorySelected(c); loadHistoryMessages(c.phone); }}
                    className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${historySelected?.id === c.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"}`}>
                    <p className="font-semibold text-sm">{c.customer_name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(c.updated_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Read-only transcript — full width on mobile */}
            {historySelected ? (
              <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                  <button onClick={() => setHistorySelected(null)} className="md:hidden shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium hover:bg-gray-50">
                    ← Back
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{historySelected.customer_name || historySelected.phone}</p>
                    <p className="text-xs text-gray-500 truncate">{historySelected.phone} · {historySelected.email || "no email"} · {historySelected.status}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50">
                  {historyMessages.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm mt-8">No messages in this conversation</p>
                  ) : (
                    <MessageList messages={historyMessages} endRef={historyChatEndRef} fmtTime={fmtTime} fmtDate={fmtDate} />
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center bg-white rounded-xl border border-gray-200">
                <p className="text-gray-400">Select a conversation to view transcript</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

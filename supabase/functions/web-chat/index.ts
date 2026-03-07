import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
var GK = Deno.env.get("GEMINI_API_KEY");
var SU = Deno.env.get("SUPABASE_URL");
var SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
var db = createClient(SU, SK);
var YK = Deno.env.get("YOCO_SECRET_KEY");
var AO = ["https://admin.capekayak.co.za", "https://book.capekayak.co.za", "https://capekayak.co.za", "https://bookingtours.co.za", "https://www.bookingtours.co.za", "http://localhost:3000", "http://localhost:3001"]; function gCors(r) { var o = r?.headers?.get("origin") || ""; var a = AO.includes(o) ? o : AO[0]; return { "Access-Control-Allow-Origin": a, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" }; }
function fmt(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return "?"; return d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Johannesburg" }) + " at " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }); }
function fmtS(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return "?"; return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }) + " " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }); }
function fmtDate(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return "?"; return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }); }
function fmtTime(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return "?"; return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }); }
function dateKey(iso) { var d = new Date(iso); return d.toISOString().split("T")[0]; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
async function gemChat(hist, msg) {
  try {
    var c = []; for (var h of (hist || []).slice(-8)) c.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
    c.push({ role: "user", parts: [{ text: msg }] });
    var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GK, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ system_instruction: { parts: [{ text: "You are a friendly website chat assistant for Cape Kayak Adventures, Cape Town's original kayak tour operator since 1994. Keep responses SHORT (1-2 sentences). Sound like a real person. 1 emoji max.\n\nSTRICT RULES:\n- ONLY answer from the knowledge base below\n- If the answer is not in the knowledge base, say: \"I'm not sure about that. Let me connect you to our team.\"\n- NEVER make up information, times, availability, or prices\n- NEVER say we don't offer something if it's in the knowledge base\n\nTOURS (We do NOT offer private tours):\n- Sea Kayak Tour: R600/pp, 90 min, morning departures 07:00 and 09:00\n- Sunset Paddle: R600/pp, 2 hours, evening departure 17:00, includes sparkling wine\n- The early trip is cooler and a wonderful way to start the day. The Sunset Paddle is more relaxed with sparkling wine.\n- Wildlife sightings are not guaranteed, but there is an 80% chance of seeing dolphins. We also sometimes see seals, penguins, sunfish, and whales if very lucky.\n- We operate 365 days a year, weather permitting. Public holidays are some of our busiest days.\n\nMEETING POINT: Cape Kayak Adventures, 180 Beach Rd, Three Anchor Bay, Cape Town, 8005. Arrive 15 minutes early. If lost, call our number and a human will answer.\nWHAT TO BRING: Sunscreen, hat, sunnies, towel, water. Eat a light meal 1 hour before.\nWHAT TO WEAR: Comfortable clothes you don't mind getting wet, like shorts and a t-shirt. You will go barefoot.\nDURATION: Sea Kayak 90 min, Sunset Paddle 2 hours.\nAGES: 6+ welcome. Kids must be accompanied by an adult.\nPARKING & FACILITIES: Free street parking nearby. We have lockers for valuables and changing rooms close by. \n\nSAFETY: Experienced guides, life jackets provided and mandatory, stable sit-inside double kayaks. No experience needed. Beginners very welcome. 30+ years operating safely. Will I get wet? Yes, but the likelihood of capsizing is very low.\n\nCAMERA/PHONE: If you have a phone pouch then yes! We also take photos during the trip and send them to you afterwards.\nDOGS: If the doggie is used to water, we do make exceptions. Otherwise dogs aren't always allowed. Send us a message.\nWEIGHT/FITNESS: Weight restriction of 95kg per person. No special fitness needed.\nPREGNANT: Up to you, but as they are sit-inside kayaks, we can't be certain you'll fit comfortably if heavily pregnant. Chat to your doctor.\nGLASSES: Definitely, we recommend bringing sunnies \u2014 the glare can be strong.\nFOOD/DRINKS: We don't provide food. Water bottles for sale at R25 each.\n\nCANCELLATION: More than 24hrs = 95% refund. Less than 24hrs = no refund. Weather cancellation by us = full refund or free reschedule.\nPAYMENT: VISA and Mastercard accepted. For cash, we ask at least 50% deposit online.\nINTERNATIONAL CARDS: VISA and Mastercard are supported.\nGROUP DISCOUNT: 6+ people get 5% off.\nSPLIT PAYMENT: Yes we can split payment into multiple links.\n\nSUPPORT HOURS: Live chat via this bot 24/7. Human responses 9AM-5PM.\n\nWEATHER: We check conditions every morning. If swell above 2.6m, heavy fog, or wind above 25km/h SE or 20km/h other directions, we may postpone. We notify 1 hour before launch. Keep your phone nearby." }] }, contents: c, generationConfig: { temperature: 0.7, maxOutputTokens: 150 } }) });
    var d = await r.json();
    if (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0]) return d.candidates[0].content.parts[0].text;
    return null;
  } catch (e) { return null; }
}
async function getSlots(tourId, now) {
  var in30 = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  var { data } = await db.from("slots").select("id,start_time,capacity_total,booked,held").eq("tour_id", tourId).eq("status", "OPEN").gt("start_time", now.toISOString()).lt("start_time", in30.toISOString()).order("start_time", { ascending: true });
  return (data || []).filter(function (s) { return s.capacity_total - s.booked - (s.held || 0) > 0; });
}
async function canAcceptPaidBooking(businessId) {
  if (!businessId) return { allowed: true, reason: "NO_BUSINESS" };
  var cap = await db.rpc("ck_can_accept_paid_booking", { p_business_id: businessId });
  var row = Array.isArray(cap.data) ? cap.data[0] : null;
  if (cap.error) return { allowed: true, reason: "CAP_CHECK_FAILED" };
  return row || { allowed: true, reason: "UNKNOWN" };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: gCors(req) });
  try {
    var body = await req.json(); var hist = body.messages || []; var msg = body.message || ""; var state = body.state || { step: "IDLE" };
    var now = new Date(); var ns = { ...state }; var pay = null; var reply = ""; var buttons = null; var calendar = null;
    var { data: allT } = await db.from("tours").select("*").eq("active", true).order("base_price_per_person");
    var tours = (allT || []).filter(function (t) { return !t.name.includes("Private") && !t.hidden; });
    var lo = msg.toLowerCase().trim(); var step = state.step || "IDLE";
    var isBtnClick = lo.startsWith("btn:"); var btnVal = isBtnClick ? lo.replace("btn:", "") : "";
    // ===== IDLE =====
    // Handle button clicks in IDLE state (e.g., "btn:book", "btn:question")
    if (step === "IDLE" && isBtnClick) {
      if (btnVal === "book" || btnVal === "btn:book") {
        ns = { step: "PICK_TOUR" };
        reply = pick(["Which tour are you keen on?", "Let's get you on the water! Which tour?"]);
        buttons = tours.map(function (t4) { return { label: t4.name + " \u2014 R" + t4.base_price_per_person, value: t4.id }; });
        return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
      }
      if (btnVal === "question" || btnVal === "btn:question") {
        reply = "Sure, what would you like to know? \u{1F60A}";
        return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
      }
    }
    if (step === "IDLE" && !isBtnClick) {
      // Detect booking management intents first
      var wReschedule = lo.includes("reschedule") || (lo.includes("change") && (lo.includes("date") || lo.includes("day") || lo.includes("time"))) || (lo.includes("wrong") && (lo.includes("date") || lo.includes("day"))) || (lo.includes("move") && lo.includes("booking"));
      var wCancel = (lo.includes("cancel") && !lo.includes("cancellation") && !lo.includes("policy")) || (lo.includes("refund") && lo.includes("my"));
      var wMyBooking = lo.includes("my booking") || lo.includes("my trip") || lo.includes("booking status") || (lo.includes("when") && lo.includes("my")) || (lo.includes("check") && lo.includes("booking"));
      var wLook = wReschedule || wCancel || wMyBooking || lo.includes("look up");
      var wBook = !wLook && (lo.includes("book") || lo.includes("reserve") || lo.includes("interested") || lo.includes("i want") && lo.includes("tour") || lo.includes("id like") && lo.includes("tour") || lo.includes("sign up"));
      var wAvail = !wLook && !wBook && (lo.includes("available") || lo.includes("space") || lo.includes("tomorrow") && lo.includes("free") || lo.includes("weekend") && lo.includes("free"));
      var wGift = lo.includes("gift") || lo.includes("voucher") && (lo.includes("buy") || lo.includes("purchase") || lo.includes("get"));
      if (wGift) { ns = { step: "GIFT_PICK_TOUR" }; reply = "Awesome, gift vouchers make great presents! 🎁 Which tour should the voucher be for?"; buttons = tours.map(function (t9) { return { label: t9.name + " \u2014 R" + t9.base_price_per_person, value: t9.id }; }); return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) }); }
      if (wLook) {
        if (wReschedule) ns = { step: "LOOKUP", intent: "reschedule" };
        else if (wCancel) ns = { step: "LOOKUP", intent: "cancel" };
        else ns = { step: "LOOKUP", intent: "view" };
        reply = wReschedule ? "Sure, let me help you reschedule! What email did you use when you booked?" : wCancel ? "I can help with that. What email is the booking under?" : "What email did you use when you booked?";
        return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
      }
      if (wBook || wAvail) {
        var mt = null; for (var t of tours) { if ((lo.includes("sea") || lo.includes("morning") || (lo.includes("paddle") && !lo.includes("sunset")) || lo.includes("normal") || lo.includes("regular") || (lo.includes("kayak") && !lo.includes("sunset"))) && t.name.includes("Sea")) mt = t; if ((lo.includes("sunset") || lo.includes("evening") || lo.includes("wine")) && t.name.includes("Sunset")) mt = t; }
        if (mt) {
          ns = { step: "PICK_DATE", tid: mt.id, tname: mt.name, tprice: mt.base_price_per_person, bid: mt.business_id };
          var slots = await getSlots(mt.id, now);
          if (slots.length > 0) {
            var dates = {}; for (var s of slots) { var dk = dateKey(s.start_time); if (!dates[dk]) dates[dk] = { date: dk, label: fmtDate(s.start_time), slots: [] }; dates[dk].slots.push({ id: s.id, time: s.start_time, avail: s.capacity_total - s.booked - (s.held || 0) }); }
            calendar = Object.values(dates);
            reply = pick(["Pick a date for the " + mt.name + " 📅", "When works for you? Here are the available dates for " + mt.name + ":"]);
          } else { reply = "No " + mt.name + " slots in the next month 😔 Want to try the other tour?"; buttons = tours.filter(function (t2) { return t2.id !== mt.id; }).map(function (t3) { return { label: t3.name + " — R" + t3.base_price_per_person, value: t3.id }; }); ns.step = "PICK_TOUR"; }
        } else {
          ns = { step: "PICK_TOUR" };
          reply = pick(["Which tour are you keen on?", "Let's get you on the water! Which tour?"]);
          buttons = tours.map(function (t4) { return { label: t4.name + " — R" + t4.base_price_per_person, value: t4.id }; });
        }
      }
      else { var gem = await gemChat(hist, msg); reply = gem || "Hey! Want to book a paddle or got a question?"; }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons, calendar: calendar }), { status: 200, headers: gCors(req) });
    }
    // ===== PICK_TOUR =====
    if (step === "PICK_TOUR") {
      var picked = null;
      if (isBtnClick) picked = tours.find(function (t) { return t.id === btnVal; });
      else { for (var t5 of tours) { if ((lo.includes("sea") || lo.includes("morning") || (lo.includes("paddle") && !lo.includes("sunset")) || lo.includes("kayak") && !lo.includes("sunset")) && t5.name.includes("Sea")) picked = t5; if ((lo.includes("sunset") || lo.includes("evening") || lo.includes("wine")) && t5.name.includes("Sunset")) picked = t5; if (lo.includes(t5.name.toLowerCase())) picked = t5; } }
      if (picked) {
        ns = { step: "PICK_DATE", tid: picked.id, tname: picked.name, tprice: picked.base_price_per_person, bid: picked.business_id };
        var slots2 = await getSlots(picked.id, now);
        if (slots2.length > 0) {
          var dates2 = {}; for (var s2 of slots2) { var dk2 = dateKey(s2.start_time); if (!dates2[dk2]) dates2[dk2] = { date: dk2, label: fmtDate(s2.start_time), slots: [] }; dates2[dk2].slots.push({ id: s2.id, time: s2.start_time, avail: s2.capacity_total - s2.booked - (s2.held || 0) }); }
          calendar = Object.values(dates2);
          reply = pick(["Great choice! Pick a date:", "" + picked.name + " it is! When works for you?"]);
        } else { reply = "Nothing open for " + picked.name + ". Try the other tour?"; ns.step = "PICK_TOUR"; buttons = tours.filter(function (t6) { return t6.id !== picked.id; }).map(function (t7) { return { label: t7.name, value: t7.id }; }); }
      } else { reply = "Sea Kayak or Sunset Paddle?"; buttons = tours.map(function (t8) { return { label: t8.name + " — R" + t8.base_price_per_person, value: t8.id }; }); }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons, calendar: calendar }), { status: 200, headers: gCors(req) });
    }
    // ===== PICK_DATE =====
    if (step === "PICK_DATE") {
      var pdSelectedDate = "";
      if (isBtnClick && btnVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
        pdSelectedDate = btnVal;
      } else if (!isBtnClick && lo) {
        // Try to parse natural language date using Gemini
        if (GK) {
          try {
            var pdR = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GK, {
              method: "POST", headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(5000),
              body: JSON.stringify({
                system_instruction: { parts: [{ text: "You are a date extractor. The user is asking for a date. Today is " + now.toISOString().split("T")[0] + ". Return exactly one YYYY-MM-DD date string based on their input, or \"INVALID\" if no date is found. Examples: \"Tomorrow\" -> next date. \"1 September\" -> 2026-09-01." }] },
                contents: [{ role: "user", parts: [{ text: msg }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 15 }
              })
            });
            var pdD = await pdR.json();
            if (pdD.candidates?.[0]?.content?.parts?.[0]) {
              var pdExt = pdD.candidates[0].content.parts[0].text.trim();
              if (pdExt !== "INVALID" && pdExt.match(/^\d{4}-\d{2}-\d{2}$/)) pdSelectedDate = pdExt;
            }
          } catch (e) { }
        }
      }

      if (pdSelectedDate) {
        // Date selected — show time slots for this date
        var slots3 = await getSlots(ns.tid, now);
        var daySlots = slots3.filter(function (s3) { return dateKey(s3.start_time) === pdSelectedDate; });
        if (daySlots.length > 0) {
          ns = { ...ns, step: "PICK_TIME", selectedDate: pdSelectedDate };
          reply = "Times for " + fmtDate(daySlots[0].start_time) + ":";
          buttons = daySlots.map(function (s4) { var av = s4.capacity_total - s4.booked - (s4.held || 0); return { label: fmtTime(s4.start_time) + " (" + av + " spots)", value: s4.id }; });
        } else {
          // No slots for that specific day — re-show calendar
          reply = "No available times on " + fmtDate(pdSelectedDate + "T12:00:00+02:00") + ". Pick another date:";
          var slots4 = await getSlots(ns.tid, now);
          if (slots4.length > 0) {
            var dates3 = {}; for (var s5 of slots4) { var dk3 = dateKey(s5.start_time); if (!dates3[dk3]) dates3[dk3] = { date: dk3, label: fmtDate(s5.start_time), slots: [] }; dates3[dk3].slots.push({ id: s5.id, time: s5.start_time, avail: s5.capacity_total - s5.booked - (s5.held || 0) }); }
            calendar = Object.values(dates3);
          }
        }
      } else {
        // No date parsed — re-show calendar with helpful message
        reply = "Just click on an available date from the calendar \u{1F4C5}";
        var slots4b = await getSlots(ns.tid, now);
        if (slots4b.length > 0) {
          var dates3b = {}; for (var s5b of slots4b) { var dk3b = dateKey(s5b.start_time); if (!dates3b[dk3b]) dates3b[dk3b] = { date: dk3b, label: fmtDate(s5b.start_time), slots: [] }; dates3b[dk3b].slots.push({ id: s5b.id, time: s5b.start_time, avail: s5b.capacity_total - s5b.booked - (s5b.held || 0) }); }
          calendar = Object.values(dates3b);
        } else { reply = "No slots available right now. Try the other tour?"; buttons = tours.filter(function (t6b) { return t6b.id !== ns.tid; }).map(function (t7b) { return { label: t7b.name, value: t7b.id }; }); ns.step = "PICK_TOUR"; }
      }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons, calendar: calendar }), { status: 200, headers: gCors(req) });
    }
    // ===== PICK_TIME =====
    if (step === "PICK_TIME") {
      var slotId = null; var slotTime = null;
      if (isBtnClick) { var { data: sl } = await db.from("slots").select("id,start_time").eq("id", btnVal).single(); if (sl) { slotId = sl.id; slotTime = sl.start_time; } }
      if (slotId && slotTime) {
        ns = { ...ns, step: "ASK_QTY", slotId: slotId, slotTime: slotTime };
        reply = pick([fmt(slotTime) + " — great pick! How many people?", fmt(slotTime) + " it is! 🙌 How many of you are coming?"]);
      } else {
        var slots5 = await getSlots(ns.tid, now);
        var daySlots2 = slots5.filter(function (s6) { return dateKey(s6.start_time) === ns.selectedDate; });
        reply = "Pick a time:";
        buttons = daySlots2.map(function (s7) { var av2 = s7.capacity_total - s7.booked - (s7.held || 0); return { label: fmtTime(s7.start_time) + " (" + av2 + " spots)", value: s7.id }; });
      }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
    }
    // ===== ASK_QTY =====
    if (step === "ASK_QTY") {
      var n = parseInt(lo.replace(/[^0-9]/g, ""));
      if (n > 0 && n <= 30) {
        var { data: sc } = await db.from("slots").select("capacity_total,booked,held").eq("id", ns.slotId).single();
        var mx = sc ? sc.capacity_total - sc.booked - (sc.held || 0) : 10;
        if (n > mx) { reply = "Only " + mx + " spots left — would " + mx + " work?"; }
        else {
          var tot = n * ns.tprice; var disc = 0; if (n >= 6) { disc = Math.round(tot * 0.05); tot = tot - disc; } ns = { ...ns, step: "ASK_DETAILS", qty: n, total: tot, baseTotal: n * ns.tprice, discount: disc };
          if (disc > 0) reply = n + " people — nice group! You get 5% off (R" + disc + " saved). Total: R" + tot + ".\n\nTo lock this in, please send your:\n- Full Name\n- Email Address\n- Cell Number\n\n*(You can just send them all in one message!)*";
          else reply = pick([n + " people, awesome!\n\nTo lock this in, please send your:\n- Full Name\n- Email Address\n- Cell Number\n\n*(You can just send them all in one message!)*"]);
        }
      } else { reply = "How many people will be joining?"; }
      return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }
    // ===== ASK_NAME =====
    if (step === "ASK_DETAILS") {
      var dParts = msg.split(/[,;\n]+/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
      var dName = ""; var dEmail = ""; var dPhone = "";
      for (var dp of dParts) { var dc = dp.replace(/^(name|email|phone|tel|mobile|cell|number)[:\-\s]*/i, "").trim(); if (!dc) continue; if (dc.includes("@") && dc.includes(".") && !dEmail) { dEmail = dc.toLowerCase(); } else if (dc.replace(/[\s\-\+\(\)]/g, "").match(/^\d{7,15}$/) && !dPhone) { dPhone = dc.replace(/[\s\-\(\)]/g, ""); } else if (dc.match(/[a-zA-Z]/) && !dName) { dName = dc; } }
      if (!dName || !dEmail || !dPhone) {
        var dMiss = []; if (!dName) dMiss.push("full name"); if (!dEmail) dMiss.push("email address"); if (!dPhone) dMiss.push("phone number");
        reply = "I still need your " + dMiss.join(", ") + ".\n\nPlease send all three together, e.g.:\n*John Smith, john@email.com, 082 123 4567*";
        return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
      }
      ns = { ...ns, step: "ASK_VOUCHER", name: dName, email: dEmail, phone: dPhone };
      reply = "Thanks " + dName.split(" ")[0] + "! \u{1F44D} Do you have a voucher or promo code?"; buttons = [{ label: "No voucher \u2014 continue", value: "no_voucher" }, { label: "Yes, I have a code", value: "has_voucher" }];
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
    }
    if (step === "ASK_VOUCHER") {
      if (btnVal === "no_voucher" || lo.includes("no") || lo.includes("skip") || lo.includes("nah") || lo.includes("none")) {
        ns = { ...ns, step: "CONFIRM", vded: 0 };
        reply = "Here's your booking summary:\n\n🛶 " + ns.tname + "\n📅 " + fmt(ns.slotTime) + "\n👥 " + ns.qty + " people\n💰 R" + ns.total + "\n\nLook good?";
        buttons = [{ label: "✅ Confirm" + (ns.total > 0 ? " & Pay R" + ns.total : " (FREE)"), value: "confirm" }, { label: "❌ Cancel", value: "cancel_booking" }];
      } else if (btnVal === "has_voucher") { ns.step = "ENTER_VOUCHER"; reply = "Type your 8-character voucher code:"; }
      else {
        var vc = msg.toUpperCase().replace(/\s/g, "");
        if (vc.length === 8) {
          var { data: vd } = await db.from("vouchers").select("*").eq("code", vc).single();
          if (vd && vd.status === "ACTIVE") { var vv = Number(vd.value || vd.purchase_amount || 0); var dd = Math.min(vv, ns.total); var nt = Math.max(0, ns.total - dd); ns = { ...ns, step: "CONFIRM", vcode: vc, vid: vd.id, vded: dd, total: nt }; reply = "🎉 Voucher applied! R" + dd + " off." + (nt > 0 ? " New total: R" + nt : " It's completely FREE!") + "\n\n🛶 " + ns.tname + "\n📅 " + fmt(ns.slotTime) + "\n👥 " + ns.qty + " people\n💰 " + (nt > 0 ? "R" + nt : "FREE"); buttons = [{ label: "✅ Confirm" + (nt > 0 ? " & Pay R" + nt : " (FREE)"), value: "confirm" }, { label: "❌ Cancel", value: "cancel_booking" }]; }
          else if (vd && vd.status === "REDEEMED") { reply = "That voucher's already been used. Got another?"; buttons = [{ label: "No voucher — continue", value: "no_voucher" }]; }
          else { reply = "Can't find that code — double-check it?"; buttons = [{ label: "No voucher — continue", value: "no_voucher" }]; }
        } else { reply = "Voucher codes are 8 characters. Try again?"; buttons = [{ label: "No voucher — continue", value: "no_voucher" }]; }
      }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
    }
    // ===== ENTER_VOUCHER =====
    if (step === "ENTER_VOUCHER") {
      var noVc = lo.includes("no") || lo.includes("don") || lo.includes("skip") || lo.includes("continue") || lo.includes("dont") || lo.includes("nope") || lo.includes("none") || lo.includes("back") || lo.includes("without") || btnVal === "no_voucher";
      if (noVc) { ns = { ...ns, step: "CONFIRM" }; reply = "No problem! Here's your booking summary:\n\n" + ns.tname + "\n" + ns.qty + " people \u2022 R" + ns.total + "\n\nReady to confirm?"; buttons = [{ label: "\u2705 Confirm & Pay R" + ns.total, value: "confirm" }, { label: "\u274C Cancel", value: "cancel_booking" }]; return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) }); }
      var vc2 = msg.toUpperCase().replace(/\s/g, "");
      if (vc2.length === 8) {
        var { data: vd2 } = await db.from("vouchers").select("*").eq("code", vc2).single();
        if (vd2 && vd2.status === "ACTIVE") { var vv2 = Number(vd2.value || vd2.purchase_amount || 0); var dd2 = Math.min(vv2, ns.total); var nt2 = Math.max(0, ns.total - dd2); ns = { ...ns, step: "CONFIRM", vcode: vc2, vid: vd2.id, vded: dd2, total: nt2 }; reply = "🎉 R" + dd2 + " off!" + (nt2 > 0 ? " Total now R" + nt2 : " FREE!") + "\n\nReady to confirm?"; buttons = [{ label: "✅ Confirm" + (nt2 > 0 ? " & Pay R" + nt2 : " (FREE)"), value: "confirm" }, { label: "❌ Cancel", value: "cancel_booking" }]; }
        else if (vd2 && vd2.status === "REDEEMED") { reply = "Already used. Got another?"; buttons = [{ label: "No voucher — continue", value: "no_voucher" }]; }
        else { reply = "Code not found. Check and try again?"; buttons = [{ label: "No voucher — continue", value: "no_voucher" }]; }
      } else { reply = "That doesn't look like a voucher code. Want to continue without one?"; buttons = [{ label: "No voucher \u2014 continue", value: "no_voucher" }, { label: "Try again", value: "btn:yes_voucher" }]; }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
    }
    // ===== CONFIRM =====
    if (step === "CONFIRM") {
      if (lo.includes("start over") || lo.includes("restart") || (lo.includes("back") && lo.includes("start"))) { ns = { step: "IDLE" }; reply = "No problem! What would you like to do?"; buttons = [{ label: "\u{1F6F6} Book a Tour", value: "btn:book" }, { label: "\u2753 Ask a Question", value: "btn:question" }]; return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) }); }

      if (btnVal === "confirm" || lo.includes("yes") || lo.includes("confirm") || lo.includes("go ahead") || lo.includes("sure") || lo.includes("yep")) {
        var ft = ns.total || 0;
        var businessId = ns.bid || tours[0]?.business_id;
        if (ft > 0) {
          var cap = await canAcceptPaidBooking(businessId);
          if (cap.allowed === false) {
            reply = "We’ve reached this month’s paid booking limit on our current plan. Please try again shortly while our team adds a top-up or upgrades the plan.";
            ns = { step: "IDLE" };
            return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
          }
        }
        var { data: bk } = await db.from("bookings").insert({ business_id: businessId, tour_id: ns.tid, slot_id: ns.slotId, customer_name: ns.name, phone: ns.phone || "", email: ns.email, qty: ns.qty, unit_price: ns.tprice, total_amount: ft, original_total: ns.baseTotal, status: "PENDING", source: "WEB_CHAT" }).select().single();
        if (!bk) { reply = "Something went wrong — try the Book Now page?"; ns = { step: "IDLE" }; }
        else if (ft <= 0) {
          await db.from("bookings").update({ status: "PAID", yoco_payment_id: "VOUCHER_CHAT" }).eq("id", bk.id);
          if (ns.vid) await db.from("vouchers").update({ status: "REDEEMED", redeemed_at: now.toISOString(), redeemed_booking_id: bk.id }).eq("id", ns.vid);
          var { data: su } = await db.from("slots").select("booked").eq("id", ns.slotId).single();
          if (su) await db.from("slots").update({ booked: su.booked + ns.qty }).eq("id", ns.slotId);
          // Send booking confirmation email for voucher bookings
          var vRef = bk.id.substring(0, 8).toUpperCase();
          try { await fetch(SU + "/functions/v1/send-email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK }, body: JSON.stringify({ type: "BOOKING_CONFIRM", data: { email: ns.email, customer_name: ns.name, ref: vRef, tour_name: ns.tname, start_time: fmtS(ns.slotTime), qty: ns.qty, total_amount: "FREE (voucher)" } }) }); } catch (e) { console.log("webchat voucher confirm email err"); }
          // Send WhatsApp confirmation if phone provided
          if (ns.phone) { try { await fetch(SU + "/functions/v1/send-whatsapp-text", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK }, body: JSON.stringify({ to: ns.phone, message: "\u{1F389} *Booking Confirmed!*\n\n\u{1F4CB} Ref: " + vRef + "\n\u{1F6F6} " + ns.tname + "\n\u{1F4C5} " + fmtS(ns.slotTime) + "\n\u{1F465} " + ns.qty + " people\n\u{1F39F} Paid with voucher\n\n\u{1F4CD} *Meeting Point:*\nCape Kayak Adventures\n180 Beach Rd, Three Anchor Bay\nCape Town, 8005\nArrive 15 min early\n\n\u{1F5FA} https://www.google.com/maps/search/?api=1&query=Cape+Kayak+Adventures%2C+180+Beach+Rd%2C+Three+Anchor+Bay%2C+Cape+Town%2C+8005\n\n\u{1F392} *Bring:* Sunscreen, hat, towel, water bottle\n\nSee you on the water! \u{1F30A}" }) }); } catch (e) { console.log("webchat voucher wa err"); } }
          reply = "🎉 You're booked!\n\nRef: " + vRef + "\nConfirmation email on its way.\n\nMeet us at 180 Beach Rd, Three Anchor Bay — 15 min early. See you on the water! 🛶"; ns = { step: "IDLE" };
        } else {
          await db.from("holds").insert({ booking_id: bk.id, slot_id: ns.slotId, expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(), status: "ACTIVE" });
          var { data: sh } = await db.from("slots").select("held").eq("id", ns.slotId).single();
          if (sh) await db.from("slots").update({ held: (sh.held || 0) + ns.qty }).eq("id", ns.slotId);
          await db.from("bookings").update({ status: "HELD" }).eq("id", bk.id);
          var yr = await fetch("https://payments.yoco.com/api/checkouts", { method: "POST", headers: { Authorization: "Bearer " + YK, "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(ft * 100), currency: "ZAR", successUrl: "https://book.capekayak.co.za/success?ref=" + bk.id, cancelUrl: "https://book.capekayak.co.za/cancelled", failureUrl: "https://book.capekayak.co.za/cancelled", metadata: { booking_id: bk.id, type: "BOOKING", source: "WEB_CHAT" } }) });
          var yd = await yr.json();
          if (yd && yd.redirectUrl) { await db.from("bookings").update({ yoco_checkout_id: yd.id }).eq("id", bk.id); pay = yd.redirectUrl; reply = "🙌 Spots held for 15 minutes!\n\nRef: " + bk.id.substring(0, 8).toUpperCase() + "\nClick below to complete payment."; }
          else { reply = "Payment link didn't work — try the Book Now page?"; }
          ns = { step: "IDLE" };
        }
      } else if (btnVal === "cancel_booking" || lo.includes("cancel") || lo.includes("nevermind")) {
        reply = pick(["No worries! Let me know if you need anything else 😊", "All good! Hit me up if you change your mind."]); ns = { step: "IDLE" };
      } else {
        reply = "Ready to go ahead?";
        buttons = [{ label: "✅ Confirm" + (ns.total > 0 ? " & Pay R" + ns.total : " (FREE)"), value: "confirm" }, { label: "❌ Cancel", value: "cancel_booking" }];
      }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons, paymentUrl: pay }), { status: 200, headers: gCors(req) });
    }
    // ===== LOOKUP =====
    if (step === "LOOKUP") {
      var em2 = lo.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      if (em2) {
        var { data: bks } = await db.from("bookings").select("id,customer_name,qty,total_amount,status,slots(start_time),tours(name)").eq("email", em2[0]).order("created_at", { ascending: false }).limit(5);
        if (bks && bks.length > 0) { reply = "Found your bookings:\n\n"; for (var b of bks) reply += (b.tours?.name || "Tour") + " — " + (b.slots?.start_time ? fmtS(b.slots.start_time) : "?") + "\n" + b.qty + " people — " + b.status + "\nRef: " + b.id.substring(0, 8).toUpperCase() + "\n\n"; reply += "For changes, head to My Bookings on the website."; }
        else { reply = "No bookings under that email. Try a different one?"; }
        ns = { step: "IDLE" };
      } else { reply = "What email did you use when you booked?"; }
      return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }
    // ===== RESCHEDULE DATE PICK =====
    if (step === "RESCH_DATE") {
      var rsId = btnVal || "";
      if (!rsId) { reply = "Please pick a date from the calendar above."; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }
      var { data: rsSlot } = await db.from("slots").select("id,start_time,booked").eq("id", rsId).single();
      if (!rsSlot) { reply = "Couldn\u2019t find that slot. Try again."; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }

      var { data: rbData, error: rbErr } = await db.functions.invoke("rebook-booking", {
        body: { booking_id: ns.booking_id, new_slot_id: rsId, excess_action: "VOUCHER" }
      });
      if (rbErr || rbData?.error) { reply = "Something went wrong changing your booking. Contact our team."; ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }

      reply = "\u2705 Rescheduled to " + fmt(rsSlot.start_time) + "!\n\nSee you on the water! \u{1F30A}";
      if (rbData?.diff > 0) {
        reply = "\u2705 Timeslot updated!\n\nAs this was more expensive, you have a balance of R" + rbData.diff + ". Please pay using the link below:";
        pay = rbData.payment_url;
      }
      ns = { step: "IDLE" }; buttons = [{ label: "\u{1F6F6} Book Another", value: "btn:book" }];
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons, paymentUrl: pay }), { status: 200, headers: gCors(req) });
    }

    // ===== CONFIRM CANCEL =====
    if (step === "CONFIRM_CANCEL") {
      if (btnVal === "confirm_cancel" || lo.includes("yes") || lo.includes("cancel")) {
        await db.from("bookings").update({ status: "CANCELLED", cancellation_reason: "Customer request via web chat", cancelled_at: new Date().toISOString(), refund_status: ns.hours >= 24 ? "REQUESTED" : "NONE", refund_amount: ns.refund || 0 }).eq("id", ns.booking_id);
        var { data: cSl } = await db.from("slots").select("booked").eq("id", ns.slot_id).single();
        if (cSl) await db.from("slots").update({ booked: Math.max(0, cSl.booked - ns.qty) }).eq("id", ns.slot_id);
        reply = ns.hours >= 24 ? "Booking cancelled. Your refund of R" + ns.refund + " has been submitted \u2014 expect it in 5-7 business days." : "Booking cancelled. As this was within 24 hours, no refund applies.";
        reply += "\n\nWe\u2019d love to have you back! Type *book* anytime \u{1F30A}";
      } else { reply = "No problem, your booking is safe! \u{1F44D}"; }
      ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }

    // ===== MODIFY QTY =====
    if (step === "MODIFY_QTY") {
      var newQ = parseInt(msg);
      if (isNaN(newQ) || newQ < 1 || newQ > 30) { reply = "Please enter a number between 1 and 30."; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }
      if (newQ === ns.current_qty) { reply = "That\u2019s the same! No changes needed \u{1F60A}"; ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }
      if (newQ > ns.max_avail) { reply = "Only " + ns.max_avail + " spots available. Try a smaller number."; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }
      var qDiff = newQ - ns.current_qty; var newTot = newQ * Number(ns.unit_price); var diffAmt = Math.abs(newTot - ns.current_qty * Number(ns.unit_price));
      await db.from("bookings").update({ qty: newQ, total_amount: newTot }).eq("id", ns.booking_id);
      var { data: mqSl } = await db.from("slots").select("booked").eq("id", ns.slot_id).single();
      if (mqSl) await db.from("slots").update({ booked: Math.max(0, mqSl.booked + qDiff) }).eq("id", ns.slot_id);
      if (qDiff > 0) {
        try {
          var addPay = await fetch("https://payments.yoco.com/api/checkouts", { method: "POST", headers: { Authorization: "Bearer " + YK, "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(diffAmt * 100), currency: "ZAR", successUrl: "https://book.capekayak.co.za/success?ref=" + ns.booking_id, cancelUrl: "https://book.capekayak.co.za/cancelled", metadata: { booking_id: ns.booking_id, type: "ADD_PEOPLE" } }) });
          var addD = await addPay.json();
          if (addD?.redirectUrl) { pay = addD.redirectUrl; reply = "Updated to " + newQ + " people! Pay the extra R" + diffAmt + " to confirm:"; }
          else { reply = "Updated to " + newQ + " people! Contact us to arrange the extra R" + diffAmt + "."; }
        } catch (e) { reply = "Updated but payment link failed."; }
      } else {
        if (ns.hours_before >= 24) { await db.from("bookings").update({ refund_status: "REQUESTED", refund_amount: diffAmt }).eq("id", ns.booking_id); reply = "Updated to " + newQ + " people! Refund of R" + diffAmt + " submitted \u2014 5-7 business days."; }
        else { reply = "Updated to " + newQ + " people! Refund policy applies for the difference."; }
      }
      ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns, paymentUrl: pay }), { status: 200, headers: gCors(req) });
    }

    // ===== CHANGE TOUR =====
    if (step === "CHANGE_TOUR") {
      var ctId = btnVal ? btnVal.replace("chtour_", "") : "";
      var ctTour = tours.find(function (t: any) { return t.id === ctId; });
      if (!ctTour) { reply = "Please pick a tour."; return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) }); }
      var ctSlots = await getSlots(ctId, now); var ctFit = ctSlots.filter(function (s: any) { return s.capacity_total - s.booked - (s.held || 0) >= ns.qty; });
      if (ctFit.length === 0) { reply = "No available slots for " + ctTour.name + ". Contact our team."; ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }
      reply = "Switching to *" + ctTour.name + "* (R" + ctTour.base_price_per_person + "/pp). Pick a date:";
      calendar = { slots: ctFit.map(function (s: any) { return { id: s.id, start_time: s.start_time, spots: s.capacity_total - s.booked - (s.held || 0) }; }) };
      ns = { step: "CHANGE_TOUR_SLOT", booking_id: ns.booking_id, slot_id: ns.slot_id, tour_id: ns.tour_id, qty: ns.qty, new_tour_id: ctId, new_tour_name: ctTour.name, new_price: ctTour.base_price_per_person };
      return new Response(JSON.stringify({ reply: reply, state: ns, calendar: calendar }), { status: 200, headers: gCors(req) });
    }

    // ===== CHANGE TOUR SLOT =====
    if (step === "CHANGE_TOUR_SLOT") {
      var ctsId = btnVal || "";
      var { data: ctsSl } = await db.from("slots").select("id,start_time,booked").eq("id", ctsId).single();
      if (!ctsSl) { reply = "Please pick a slot."; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }

      var { data: rbData2, error: rbErr2 } = await db.functions.invoke("rebook-booking", {
        body: { booking_id: ns.booking_id, new_slot_id: ctsId, excess_action: "VOUCHER" }
      });
      if (rbErr2 || rbData2?.error) { reply = "Something went wrong changing your tour. Contact our team."; ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }

      reply = "\u2705 Switched to *" + ns.new_tour_name + "* on " + fmt(ctsSl.start_time) + "!\n\nSee you on the water! \u{1F30A}";
      if (rbData2?.diff > 0) {
        reply = "\u2705 Tour switched!\n\nAs this tour is more expensive, you have a balance of R" + rbData2.diff + ". Please pay using the link below:";
        pay = rbData2.payment_url;
      }
      ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns, paymentUrl: pay }), { status: 200, headers: gCors(req) });
    }

    // ===== UPDATE NAME =====
    if (step === "UPDATE_NAME") {
      if (msg.trim().length < 2) { reply = "Please enter the new name:"; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) }); }
      await db.from("bookings").update({ customer_name: msg.trim() }).eq("id", ns.booking_id);
      reply = "Updated! Booking is now under *" + msg.trim() + "* \u2705";
      ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }

    // ===== RESEND CONFIRM =====
    if (step === "RESEND_CONFIRM") {
      if (btnVal === "resend_email" || lo.includes("yes") || lo.includes("resend")) {
        try {
          await fetch(SU + "/functions/v1/send-email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK }, body: JSON.stringify({ type: "BOOKING_CONFIRM", data: { email: ns.email, customer_name: ns.customer_name, ref: ns.booking_id.substring(0, 8).toUpperCase() } }) });
          reply = "Sent! Check your inbox and spam folder \u2709\uFE0F";
        } catch (e) { reply = "Something went wrong. Please try again."; }
      } else { reply = "No problem!"; }
      ns = { step: "IDLE" }; return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }

    // ===== GIFT VOUCHER FLOW =====
    if (step === "GIFT_PICK_TOUR") {
      var gPicked = null;
      if (isBtnClick) gPicked = tours.find(function (t) { return t.id === btnVal; });
      else { for (var gt of tours) { if ((lo.includes("sea") || lo.includes("morning") || lo.includes("kayak")) && gt.name.includes("Sea")) gPicked = gt; if ((lo.includes("sunset") || lo.includes("evening")) && gt.name.includes("Sunset")) gPicked = gt; } }
      if (gPicked) { ns = { step: "GIFT_RECIPIENT", gtid: gPicked.id, gtname: gPicked.name, gtprice: gPicked.base_price_per_person, gbid: gPicked.business_id }; reply = "" + gPicked.name + " voucher (R" + gPicked.base_price_per_person + ") \u2014 great choice! Who is it for? (Their name)"; }
      else { reply = "Which tour? Sea Kayak or Sunset Paddle?"; buttons = tours.map(function (gt2) { return { label: gt2.name + " \u2014 R" + gt2.base_price_per_person, value: gt2.id }; }); }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
    }
    if (step === "GIFT_RECIPIENT") {
      if (msg.trim().length >= 2) { ns = { ...ns, step: "GIFT_MESSAGE", grecipient: msg.trim() }; reply = "Nice! Want to add a personal message? Or say skip."; }
      else { reply = "What\u2019s the recipient\u2019s name?"; }
      return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }
    if (step === "GIFT_MESSAGE") {
      var gmsg = lo.includes("skip") || lo.includes("no") ? "" : msg.trim();
      ns = { ...ns, step: "GIFT_BUYER_NAME", gmessage: gmsg };
      reply = "And your name? (The person buying the voucher)";
      return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }
    if (step === "GIFT_BUYER_NAME") {
      if (msg.trim().length >= 2) { ns = { ...ns, step: "GIFT_BUYER_EMAIL", gbuyername: msg.trim() }; reply = "Your email? We\u2019ll send the voucher there."; }
      else { reply = "What\u2019s your name?"; }
      return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
    }
    if (step === "GIFT_BUYER_EMAIL") {
      var gem = lo.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      if (gem) {
        ns = { ...ns, step: "GIFT_CONFIRM", gbuyeremail: gem[0] };
        reply = "Here\u2019s the voucher summary:\n\n\ud83c\udf81 " + ns.gtname + " Voucher\n\ud83d\udc64 For: " + ns.grecipient + "\n" + (ns.gmessage ? "\ud83d\udcac \"" + ns.gmessage + "\"\n" : "") + "\ud83d\udcb0 R" + ns.gtprice + "\n\nReady to purchase?";
        buttons = [{ label: "\u2705 Purchase R" + ns.gtprice, value: "gift_confirm" }, { label: "\u274c Cancel", value: "cancel_booking" }];
      } else { reply = "That doesn\u2019t look right \u2014 try your email again?"; }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons }), { status: 200, headers: gCors(req) });
    }
    if (step === "GIFT_CONFIRM") {
      if (btnVal === "gift_confirm" || lo.includes("yes") || lo.includes("confirm") || lo.includes("sure") || lo.includes("yep")) {
        var vcode = Array.from({ length: 8 }, function () { return "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]; }).join("");
        var { data: gv } = await db.from("vouchers").insert({ business_id: ns.gbid, code: vcode, status: "PENDING", type: "FREE_TRIP", value: ns.gtprice, purchase_amount: ns.gtprice, recipient_name: ns.grecipient, gift_message: ns.gmessage || null, buyer_name: ns.gbuyername, buyer_email: ns.gbuyeremail, tour_name: ns.gtname, expires_at: new Date(now.getTime() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString() }).select().single();
        if (gv) {
          var gyr = await fetch("https://payments.yoco.com/api/checkouts", { method: "POST", headers: { Authorization: "Bearer " + YK, "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(ns.gtprice * 100), currency: "ZAR", successUrl: "https://book.capekayak.co.za/voucher-confirmed?code=" + vcode, cancelUrl: "https://book.capekayak.co.za/cancelled", failureUrl: "https://book.capekayak.co.za/cancelled", metadata: { type: "GIFT_VOUCHER", voucher_id: gv.id, voucher_code: vcode } }) });
          var gyd = await gyr.json();
          if (gyd && gyd.redirectUrl) { await db.from("vouchers").update({ yoco_checkout_id: gyd.id }).eq("id", gv.id); pay = gyd.redirectUrl; reply = "\ud83c\udf81 Voucher created! Click below to pay R" + ns.gtprice + ".\n\nOnce paid, we\u2019ll email the voucher to " + ns.gbuyeremail + " \u2709\ufe0f"; }
          else { reply = "Payment link didn\u2019t work \u2014 try the Gift Voucher page on the website?"; }
        } else { reply = "Something went wrong. Try the Gift Voucher page?"; }
        ns = { step: "IDLE" };
      } else if (btnVal === "cancel_booking" || lo.includes("cancel")) { reply = "No worries!"; ns = { step: "IDLE" }; }
      else { reply = "Ready to purchase?"; buttons = [{ label: "\u2705 Purchase R" + ns.gtprice, value: "gift_confirm" }, { label: "\u274c Cancel", value: "cancel_booking" }]; }
      return new Response(JSON.stringify({ reply: reply, state: ns, buttons: buttons, paymentUrl: pay }), { status: 200, headers: gCors(req) });
    }
    // ===== FALLBACK =====
    var gem2 = await gemChat(hist, msg);
    reply = gem2 || "Hey! Need help booking or got a question?";
    ns = { step: "IDLE" };
    return new Response(JSON.stringify({ reply: reply, state: ns }), { status: 200, headers: gCors(req) });
  } catch (err) { console.error("ERR:", err); return new Response(JSON.stringify({ reply: "Ah sorry, try that again?", state: { step: "IDLE" } }), { status: 500, headers: gCors(req) }); }
});

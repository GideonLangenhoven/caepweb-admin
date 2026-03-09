import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Cape Kayak Adventures <onboarding@resend.dev>";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const COMPANY = {
  name: "Cape Kayak Adventures",
  addressLines: ["179 Beach Road Three Anchor Bay", "Cape Town", "8005"],
  vat: "4290176926",
  registration: "1995/051404/23",
  bankOwner: "Coastal Kayak Trails CC",
  bankNumber: "070631824",
  bankType: "Current / Cheque",
  bankName: "Standard Bank",
  bankBranch: "020909",
};

type Json = Record<string, unknown>;

function respond(status: number, body: Json) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function text(value: unknown, fallback = ""): string {
  const str = String(value ?? "").trim();
  return str || fallback;
}

function money(value: unknown): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toFixed(2);
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  const raw = String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlLayout(title: string, intro: string, content: string) {
  return `<!doctype html>
  <html lang="en">
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <div style="padding:24px 24px 12px;background:linear-gradient(135deg,#ecfeff 0%,#ffffff 100%);border-bottom:1px solid #e5e7eb;">
            <div style="font-size:24px;font-weight:800;color:#0f595e;">Cape Kayak Adventures</div>
            <div style="margin-top:6px;font-size:12px;color:#6b7280;">${escapeHtml(COMPANY.addressLines.join(" · "))}</div>
          </div>
          <div style="padding:24px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#111827;">${escapeHtml(title)}</h1>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">${intro}</p>
            ${content}
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

function infoRows(rows: Array<{ label: string; value: string }>) {
  return `<table role="presentation" style="width:100%;border-collapse:collapse;">${rows.map((row) => `
    <tr>
      <td style="padding:10px 0;border-top:1px solid #eef2f7;width:38%;font-size:13px;font-weight:700;color:#6b7280;vertical-align:top;">${escapeHtml(row.label)}</td>
      <td style="padding:10px 0;border-top:1px solid #eef2f7;font-size:14px;color:#111827;vertical-align:top;">${escapeHtml(row.value)}</td>
    </tr>`).join("")}</table>`;
}

async function invoicePdf(data: Json): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.06, 0.35, 0.37);
  const gray = rgb(0.42, 0.47, 0.54);
  const black = rgb(0.1, 0.1, 0.12);
  let y = 790;

  function line(label: string, value: string, opts: { bold?: boolean; size?: number; x?: number } = {}) {
    const x = opts.x ?? 48;
    const size = opts.size ?? 11;
    page.drawText(label, { x, y, size, font: fontBold, color: gray });
    page.drawText(value, { x: x + 140, y, size, font: opts.bold ? fontBold : font, color: black });
    y -= size + 10;
  }

  page.drawText("Cape Kayak Adventures", { x: 48, y, size: 24, font: fontBold, color: teal });
  page.drawText("Tax Invoice", { x: 410, y: y + 4, size: 18, font: fontBold, color: gray });
  y -= 28;
  page.drawText(`${COMPANY.addressLines.join(", ")}`, { x: 48, y, size: 10, font, color: gray });
  y -= 14;
  page.drawText(`Reg. ${COMPANY.registration}  VAT ${COMPANY.vat}`, { x: 48, y, size: 10, font, color: gray });
  y -= 28;

  line("Invoice #", text(data.invoice_number, "-"));
  line("Invoice Date", formatDate(data.invoice_date));
  line("Customer", text(data.customer_name, "Customer"));
  line("Email", text(data.customer_email, "-"));
  line("Service", text(data.tour_name, "Kayak Booking"));
  line("Tour Date", text(data.tour_date, "-"));
  line("Qty", text(data.qty, "1"));
  line("Unit Price", `R${money(data.unit_price)}`);
  line("Subtotal", `R${money(data.subtotal)}`);
  line("Total Paid", `R${money(data.total_amount)}`, { bold: true });
  line("Payment Method", text(data.payment_method, "Online"));
  line("Reference", text(data.payment_reference, text(data.invoice_number, "-")));

  y -= 12;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: rgb(0.9, 0.92, 0.95) });
  y -= 28;
  page.drawText("Banking Details", { x: 48, y, size: 14, font: fontBold, color: black });
  y -= 22;
  line("Account Owner", COMPANY.bankOwner);
  line("Account Number", COMPANY.bankNumber);
  line("Account Type", COMPANY.bankType);
  line("Bank", COMPANY.bankName);
  line("Branch Code", COMPANY.bankBranch);

  return await pdf.save();
}

function bookingConfirmEmail(data: Json) {
  const rows = infoRows([
    { label: "Reference", value: text(data.ref, "-") },
    { label: "Tour", value: text(data.tour_name, "Tour") },
    { label: "Start Time", value: text(data.start_time, "TBC") },
    { label: "Guests", value: text(data.qty, "1") },
    { label: "Amount", value: `R${money(data.total_amount)}` },
  ]);
  return {
    subject: `Booking confirmed: ${text(data.ref, "Cape Kayak")}`,
    html: htmlLayout(
      "Booking Confirmed",
      `Hi ${escapeHtml(text(data.customer_name, "there"))}, your booking is confirmed.`,
      rows,
    ),
  };
}

function paymentLinkEmail(data: Json) {
  const url = text(data.payment_url, "");
  const content = `${infoRows([
    { label: "Reference", value: text(data.ref, "-") },
    { label: "Tour", value: text(data.tour_name, "Tour") },
    { label: "Tour Date", value: text(data.tour_date, "-") },
    { label: "Guests", value: text(data.qty, "1") },
    { label: "Amount Due", value: `R${money(data.total_amount)}` },
  ])}
  <div style="margin-top:20px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f595e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Pay Now</a>
  </div>`;
  return {
    subject: `Payment link: ${text(data.ref, "Cape Kayak")}`,
    html: htmlLayout(
      "Payment Link",
      `Hi ${escapeHtml(text(data.customer_name, "there"))}, use the button below to complete payment for your booking.`,
      content,
    ),
  };
}

function adminSetupEmail(data: Json) {
  const reason = text(data.reason, "ADMIN_INVITE");
  const intro = reason === "RESET"
    ? `Hi ${escapeHtml(text(data.name, "there"))}, use the secure link below to reset your admin password.`
    : `Hi ${escapeHtml(text(data.name, "there"))}, you have been added as an admin. Use the secure link below to create your password.`;
  return {
    subject: reason === "RESET" ? "Reset your admin password" : "Create your admin password",
    html: htmlLayout(
      reason === "RESET" ? "Reset Password" : "Admin Access",
      intro,
      `${infoRows([
        { label: "Email", value: text(data.email, "-") },
        { label: "Link Expires", value: formatDate(data.expires_at) || "In 48 hours" },
      ])}
      <p style="margin:16px 0 0;font-size:14px;"><a href="${escapeHtml(text(data.setup_url, "#"))}" style="color:#0f595e;font-weight:700;">Create or reset your password</a></p>`,
    ),
  };
}

function cancellationEmail(data: Json) {
  const refund = Number(data.refund_amount ?? 0);
  return {
    subject: `Trip cancelled: ${text(data.ref, "Cape Kayak")}`,
    html: htmlLayout(
      "Trip Cancelled",
      `Hi ${escapeHtml(text(data.customer_name, "there"))}, unfortunately your booking has been cancelled.`,
      `${infoRows([
        { label: "Reference", value: text(data.ref, "-") },
        { label: "Tour", value: text(data.tour_name, "Tour") },
        { label: "Start Time", value: text(data.start_time, "-") },
        { label: "Reason", value: text(data.reason, "Operational cancellation") },
        ...(refund > 0 ? [{ label: "Refund", value: `R${money(refund)}` }] : []),
      ])}
      <div style="margin-top:20px;">
        <a href="https://booking-mu-steel.vercel.app/my-bookings" style="display:inline-block;background:#0f595e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Manage Your Booking</a>
      </div>`,
    ),
  };
}

function tripPhotosEmail(data: Json) {
  const url = text(data.photo_url, "");
  return {
    subject: "Your trip photos",
    html: htmlLayout(
      "Trip Photos",
      `Hi ${escapeHtml(text(data.customer_name, "there"))}, thanks for joining us on the water.`,
      `${infoRows([
        { label: "Trip", value: text(data.tour_name, "Cape Kayak Adventures") },
      ])}
      <p style="margin:16px 0 0;font-size:14px;"><a href="${escapeHtml(url)}" style="color:#0f595e;font-weight:700;">Open your photos</a></p>`,
    ),
  };
}

async function invoiceEmail(data: Json) {
  const pdfBytes = await invoicePdf(data);
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  return {
    subject: `Tax invoice ${text(data.invoice_number, "")}`.trim(),
    html: htmlLayout(
      "Tax Invoice",
      `Hi ${escapeHtml(text(data.customer_name, "there"))}, your payment has been received. Your tax invoice is attached as a PDF.`,
      `${infoRows([
        { label: "Invoice #", value: text(data.invoice_number, "-") },
        { label: "Invoice Date", value: formatDate(data.invoice_date) },
        { label: "Service", value: text(data.tour_name, "Kayak Booking") },
        { label: "Tour Date", value: text(data.tour_date, "-") },
        { label: "Amount Paid", value: `R${money(data.total_amount)}` },
        { label: "Payment Method", value: text(data.payment_method, "Online") },
      ])}`,
    ),
    attachments: [{
      filename: `${text(data.invoice_number, "invoice")}.pdf`,
      content: base64,
      content_type: "application/pdf",
    }],
  };
}

async function buildEmail(type: string, data: Json) {
  if (type === "BOOKING_CONFIRM") return bookingConfirmEmail(data);
  if (type === "PAYMENT_LINK") return paymentLinkEmail(data);
  if (type === "ADMIN_SETUP" || type === "ADMIN_WELCOME") return adminSetupEmail(data);
  if (type === "CANCELLATION") return cancellationEmail(data);
  if (type === "TRIP_PHOTOS") return tripPhotosEmail(data);
  if (type === "INVOICE") return await invoiceEmail(data);
  return {
    subject: "Cape Kayak Adventures",
    html: htmlLayout("Notification", "You have a new message from Cape Kayak Adventures.", "<p style=\"margin:0;font-size:14px;color:#374151;\">This email type is not explicitly templated yet.</p>"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (!RESEND_API_KEY) {
    return respond(500, { ok: false, error: "RESEND_API_KEY is not configured." });
  }

  try {
    const payload = asRecord(await req.json());
    const type = text(payload.type).toUpperCase();
    const data = asRecord(payload.data);
    const to = text(data.email);

    if (!type) return respond(400, { ok: false, error: "Missing email type." });
    if (!to) return respond(400, { ok: false, error: "Missing recipient email." });

    const message = await buildEmail(type, data);
    const resendPayload: Json = {
      from: EMAIL_FROM,
      to: [to],
      subject: message.subject,
      html: message.html,
    };

    if ("attachments" in message) {
      resendPayload.attachments = (message as Json).attachments;
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendJson = await resendRes.json();
    if (!resendRes.ok) {
      return respond(502, {
        ok: false,
        error: text((resendJson as Json).message, "Email provider rejected the request."),
        details: resendJson,
      });
    }

    return respond(200, { ok: true, id: (resendJson as Json).id ?? null });
  } catch (error) {
    return respond(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

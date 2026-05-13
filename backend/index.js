import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ── Supabase ────────────────────────────────────────────────
// Use SERVICE_ROLE key here (server-side only, never expose to client)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://particles-without-borders-5nhz-two.vercel.app",
    "https://particles-without-borders-wivr-8dui1k35z.vercel.app",
    "http://localhost:5000"
  ]
}));
app.use(express.json());

// ── Email ────────────────────────────────────────────────────
async function sendConfirmationEmail(to, name, registrationId, category) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Particles Without Borders <do-not-reply@particleswithoutborders.com>",
      to: [to],
      subject: "Registration Confirmed — Particles Without Borders 2026",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #0e7490;">Registration Confirmed!</h1>
          <p>Dear <strong>${name}</strong>,</p>
          <p>Thank you for registering for <strong>Particles Without Borders 2026</strong>.</p>
          <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Reference ID:</strong> ${registrationId}</p>
            <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${category}</p>
          </div>
          <p>Our team will review your submission and send payment instructions within 3 working days.</p>
          <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.org">secretariat@particleswithoutborders.org</a></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Particles Without Borders · KLCC, Kuala Lumpur · 16 November 2026</p>
        </div>
      `
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
}

// ── Routes ───────────────────────────────────────────────────
app.post("/api/registrations", async (req, res) => {
  const { name, email, category } = req.body;

  if (!name || !email || !category) {
    return res.status(400).json({ error: "name, email and category are required." });
  }

  const id = "REG-" + Math.random().toString(36).slice(2, 10).toUpperCase();

  // 1. Save registration to Supabase
  const { error: dbError } = await supabase
    .from("registrations")
    .insert({ id, name, email, category });

  if (dbError) {
    console.error("DB insert error:", dbError);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }

  // 2. Send confirmation email & log result
  let emailStatus = "sent";
  let emailError  = null;

  try {
    await sendConfirmationEmail(email, name, id, category);
  } catch (err) {
    console.error("Email error (non-fatal):", err.message);
    emailStatus = "failed";
    emailError  = err.message;
  }

  await supabase.from("email_logs").insert({
    registration_id: id,
    to_email:        email,
    subject:         "Registration Confirmed — Particles Without Borders 2026",
    status:          emailStatus,
    error_message:   emailError
  });

  res.json({ ok: true, registration: { id } });
});

// ── Payment status update (called by your payment provider webhook) ──
app.post("/api/registrations/:id/payment", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // "paid" | "failed"

  if (!["paid", "failed"].includes(status)) {
    return res.status(400).json({ error: "status must be 'paid' or 'failed'." });
  }

  const { error } = await supabase
    .from("registrations")
    .update({ payment_status: status })
    .eq("id", id);

  if (error) {
    console.error("Payment update error:", error);
    return res.status(500).json({ error: "Could not update payment status." });
  }

  res.json({ ok: true });
});

app.get("/", (req, res) => res.json({ status: "ok" }));

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

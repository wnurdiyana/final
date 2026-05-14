import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ── Supabase ────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://final-roan-beta-76.vercel.app",
    "http://localhost:5173"
  ]
}));
app.use(express.json());

// ── Helpers ──────────────────────────────────────────────────
function generatePassword() {
  return Math.random().toString(36).slice(-8).toUpperCase() + "!" + Math.random().toString(36).slice(-2).toUpperCase();
}

async function sendConfirmationEmail(to, name, registrationId, category, loginData = null) {
  const isPresenter = !!loginData;
  const subject = isPresenter
    ? "Action Required: Your Submission Account for Particles Without Borders 2026"
    : "Registration Confirmed — Particles Without Borders 2026";

  const html = isPresenter ? `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h1 style="color: #0e7490;">Submission Account Created!</h1>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Your registration as a presenter is confirmed. We have created a secure account for you to monitor your abstract review status and manage your invoice.</p>
      <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Reference ID:</strong> ${registrationId}</p>
        <p style="margin: 0 0 8px 0;"><strong>Login Email:</strong> ${to}</p>
        <p style="margin: 0 0 8px 0;"><strong>Temporary Password:</strong> ${loginData.password}</p>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">Please use these details to log into your author dashboard.</p>
      </div>
      <p>Our team will review your submission. You can check your status at any time via the dashboard.</p>
      <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.org">secretariat@particleswithoutborders.org</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Particles Without Borders · KLCC, Kuala Lumpur · 16 November 2026</p>
    </div>
  ` : `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h1 style="color: #0e7490;">Registration Confirmed!</h1>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Thank you for registering as a listener for <strong>Particles Without Borders 2026</strong>.</p>
      <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Reference ID:</strong> ${registrationId}</p>
        <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${category}</p>
      </div>
      <p>Your invoice and payment instructions will be sent to this email shortly. We look forward to seeing you in Kuala Lumpur!</p>
      <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.org">secretariat@particleswithoutborders.org</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Particles Without Borders · KLCC, Kuala Lumpur · 16 November 2026</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Particles Without Borders <do-not-reply@send.particleswithoutborders.com>",
      to: [to],
      subject,
      html
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
}

// ── Routes ───────────────────────────────────────────────────
app.post("/api/registrations", async (req, res) => {
  const { name, email, category, subRole } = req.body;

  if (!name || !email || !category) {
    return res.status(400).json({ error: "name, email and category are required." });
  }

  const id = "REG-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const isPresenter = subRole === "presenter";

  try {
    let loginData = null;
    let userId = null;

    if (isPresenter) {
      const password = generatePassword();
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) throw new Error("Auth account creation failed: " + authError.message);
      userId = authUser.user.id;
      loginData = { password };
    }

    // 1. Save registration to Supabase
    const { error: dbError } = await supabase
      .from("registrations")
      .insert({
        id,
        name,
        email,
        category,
        user_id: userId
      });

    if (dbError) throw dbError;

    // 2. Send differentiated email
    await sendConfirmationEmail(email, name, id, category, loginData);

    // 3. Log email
    await supabase.from("email_logs").insert({
      registration_id: id,
      to_email:        email,
      subject:         isPresenter ? "Account Created" : "Registration Confirmed",
      status:          "sent"
    });

    res.json({ ok: true, registration: { id } });

  } catch (err) {
    console.error("Registration Error:", err);
    return res.status(500).json({ error: err.message || "Registration failed" });
  }
});

app.get("/", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

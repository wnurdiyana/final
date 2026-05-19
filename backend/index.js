import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const allowedOrigins = [
  "https://particleswithoutborders.com",
  "https://www.particleswithoutborders.com",
  "https://final-roan-beta-76.vercel.app",
  process.env.FRONTEND_ORIGIN,
  "http://localhost:5173"
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());
app.use(express.json({ limit: "1mb" }));

function generatePassword() {
  return `${Math.random().toString(36).slice(-8).toUpperCase()}!${Math.random().toString(36).slice(-2).toUpperCase()}`;
}

function generateRegistrationId() {
  return `PWB-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function logEmail({ registrationId, to, subject, status }) {
  try {
    await supabase.from("email_logs").insert({
      registration_id: registrationId,
      to_email: to,
      subject,
      status
    });
  } catch (logError) {
    console.error("Email log failed:", logError);
  }
}

async function sendConfirmationEmail(to, name, registrationId, category, loginData = null) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured in Vercel environment variables.");
  }

  const isPresenter = !!loginData;
  const subject = `Registration Confirmed: ${registrationId} - Particles Without Borders 2026`;
  const safeName = escapeHtml(name);
  const safeRegistrationId = escapeHtml(registrationId);
  const safeCategory = escapeHtml(category);
  const safeEmail = escapeHtml(to);
  const safePassword = loginData ? escapeHtml(loginData.password) : "";

  const accountBlock = isPresenter ? `
        <p style="margin: 0 0 8px 0;"><strong>Login Email:</strong> ${safeEmail}</p>
        <p style="margin: 0 0 8px 0;"><strong>Temporary Password:</strong> ${safePassword}</p>
  ` : "";

  const roleText = isPresenter
    ? "Your presenter registration has been received and a secure submission account has been created for you."
    : "Your listener registration has been received.";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #0f172a;">
      <h1 style="color: #0e7490; margin: 0 0 16px 0;">Registration Confirmed</h1>
      <p>Dear <strong>${safeName}</strong>,</p>
      <p>Thank you for registering for <strong>Particles Without Borders 2026</strong>. ${roleText}</p>
      <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Unique Registration ID:</strong> ${safeRegistrationId}</p>
        <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${safeCategory}</p>
${accountBlock}
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">Keep your registration ID for payment, invoice, and conference correspondence.</p>
      </div>
      <p>Your invoice and payment instructions will be sent to this email shortly.</p>
      <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.com">secretariat@particleswithoutborders.com</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Particles Without Borders - KLCC, Kuala Lumpur - 16 November 2026</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Particles Without Borders <do-not-reply@particleswithoutborders.com>",
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email failed: ${details}`);
  }

  return { subject, html };
}

app.post("/api/registrations", async (req, res) => {
  const {
    name,
    email,
    category,
    subRole,
    affiliation,
    country,
    theme,
    paperTitle,
    keywords,
    dietary,
    visa,
    reviewer,
    paymentStatus,
    abstractFile,
    studentIdFile
  } = req.body;

  if (!name || !email || !category) {
    return res.status(400).json({ error: "name, email and category are required." });
  }

  const id = generateRegistrationId();
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

      if (authError) {
        throw new Error(`Auth account creation failed: ${authError.message}`);
      }

      userId = authUser.user.id;
      loginData = { password };
    }

    const { error: dbError } = await supabase
      .from("registrations")
      .insert({
        id,
        name,
        email,
        category,
        affiliation,
        country,
        theme,
        sub_role: subRole,
        paper_title: paperTitle,
        keywords,
        dietary,
        visa,
        reviewer,
        payment_status: paymentStatus || "Pending",
        abstract_file: abstractFile,
        student_id_file: studentIdFile,
        user_id: userId
      });

    if (dbError) {
      throw dbError;
    }

    try {
      const emailContent = await sendConfirmationEmail(email, name, id, category, loginData);
      await logEmail({
        registrationId: id,
        to: email,
        subject: emailContent.subject,
        status: "sent"
      });
    } catch (emailError) {
      await logEmail({
        registrationId: id,
        to: email,
        subject: `Registration Confirmed: ${id}`,
        status: "failed"
      });
      throw emailError;
    }

    res.json({ ok: true, registration: { id } });
  } catch (err) {
    console.error("Registration Error:", err);
    return res.status(500).json({ error: err.message || "Registration failed" });
  }
});

app.get("/", (req, res) => res.json({ status: "ok" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;

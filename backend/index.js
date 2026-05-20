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

async function sendConfirmationEmail(to, name, registrationId, category) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured in Vercel environment variables.");
  }

  const isPresenter = String(category).toLowerCase().includes("presenter");
  const subject = `Registration Confirmed: ${registrationId} - Particles Without Borders 2026`;
  const safeName = escapeHtml(name);
  const safeRegistrationId = escapeHtml(registrationId);
  const safeCategory = escapeHtml(category);

  const roleText = isPresenter
    ? "Your presenter registration has been received."
    : "Your listener registration has been received.";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #0f172a;">
      <h1 style="color: #0e7490; margin: 0 0 16px 0;">Registration Confirmed</h1>
      <p>Dear <strong>${safeName}</strong>,</p>
      <p>Thank you for registering for <strong>Particles Without Borders 2026</strong>. ${roleText}</p>
      <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Unique Registration ID:</strong> ${safeRegistrationId}</p>
        <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${safeCategory}</p>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">Keep your registration ID for payment, invoice, and conference correspondence.</p>
      </div>
      <p>Your invoice, payment due date, and payment link will be sent to this email shortly. Abstract notifications will be sent separately.</p>
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

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured in Vercel environment variables.");
  }

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

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 100;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Auth user lookup failed: ${error.message}`);
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createOrFindDashboardUser(email) {
  const password = generatePassword();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (!authError) {
    return {
      userId: authUser.user.id,
      loginData: { password }
    };
  }

  if (!authError.message.toLowerCase().includes("already")) {
    throw new Error(`Auth account creation failed: ${authError.message}`);
  }

  const existingUser = await findAuthUserByEmail(email);

  if (!existingUser) {
    throw new Error("Auth account already exists, but could not be found for linking.");
  }

  const resetPassword = generatePassword();
  const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
    password: resetPassword,
    email_confirm: true
  });

  if (updateError) {
    throw new Error(`Auth password reset failed: ${updateError.message}`);
  }

  return {
    userId: existingUser.id,
    loginData: { password: resetPassword, resetExistingAccount: true }
  };
}

async function resetDashboardPassword(userId) {
  const password = generatePassword();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true
  });

  if (error) {
    throw new Error(`Auth password reset failed: ${error.message}`);
  }

  return { password, resetExistingAccount: true };
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not configured in Vercel environment variables." });
  }

  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

function getInvoiceAmount(category = "") {
  const lower = category.toLowerCase();

  if (lower.includes("industry")) {
    return lower.includes("listener") ? 320 : 400;
  }

  if (lower.includes("academician")) {
    return lower.includes("listener") ? 160 : 200;
  }

  if (lower.includes("student")) {
    return 100;
  }

  return 0;
}

function buildInvoiceEmail(registration, invoice) {
  const safeName = escapeHtml(registration.name);
  const safeRegistrationId = escapeHtml(registration.id);
  const safeCategory = escapeHtml(registration.category);
  const safeInvoiceId = escapeHtml(invoice.id);
  const amountText = invoice.amount ? `MYR ${Number(invoice.amount).toFixed(2)}` : "To be confirmed";
  const safeAmount = escapeHtml(amountText);
  const paymentLink = process.env.PAYMENT_LINK || process.env.TOYYIBPAY_PAYMENT_LINK || "";
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const dueDateText = dueDate.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const paymentBlock = paymentLink
    ? `<p style="margin: 20px 0;"><a href="${escapeHtml(paymentLink)}" style="display: inline-block; background: #0e7490; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700;">Pay Online</a></p>`
    : `<p style="margin: 20px 0; color: #b45309;">Payment link is not configured yet. The secretariat will send payment instructions separately.</p>`;
  const subject = `Invoice ${invoice.id} - Particles Without Borders 2026`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #0f172a;">
      <h1 style="color: #0e7490; margin: 0 0 16px 0;">Conference Invoice</h1>
      <p>Dear <strong>${safeName}</strong>,</p>
      <p>Thank you for registering for <strong>Particles Without Borders 2026</strong>. Your invoice details are below.</p>
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Invoice ID:</strong> ${safeInvoiceId}</p>
        <p style="margin: 0 0 8px 0;"><strong>Registration ID:</strong> ${safeRegistrationId}</p>
        <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${safeCategory}</p>
        <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${safeAmount}</p>
        <p style="margin: 0;"><strong>Payment Due Date:</strong> ${escapeHtml(dueDateText)}</p>
      </div>
      ${paymentBlock}
      <p>Please keep your invoice ID and registration ID for payment reference.</p>
      <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.com">secretariat@particleswithoutborders.com</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Particles Without Borders - KLCC, Kuala Lumpur - 16 November 2026</p>
    </div>
  `;

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
    chairperson,
    paymentStatus,
    abstractFile,
    studentIdFile
  } = req.body;

  if (!name || !email || !category) {
    return res.status(400).json({ error: "name, email and category are required." });
  }

  const id = generateRegistrationId();
  try {
    const { data: existingRegistration, error: existingRegistrationError } = await supabase
      .from("registrations")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRegistrationError) {
      throw existingRegistrationError;
    }

    if (existingRegistration) {
      try {
        const emailContent = await sendConfirmationEmail(
          email,
          existingRegistration.name || name,
          existingRegistration.id,
          existingRegistration.category || category
        );

        await logEmail({
          registrationId: existingRegistration.id,
          to: email,
          subject: emailContent.subject,
          status: "sent"
        });
      } catch (emailError) {
        await logEmail({
          registrationId: existingRegistration.id,
          to: email,
          subject: `Registration Confirmed: ${existingRegistration.id}`,
          status: "failed"
        });
        throw emailError;
      }

      return res.json({
        ok: true,
        resent: true,
        registration: { id: existingRegistration.id }
      });
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
        chairperson,
        payment_status: paymentStatus || "Pending",
        abstract_file: abstractFile,
        student_id_file: studentIdFile
      });

    if (dbError) {
      throw dbError;
    }

    try {
      const emailContent = await sendConfirmationEmail(email, name, id, category);
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

app.get("/api/admin/registrations", requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ registrations: data || [] });
});

app.post("/api/admin/registrations/:id/invoice", requireAdmin, async (req, res) => {
  const registrationId = req.params.id;

  const { data: registration, error: fetchError } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .single();

  if (fetchError || !registration) {
    return res.status(404).json({ error: fetchError?.message || "Registration not found" });
  }

  const invoice = {
    id: `INV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    registration_id: registration.id,
    amount: getInvoiceAmount(registration.category),
    status: "Sent"
  };

  const { error: invoiceError } = await supabase.from("invoices").insert(invoice);

  if (invoiceError) {
    return res.status(500).json({ error: invoiceError.message });
  }

  const emailContent = buildInvoiceEmail(registration, invoice);

  try {
    await sendEmail({
      to: registration.email,
      subject: emailContent.subject,
      html: emailContent.html
    });

    await supabase
      .from("registrations")
      .update({
        invoice_id: invoice.id,
        invoice_sent: true,
        payment_status: "Invoice Sent"
      })
      .eq("id", registration.id);

    await logEmail({
      registrationId: registration.id,
      to: registration.email,
      subject: emailContent.subject,
      status: "sent"
    });

    res.json({ ok: true, invoice, emailContent });
  } catch (err) {
    await logEmail({
      registrationId: registration.id,
      to: registration.email,
      subject: emailContent.subject,
      status: "failed"
    });

    return res.status(500).json({ error: err.message || "Invoice email failed" });
  }
});

app.post("/api/admin/registrations/:id/decision", requireAdmin, async (req, res) => {
  const registrationId = req.params.id;
  const decision = req.body.decision === "Rejected" ? "Rejected" : "Accepted";

  const { data: registration, error: fetchError } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .single();

  if (fetchError || !registration) {
    return res.status(404).json({ error: fetchError?.message || "Registration not found" });
  }

  const subject = `Submission ${decision} - Particles Without Borders 2026`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #0f172a;">
      <h1 style="color: #0e7490; margin: 0 0 16px 0;">Submission ${escapeHtml(decision)}</h1>
      <p>Dear <strong>${escapeHtml(registration.name)}</strong>,</p>
      <p>Your submission for <strong>Particles Without Borders 2026</strong> has been marked as <strong>${escapeHtml(decision)}</strong>.</p>
      <p><strong>Registration ID:</strong> ${escapeHtml(registration.id)}</p>
      <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.com">secretariat@particleswithoutborders.com</a></p>
    </div>
  `;

  try {
    await sendEmail({ to: registration.email, subject, html });
    await supabase
      .from("registrations")
      .update({ review_status: decision, decision_sent: true })
      .eq("id", registration.id);
    await logEmail({ registrationId: registration.id, to: registration.email, subject, status: "sent" });

    res.json({ ok: true, emailContent: { subject, html } });
  } catch (err) {
    await logEmail({ registrationId: registration.id, to: registration.email, subject, status: "failed" });
    return res.status(500).json({ error: err.message || "Decision email failed" });
  }
});

app.post("/api/admin/registrations/:id/custom-email", requireAdmin, async (req, res) => {
  const registrationId = req.params.id;
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: "subject and message are required." });
  }

  const { data: registration, error: fetchError } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .single();

  if (fetchError || !registration) {
    return res.status(404).json({ error: fetchError?.message || "Registration not found" });
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #0f172a;">
      <p>Dear <strong>${escapeHtml(registration.name)}</strong>,</p>
      <p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>
      <p><strong>Registration ID:</strong> ${escapeHtml(registration.id)}</p>
      <p>Questions? Email us at <a href="mailto:secretariat@particleswithoutborders.com">secretariat@particleswithoutborders.com</a></p>
    </div>
  `;

  try {
    await sendEmail({ to: registration.email, subject, html });
    await logEmail({ registrationId: registration.id, to: registration.email, subject, status: "sent" });
    res.json({ ok: true, emailContent: { subject, html } });
  } catch (err) {
    await logEmail({ registrationId: registration.id, to: registration.email, subject, status: "failed" });
    return res.status(500).json({ error: err.message || "Custom email failed" });
  }
});

app.get("/", (req, res) => res.json({ status: "ok" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;

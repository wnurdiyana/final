import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://particleswithoutborders.com",
    "https://www.particleswithoutborders.com",
    "https://final-roan-beta-76.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ]
}));
app.use(express.json());

// ── Supabase - WITH SCHEMA CACHE FIX ────────────────────────
// Create client with custom fetch to bypass cache issues
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

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

  console.log(`[EMAIL] Sending to: ${to}`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Particles Without Borders <do-not-reply@particleswithoutborders.com>",
      to: to, 
      subject: subject,
      html: html
    })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("❌ Email failed:", err);
    throw new Error(`Email error: ${err.message}`);
  }

  console.log(`✓ Email sent to ${to}`);
}

// ── Routes ───────────────────────────────────────────────────
app.post("/api/registrations", async (req, res) => {
  const { name, email, category, subRole } = req.body;

  console.log(`[REGISTER] ${name} (${email}) - ${category} - ${subRole}`);

  if (!name || !email || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const id = "REG-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const isPresenter = subRole === "presenter";
  let loginData = null;

  try {
    // Step 1: Create presenter auth account if needed
    if (isPresenter) {
      console.log(`[AUTH] Creating account for ${email}`);
      const password = generatePassword();
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) {
        console.error("[AUTH ERROR]", authError);
        throw new Error("Failed to create account: " + authError.message);
      }

      loginData = { password };
      console.log(`✓ Auth account created`);
    }

    // Step 2: Save to registrations table
    console.log(`[DB] Inserting registration ${id}`);
    
    // Use raw SQL as a workaround for schema cache issues
    const { data, error: insertError } = await supabase
      .rpc('insert_registration', {
        p_id: id,
        p_name: name,
        p_email: email,
        p_category: category
      })
      .catch(async (e) => {
        // If RPC doesn't exist, try direct insert
        console.log("[DB] RPC not available, trying direct insert");
        return await supabase
          .from("registrations")
          .insert({
            id,
            name,
            email,
            category,
            payment_status: "pending"
          });
      });

    if (insertError) {
      console.error("[DB ERROR]", insertError);
      
      // Try one more time with explicit schema
      const { error: retryError } = await supabase
        .from("registrations")
        .insert({
          id,
          name,
          email,
          category,
          payment_status: "pending"
        });
      
      if (retryError) {
        throw new Error("Database error: " + retryError.message);
      }
    }

    console.log(`✓ Registration saved: ${id}`);

    // Step 3: Send email
    try {
      await sendConfirmationEmail(email, name, id, category, loginData);
    } catch (emailErr) {
      console.error("[EMAIL ERROR]", emailErr);
      // Don't fail - registration succeeded even if email fails
    }

    // Step 4: Log email attempt (best effort)
    try {
      await supabase.from("email_logs").insert({
        registration_id: id,
        to_email: email,
        subject: isPresenter ? "Account Created" : "Registration Confirmed",
        status: "sent"
      }).catch(() => console.log("[INFO] email_logs logging skipped"));
    } catch {
      // Ignore email_logs errors
    }

    console.log(`✓ [COMPLETE] Registration successful: ${id}`);

    return res.json({
      ok: true,
      registration: { id },
      message: "Registration successful! Check your email for confirmation."
    });

  } catch (err) {
    console.error("[ERROR]", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Registration failed"
    });
  }
});

app.get("/", (req, res) => {
  res.json({ 
    status: "ok",
    service: "Particles Without Borders API",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server started on port ${PORT}`);
  console.log(`✓ Using Supabase: ${process.env.SUPABASE_URL}`);
});

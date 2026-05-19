import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// Middleware
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

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: Generate random password
function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd + '!';
}

// Helper: Send email via Resend
async function sendEmail(to, name, id, category, isPresenter, password) {
  const subject = isPresenter 
    ? "Action Required: Your Submission Account for Particles Without Borders 2026"
    : "Registration Confirmed — Particles Without Borders 2026";

  const html = isPresenter
    ? `<div style="font-family: sans-serif; padding: 20px;">
        <h2>Submission Account Created!</h2>
        <p>Dear ${name},</p>
        <p>Your registration as a presenter is confirmed.</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
          <p><strong>Reference ID:</strong> ${id}</p>
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        <p>Our team will review your submission.</p>
        <p>Questions? Email: secretariat@particleswithoutborders.org</p>
      </div>`
    : `<div style="font-family: sans-serif; padding: 20px;">
        <h2>Registration Confirmed!</h2>
        <p>Dear ${name},</p>
        <p>Thank you for registering as a listener for Particles Without Borders 2026.</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
          <p><strong>Reference ID:</strong> ${id}</p>
          <p><strong>Category:</strong> ${category}</p>
        </div>
        <p>Your invoice will be sent shortly.</p>
        <p>Questions? Email: secretariat@particleswithoutborders.org</p>
      </div>`;

  console.log(`[EMAIL] Sending to ${to}`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Particles Without Borders <do-not-reply@particleswithoutborders.com>",
      to,
      subject,
      html
    })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("[EMAIL ERROR]", err);
    throw new Error(`Email failed: ${err.message}`);
  }

  console.log(`[EMAIL] Sent successfully to ${to}`);
}

// Registration endpoint
app.post("/api/registrations", async (req, res) => {
  const { name, email, category, subRole } = req.body;

  console.log(`[REGISTER] name=${name}, email=${email}, category=${category}, subRole=${subRole}`);

  // Validate input
  if (!name || !email || !category) {
    return res.status(400).json({ error: "Missing required fields: name, email, category" });
  }

  const regId = "REG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
  const isPresenter = subRole === "presenter";
  let password = null;

  try {
    // Step 1: Create presenter account if needed
    if (isPresenter) {
      console.log(`[AUTH] Creating account for ${email}`);
      password = generatePassword();
      
      const { error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) {
        console.error("[AUTH ERROR]", authError);
        throw new Error("Failed to create account: " + authError.message);
      }
      console.log(`[AUTH] Account created`);
    }

    // Step 2: Insert into registrations table
    console.log(`[DB] Inserting registration ${regId}`);
    
    const { error: insertError } = await supabase
      .from("registrations")
      .insert({
        id: regId,
        name,
        email,
        category,
        payment_status: "pending"
      });

    if (insertError) {
      console.error("[DB ERROR]", insertError);
      throw new Error("Database error: " + insertError.message);
    }

    console.log(`[DB] Registration saved: ${regId}`);

    // Step 3: Send confirmation email
    try {
      await sendEmail(email, name, regId, category, isPresenter, password);
    } catch (emailErr) {
      console.error("[EMAIL ERROR]", emailErr);
      // Don't fail the registration if email fails
    }

    // Step 4: Log email (optional)
    try {
      await supabase.from("email_logs").insert({
        registration_id: regId,
        to_email: email,
        subject: isPresenter ? "Account Created" : "Registration Confirmed",
        status: "sent"
      });
    } catch (logErr) {
      console.log("[INFO] Could not log email:", logErr.message);
    }

    console.log(`✓ [SUCCESS] Registration complete: ${regId}`);

    return res.json({
      ok: true,
      registration: { id: regId },
      message: "Registration successful! Check your email for confirmation."
    });

  } catch (error) {
    console.error("[REGISTRATION ERROR]", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Registration failed"
    });
  }
});

// Health check endpoints
app.get("/", (req, res) => {
  res.json({ 
    status: "ok",
    service: "Particles Without Borders API"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});

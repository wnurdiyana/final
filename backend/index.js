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

// Add logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Verify environment variables at startup
const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"];
const missingEnv = requiredEnv.filter(v => !process.env[v]);

if (missingEnv.length > 0) {
  console.error("❌ MISSING ENVIRONMENT VARIABLES:", missingEnv);
  console.error("Please set these in Vercel Environment Variables");
}

// Supabase client
let supabase;
try {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log("✓ Supabase client initialized");
} catch (error) {
  console.error("❌ Failed to initialize Supabase:", error);
}

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
  if (!process.env.RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY not set, skipping email");
    return;
  }

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

  try {
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
      const errText = await res.text();
      console.error(`[EMAIL] HTTP ${res.status}: ${errText}`);
      throw new Error(`Email HTTP ${res.status}`);
    }

    console.log(`✓ [EMAIL] Sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[EMAIL ERROR]", error instanceof Error ? error.message : error);
    // Don't throw - email failure shouldn't stop registration
    return false;
  }
}

// Registration endpoint
app.post("/api/registrations", async (req, res) => {
  try {
    console.log("[REGISTER] Received request");
    
    const { name, email, category, subRole } = req.body;

    console.log(`[REGISTER] name=${name}, email=${email}, category=${category}, subRole=${subRole}`);

    // Validate input
    if (!name || !email || !category) {
      console.warn("[REGISTER] Missing required fields");
      return res.status(400).json({ 
        ok: false,
        error: "Missing required fields: name, email, category" 
      });
    }

    // Validate Supabase is available
    if (!supabase) {
      console.error("[REGISTER] Supabase not initialized");
      return res.status(500).json({ 
        ok: false,
        error: "Database not available" 
      });
    }

    const regId = "REG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
    const isPresenter = subRole === "presenter";
    let password = null;

    // Step 1: Create presenter account if needed
    if (isPresenter) {
      try {
        console.log(`[AUTH] Creating account for ${email}`);
        password = generatePassword();
        
        const { data, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

        if (authError) {
          console.error("[AUTH ERROR]", authError);
          throw new Error("Failed to create account: " + authError.message);
        }
        console.log(`[AUTH] Account created for ${email}`);
      } catch (authErr) {
        const msg = authErr instanceof Error ? authErr.message : String(authErr);
        console.error("[AUTH FAILED]", msg);
        return res.status(500).json({ 
          ok: false,
          error: "Could not create presenter account: " + msg 
        });
      }
    }

    // Step 2: Insert into registrations table
    try {
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
        console.error("[DB INSERT ERROR]", insertError);
        throw new Error("Insert error: " + insertError.message);
      }

      console.log(`✓ [DB] Registration saved: ${regId}`);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.error("[DB FAILED]", msg);
      return res.status(500).json({ 
        ok: false,
        error: "Could not save registration: " + msg 
      });
    }

    // Step 3: Send confirmation email (non-blocking)
    let emailSent = false;
    try {
      emailSent = await sendEmail(email, name, regId, category, isPresenter, password);
    } catch (emailErr) {
      console.error("[EMAIL SEND FAILED]", emailErr instanceof Error ? emailErr.message : emailErr);
      // Don't fail the entire registration if email fails
    }

    // Step 4: Try to log email (optional, non-critical)
    try {
      await supabase.from("email_logs").insert({
        registration_id: regId,
        to_email: email,
        subject: isPresenter ? "Account Created" : "Registration Confirmed",
        status: emailSent ? "sent" : "failed"
      });
    } catch (logErr) {
      console.log("[INFO] Email logging skipped:", logErr instanceof Error ? logErr.message : logErr);
    }

    console.log(`✓ [SUCCESS] Registration complete: ${regId}`);

    return res.json({
      ok: true,
      registration: { id: regId },
      message: "Registration successful! Check your email for confirmation."
    });

  } catch (error) {
    console.error("[REGISTRATION CRITICAL ERROR]", error instanceof Error ? error.message : error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// Health check endpoints
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
    timestamp: new Date().toISOString(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      resend: !!process.env.RESEND_API_KEY
    }
  });
});

// Error handler for uncaught errors
app.use((err, req, res, next) => {
  console.error("[UNCAUGHT ERROR]", err);
  res.status(500).json({
    ok: false,
    error: "Server error"
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Time: ${new Date().toISOString()}`);
  console.log(`✓ Environment check:`);
  console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ SET' : '❌ MISSING'}`);
  console.log(`  - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SET' : '❌ MISSING'}`);
  console.log(`  - RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✓ SET' : '❌ MISSING'}`);
});

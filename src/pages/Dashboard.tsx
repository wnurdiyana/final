import { useEffect, useState } from "react";
import { Link } from "wouter";

const logoUrl = "/logo.png";

type Registration = {
  id: string;
  category: string;
  name: string;
  email: string;
  affiliation: string;
  country: string;
  theme: string;
  paper_title: string;
  keywords: string;
  payment_status: string;
  review_status: string;
  invoice_id: string;
  invoice_sent: boolean;
  created_at: string;
};

type Session = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};

const SESSION_KEY = "pwb_participant_session";

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function StatusBadge({ value }: { value: string }) {
  const status = value || "Pending";
  const accepted = status === "Accepted" || status === "Invoice Sent";
  const rejected = status === "Rejected";
  const classes = rejected
    ? "bg-red-50 text-red-700"
    : accepted
    ? "bg-emerald-50 text-emerald-700"
    : "bg-amber-50 text-amber-700";

  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${classes}`}>{status}</span>;
}

function Detail({ label, value }: { label: string; value?: string | boolean | null }) {
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : value || "-";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground break-words">{display}</div>
    </div>
  );
}

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadRegistration(activeSession: Session) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/participant/registration", {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load dashboard.");
      }

      setRegistration(data.registration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
      if (err instanceof Error && err.message.includes("session")) {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.access_token) {
      loadRegistration(session);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/participant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      setSession(data.session);
      await loadRegistration(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRegistration(null);
    setEmail("");
    setPassword("");
  }

  if (!session) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logoUrl} alt="Particles Without Borders" className="h-16 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold gradient-text">Presenter Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Log in with the email and temporary password from your confirmation email.</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-cyan-100 shadow-lg p-8 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-semibold mb-2 block">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-semibold mb-2 block">Temporary Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <Link href="/" className="block text-center text-sm text-muted-foreground hover:text-primary">
              Back to Home
            </Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-cyan-100/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Particles Without Borders" className="h-12 w-auto" />
            <div className="hidden sm:block leading-tight">
              <div className="font-bold text-sm gradient-text">Presenter Dashboard</div>
              <div className="text-[10px] text-muted-foreground tracking-wide uppercase">Particles Without Borders 2026</div>
            </div>
          </Link>
          <button onClick={logout} className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-200 hover:bg-white">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {error && <div className="mb-6 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>}
        {loading && !registration ? (
          <div className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-10 text-center text-muted-foreground">Loading dashboard...</div>
        ) : registration ? (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Registration</div>
                  <h1 className="text-3xl font-extrabold">{registration.name}</h1>
                  <p className="text-muted-foreground mt-1">{registration.email}</p>
                </div>
                <div className="font-mono text-sm bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  {registration.id}
                </div>
              </div>
            </section>

            <section className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Review Status</div>
                <StatusBadge value={registration.review_status} />
              </div>
              <div className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Invoice</div>
                <StatusBadge value={registration.invoice_sent ? "Invoice Sent" : "Pending"} />
              </div>
              <div className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment</div>
                <StatusBadge value={registration.payment_status} />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-6 sm:p-8">
              <h2 className="text-lg font-bold mb-4">Submission Details</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Detail label="Category" value={registration.category} />
                <Detail label="Affiliation" value={registration.affiliation} />
                <Detail label="Country" value={registration.country} />
                <Detail label="Theme" value={registration.theme} />
                <Detail label="Paper Title" value={registration.paper_title} />
                <Detail label="Keywords" value={registration.keywords} />
                <Detail label="Invoice ID" value={registration.invoice_id} />
                <Detail label="Registered" value={registration.created_at ? new Date(registration.created_at).toLocaleString() : "-"} />
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

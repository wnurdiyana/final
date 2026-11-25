import { Link } from "wouter";

const logoUrl = "/logo.png";
const posterUrl = "/call-for-papers-poster.jpg";

const TOPICS = [
  {
    title: "Exposure Assessment and Health Risk Evaluation Based on Advanced Air Quality Measurements",
    desc: "Assessing human exposure to air pollution and related health risks using advanced monitoring methods, bio-monitoring, and toxicological indicators.",
  },
  {
    title: "Indoor Air Quality Monitoring Technologies and Human Health Implications",
    desc: "Monitoring indoor air pollution, ventilation effectiveness, and understanding its direct effects on human health, productivity, and wellbeing.",
  },
  {
    title: "Measurement and Monitoring of Aerosols, Microplastics, and Emerging Airborne Contaminants",
    desc: "Studying airborne particles, bioaerosols, microplastics, and emerging pollutants and their environmental transport and public health risks.",
  },
  {
    title: "Smart Sensors, Big Data Analytics, Air Quality Modelling, and Remote Sensing Applications",
    desc: "Deploying low-cost sensor networks, IoT platforms, satellite remote sensing, AI and machine learning modelling for high-resolution air quality mapping.",
  },
  {
    title: "Characterisation of Air Pollution Sources and Emissions Using Advanced Monitoring Technologies",
    desc: "Source apportionment, emission inventories, vehicular and maritime transport emissions, and industrial source characterisation.",
  },
];

const MILESTONES = [
  { label: "Abstract Submission Opens", date: "1 January 2027" },
  { label: "Abstract Submission Deadline", date: "31 May 2027" },
  { label: "Notification of Acceptance", date: "30 June 2027" },
  { label: "Early Bird Registration Deadline", date: "31 July 2027" },
  { label: "Final Registration Deadline", date: "31 August 2027" },
  { label: "Conference Dates", date: "27 & 28 September 2027" },
];

export default function CallForPapers() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 border-b border-cyan-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Particles Without Borders" className="h-12 w-auto" />
            <div className="hidden sm:block leading-tight">
              <div className="font-bold text-sm gradient-text">Particles Without Borders</div>
              <div className="text-[10px] text-muted-foreground tracking-wide uppercase">27 & 28 Sep 2027</div>
            </div>
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-emerald-50" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Call for Papers</div>
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-5">
            Share Your Research at <span className="gradient-text">Particles Without Borders 2027</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mb-6">
            We invite original research abstracts addressing air quality, particulate pollution, exposure assessment, environmental technologies, and sustainable health solutions.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Poster Figure */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-cyan-100 shadow-xl overflow-hidden sticky top-28">
              <div className="relative group overflow-hidden bg-slate-50">
                <img
                  src={posterUrl}
                  alt="Particles Without Borders 2027 - Call for Papers / Save The Date"
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <a
                  href={posterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold gap-2 backdrop-blur-sm"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  View Full Image
                </a>
              </div>
              <div className="p-6 bg-gradient-to-r from-cyan-50/60 to-emerald-50/60 border-t border-cyan-100 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-base text-foreground">Save the Date Poster</div>
                  <div className="text-xs text-muted-foreground">27 – 28 September 2027 · Putrajaya, Malaysia</div>
                </div>
                <a
                  href={posterUrl}
                  download="Particles-Without-Borders-2027-Call-For-Papers.jpg"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Themes & Submission Info */}
          <div className="lg:col-span-7 space-y-8">
            {/* Key Milestones Card */}
            <div className="bg-white rounded-3xl border border-cyan-100 shadow-sm p-6 sm:p-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Key Dates &amp; Deadlines
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {MILESTONES.map((m, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-cyan-50/40 border border-cyan-100">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{m.label}</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{m.date}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Conference Themes */}
            <div className="bg-white rounded-3xl border border-cyan-100 shadow-sm p-6 sm:p-8">
              <h2 className="text-xl font-bold mb-2">Conference Themes</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Authors are encouraged to submit abstracts under one of the following 5 scientific tracks:
              </p>
              <div className="space-y-4">
                {TOPICS.map((t, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl border border-cyan-100 hover:border-cyan-300 transition-all bg-slate-50/50 flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">{t.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submission Guidelines & Action */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-cyan-50 to-emerald-50 border border-cyan-200 shadow-sm">
              <h2 className="text-xl font-bold mb-3">Abstract Submission Guidelines</h2>
              <ul className="text-sm text-muted-foreground space-y-2 mb-6 list-disc list-inside">
                <li>Abstracts must be written in English (maximum 300 words).</li>
                <li>Include paper title, author name(s), affiliations, and 3–5 keywords.</li>
                <li>Accepted formats: PDF, DOC, or DOCX.</li>
                <li>Notification of acceptance will be issued by <strong>30 June 2027</strong>.</li>
              </ul>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/#registration"
                  className="px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-lg"
                >
                  Submit Abstract Online →
                </Link>
                <a
                  href="mailto:admin@particleswithoutborders.com?subject=Call%20for%20Papers%20Enquiry"
                  className="px-6 py-3.5 rounded-full border border-slate-300 text-slate-700 bg-white font-semibold hover:bg-slate-50 transition"
                >
                  Contact Secretariat
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-slate-900 via-cyan-950 to-emerald-950 text-white py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-cyan-200/70">
          © 2027 Particles Without Borders
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from "react";
import SEO from "@shared/components/SEO";
import logo from "@/assets/univ-logo.png";

const PRIMARY = "#6C47FF";
const ACCENT = "#A78BFA";

// ─── ICONS ────────────────────────────────────────────────────────────────────
type IconName =
  | "menu" | "close" | "arrow" | "check" | "cross" | "star"
  | "chevronL" | "chevronR" | "calendar" | "user" | "phone"
  | "building" | "book" | "brain" | "chart" | "doc" | "share"
  | "globe" | "mail" | "report" | "sparkle" | "lightbulb" | "pen";

function Icon({ name, size = 20, color = "currentColor" }: { name: IconName; size?: number; color?: string }) {
  const icons: Record<IconName, React.ReactElement> = {
    menu: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    arrow: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    cross: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    chevronL: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
    chevronR: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    user: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    phone: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2.18 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.91 7.91a16 16 0 0 0 6.72 6.72l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    building: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>,
    book: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    brain: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5V5a2 2 0 0 0 2 2h.5A2.5 2.5 0 0 1 17 9.5v0A2.5 2.5 0 0 1 14.5 12H14a2 2 0 0 0-2 2v.5A2.5 2.5 0 0 1 9.5 17v0A2.5 2.5 0 0 1 7 14.5V14a2 2 0 0 0-2-2h-.5A2.5 2.5 0 0 1 2 9.5v0A2.5 2.5 0 0 1 4.5 7H5a2 2 0 0 0 2-2v-.5A2.5 2.5 0 0 1 9.5 2z"/></svg>,
    chart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    doc: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    share: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
    globe: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    mail: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    report: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    sparkle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/></svg>,
    lightbulb: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>,
    pen: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  };
  return icons[name] ?? null;
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinks = ["Features", "How It Works", "Testimonials", "Contact"];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: scrolled ? "1px solid rgba(108,71,255,0.08)" : "1px solid transparent",
      transition: "all 0.3s ease",
      boxShadow: scrolled ? "0 2px 24px rgba(108,71,255,0.07)" : "none",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src={logo} alt="Univ.live" style={{ height: 38, width: "auto" }} />
        </a>

        {/* Desktop links */}
        <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {navLinks.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, color: "#3d3c47", textDecoration: "none", letterSpacing: "0.01em", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = PRIMARY)}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d3c47")}
            >{l}</a>
          ))}
          <a href="#interest-widget"
            style={{ padding: "9px 22px", background: PRIMARY, color: "#fff", borderRadius: 100, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14, textDecoration: "none", transition: "opacity 0.2s", boxShadow: `0 4px 16px ${PRIMARY}40` }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >Book a Demo</a>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(o => !o)}
          className="mobile-menu-btn"
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#0f0e17" }}>
          <Icon name={mobileOpen ? "close" : "menu"} size={24} />
        </button>
      </div>

      {mobileOpen && (
        <div style={{ background: "#fff", borderTop: "1px solid #f0eeff", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {navLinks.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: 16, fontWeight: 500, color: "#3d3c47", textDecoration: "none" }}
            >{l}</a>
          ))}
          <a href="#interest-widget" onClick={() => setMobileOpen(false)}
            style={{ padding: "12px 22px", background: PRIMARY, color: "#fff", borderRadius: 100, fontWeight: 600, fontSize: 15, textDecoration: "none", textAlign: "center" }}
          >Book a Demo</a>
        </div>
      )}
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  const tags = ["CUET", "JEE", "NEET", "UPSC", "CAT", "CBSE", "State Boards", "Any Exam"];
  const [activeTag, setActiveTag] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveTag(p => (p + 1) % tags.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 68, background: "linear-gradient(160deg, #faf9ff 0%, #f3f0ff 50%, #ede8ff 100%)" }}>
      <div className="hero-grid" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        {/* Left */}
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${PRIMARY}12`, border: `1px solid ${PRIMARY}28`, borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIMARY, boxShadow: `0 0 0 3px ${PRIMARY}30` }}></div>
            <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>For Coaching Institutes</span>
          </div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 58px)", fontWeight: 700, lineHeight: 1.12, color: "#0f0e17", marginBottom: 20, letterSpacing: "-1.5px" }}>
            Launch Your Own Institute<br />
            <span style={{ color: PRIMARY }}>Platform in Minutes</span>
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {tags.map((tag, i) => (
              <span key={tag} style={{
                padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif",
                background: activeTag === i ? PRIMARY : `${PRIMARY}0f`,
                color: activeTag === i ? "#fff" : PRIMARY,
                border: `1px solid ${activeTag === i ? PRIMARY : PRIMARY + "28"}`,
                transition: "all 0.4s ease",
              }}>{tag}</span>
            ))}
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#5a5970", marginBottom: 36, fontFamily: "'Inter', sans-serif", maxWidth: 480 }}>
            Univ.live empowers coaching institutes to run their own branded exam platform for any competitive exam with AI-powered tools, question banks, and real-time analytics.
          </p>
          <div className="hero-cta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="#interest-widget"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px", background: PRIMARY, color: "#fff", borderRadius: 100, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 15, textDecoration: "none", boxShadow: `0 8px 32px ${PRIMARY}45`, transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 12px 40px ${PRIMARY}55`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 8px 32px ${PRIMARY}45`; }}
            >
              Book a Demo <Icon name="arrow" size={16} />
            </a>
            <a href="#features"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px", background: "#fff", color: "#0f0e17", borderRadius: 100, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1.5px solid #e5e2f5", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = PRIMARY)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e2f5")}
            >
              Explore Features
            </a>
          </div>
          <div style={{ display: "flex", gap: 28, marginTop: 44, paddingTop: 32, borderTop: "1px solid #e5e2f5", flexWrap: "wrap" }}>
            {[["500+", "Institutes"], ["2L+", "Students"], ["10+", "Exams Supported"]].map(([num, label]) => (
              <div key={label}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 26, color: "#0f0e17", letterSpacing: "-1px" }}>{num}</div>
                <div style={{ fontSize: 13, color: "#8b8aa0", fontFamily: "'Inter', sans-serif", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Dashboard mockup */}
        <div className="hero-right" style={{ position: "relative" }}>
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 32px 80px rgba(108,71,255,0.18), 0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden", border: "1px solid rgba(108,71,255,0.1)" }}>
            <div style={{ background: PRIMARY, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }}></div>)}
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "rgba(255,255,255,0.85)", fontFamily: "monospace" }}>
                yourcoaching.univ.live
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "#0f0e17" }}>Dashboard</div>
                  <div style={{ fontSize: 11, color: "#8b8aa0" }}>Welcome back, Rahul Sir</div>
                </div>
                <div style={{ background: `${PRIMARY}12`, padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600, color: PRIMARY }}>● Live</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
                {[["1,240", "Students", "#6C47FF"], ["48", "Tests Live", "#22c55e"], ["94%", "Avg. Score", "#f59e0b"]].map(([val, lbl, clr]) => (
                  <div key={lbl} style={{ background: "#f8f7ff", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: clr }}>{val}</div>
                    <div style={{ fontSize: 10, color: "#8b8aa0", marginTop: 2 }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8b8aa0", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>Recent Tests</div>
                {[
                  { name: "Physics DPP #12", exam: "JEE", status: "Live", clr: "#22c55e" },
                  { name: "Polity Mock #5", exam: "UPSC", status: "Scheduled", clr: "#f59e0b" },
                  { name: "Quant Practice", exam: "CAT", status: "Completed", clr: "#8b8aa0" },
                ].map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < 2 ? "1px solid #ede8ff" : "none" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f0e17" }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: "#8b8aa0" }}>{t.exam}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: t.clr, background: t.clr + "18", padding: "3px 8px", borderRadius: 100 }}>{t.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Floating badges */}
          <div style={{ position: "absolute", top: -16, right: -20, background: "#fff", borderRadius: 14, padding: "10px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8, border: "1px solid #f0eeff" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkle" size={16} color="#22c55e" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f0e17" }}>AI Checking</div>
              <div style={{ fontSize: 10, color: "#8b8aa0" }}>Subjective papers</div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 20, left: -24, background: "#fff", borderRadius: 14, padding: "10px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8, border: "1px solid #f0eeff" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fdf4ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="chart" size={16} color={PRIMARY} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f0e17" }}>Live Analytics</div>
              <div style={{ fontSize: 10, color: "#8b8aa0" }}>Real-time insights</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    { icon: "book" as IconName, title: "Question Bank", desc: "Both subjective and objective question sets, organized by topic and difficulty level.", color: "#6C47FF" },
    { icon: "doc" as IconName, title: "Daily Practice Papers", desc: "Auto-generate DPPs based on topics selected by the teacher — personalized daily practice.", color: "#8B5CF6" },
    { icon: "lightbulb" as IconName, title: "Content Library", desc: "Curated short notes and study material shared directly with students.", color: "#EC4899" },
    { icon: "share" as IconName, title: "Notes Sharing", desc: "Teachers can share notes and resources with their entire batch instantly.", color: "#F59E0B" },
    { icon: "globe" as IconName, title: "Pan-India Test Series", desc: "Monthly all-India competitive test series to benchmark students nationally.", color: "#10B981" },
    { icon: "mail" as IconName, title: "Monthly Parent Reports", desc: "Automated performance reports sent to parents every month — no manual effort.", color: "#3B82F6" },
    { icon: "pen" as IconName, title: "AI Subjective Checking", desc: "AI evaluates written answers with feedback, saving teachers hours of work.", color: "#6C47FF" },
    { icon: "sparkle" as IconName, title: "Personalised Test Papers", desc: "AI generates unique test papers per student based on their weak areas.", color: "#EC4899" },
    { icon: "brain" as IconName, title: "AI Doubt Support", desc: "24/7 AI-powered doubt resolution so students never get stuck.", color: "#F59E0B" },
    { icon: "chart" as IconName, title: "AI-Based Analytics", desc: "Deep performance insights — question-wise accuracy, time analysis, and weak area identification.", color: "#10B981" },
  ];
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="features" style={{ padding: "100px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ display: "inline-flex", background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}20`, borderRadius: 100, padding: "5px 16px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.06em", textTransform: "uppercase" }}>Platform Features</span>
          </div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", color: "#0f0e17", letterSpacing: "-1px", lineHeight: 1.15, marginBottom: 16 }}>
            Everything Your Coaching<br />Institute Needs
          </h2>
          <p style={{ fontSize: 16, color: "#5a5970", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            From question banks to AI-powered analytics — one platform to run your entire academic operation.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
          {features.map((f, i) => (
            <div key={i}
              className="feature-card"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: "calc(25% - 15px)", minWidth: 220, maxWidth: 320, flexGrow: 0,
                background: hovered === i ? `${f.color}06` : "#faf9ff",
                border: `1.5px solid ${hovered === i ? f.color + "30" : "#f0eeff"}`,
                borderRadius: 16, padding: "24px", cursor: "default",
                transition: "all 0.25s ease",
                transform: hovered === i ? "translateY(-3px)" : "none",
                boxShadow: hovered === i ? `0 12px 40px ${f.color}18` : "none",
              }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.color}14`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon name={f.icon} size={20} color={f.color} />
              </div>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "#0f0e17", marginBottom: 8, letterSpacing: "-0.3px" }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: "#6b6a7e", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      num: "01", title: "Tell Us About Your Institute",
      sub: "Share basic details — your coaching name, exam focus, and student count.",
      visual: (
        <div style={{ padding: 16 }}>
          <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: "#8b8aa0", marginBottom: 10, fontWeight: 600 }}>Institute Setup</div>
            {["Institute Name", "Exam Category", "No. of Students"].map((lbl, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#8b8aa0", marginBottom: 3 }}>{lbl}</div>
                <div style={{ background: "#fff", border: "1px solid #e5e2f5", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#0f0e17" }}>
                  {["Bright Future Academy", "JEE / NEET / CUET", "1,200+"][i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      num: "02", title: "We Set Up Your Platform",
      sub: "Our team configures your branded portal within 24 hours — no tech knowledge needed.",
      visual: (
        <div style={{ padding: 16 }}>
          <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: "#8b8aa0", marginBottom: 10, fontWeight: 600 }}>Platform Setup</div>
            {[
              { label: "Domain configured", done: true },
              { label: "Branding applied", done: true },
              { label: "Question bank seeded", done: true },
              { label: "Teacher accounts ready", done: false },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: item.done ? "#22c55e" : "#e5e2f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.done && <Icon name="check" size={10} color="#fff" />}
                </div>
                <span style={{ fontSize: 12, color: item.done ? "#0f0e17" : "#8b8aa0" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      num: "03", title: "Teachers Add Content",
      sub: "Upload questions, create DPPs, share notes, and schedule tests — all from one dashboard.",
      visual: (
        <div style={{ padding: 16 }}>
          <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: "#8b8aa0", marginBottom: 10, fontWeight: 600 }}>Teacher Dashboard</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["📚", "Question Bank"], ["📝", "Create DPP"], ["📄", "Share Notes"], ["📊", "View Analytics"]].map(([emoji, label]) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #e5e2f5", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#0f0e17", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{emoji}</span><span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      num: "04", title: "Students Learn & Grow",
      sub: "Students get personalised tests, AI doubt support, and monthly reports automatically.",
      visual: (
        <div style={{ padding: 16 }}>
          <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#8b8aa0", fontWeight: 600 }}>Student Progress</div>
              <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>↑ 18%</div>
            </div>
            {[["Physics", 82], ["Math", 74], ["Chemistry", 91]].map(([sub, pct]) => (
              <div key={sub} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8b8aa0", marginBottom: 4 }}><span>{sub}</span><span>{pct}%</span></div>
                <div style={{ background: "#e5e2f5", borderRadius: 100, height: 5 }}>
                  <div style={{ width: `${pct}%`, background: PRIMARY, borderRadius: 100, height: "100%" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="how-it-works" style={{ padding: "100px 24px", background: "linear-gradient(180deg, #f8f7ff 0%, #fff 100%)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ display: "inline-flex", background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}20`, borderRadius: 100, padding: "5px 16px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.06em", textTransform: "uppercase" }}>How It Works</span>
          </div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", color: "#0f0e17", letterSpacing: "-1px", lineHeight: 1.15, marginBottom: 16 }}>
            From Enquiry to Live<br />Platform in 48 Hours
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0eeff", overflow: "hidden", boxShadow: "0 4px 24px rgba(108,71,255,0.06)" }}>
              <div style={{ padding: "20px 20px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{s.num}</div>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "#0f0e17", letterSpacing: "-0.3px", lineHeight: 1.3 }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: 13, color: "#6b6a7e", lineHeight: 1.65, marginBottom: 12 }}>{s.sub}</p>
              </div>
              {s.visual}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── COMPARISON ───────────────────────────────────────────────────────────────
function ComparisonSection() {
  const rows = [
    { feature: "Test Delivery", old: "Physical OMR sheets", univ: "Digital CBT — any device" },
    { feature: "Paper Checking", old: "Manual — hours of effort", univ: "AI-automated in seconds" },
    { feature: "Exam Coverage", old: "Single exam focus", univ: "Any exam — JEE, NEET, CUET, UPSC…" },
    { feature: "Question Types", old: "MCQ only", univ: "Subjective + Objective" },
    { feature: "Student Analytics", old: "Not available", univ: "AI-powered deep analytics" },
    { feature: "Doubt Support", old: "Limited to class hours", univ: "24/7 AI Doubt Support" },
    { feature: "Parent Reports", old: "Manual effort", univ: "Auto-sent every month" },
    { feature: "Test Papers", old: "Same paper for all", univ: "AI-personalised per student" },
    { feature: "Notes & Content", old: "WhatsApp / printouts", univ: "Centralised content library" },
  ];

  return (
    <section id="comparison" style={{ padding: "100px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}20`, borderRadius: 100, padding: "5px 16px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.06em", textTransform: "uppercase" }}>Why Switch</span>
          </div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", color: "#0f0e17", letterSpacing: "-1px", lineHeight: 1.15 }}>
            Traditional vs Univ.live
          </h2>
        </div>
        <div style={{ borderRadius: 20, overflow: "hidden", border: "1.5px solid #f0eeff", boxShadow: "0 8px 48px rgba(108,71,255,0.08)" }}>
          <div className="comparison-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr", background: "#faf9ff" }}>
            <div className="comparison-cell" style={{ padding: "16px 24px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: "#8b8aa0" }}>Feature</div>
            <div className="comparison-cell" style={{ padding: "16px 24px", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "#ef4444", borderLeft: "1px solid #f0eeff", textAlign: "center" }}>Traditional Method</div>
            <div className="comparison-cell" style={{ padding: "16px 24px", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, color: PRIMARY, borderLeft: "1px solid #f0eeff", textAlign: "center", background: `${PRIMARY}06` }}>Univ.live Platform</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="comparison-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr", borderTop: "1px solid #f0eeff", background: i % 2 === 0 ? "#fff" : "#fdf9ff" }}>
              <div className="comparison-cell" style={{ padding: "14px 24px", fontSize: 14, color: "#0f0e17", fontWeight: 500 }}>{r.feature}</div>
              <div className="comparison-cell" style={{ padding: "14px 24px", fontSize: 13, color: "#ef4444", borderLeft: "1px solid #f0eeff", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="cross" size={14} color="#ef4444" />{r.old}
              </div>
              <div className="comparison-cell" style={{ padding: "14px 24px", fontSize: 13, color: "#16a34a", borderLeft: "1px solid #f0eeff", display: "flex", alignItems: "center", gap: 8, background: `${PRIMARY}04` }}>
                <Icon name="check" size={14} color="#16a34a" />{r.univ}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    { name: "Rajesh Sharma", role: "Director, Pinnacle Academy", initials: "RS", text: "Univ.live transformed how we run our JEE test series. The AI analytics helped our top students improve their weak subjects by 30% in just 2 months.", rating: 5 },
    { name: "Priya Menon", role: "Founder, NEET Guru Institute", initials: "PM", text: "We shifted from OMR sheets to Univ.live and saved ₹8,000/month in paper costs alone. The parent report feature has increased trust dramatically.", rating: 5 },
    { name: "Arvind Khanna", role: "Centre Head, Career Catalyst", initials: "AK", text: "The personalised test papers are a game-changer. Each student gets targeted practice, and our results have improved across all batches this year.", rating: 5 },
    { name: "Sunita Patel", role: "Teacher, Excel Coaching", initials: "SP", text: "AI doubt support means I don't have to answer WhatsApp messages at midnight anymore. Students get instant answers and I get my life back!", rating: 5 },
  ];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive(p => (p + 1) % testimonials.length), 4000);
    return () => clearInterval(t);
  }, [paused, testimonials.length]);

  return (
    <section id="testimonials" style={{ padding: "100px 24px", background: "linear-gradient(180deg, #f8f7ff 0%, #fff 100%)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}20`, borderRadius: 100, padding: "5px 16px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.06em", textTransform: "uppercase" }}>Testimonials</span>
          </div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", color: "#0f0e17", letterSpacing: "-1px", lineHeight: 1.15 }}>
            What Coaching Centers<br />Say About <span style={{ color: PRIMARY }}>Univ.live</span>
          </h2>
        </div>
        <div className="testimonial-card" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ background: "#fff", borderRadius: 24, padding: "40px 48px", border: "1.5px solid #f0eeff", boxShadow: "0 8px 48px rgba(108,71,255,0.08)", marginBottom: 32, position: "relative" }}>
          <div style={{ position: "absolute", top: 28, right: 36, fontFamily: "Georgia, serif", fontSize: 80, color: `${PRIMARY}14`, lineHeight: 1, userSelect: "none" }}>"</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{testimonials[active].initials}</div>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "#0f0e17" }}>{testimonials[active].name}</div>
              <div style={{ fontSize: 13, color: "#8b8aa0" }}>{testimonials[active].role}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
            {[...Array(5)].map((_, i) => <Icon key={i} name="star" size={16} color="#F59E0B" />)}
          </div>
          <p style={{ fontSize: 16, color: "#3d3c47", lineHeight: 1.75, fontStyle: "italic" }}>"{testimonials[active].text}"</p>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }}>
          <button onClick={() => setActive((active - 1 + testimonials.length) % testimonials.length)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid #e5e2f5", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.background = `${PRIMARY}10`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e2f5"; e.currentTarget.style.background = "#fff"; }}>
            <Icon name="chevronL" size={18} color="#3d3c47" />
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setActive(i)}
                style={{ width: i === active ? 28 : 8, height: 8, borderRadius: 100, background: i === active ? PRIMARY : "#e5e2f5", border: "none", cursor: "pointer", transition: "all 0.3s ease" }}>
              </button>
            ))}
          </div>
          <button onClick={() => setActive((active + 1) % testimonials.length)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid #e5e2f5", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.background = `${PRIMARY}10`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e2f5"; e.currentTarget.style.background = "#fff"; }}>
            <Icon name="chevronR" size={18} color="#3d3c47" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── INTEREST WIDGET ──────────────────────────────────────────────────────────
type FormState = { name: string; coaching: string; phone: string; email: string; exam: string; date: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

function InterestWidgetSection() {
  const [form, setForm] = useState<FormState>({ name: "", coaching: "", phone: "", email: "", exam: "", date: "" });
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const exams = ["JEE (Main + Advanced)", "NEET", "CUET", "UPSC / Civil Services", "CAT / MBA", "State Board Exams", "CA Foundation", "Other"];

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.coaching.trim()) e.coaching = "Required";
    if (!form.phone.trim() || !/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Enter valid 10-digit mobile";
    if (!form.exam) e.exam = "Please select";
    return e;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setStep(2); }, 1200);
  };

  const inputStyle = (key: keyof FormState): React.CSSProperties => ({
    width: "100%", padding: "12px 14px", border: `1.5px solid ${errors[key] ? "#ef4444" : "#e5e2f5"}`,
    borderRadius: 10, fontSize: 14, fontFamily: "'Inter', sans-serif", color: "#0f0e17",
    background: "#fff", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#3d3c47", marginBottom: 6, display: "block", fontFamily: "'Inter', sans-serif" };

  return (
    <section id="interest-widget" style={{ padding: "100px 24px", background: "#0f0e17" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="widget-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", background: `${PRIMARY}25`, border: `1px solid ${PRIMARY}40`, borderRadius: 100, padding: "5px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT, letterSpacing: "0.06em", textTransform: "uppercase" }}>Get Started</span>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "clamp(28px,3.5vw,42px)", color: "#fff", letterSpacing: "-1px", lineHeight: 1.15, marginBottom: 20 }}>
              Ready to transform your coaching institute?
            </h2>
            <p style={{ fontSize: 15, color: "#9b9aae", lineHeight: 1.75, marginBottom: 36 }}>
              Schedule a personalised demo with our team. We'll show you exactly how Univ.live can work for your institute and exam category.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {["Personalised walkthrough of all features", "Platform configured for your exam type", "Live Q&A with our academic team", "No commitment required"].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${PRIMARY}30`, border: `1px solid ${PRIMARY}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Icon name="check" size={11} color={ACCENT} />
                  </div>
                  <span style={{ fontSize: 14, color: "#c4c3d4", lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right form */}
          <div style={{ background: "#fff", borderRadius: 24, padding: "36px 32px", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
            {step === 1 ? (
              <>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: "#0f0e17", marginBottom: 6 }}>Show Your Interest</h3>
                <p style={{ fontSize: 13, color: "#8b8aa0", marginBottom: 28 }}>Fill in your details and we'll reach out to schedule your demo.</p>
                <form onSubmit={submit}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Your Name <span style={{ color: "#ef4444" }}>*</span></label>
                      <input style={inputStyle("name")} placeholder="Rahul Gupta" value={form.name}
                        onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: "" })); }}
                        onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = errors.name ? "#ef4444" : "#e5e2f5")} />
                      {errors.name && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.name}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Coaching Name <span style={{ color: "#ef4444" }}>*</span></label>
                      <input style={inputStyle("coaching")} placeholder="Bright Future Academy" value={form.coaching}
                        onChange={e => { setForm(p => ({ ...p, coaching: e.target.value })); setErrors(p => ({ ...p, coaching: "" })); }}
                        onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = errors.coaching ? "#ef4444" : "#e5e2f5")} />
                      {errors.coaching && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.coaching}</div>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Mobile Number <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={inputStyle("phone")} placeholder="9876543210" value={form.phone} type="tel"
                      onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setErrors(p => ({ ...p, phone: "" })); }}
                      onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = errors.phone ? "#ef4444" : "#e5e2f5")} />
                    {errors.phone && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.phone}</div>}
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Email (optional)</label>
                    <input style={inputStyle("email")} placeholder="rahul@brightfuture.in" value={form.email} type="email"
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = "#e5e2f5")} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Exam Focus <span style={{ color: "#ef4444" }}>*</span></label>
                    <select style={{ ...inputStyle("exam"), appearance: "none", cursor: "pointer" }} value={form.exam}
                      onChange={e => { setForm(p => ({ ...p, exam: e.target.value })); setErrors(p => ({ ...p, exam: "" })); }}
                      onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = errors.exam ? "#ef4444" : "#e5e2f5")}>
                      <option value="">Select your primary exam</option>
                      {exams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                    {errors.exam && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.exam}</div>}
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>Preferred Demo Date (optional)</label>
                    <input style={inputStyle("date")} type="date" value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = "#e5e2f5")} />
                  </div>
                  <button type="submit"
                    style={{ width: "100%", padding: "14px", background: submitting ? `${PRIMARY}88` : PRIMARY, color: "#fff", border: "none", borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 8px 24px ${PRIMARY}40`, transition: "opacity 0.2s" }}
                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.opacity = "0.9"; }}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                    {submitting ? (
                      <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>Submitting…</>
                    ) : (
                      <><Icon name="calendar" size={16} /> Schedule My Demo</>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <Icon name="check" size={32} color="#22c55e" />
                </div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: "#0f0e17", marginBottom: 10 }}>We've received your interest!</h3>
                <p style={{ fontSize: 14, color: "#6b6a7e", lineHeight: 1.65, marginBottom: 28 }}>
                  Thank you, <strong>{form.name}</strong>! Our team will reach out to <strong>{form.coaching}</strong> within 24 hours to schedule your personalised demo.
                </p>
                <div style={{ background: "#f8f7ff", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8b8aa0", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Details</div>
                  {(["name", "coaching", "phone", "exam"] as const).filter(k => form[k]).map(k => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: "#8b8aa0", textTransform: "capitalize" }}>{k === "coaching" ? "Coaching" : k.charAt(0).toUpperCase() + k.slice(1)}</span>
                      <span style={{ color: "#0f0e17", fontWeight: 500 }}>{form[k]}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setStep(1); setForm({ name: "", coaching: "", phone: "", email: "", exam: "", date: "" }); }}
                  style={{ fontSize: 13, color: PRIMARY, background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", textDecoration: "underline" }}>
                  Submit another response
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer id="contact" style={{ background: "#0a0917", padding: "48px 24px 32px", borderTop: "1px solid #1a1830" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24, marginBottom: 36 }}>
          <div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff", letterSpacing: "-0.5px" }}>
              univ<span style={{ color: PRIMARY }}>.</span>live
            </span>
            <p style={{ fontSize: 13, color: "#5a5970", marginTop: 8, maxWidth: 300 }}>Empowering coaching institutes across India with intelligent test platforms.</p>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {["Features", "How It Works", "Testimonials", "Contact"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}
                style={{ fontSize: 14, color: "#5a5970", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "#5a5970")}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 32 }}>
          <a href="mailto:support@univ.live" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#9b9aae", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "#9b9aae")}>
            <Icon name="mail" size={15} color={PRIMARY} />
            support@univ.live
          </a>
          <a href="tel:+918319937769" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#9b9aae", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "#9b9aae")}>
            <Icon name="phone" size={15} color={PRIMARY} />
            +91 831 993 7769
          </a>
        </div>
        <div style={{ borderTop: "1px solid #1a1830", paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontSize: 12, color: "#3d3c4a" }}>© {new Date().getFullYear()} Univ.live. All rights reserved.</span>
          <span style={{ fontSize: 12, color: "#3d3c4a" }}>Made for India's coaching institutes 🇮🇳</span>
        </div>
      </div>
    </footer>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function Index() {
  return (
    <>
      <SEO
        title="Univ.live — AI Test Series Platform for Coaching Institutes | JEE, NEET, CUET & More"
        description="Launch your AI-powered test series platform in minutes. Univ.live supports JEE, NEET, CUET, CBSE, State Board and all exam types — objective & subjective. Built for coaching institutes."
        canonical="https://univlive.tech/"
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Inter:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hero-right { display: none !important; }
          .widget-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (max-width: 1024px) {
          .feature-card { width: calc(50% - 10px) !important; }
        }
        @media (max-width: 600px) {
          .feature-card { width: 100% !important; }
          .hero-cta { flex-direction: column !important; }
          .hero-cta a { width: 100% !important; justify-content: center !important; }
          .comparison-grid { grid-template-columns: 1.5fr 1fr 1fr !important; font-size: 12px !important; }
          .comparison-cell { padding: 10px 10px !important; font-size: 12px !important; }
          .testimonial-card { padding: 28px 22px !important; }
        }
      `}</style>
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ComparisonSection />
      <TestimonialsSection />
      <InterestWidgetSection />
      <LandingFooter />
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { Monitor, Smartphone, ArrowLeft, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────
type ThemeKey = "indigo" | "emerald" | "crimson" | "slate" | "amber" | "violet";

interface Theme {
  primary: string; secondary: string; accent: string;
  bg: string; text: string; surface: string;
}

interface Section { id: string; type: string; data: Record<string, any>; }

interface ComponentProps {
  data: Record<string, any>; theme: Theme; selected: boolean; onClick: () => void;
}

interface EditorField {
  key: string; label: string; type: "text" | "textarea" | "select"; options?: string[];
}

// ── Theme Presets ────────────────────────────────────────────
const THEME_PRESETS: Record<ThemeKey, Theme> = {
  indigo:  { primary: "#4f46e5", secondary: "#818cf8", accent: "#f59e0b", bg: "#f8f8ff", text: "#1e1b4b", surface: "#fff" },
  emerald: { primary: "#059669", secondary: "#34d399", accent: "#f59e0b", bg: "#f0fdf4", text: "#064e3b", surface: "#fff" },
  crimson: { primary: "#dc2626", secondary: "#f87171", accent: "#f59e0b", bg: "#fff8f8", text: "#7f1d1d", surface: "#fff" },
  slate:   { primary: "#0f172a", secondary: "#475569", accent: "#3b82f6", bg: "#f8fafc", text: "#0f172a", surface: "#fff" },
  amber:   { primary: "#b45309", secondary: "#f59e0b", accent: "#0369a1", bg: "#fffbeb", text: "#78350f", surface: "#fff" },
  violet:  { primary: "#7c3aed", secondary: "#a78bfa", accent: "#ec4899", bg: "#faf5ff", text: "#3b0764", surface: "#fff" },
};

// ── Editor Fields ────────────────────────────────────────────
const EDITOR_FIELDS: Record<string, EditorField[]> = {
  hero: [
    { key: "variant", label: "Layout", type: "select", options: ["centered", "split"] },
    { key: "badge", label: "Badge Text", type: "text" },
    { key: "headline", label: "Headline", type: "textarea" },
    { key: "subtext", label: "Sub-text", type: "textarea" },
    { key: "cta1", label: "Primary CTA", type: "text" },
    { key: "cta2", label: "Secondary CTA", type: "text" },
  ],
  courses:      [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  faculty:      [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  results:      [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  testimonials: [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  gallery:      [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  faq:          [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  announcement: [
    { key: "label", label: "Label", type: "text" },
    { key: "text", label: "Announcement Text", type: "textarea" },
    { key: "cta", label: "Button Text", type: "text" },
  ],
  pricing:  [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  video:    [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  contact:  [
    { key: "eyebrow", label: "Eyebrow Text", type: "text" },
    { key: "title", label: "Section Title", type: "text" },
    { key: "phone", label: "Phone Number", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "address", label: "Address", type: "text" },
  ],
  batches:   [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  trust:     [],
  app:       [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }, { key: "desc", label: "Description", type: "textarea" }],
  about:     [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }, { key: "desc", label: "Description", type: "textarea" }],
  live:      [{ key: "title", label: "Class Title", type: "text" }, { key: "subject", label: "Subject", type: "text" }, { key: "viewers", label: "Viewers Count", type: "text" }],
  stats:     [{ key: "title", label: "Section Title", type: "text" }],
  blog:      [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Section Title", type: "text" }],
  countdown: [{ key: "eyebrow", label: "Eyebrow Text", type: "text" }, { key: "title", label: "Timer Title", type: "text" }, { key: "cta", label: "Button Text", type: "text" }],
  footer:    [{ key: "name", label: "Institute Name", type: "text" }, { key: "tagline", label: "Tagline", type: "textarea" }],
};

// ── 20 Website Components ────────────────────────────────────

function HeroComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const variant = data.variant || "centered";
  const s: Record<string, React.CSSProperties> = {
    wrapper: { position: "relative", background: `linear-gradient(135deg, ${t.primary}ee 0%, ${t.primary}aa 60%, ${t.secondary}55 100%)`, padding: variant === "centered" ? "80px 40px" : "60px 40px", display: "flex", flexDirection: variant === "split" ? "row" : "column", alignItems: "center", gap: 40, cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3, overflow: "hidden", minHeight: 360 },
    badge: { display: "inline-block", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 16 },
    headline: { fontSize: variant === "centered" ? 48 : 40, fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 16, textAlign: variant === "centered" ? "center" : "left" },
    sub: { fontSize: 18, color: "rgba(255,255,255,0.85)", marginBottom: 32, maxWidth: 560, textAlign: variant === "centered" ? "center" : "left", lineHeight: 1.6 },
    ctaRow: { display: "flex", gap: 12, justifyContent: variant === "centered" ? "center" : "flex-start", flexWrap: "wrap" },
    primaryBtn: { background: "#fff", color: t.primary, border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
    secondaryBtn: { background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.5)", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
    statsRow: { display: "flex", gap: 32, marginTop: 40, justifyContent: variant === "centered" ? "center" : "flex-start" },
    imagePlaceholder: { width: 280, height: 220, background: "rgba(255,255,255,0.1)", borderRadius: 16, border: "2px dashed rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 12, flexShrink: 0 },
    decor1: { position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" },
    decor2: { position: "absolute", bottom: -80, left: -40, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" },
  };
  return (
    <div style={s.wrapper} onClick={onClick}>
      <div style={s.decor1} /><div style={s.decor2} />
      {variant === "centered" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
          <span style={s.badge}>{data.badge || "🎯 India's #1 Coaching Platform"}</span>
          <div style={s.headline}>{data.headline || "Crack IIT-JEE & NEET with Expert Guidance"}</div>
          <div style={s.sub}>{data.subtext || "Join 50,000+ students who cracked their dream exam with our proven methodology."}</div>
          <div style={s.ctaRow}><button style={s.primaryBtn}>{data.cta1 || "Start Free Trial"}</button><button style={s.secondaryBtn}>{data.cta2 || "Watch Demo"}</button></div>
          <div style={s.statsRow}>{(data.stats || [{ num: "50K+", label: "Students" }, { num: "98%", label: "Success Rate" }, { num: "15+", label: "Years" }]).map((st: any, i: number) => (<div key={i} style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{st.num}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{st.label}</div></div>))}</div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, zIndex: 1 }}>
            <span style={s.badge}>{data.badge || "🎯 Top Ranked Institute"}</span>
            <div style={s.headline}>{data.headline || "Your Dream Rank Starts Here"}</div>
            <div style={s.sub}>{data.subtext || "Expert faculty, AI tools, and a proven system to help you succeed."}</div>
            <div style={s.ctaRow}><button style={s.primaryBtn}>{data.cta1 || "Enroll Now"}</button><button style={s.secondaryBtn}>{data.cta2 || "View Courses"}</button></div>
          </div>
          <div style={s.imagePlaceholder}>hero image</div>
        </>
      )}
    </div>
  );
}

function CourseCatalogComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const courses = data.courses || [{ name: "JEE Main & Advanced", tag: "Engineering", students: "2400", duration: "2 Years", price: "₹45,000" }, { name: "NEET Foundation", tag: "Medical", students: "1800", duration: "1 Year", price: "₹38,000" }, { name: "Class 10 Board Prep", tag: "School", students: "3200", duration: "1 Year", price: "₹22,000" }];
  return (
    <div onClick={onClick} style={{ background: t.bg, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Our Programs"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "Courses Designed to Get You Results"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {courses.map((c: any, i: number) => (
          <div key={i} style={{ background: t.surface, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(0,0,0,0.06)", border: `1px solid ${t.primary}15` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.primary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{c.tag}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 12 }}>{c.name}</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}><span style={{ fontSize: 12, color: "#666" }}>👤 {c.students}</span><span style={{ fontSize: 12, color: "#666" }}>🕐 {c.duration}</span></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 20, fontWeight: 800, color: t.primary }}>{c.price}</span><button style={{ background: t.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Enroll</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FacultyComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const faculty = data.faculty || [{ name: "Dr. Rajesh Kumar", subject: "Physics", exp: "15 yrs", tag: "IIT Delhi Alumni" }, { name: "Priya Sharma", subject: "Chemistry", exp: "12 yrs", tag: "AIIMS Topper" }, { name: "Amit Verma", subject: "Mathematics", exp: "18 yrs", tag: "IIT Bombay Alumni" }];
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Expert Faculty"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "Learn from the Best in the Country"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
        {faculty.map((f: any, i: number) => (
          <div key={i} style={{ textAlign: "center", padding: 24, background: t.bg, borderRadius: 20, border: `1px solid ${t.primary}10` }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${t.primary}33, ${t.secondary}33)`, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${t.primary}30`, fontSize: 10, color: t.primary }}>photo</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>{f.name}</div>
            <div style={{ fontSize: 13, color: t.primary, fontWeight: 600, marginBottom: 8 }}>{f.subject}</div>
            <div style={{ fontSize: 12, background: `${t.primary}10`, color: t.primary, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>{f.tag}</div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{f.exp} experience</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const results = data.results || [{ name: "Arjun Singh", rank: "AIR 47", exam: "JEE Advanced 2024", tag: "IIT Bombay" }, { name: "Sneha Patel", rank: "AIR 12", exam: "NEET 2024", tag: "AIIMS Delhi" }];
  const stats = data.stats || [{ num: "127", label: "IIT Selections 2024" }, { num: "89", label: "NEET Selections 2024" }, { num: "98%", label: "Board Toppers" }, { num: "15+", label: "Years of Excellence" }];
  return (
    <div onClick={onClick} style={{ background: `linear-gradient(135deg, ${t.primary} 0%, ${t.text} 100%)`, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.secondary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Our Results"}</div><div style={{ fontSize: 34, fontWeight: 800, color: "#fff" }}>{data.title || "Proven Track Record of Excellence"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 48, textAlign: "center" }}>{stats.map((s: any, i: number) => (<div key={i} style={{ padding: 20, background: "rgba(255,255,255,0.08)", borderRadius: 16 }}><div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{s.num}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{s.label}</div></div>))}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>{results.map((r: any, i: number) => (<div key={i} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.15)", textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: t.secondary }}>{r.rank}</div><div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 4 }}>{r.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{r.exam}</div><div style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 20, padding: "2px 10px", display: "inline-block", marginTop: 8 }}>{r.tag}</div></div>))}</div>
    </div>
  );
}

function TestimonialsComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const reviews = data.reviews || [{ name: "Priya M.", role: "IIT Delhi, CS 2024", text: "The faculty here is exceptional. Got AIR 234!" }, { name: "Karan S.", role: "AIIMS Delhi, MBBS 2024", text: "Best coaching for NEET. The test series were game changers." }, { name: "Ananya R.", role: "Class 12, Batch 2025", text: "The AI doubt chatbot saved me so many hours during exams." }];
  return (
    <div onClick={onClick} style={{ background: t.bg, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Student Stories"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "What Our Students Say"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
        {reviews.map((r: any, i: number) => (
          <div key={i} style={{ background: t.surface, borderRadius: 20, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${t.primary}10`, position: "relative" }}>
            <div style={{ fontSize: 40, color: t.primary, opacity: 0.2, lineHeight: 1, marginBottom: 12 }}>"</div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>{r.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: "50%", background: `${t.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: t.primary }}>photo</div><div><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{r.name}</div><div style={{ fontSize: 12, color: t.primary }}>{r.role}</div></div></div>
            <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 2 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 12, color: t.accent }}>★</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GalleryComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const items = data.items || [{ caption: "Annual Result Celebration" }, { caption: "Lab Sessions" }, { caption: "Faculty Workshop" }, { caption: "Online Class Setup" }, { caption: "Award Ceremony" }, { caption: "Student Orientation" }];
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Campus Life"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "Life at Our Institute"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {items.map((item: any, i: number) => (<div key={i} style={{ borderRadius: 12, aspectRatio: "4/3", background: `repeating-linear-gradient(45deg, ${t.primary}08, ${t.primary}08 10px, ${t.primary}04 10px, ${t.primary}04 20px)`, border: `1px dashed ${t.primary}30`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}><div style={{ fontSize: 10, color: t.primary, opacity: 0.5 }}>photo</div><div style={{ fontSize: 11, color: t.text, opacity: 0.6 }}>{item.caption}</div></div>))}
      </div>
    </div>
  );
}

function FAQComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const faqs = data.faqs || [{ q: "What is the batch size?", a: "We maintain small batch sizes of 30-40 students for personalized attention." }, { q: "Do you offer online classes?", a: "Yes! Both live online and recorded sessions available." }, { q: "What is your fee structure?", a: "Fee varies by course. EMI options and scholarships available." }, { q: "Is there doubt clearing?", a: "Daily doubt sessions, AI chatbot 24/7, and dedicated faculty hours." }];
  return (
    <div onClick={onClick} style={{ background: t.bg, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "FAQ"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "Frequently Asked Questions"}</div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map((faq: any, i: number) => (
            <div key={i} style={{ background: t.surface, borderRadius: 14, border: `1px solid ${openIdx === i ? t.primary : t.primary + "15"}`, overflow: "hidden" }} onClick={e => { e.stopPropagation(); setOpenIdx(openIdx === i ? null : i); }}>
              <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}><span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{faq.q}</span><span style={{ fontSize: 20, color: t.primary, transform: openIdx === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span></div>
              {openIdx === i && <div style={{ padding: "0 24px 18px", fontSize: 14, color: "#666", lineHeight: 1.7 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnouncementComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  return (
    <div onClick={onClick} style={{ background: `${t.primary}10`, borderLeft: `4px solid ${t.primary}`, padding: "16px 40px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <span style={{ fontSize: 20 }}>📢</span>
      <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 700, color: t.primary, marginRight: 8 }}>{data.label || "New Batch Starting:"}</span><span style={{ fontSize: 13, color: t.text }}>{data.text || "JEE 2026 Dropper Batch begins June 1st. Limited seats available."}</span></div>
      <button style={{ background: t.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{data.cta || "Register Now"}</button>
    </div>
  );
}

function PricingComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const plans = data.plans || [{ name: "Foundation", price: "₹15,000", period: "/year", features: ["Live Classes", "Recorded Lectures", "Test Series"], popular: false }, { name: "Pro", price: "₹35,000", period: "/year", features: ["Everything in Foundation", "AI Doubt Bot", "Mentorship", "Mock Tests"], popular: true }, { name: "Elite", price: "₹65,000", period: "/year", features: ["Everything in Pro", "1-on-1 Sessions", "Rank Predictor"], popular: false }];
  return (
    <div onClick={onClick} style={{ background: t.bg, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Pricing"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "Simple, Transparent Pricing"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, maxWidth: 860, margin: "0 auto" }}>
        {plans.map((p: any, i: number) => (
          <div key={i} style={{ background: p.popular ? t.primary : t.surface, borderRadius: 20, padding: 28, position: "relative", boxShadow: p.popular ? `0 12px 40px ${t.primary}40` : "0 2px 16px rgba(0,0,0,0.06)", border: p.popular ? "none" : `1px solid ${t.primary}10`, transform: p.popular ? "scale(1.04)" : "none" }}>
            {p.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: t.accent, color: "#fff", borderRadius: 20, padding: "4px 16px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Most Popular</div>}
            <div style={{ fontSize: 16, fontWeight: 700, color: p.popular ? "rgba(255,255,255,0.8)" : t.primary, marginBottom: 8 }}>{p.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}><span style={{ fontSize: 36, fontWeight: 800, color: p.popular ? "#fff" : t.text }}>{p.price}</span><span style={{ fontSize: 13, color: p.popular ? "rgba(255,255,255,0.6)" : "#999" }}>{p.period}</span></div>
            {p.features.map((f: string, fi: number) => (<div key={fi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span style={{ color: p.popular ? "rgba(255,255,255,0.7)" : t.primary, fontSize: 14 }}>✓</span><span style={{ fontSize: 13, color: p.popular ? "rgba(255,255,255,0.85)" : "#555" }}>{f}</span></div>))}
            <button style={{ width: "100%", marginTop: 24, padding: 12, borderRadius: 10, border: p.popular ? "2px solid rgba(255,255,255,0.4)" : `2px solid ${t.primary}`, background: p.popular ? "rgba(255,255,255,0.1)" : "transparent", color: p.popular ? "#fff" : t.primary, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Get Started</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Watch & Learn"}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: t.text, marginBottom: 32 }}>{data.title || "See How We Transform Students"}</div>
        <div style={{ borderRadius: 20, background: `repeating-linear-gradient(45deg, ${t.primary}08, ${t.primary}08 10px, ${t.primary}04 10px, ${t.primary}04 20px)`, border: `2px dashed ${t.primary}30`, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: t.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 32px ${t.primary}60` }}><div style={{ width: 0, height: 0, borderTop: "14px solid transparent", borderBottom: "14px solid transparent", borderLeft: "24px solid #fff", marginLeft: 6 }}></div></div>
          <div style={{ fontSize: 11, color: t.primary, opacity: 0.5 }}>video embed / youtube url</div>
        </div>
      </div>
    </div>
  );
}

function ContactFormComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  return (
    <div onClick={onClick} style={{ background: t.bg, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, maxWidth: 900, margin: "0 auto", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Get in Touch"}</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: t.text, marginBottom: 16 }}>{data.title || "Book a Free Counselling Session"}</div>
          {[{ icon: "📞", label: data.phone || "+91 98765 43210" }, { icon: "✉️", label: data.email || "hello@institute.com" }, { icon: "📍", label: data.address || "123 Education Hub, Delhi" }].map((c, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><span style={{ fontSize: 16 }}>{c.icon}</span><span style={{ fontSize: 14, color: t.text }}>{c.label}</span></div>))}
        </div>
        <div style={{ background: t.surface, borderRadius: 20, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          {["Full Name", "Phone Number", "Email Address", "Course Interest"].map((label, i) => (<div key={i} style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 6 }}>{label}</div><div style={{ height: 40, borderRadius: 8, border: `1.5px solid ${t.primary}25`, background: t.bg }}></div></div>))}
          <button style={{ width: "100%", padding: 13, background: t.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Submit Enquiry</button>
        </div>
      </div>
    </div>
  );
}

function BatchScheduleComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const batches = data.batches || [{ name: "JEE 2026 Morning Batch", time: "Mon–Sat, 7:00 AM – 10:00 AM", seats: "8 seats left", mode: "Hybrid", tag: "Filling Fast" }, { name: "NEET Weekend Intensive", time: "Sat–Sun, 9:00 AM – 5:00 PM", seats: "15 seats left", mode: "Online", tag: "New" }, { name: "Class 10 Evening Batch", time: "Mon–Fri, 5:00 PM – 7:30 PM", seats: "12 seats left", mode: "Offline", tag: "" }];
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Upcoming Batches"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "Find Your Perfect Schedule"}</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
        {batches.map((b: any, i: number) => (<div key={i} style={{ background: t.bg, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 24, border: `1px solid ${t.primary}10` }}><div style={{ width: 48, height: 48, borderRadius: 12, background: `${t.primary}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📅</div><div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{b.name}</span>{b.tag && <span style={{ fontSize: 10, background: t.accent, color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>{b.tag}</span>}</div><div style={{ fontSize: 13, color: "#666" }}>{b.time}</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 12, color: t.primary, fontWeight: 600, marginBottom: 4 }}>{b.seats}</div><div style={{ fontSize: 11, background: `${t.primary}15`, color: t.primary, borderRadius: 6, padding: "2px 8px" }}>{b.mode}</div></div><button style={{ background: t.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Enroll</button></div>))}
      </div>
    </div>
  );
}

function TrustBadgesComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const badges = data.badges || [{ label: "ISO Certified", sub: "Quality Education" }, { label: "AICTE Approved", sub: "Govt. Recognition" }, { label: "15+ Years", sub: "Of Excellence" }, { label: "50,000+", sub: "Students Trained" }, { label: "98% Success", sub: "Rate Consistent" }];
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: 40, borderTop: `1px solid ${t.primary}10`, borderBottom: `1px solid ${t.primary}10`, cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
        {badges.map((b: any, i: number) => (<div key={i} style={{ textAlign: "center" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: `${t.primary}10`, border: `2px solid ${t.primary}20`, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 24, height: 24, borderRadius: 6, background: t.primary, opacity: 0.5 }}></div></div><div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{b.label}</div><div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{b.sub}</div></div>))}
      </div>
    </div>
  );
}

function AppDownloadComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  return (
    <div onClick={onClick} style={{ background: `linear-gradient(135deg, ${t.text} 0%, ${t.primary} 100%)`, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 60, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.secondary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{data.eyebrow || "Mobile App"}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>{data.title || "Learn Anytime, Anywhere"}</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 32, lineHeight: 1.7 }}>{data.desc || "Download our app for offline lectures, live classes, test series, and AI doubt solving on the go."}</div>
          <div style={{ display: "flex", gap: 12 }}>{["App Store", "Google Play"].map((store, i) => (<div key={i} style={{ background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}><div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.2)" }}></div><div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Download on</div><div style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{store}</div></div></div>))}</div>
        </div>
        <div style={{ width: 160, height: 280, background: "rgba(255,255,255,0.08)", borderRadius: 28, border: "2px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>app screenshot</div>
      </div>
    </div>
  );
}

function AboutComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const milestones = data.milestones || [{ year: "2009", text: "Founded with 30 students" }, { year: "2014", text: "Launched online platform" }, { year: "2019", text: "Crossed 10,000 students" }, { year: "2024", text: "50,000+ students, 15 centers" }];
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, maxWidth: 960, margin: "0 auto", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Our Story"}</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: t.text, marginBottom: 20, lineHeight: 1.2 }}>{data.title || "Transforming Lives Through Education"}</div>
          <div style={{ fontSize: 14, color: "#666", lineHeight: 1.8, marginBottom: 28 }}>{data.desc || "We started with a simple belief: every student deserves world-class education."}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{milestones.map((m: any, i: number) => (<div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}><div style={{ fontSize: 12, fontWeight: 800, color: t.primary, background: `${t.primary}10`, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" }}>{m.year}</div><div style={{ fontSize: 14, color: t.text, paddingTop: 4 }}>{m.text}</div></div>))}</div>
        </div>
        <div style={{ borderRadius: 20, background: `repeating-linear-gradient(45deg, ${t.primary}08, ${t.primary}08 10px, transparent 10px, transparent 20px)`, border: `2px dashed ${t.primary}25`, aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: t.primary, opacity: 0.6 }}>campus photo</div>
      </div>
    </div>
  );
}

function LiveClassComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "32px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)", borderRadius: 20, padding: "28px 32px", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }}></div><span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>LIVE NOW</span></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{data.title || "Thermodynamics - JEE Advanced Level | Dr. Rajesh Kumar"}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{data.subject || "Physics"} · {data.viewers || "1,247"} students watching</div></div>
        <button style={{ background: "#fff", color: "#dc2626", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Join Class</button>
      </div>
    </div>
  );
}

function StatsComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const stats = data.stats || [{ num: "50,000+", label: "Students Enrolled", icon: "🎓" }, { num: "500+", label: "Expert Faculty", icon: "👨‍🏫" }, { num: "98%", label: "Success Rate", icon: "🏆" }, { num: "15+", label: "Years of Excellence", icon: "⭐" }];
  return (
    <div onClick={onClick} style={{ background: t.bg, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, maxWidth: 900, margin: "0 auto" }}>
        {stats.map((s: any, i: number) => (<div key={i} style={{ textAlign: "center", padding: "32px 16px", background: t.surface, borderRadius: 20, boxShadow: "0 2px 16px rgba(0,0,0,0.05)", border: `1px solid ${t.primary}10` }}><div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div><div style={{ fontSize: 36, fontWeight: 800, color: t.primary }}>{s.num}</div><div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>{s.label}</div></div>))}
      </div>
    </div>
  );
}

function BlogComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const posts = data.posts || [{ title: "JEE Advanced 2025 Syllabus Changes", date: "Apr 28, 2025", tag: "JEE" }, { title: "NEET 2025 Cut-off Predictions", date: "Apr 22, 2025", tag: "NEET" }, { title: "How to Build a 6-Month Study Plan", date: "Apr 15, 2025", tag: "Strategy" }];
  return (
    <div onClick={onClick} style={{ background: t.surface, padding: "60px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Latest Updates"}</div><div style={{ fontSize: 34, fontWeight: 800, color: t.text }}>{data.title || "News & Study Resources"}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {posts.map((p: any, i: number) => (<div key={i} style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${t.primary}10`, background: t.bg }}><div style={{ height: 140, background: `repeating-linear-gradient(45deg, ${t.primary}06, ${t.primary}06 10px, transparent 10px, transparent 20px)`, border: `2px dashed ${t.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: t.primary, opacity: 0.5 }}>blog image</div><div style={{ padding: 20 }}><div style={{ fontSize: 11, background: `${t.primary}10`, color: t.primary, borderRadius: 20, padding: "2px 10px", display: "inline-block", marginBottom: 10, fontWeight: 600 }}>{p.tag}</div><div style={{ fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1.4, marginBottom: 10 }}>{p.title}</div><div style={{ fontSize: 12, color: "#999" }}>{p.date}</div></div></div>))}
      </div>
    </div>
  );
}

function CountdownComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  const [time, setTime] = useState({ d: 12, h: 8, m: 34, s: 56 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => {
        let { d, h, m, s } = prev;
        s--; if (s < 0) { s = 59; m--; } if (m < 0) { m = 59; h--; } if (h < 0) { h = 23; d--; } if (d < 0) d = 0;
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div onClick={onClick} style={{ background: `${t.primary}08`, padding: "48px 40px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3, textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{data.eyebrow || "Admissions Closing Soon"}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, marginBottom: 28 }}>{data.title || "JEE 2026 Batch Registration Ends In"}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 32 }}>
        {([["Days", time.d], ["Hours", time.h], ["Minutes", time.m], ["Seconds", time.s]] as [string, number][]).map(([label, val]) => (<div key={label} style={{ textAlign: "center", background: t.surface, borderRadius: 16, padding: "20px 24px", minWidth: 80, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", border: `1px solid ${t.primary}15` }}><div style={{ fontSize: 40, fontWeight: 800, color: t.primary }}>{String(val).padStart(2, "0")}</div><div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{label}</div></div>))}
      </div>
      <button style={{ background: t.primary, color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>{data.cta || "Register Before It's Too Late"}</button>
    </div>
  );
}

function FooterComponent({ data, theme: t, selected, onClick }: ComponentProps) {
  return (
    <div onClick={onClick} style={{ background: t.text, padding: "48px 40px 24px", cursor: "pointer", outline: selected ? `3px solid ${t.accent}` : "none", outlineOffset: -3 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
        <div><div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12 }}>{data.name || "Apex Institute"}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 20 }}>{data.tagline || "India's leading coaching institute. Trusted by 50,000+ students."}</div><div style={{ display: "flex", gap: 10 }}>{["fb", "tw", "yt", "ig"].map(s => (<div key={s} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{s}</div>))}</div></div>
        {[{ title: "Courses", links: ["JEE Main", "JEE Advanced", "NEET", "Class 10"] }, { title: "Institute", links: ["About Us", "Faculty", "Results", "Blog"] }, { title: "Support", links: ["Contact", "FAQ", "Privacy Policy", "Terms"] }].map((col, i) => (<div key={i}><div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>{col.title}</div>{col.links.map((link, li) => (<div key={li} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 10, cursor: "pointer" }}>{link}</div>))}</div>))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>© 2025 {data.name || "Apex Institute"}. All rights reserved.</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Powered by UNIV.LIVE</div></div>
    </div>
  );
}

// ── Component Registry ───────────────────────────────────────
const COMPONENT_REGISTRY: Record<string, { label: string; icon: string; component: React.FC<ComponentProps>; defaultData: Record<string, any> }> = {
  hero:         { label: "Hero Banner",       icon: "🚀", component: HeroComponent,         defaultData: { variant: "centered" } },
  courses:      { label: "Course Catalog",    icon: "📚", component: CourseCatalogComponent, defaultData: {} },
  faculty:      { label: "Faculty Team",      icon: "👨‍🏫", component: FacultyComponent,       defaultData: {} },
  results:      { label: "Results",           icon: "🏆", component: ResultsComponent,       defaultData: {} },
  testimonials: { label: "Testimonials",      icon: "💬", component: TestimonialsComponent,  defaultData: {} },
  gallery:      { label: "Photo Gallery",     icon: "🖼️", component: GalleryComponent,       defaultData: {} },
  faq:          { label: "FAQ Accordion",     icon: "❓", component: FAQComponent,           defaultData: {} },
  announcement: { label: "Announcement",      icon: "📢", component: AnnouncementComponent,  defaultData: {} },
  pricing:      { label: "Pricing Plans",     icon: "💰", component: PricingComponent,       defaultData: {} },
  video:        { label: "Video Section",     icon: "▶️", component: VideoComponent,         defaultData: {} },
  contact:      { label: "Contact Form",      icon: "📞", component: ContactFormComponent,   defaultData: {} },
  batches:      { label: "Batch Schedule",    icon: "📅", component: BatchScheduleComponent, defaultData: {} },
  trust:        { label: "Trust Badges",      icon: "✅", component: TrustBadgesComponent,   defaultData: {} },
  app:          { label: "App Download",      icon: "📱", component: AppDownloadComponent,   defaultData: {} },
  about:        { label: "About / Mission",   icon: "ℹ️", component: AboutComponent,         defaultData: {} },
  live:         { label: "Live Class Banner", icon: "🔴", component: LiveClassComponent,     defaultData: {} },
  stats:        { label: "Stats Counter",     icon: "📊", component: StatsComponent,         defaultData: {} },
  blog:         { label: "Blog / News",       icon: "📰", component: BlogComponent,          defaultData: {} },
  countdown:    { label: "Countdown Timer",   icon: "⏱️", component: CountdownComponent,     defaultData: {} },
  footer:       { label: "Footer",            icon: "📋", component: FooterComponent,        defaultData: {} },
};

const COMPONENT_GROUPS = [
  { label: "Essential", keys: ["hero", "announcement", "stats", "trust", "countdown", "live"] },
  { label: "Content",   keys: ["courses", "faculty", "results", "testimonials", "gallery", "faq"] },
  { label: "Info",      keys: ["about", "pricing", "batches", "video", "blog"] },
  { label: "Convert",   keys: ["contact", "app", "footer"] },
];

// ── Draggable Library Item ───────────────────────────────────
function LibraryItem({ type, entry, onAdd }: { type: string; entry: typeof COMPONENT_REGISTRY[string]; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${type}`,
    data: { isLibrary: true, componentType: type },
  });
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      onClick={onAdd}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "grab", background: isDragging ? "rgba(99,102,241,0.08)" : "transparent", border: "1px solid transparent", transition: "all 0.15s", opacity: isDragging ? 0.5 : 1, userSelect: "none" }}
      onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{entry.icon}</span>
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{entry.label}</span>
    </div>
  );
}

// ── Sortable Canvas Section ──────────────────────────────────
function SortableSection({ section, selected, onSelect, onDelete, onMoveUp, onMoveDown, theme, previewMode }: {
  section: Section; selected: boolean; onSelect: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; theme: Theme; previewMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const Comp = COMPONENT_REGISTRY[section.type]?.component;
  if (!Comp) return null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" }}
    >
      {!previewMode && selected && (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onMoveUp(); }} title="Move up" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.9)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}><ChevronUp size={14} /></button>
          <button onClick={e => { e.stopPropagation(); onMoveDown(); }} title="Move down" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.9)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}><ChevronDown size={14} /></button>
          <div {...listeners} {...attributes} title="Drag to reorder" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.9)", cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}><GripVertical size={14} /></div>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete section" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "#fee2e2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}><Trash2 size={14} color="#dc2626" /></button>
        </div>
      )}
      <Comp data={section.data} theme={theme} selected={!previewMode && selected} onClick={previewMode ? () => {} : onSelect} />
    </div>
  );
}

// ── Canvas Drop Zone ─────────────────────────────────────────
function CanvasDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop-zone" });
  return (
    <div ref={setNodeRef} style={{ minHeight: 120, background: isOver ? "rgba(99,102,241,0.06)" : "transparent", borderRadius: 8, transition: "background 0.15s" }}>
      {children}
    </div>
  );
}

// ── Left Sidebar ─────────────────────────────────────────────
function LeftSidebar({ sections, onAdd, selectedId, onSelectSection, onDeleteSection, themeKey, setThemeKey, instituteName, setInstituteName }: {
  sections: Section[]; onAdd: (type: string) => void; selectedId: string | null; onSelectSection: (id: string) => void; onDeleteSection: (id: string) => void; themeKey: ThemeKey; setThemeKey: (k: ThemeKey) => void; instituteName: string; setInstituteName: (n: string) => void;
}) {
  const [tab, setTab] = useState<"components" | "layers" | "settings">("components");
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? Object.entries(COMPONENT_REGISTRY).filter(([, v]) => v.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div style={{ width: 260, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
        {([{ id: "components", label: "Add", icon: "＋" }, { id: "layers", label: "Layers", icon: "≡" }, { id: "settings", label: "Site", icon: "⚙" }] as const).map(t2 => (
          <button key={t2.id} onClick={() => setTab(t2.id)} style={{ flex: 1, padding: "10px 4px", border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: tab === t2.id ? "#6366f1" : "rgba(0,0,0,0.35)", borderBottom: tab === t2.id ? "2px solid #6366f1" : "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 14 }}>{t2.icon}</span><span>{t2.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {tab === "components" && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components…" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, marginBottom: 12, outline: "none", background: "#f9f9f9" }} />
            {filtered ? (
              filtered.map(([key, entry]) => <LibraryItem key={key} type={key} entry={entry} onAdd={() => onAdd(key)} />)
            ) : (
              COMPONENT_GROUPS.map(group => (
                <div key={group.label} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.3)", letterSpacing: 1, textTransform: "uppercase", padding: "4px 10px", marginBottom: 4 }}>{group.label}</div>
                  {group.keys.map(key => <LibraryItem key={key} type={key} entry={COMPONENT_REGISTRY[key]} onAdd={() => onAdd(key)} />)}
                </div>
              ))
            )}
          </>
        )}

        {tab === "layers" && (
          sections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "rgba(0,0,0,0.3)", fontSize: 13 }}>No sections yet.<br />Add from the Add tab.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sections.map((sec, i) => (
                <div key={sec.id} onClick={() => onSelectSection(sec.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: selectedId === sec.id ? "rgba(99,102,241,0.1)" : "transparent", border: selectedId === sec.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent", cursor: "pointer" }}>
                  <span style={{ fontSize: 14 }}>{COMPONENT_REGISTRY[sec.type]?.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#374151", flex: 1 }}>{COMPONENT_REGISTRY[sec.type]?.label}</span>
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.3)" }}>#{i + 1}</span>
                  <button onClick={e => { e.stopPropagation(); onDeleteSection(sec.id); }} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", color: "#dc2626", opacity: 0.6, borderRadius: 4, display: "flex", alignItems: "center" }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "settings" && (
          <div style={{ padding: "4px 4px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Institute Name</div>
              <input value={instituteName} onChange={e => setInstituteName(e.target.value)} placeholder="Your Institute Name" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Color Theme</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(Object.keys(THEME_PRESETS) as ThemeKey[]).map(key => (
                  <button key={key} onClick={() => setThemeKey(key)} title={key} style={{ width: 36, height: 36, borderRadius: "50%", background: THEME_PRESETS[key].primary, border: themeKey === key ? "3px solid #6366f1" : "3px solid transparent", outline: themeKey === key ? `2px solid #6366f1` : "none", outlineOffset: 2, cursor: "pointer" }} />
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.4)", textTransform: "capitalize" }}>Selected: {themeKey}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Right Panel ──────────────────────────────────────────────
function RightPanel({ section, onUpdate }: { section: Section | null; onUpdate: (key: string, value: string) => void }) {
  if (!section) {
    return (
      <div style={{ width: 260, background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ textAlign: "center", padding: 24, color: "rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
          <div style={{ fontSize: 13 }}>Click a section<br />to edit its content</div>
        </div>
      </div>
    );
  }

  const fields = EDITOR_FIELDS[section.type] || [];
  const reg = COMPONENT_REGISTRY[section.type];

  return (
    <div style={{ width: 260, background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{reg?.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{reg?.label}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {fields.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(0,0,0,0.3)", fontSize: 13 }}>No editable fields for this section.</div>
        ) : (
          fields.map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.45)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{field.label}</label>
              {field.type === "select" ? (
                <select value={section.data[field.key] || field.options![0]} onChange={e => onUpdate(field.key, e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, outline: "none", background: "#fff" }}>
                  {field.options!.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === "textarea" ? (
                <textarea value={section.data[field.key] || ""} onChange={e => onUpdate(field.key, e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              ) : (
                <input type="text" value={section.data[field.key] || ""} onChange={e => onUpdate(field.key, e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, outline: "none" }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Builder ─────────────────────────────────────────────
let _secId = 0;
function newId() { return `sec_${Date.now()}_${++_secId}`; }

export default function InstituteBuilder() {
  const navigate = useNavigate();
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid || null;

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState<ThemeKey>("indigo");
  const [instituteName, setInstituteName] = useState("My Institute");
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  const theme = THEME_PRESETS[themeKey];

  // Load from Firestore
  useEffect(() => {
    if (!uid) { setLoaded(true); return; }
    getDoc(doc(db, "educators", uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data() as any;
        const cfg = d.builderConfig;
        if (cfg?.sections) setSections(cfg.sections);
        if (cfg?.themeKey) setThemeKey(cfg.themeKey as ThemeKey);
        if (cfg?.instituteName) setInstituteName(cfg.instituteName);
        else setInstituteName(d.coachingName || d.displayName || profile?.displayName || "My Institute");
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [uid]);

  // Auto-save with debounce
  useEffect(() => {
    if (!uid || !loaded) return;
    clearTimeout(saveTimeout.current);
    setSaving(true);
    saveTimeout.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, "educators", uid), { builderConfig: { sections, themeKey, instituteName } }, { merge: true });
      } finally {
        setSaving(false);
      }
    }, 1500);
    return () => clearTimeout(saveTimeout.current);
  }, [sections, themeKey, instituteName, uid, loaded]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function addSection(type: string, afterId?: string | null) {
    const reg = COMPONENT_REGISTRY[type];
    if (!reg) return;
    const newSec: Section = { id: newId(), type, data: { ...reg.defaultData } };
    setSections(prev => {
      if (!afterId) return [...prev, newSec];
      const idx = prev.findIndex(s => s.id === afterId);
      const arr = [...prev];
      arr.splice(idx === -1 ? arr.length : idx + 1, 0, newSec);
      return arr;
    });
    setSelectedId(newSec.id);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as { isLibrary?: boolean; componentType?: string } | undefined;

    if (activeData?.isLibrary) {
      const type = activeData.componentType!;
      const overId = over.id as string;
      const reg = COMPONENT_REGISTRY[type];
      if (!reg) return;
      const newSec: Section = { id: newId(), type, data: { ...reg.defaultData } };
      setSections(prev => {
        if (overId === "canvas-drop-zone") return [...prev, newSec];
        const idx = prev.findIndex(s => s.id === overId);
        const arr = [...prev];
        arr.splice(idx === -1 ? arr.length : idx + 1, 0, newSec);
        return arr;
      });
      setSelectedId(newSec.id);
    } else {
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setSections(prev => arrayMove(prev, oldIndex, newIndex));
      }
    }
  }

  function updateSectionData(key: string, value: string) {
    if (!selectedId) return;
    setSections(prev => prev.map(s => s.id === selectedId ? { ...s, data: { ...s.data, [key]: value } } : s));
  }

  function deleteSection(id: string) {
    setSections(prev => prev.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveSection(id: string, dir: "up" | "down") {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      return arrayMove(prev, idx, newIdx);
    });
  }

  const selectedSection = sections.find(s => s.id === selectedId) || null;

  const canvasContent = (
    <div style={{ background: theme.bg }}>
      {sections.length === 0 && (
        <div style={{ minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(0,0,0,0.25)", fontSize: 14, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48 }}>🏗️</div>
          <div style={{ fontWeight: 600 }}>Start building your website</div>
          <div style={{ fontSize: 13 }}>Drag & drop components from the left panel,<br />or click any component to add it to your page.</div>
        </div>
      )}
      <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
        {sections.map(sec => (
          <SortableSection
            key={sec.id}
            section={sec}
            selected={selectedId === sec.id}
            onSelect={() => setSelectedId(sec.id)}
            onDelete={() => deleteSection(sec.id)}
            onMoveUp={() => moveSection(sec.id, "up")}
            onMoveDown={() => moveSection(sec.id, "down")}
            theme={theme}
            previewMode={previewMode}
          />
        ))}
      </SortableContext>
      <CanvasDropZone>
        {sections.length === 0 && <div style={{ height: 120 }} />}
      </CanvasDropZone>
    </div>
  );

  if (!loaded) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "rgba(0,0,0,0.4)", fontSize: 14 }}>Loading builder…</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="-m-4 lg:-m-6" style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f0f0f5" }}>

        {/* Top Bar */}
        <div style={{ height: 52, background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate("/educator/website-settings")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "none", cursor: "pointer", fontSize: 12, color: "rgba(0,0,0,0.5)" }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: 1, height: 24, background: "rgba(0,0,0,0.08)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10 }}>🏫</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{instituteName}</span>
          </div>
          <div style={{ flex: 1 }} />
          {saving && <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Saving…</span>}

          {/* Edit / Preview toggle */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.06)", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["Edit", "Preview"] as const).map(mode => (
              <button key={mode} onClick={() => { setPreviewMode(mode === "Preview"); if (mode === "Edit") setSelectedId(null); }}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: (previewMode ? mode === "Preview" : mode === "Edit") ? "rgba(99,102,241,0.85)" : "transparent", color: (previewMode ? mode === "Preview" : mode === "Edit") ? "#fff" : "rgba(0,0,0,0.4)", transition: "all 0.15s" }}>{mode}</button>
            ))}
          </div>

          {/* Device toggle (preview mode only) */}
          {previewMode && (
            <div style={{ display: "flex", background: "rgba(0,0,0,0.06)", borderRadius: 8, padding: 3, gap: 2 }}>
              <button onClick={() => setPreviewDevice("desktop")} title="Desktop view" style={{ width: 32, height: 28, borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: previewDevice === "desktop" ? "#fff" : "transparent", boxShadow: previewDevice === "desktop" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                <Monitor size={15} color={previewDevice === "desktop" ? "#4f46e5" : "rgba(0,0,0,0.35)"} />
              </button>
              <button onClick={() => setPreviewDevice("mobile")} title="Mobile view" style={{ width: 32, height: 28, borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: previewDevice === "mobile" ? "#fff" : "transparent", boxShadow: previewDevice === "mobile" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                <Smartphone size={15} color={previewDevice === "mobile" ? "#4f46e5" : "rgba(0,0,0,0.35)"} />
              </button>
            </div>
          )}

          <div style={{ width: 20, height: 20, borderRadius: "50%", background: theme.primary, border: "2px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
          <button style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(99,102,241,0.4)" }}>
            Publish Site →
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left Sidebar — hidden in preview */}
          {!previewMode && (
            <LeftSidebar
              sections={sections}
              onAdd={type => addSection(type, selectedId)}
              selectedId={selectedId}
              onSelectSection={setSelectedId}
              onDeleteSection={deleteSection}
              themeKey={themeKey}
              setThemeKey={setThemeKey}
              instituteName={instituteName}
              setInstituteName={setInstituteName}
            />
          )}

          {/* Canvas */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {previewMode && previewDevice === "mobile" ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 16px", minHeight: "100%" }}>
                <div style={{ width: 390, flexShrink: 0, borderRadius: 36, overflow: "hidden", boxShadow: "0 0 0 10px #1a1a2e, 0 30px 80px rgba(0,0,0,0.4)", position: "relative" }}>
                  <div style={{ height: 28, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 80, height: 6, borderRadius: 3, background: "#333" }} /></div>
                  <div style={{ maxHeight: "70vh", overflowY: "auto" }}>{canvasContent}</div>
                  <div style={{ height: 20, background: "#1a1a2e" }} />
                </div>
              </div>
            ) : (
              canvasContent
            )}
          </div>

          {/* Right Panel — hidden in preview */}
          {!previewMode && (
            <RightPanel section={selectedSection} onUpdate={updateSectionData} />
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeId.startsWith("lib:") && (() => {
          const type = activeId.replace("lib:", "");
          const entry = COMPONENT_REGISTRY[type];
          return entry ? (
            <div style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 500, color: "#374151", border: "2px solid #6366f1" }}>
              <span>{entry.icon}</span><span>{entry.label}</span>
            </div>
          ) : null;
        })()}
        {activeId && !activeId.startsWith("lib:") && (() => {
          const sec = sections.find(s => s.id === activeId);
          if (!sec) return null;
          const Comp = COMPONENT_REGISTRY[sec.type]?.component;
          return Comp ? (
            <div style={{ opacity: 0.85, transform: "scale(0.97)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", pointerEvents: "none" }}>
              <Comp data={sec.data} theme={theme} selected={false} onClick={() => {}} />
            </div>
          ) : null;
        })()}
      </DragOverlay>
    </DndContext>
  );
}

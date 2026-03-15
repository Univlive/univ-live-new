// src/themes/coaching/theme2/TenantHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Menu,
  X,
  Play,
  FileText,
  Star,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  Twitter,
  Globe,
  MessageCircle,
  Send,
  Phone,
  MapPin,
  Mail,
  CheckCircle2,
  Sparkles,
  Clock,
  Brain,
  BarChart3,
  Users,
  Target,
  BookOpen
} from "lucide-react";

import { useTenant } from "@/contexts/TenantProvider";
import { useFavicon } from "@/hooks/useFavicon";
import { db } from "@/lib/firebase";
import { collection, documentId, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type StatItem = { label: string; value: string; icon?: string };
type AchievementItem = { title: string; description: string; icon?: string };
type FacultyItem = { name: string; subject?: string; designation?: string; experience?: string; bio?: string; image?: string };
type TestimonialItem = { name: string; course?: string; rating?: number; text: string; avatar?: string };
type FAQItem = { question: string; answer: string };

type TestSeries = {
  id: string;
  title: string;
  description: string;
  price: string | number;
  coverImage?: string;
  subject?: string;
  difficulty?: string;
  testsCount?: number;
  durationMinutes?: number;
};

function initials(name: string) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

function isTruthyUrl(v: any) {
  return typeof v === "string" && v.trim().length > 0;
}

export default function TenantHomeTheme2() {
  const { tenant, loading } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [featured, setFeatured] = useState<TestSeries[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin mr-3" />
        <span className="font-medium">Loading your experience...</span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center px-6">
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Coaching not found</h2>
          <p className="text-zinc-500 mt-3 text-lg">
            This coaching website does not exist. Check the URL or contact support.
          </p>
        </div>
      </div>
    );
  }

  const config = tenant.websiteConfig || {};

  const coachingName = config.coachingName || tenant.coachingName || "Your Institute";
  const tagline = config.tagline || tenant.tagline || "Learn smarter. Score higher.";
  const heroImage: string | undefined = config.heroImage;
  const logoUrl: string | undefined = config.logoUrl;

  // Set dynamic favicon + page title for this educator's subdomain
  useFavicon(logoUrl, coachingName);

  const stats: StatItem[] = Array.isArray(config.stats) ? config.stats : [];
  const testimonials: TestimonialItem[] = Array.isArray(config.testimonials) ? config.testimonials : [];

  const faqs: FAQItem[] =
    Array.isArray(config.faqs) && config.faqs.length > 0
      ? config.faqs
      : [
          {
            question: "How do I access the test series after purchase?",
            answer: "Once you purchase (or enroll if free), the test series appears in your student dashboard under 'My Tests'.",
          },
          {
            question: "Can I access content on mobile?",
            answer: "Yes. The platform is mobile-responsive and works smoothly on phones and tablets.",
          },
          {
            question: "Do you provide performance analytics?",
            answer: "Yes. Students get score insights and progress tracking inside the dashboard.",
          },
          {
            question: "Is there any demo / preview available?",
            answer: "Many educators provide free tests or previews. Check the Featured section or login to see what's included.",
          },
        ];

  const socials: Record<string, string> = useMemo(() => {
    const s = (config.socials || {}) as Record<string, string>;
    const cleaned: Record<string, string> = {};
    Object.entries(s).forEach(([k, v]) => {
      if (isTruthyUrl(v)) cleaned[k] = v.trim();
    });
    return cleaned;
  }, [config.socials]);

  const educatorId = tenant.educatorId;
  const featuredIds: string[] = Array.isArray(config.featuredTestIds) ? config.featuredTestIds : [];
  const featuredKey = featuredIds.join(",");

  useEffect(() => {
    if (!educatorId) return;

    async function loadFeatured() {
      setLoadingFeatured(true);
      try {
        let qRef;

        if (featuredIds.length > 0) {
          const safeIds = featuredIds.slice(0, 10);
          qRef = query(
            collection(db, "educators", educatorId, "my_tests"),
            where(documentId(), "in", safeIds)
          );
        } else {
          qRef = query(
            collection(db, "educators", educatorId, "my_tests"),
            orderBy("createdAt", "desc"),
            limit(4)
          );
        }

        const snap = await getDocs(qRef);
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as TestSeries[];

        setFeatured(rows);
      } catch {
        setFeatured([]);
      } finally {
        setLoadingFeatured(false);
      }
    }

    loadFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [educatorId, featuredKey]);

  // Updated Navigation
  const navLinks = [
    { label: "Home", href: "#top" },
    { label: "Features", href: "#features" },
    { label: "Test Series", href: "#tests" },
    { label: "Contact Us", href: "#contact" },
  ];

  const socialIconMap: Record<string, any> = {
    instagram: Instagram,
    youtube: Youtube,
    facebook: Facebook,
    linkedin: Linkedin,
    twitter: Twitter,
    website: Globe,
    telegram: Send,
    whatsapp: MessageCircle,
    email: Mail,
    phone: Phone,
  };


  const socialLabelMap: Record<string, string> = {
    instagram: "Instagram",
    youtube: "YouTube",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    twitter: "X",
    website: "Website",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    email: "Email",
    phone: "Phone",
  };

  const buildSocialHref = (key: string, value: string) => {
    if (key === "email") {
      return value.startsWith("mailto:") ? value : `mailto:${value}`;
    }
    if (key === "phone") {
      return value.startsWith("tel:") ? value : `tel:${value}`;
    }
    return value;
  };

  // CUET Mock Data for "Our Tests"
  const cuetSubjects = [
    { title: "English", totalTests: 440, freeTests: 1, lang: "English", attempts: "97341" },
    { title: "Economics", totalTests: 231, freeTests: 5, lang: "English", attempts: "47695" },
    { title: "Business Studies", totalTests: 214, freeTests: 5, lang: "English", attempts: "38535" },
    { title: "General Test", totalTests: 520, freeTests: 10, lang: "English", attempts: "125430" },
    { title: "Mathematics", totalTests: 310, freeTests: 4, lang: "English", attempts: "65200" },
    { title: "Physics", totalTests: 280, freeTests: 4, lang: "English", attempts: "54120" },
  ];

  return (
    <div id="top" className="min-h-screen bg-[#FAFAFA] text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-zinc-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3">
            {logoUrl ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 flex-shrink-0">
                <img src={logoUrl} alt={`${coachingName} logo`} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm flex-shrink-0">
                <span className="text-base font-bold">
                  {coachingName?.trim()?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight text-zinc-950">
              {coachingName}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login?role=student">
              <Button variant="ghost" className="hidden md:inline-flex rounded-full px-6 font-semibold hover:bg-zinc-100">
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="rounded-full px-7 bg-zinc-950 text-white hover:bg-zinc-800 font-semibold shadow-sm">
                Get Started
              </Button>
            </Link>

            <button className="ml-2 md:hidden p-2 text-zinc-600" onClick={() => setMobileOpen((s) => !s)}>
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="absolute top-20 left-0 w-full bg-white border-b border-zinc-200 p-4 md:hidden shadow-xl">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-base font-semibold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 rounded-xl"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-4 px-2 flex flex-col gap-2">
              <Link to="/login?role=student" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full rounded-full font-semibold border-zinc-200">
                  Log in
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-zinc-200 px-4 py-1.5 shadow-sm mb-8">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  {tagline}
                </span>
              </div>

              <h1 className="text-5xl sm:text-4xl lg:text-[72px] font-extrabold tracking-tighter text-zinc-950 leading-[1.05] mb-6">
                Your CUET Preparation<br className="hidden sm:block" />
                <span className="text-zinc-500">Starts With {coachingName}</span>
              </h1>

              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <a href="#tests" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto rounded-full bg-zinc-950 text-white hover:bg-zinc-800 px-8 py-6 text-base font-semibold shadow-xl shadow-zinc-900/10">
                    Get Started
                  </Button>
                </a>
              </div>

              {(stats?.length > 0) && (
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-5 w-5 fill-orange-400 text-orange-400" />
                    ))}
                  </div>
                  <div className="flex gap-4">
                    {stats.slice(0, 2).map((s, idx) => (
                      <div key={idx} className="text-sm font-medium text-zinc-600">
                        <span className="font-bold text-zinc-950">{s.value}</span> {s.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="relative lg:ml-auto w-full max-w-xl"
            >
              <div className="relative rounded-[2rem] overflow-hidden bg-zinc-100 border border-zinc-200 shadow-2xl shadow-zinc-900/5 aspect-[4/3]">
                {heroImage ? (
                  <img src={heroImage} alt={coachingName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                    <FileText className="h-12 w-12 mb-3 opacity-50" />
                    <p className="font-medium text-sm">Add a hero image in settings</p>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* NEW FEATURES SECTION */}
      <section id="features" className="py-24 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-4 py-1.5 mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                WHY CHOOSE US
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-tight">
              Everything you need to <br className="hidden sm:block" /> dominate your exams
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-[#FAFAFA] rounded-[2rem] p-8 border border-zinc-100 shadow-sm"
            >
              <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-950 mb-3">Real Exam–Like Test Experience</h3>
              <p className="text-zinc-500 leading-relaxed text-sm sm:text-base">
                Feels exactly like the actual CUET exam with authentic interface, timer, and navigation. Get comfortable before the real deal.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-[#FAFAFA] rounded-[2rem] p-8 border border-zinc-100 shadow-sm"
            >
              <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-950 mb-3">AI-Powered Advanced Analytics</h3>
              <p className="text-zinc-500 leading-relaxed text-sm sm:text-base">
                Question-wise accuracy, time taken per question/section, and clear identification of strengths and weak areas.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-[#FAFAFA] rounded-[2rem] p-8 border border-zinc-100 shadow-sm"
            >
              <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-950 mb-3">Time & accuracy insights</h3>
              <p className="text-zinc-500 leading-relaxed text-sm sm:text-base">
                Understand exactly where you lose time and make costly mistakes. Our platform highlights pacing issues to optimize your test strategy.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* NEW: WHAT WE STAND FOR */}
      <section className="py-24 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid lg:grid-cols-2 gap-16 items-center">
             <div>
                <h2 className="text-4xl font-extrabold tracking-tight text-zinc-950 mb-6">
                  What we stand for
                </h2>
                <p className="text-lg text-zinc-600 mb-8 leading-relaxed">
                  We believe in transforming raw potential into undeniable results through systematic preparation and unwavering support.
                </p>
             </div>
             <div className="grid sm:grid-cols-2 gap-6">
               {[
                 { title: "Proven Result", icon: BarChart3 },
                 { title: "Expert faculty", icon: Users },
                 { title: "Personalised Learning & Mentorship", icon: Target },
                 { title: "1:1 Doubt Support", icon: BookOpen },
               ].map((item, idx) => (
                 <div key={idx} className="bg-white border border-zinc-200 p-6 rounded-3xl flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-10 w-10 bg-zinc-100 text-zinc-900 rounded-full flex items-center justify-center">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h4 className="font-bold text-zinc-950">{item.title}</h4>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </section>

      {/* TEST SERIES SECTION */}
      <section id="tests" className="py-24 bg-white border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* NEW: OUR TESTS (CUET Style Subject Cards) */}
          <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight text-zinc-950 mb-4">
                Our Tests
              </h2>
              <p className="text-zinc-500">Master every subject with dedicated mock tests.</p>
            </div>
            <Link to="/login?role=student" className="shrink-0">
              <Button className="rounded-full bg-zinc-950 text-white hover:bg-zinc-800 px-8 py-6 text-base font-semibold shadow-sm">
                Get Started
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cuetSubjects.map((subject, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="bg-white border border-zinc-200 rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group"
              >
                {/* NTA logo */}
                <div className="absolute right-6 top-6 h-12 w-12 bg-white rounded-full flex items-center justify-center border-2 border-zinc-100 shadow-sm overflow-hidden p-1 z-10">
                   <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQs7iboUwzXcYfbV94AQ5DctkCyCVqRc-0zwA&s" alt="NTA Logo" className="w-full h-full object-contain" />
                </div>

                <div className="pr-16 mb-8">
                  <h3 className="text-xl font-bold text-zinc-950 mb-2">{subject.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-500">{subject.totalTests} Total Tests</span>
                    <span className="bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm relative after:content-[''] after:absolute after:right-[-6px] after:top-0 after:border-t-[8px] after:border-b-[8px] after:border-l-[6px] after:border-t-transparent after:border-b-transparent after:border-l-green-600">
                      Expert-Curated Test(s)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="bg-[#FAFAFA] border border-zinc-200 text-zinc-600 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> {subject.lang}
                  </div>
                  
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* UPDATED TESTIMONIALS */}
      <section id="reviews" className="py-24 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                PROOF THAT IT WORKS
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-tight">
              Happy students sharing experiences :
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {(testimonials.length ? testimonials : [
              { name: "Jason", text: "I've taken dozens of courses, but this is the only one that made improvement feel doable.", rating: 5, course: "CUET Mock Package" },
              { name: "Laolu", text: "So clear and structured. I finally understood where to start and felt confident.", rating: 5, course: "Subject Test Series" },
              { name: "Danielle", text: "No fluff, just step-by-step guidance. This removed every excuse I had for waiting.", rating: 5, course: "Full Analytics Plan" }
            ]).slice(0, 3).map((t, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-white rounded-[2rem] p-8 sm:p-10 border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center"
              >
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: Math.max(1, Math.min(5, t.rating || 5)) }).map((_, i) => (
                    <Star key={i} className="h-6 w-6 fill-orange-400 text-orange-400" />
                  ))}
                </div>
                
                <p className="text-lg text-zinc-600 leading-relaxed mb-8 flex-1">
                  "{t.text}"
                </p>

                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-zinc-200">
                      <AvatarImage src={t.avatar} className="object-cover" />
                      <AvatarFallback className="bg-zinc-100 text-zinc-600 font-bold">{initials(t.name)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-950">{t.name}</p>
                    </div>
                  </div>
                  {t.course && (
                    <div className="w-full mt-2">
                      <span className="inline-block bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg w-full truncate">
                        {t.course}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NEW CONTACT SECTION */}
      <section id="contact" className="py-24 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid lg:grid-cols-2 gap-16 items-center">
             <div>
               <div className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-4 py-1.5 mb-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                    GET IN TOUCH
                  </span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 mb-6 leading-tight">
                  Let's Talk.
                </h2>
                <p className="text-lg text-zinc-500 mb-10 max-w-md">
                  Have questions about the test series or need guidance on your preparation? Reach out directly.
                </p>

                
             </div>

             <div className="bg-[#FAFAFA] border border-zinc-200 rounded-[2.5rem] p-8 sm:p-12">
                <h3 className="text-2xl font-bold text-zinc-950 mb-8">Follow Our Socials</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Object.entries(socials).length > 0 ? (
                    Object.entries(socials).map(([k, v]) => {
                      const Icon = socialIconMap[k];
                      if (!Icon || !v) return null;

                      const href = buildSocialHref(k, v);
                      const isExternal = !["email", "phone"].includes(k);

                      return (
                        <a
                          key={k}
                          href={href}
                          target={isExternal ? "_blank" : undefined}
                          rel={isExternal ? "noopener noreferrer" : undefined}
                          className="flex flex-col items-center justify-center gap-3 bg-white border border-zinc-100 p-6 rounded-2xl hover:shadow-md hover:-translate-y-1 transition-all"
                        >
                          <Icon className="h-8 w-8 text-zinc-700" />
                          <span className="text-sm font-semibold text-zinc-900">
                            {socialLabelMap[k] || k}
                          </span>
                        </a>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-zinc-500 text-sm">
                      Social links will appear here once added in settings.
                    </div>
                  )}
                </div>
             </div>
           </div>
        </div>
      </section>


      {/* NEW BOTTOM CTA CARD (Purple Gradient Style) */}
      <section className="py-24 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-violet-500 to-indigo-500 rounded-[2.5rem] p-10 sm:p-16 lg:p-20 text-center relative overflow-hidden shadow-[0_20px_50px_rgb(99,102,241,0.2)]">
            {/* Sparkles/Floating decorative elements */}
            <Sparkles className="absolute top-10 right-12 h-8 w-8 text-white/40" />
            <Sparkles className="absolute bottom-12 left-10 h-6 w-6 text-white/30" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-4 py-1.5 text-xs font-bold tracking-wider text-white mb-8 border border-white/30 uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Start Today
              </div>

              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-10 max-w-3xl leading-[1.1]">
                Ready to Begin Your Journey at {coachingName}?
              </h2>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 w-full sm:w-auto">
                <Link to="/login?role=student" className="w-full sm:w-auto">
                  <Button className="w-full rounded-full bg-white text-indigo-600 hover:bg-zinc-50 px-10 py-7 text-lg font-bold shadow-xl">
                    Get Started For Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/courses" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full rounded-full bg-transparent border-white/30 text-white hover:bg-white/10 px-10 py-7 text-lg font-bold">
                    Browse All Tests
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-zinc-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                {logoUrl ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 flex-shrink-0">
                    <img src={logoUrl} alt={`${coachingName} logo`} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm flex-shrink-0">
                    <span className="text-sm font-bold">
                      {coachingName?.trim()?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <span className="text-xl font-bold tracking-tight text-zinc-950">{coachingName}</span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                {tagline}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-zinc-950 mb-4">Platform</h4>
              <ul className="space-y-3">
                <li><Link to="/" className="text-zinc-500 hover:text-zinc-950 text-sm font-medium">Home</Link></li>
                <li><Link to="/courses" className="text-zinc-500 hover:text-zinc-950 text-sm font-medium">Test Series</Link></li>
                <li><Link to="/login?role=student" className="text-zinc-500 hover:text-zinc-950 text-sm font-medium">Student Login</Link></li>
                <li><Link to="/signup" className="text-zinc-500 hover:text-zinc-950 text-sm font-medium">Create Account</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-zinc-950 mb-4">Contact</h4>
              <ul className="space-y-3">
                 {tenant.contact?.phone && (
                  <li>
                    <a href={`tel:${tenant.contact.phone}`} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-950 text-sm font-medium">
                      <Phone className="h-4 w-4" /> {tenant.contact.phone}
                    </a>
                  </li>
                )}
                {tenant.contact?.email && (
                  <li>
                    <a href={`mailto:${tenant.contact.email}`} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-950 text-sm font-medium">
                      <Mail className="h-4 w-4" /> {tenant.contact.email}
                    </a>
                  </li>
                )}
                {tenant.contact?.address && (
                  <li className="flex items-start gap-2 text-zinc-500 text-sm font-medium">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> 
                    <span>{tenant.contact.address}</span>
                  </li>
                )}
              </ul>
            </div>

            <div>
               <h4 className="font-bold text-zinc-950 mb-4">Powered By</h4>
               <p className="text-zinc-500 text-sm leading-relaxed mb-4">
                 Built on UNIV.LIVE to help educators scale their testing and reach.
               </p>
               <div className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-3 py-1">
              
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm font-medium text-zinc-500">
              © {new Date().getFullYear()} {coachingName}. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm font-medium text-zinc-500">
              <Link to="/privacy-policy" className="hover:text-zinc-950">Privacy Policy</Link>
              <Link to="/terms-of-use" className="hover:text-zinc-950">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

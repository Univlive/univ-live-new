// src/themes/coaching/theme3/TenantHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Menu,
  X,
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
  Mail,
  Quote,
  CheckCircle2,
  MonitorPlay,
  BrainCircuit,
  Clock,
  Target,
  Users,
  MessageSquare,
  BookOpen
} from "lucide-react";

import { useTenant } from "@app/providers/TenantProvider";
import { useFavicon } from "@shared/hooks/useFavicon";
import { db } from "@shared/lib/firebase";
import { collection, documentId, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { Button } from "@shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/ui/avatar";
import { Badge } from "@shared/ui/badge";

import { initials, isTruthyUrl } from "@/themes/coaching/shared/themeUtils";
import type { FacultyItem, TestimonialItem, TestSeries } from "@/themes/coaching/shared/themeTypes";

export default function TenantHomeTheme2() {
  const { tenant, loading } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [featured, setFeatured] = useState<TestSeries[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2 text-orange-500" />
        Loading...
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="text-center px-6">
          <h2 className="text-2xl font-bold">Coaching not found</h2>
          <p className="text-neutral-400 mt-2">
            This coaching website does not exist. Check the URL or contact support.
          </p>
        </div>
      </div>
    );
  }

  const config = tenant.websiteConfig || {};

  const coachingName = config.coachingName || tenant.coachingName || "Your Institute";
  const tagline = config.tagline || tenant.tagline || "Learn smarter. Score higher.";
  const logoUrl: string | undefined = config.logoUrl;

  // Set dynamic favicon + page title for this educator's subdomain
  useFavicon(logoUrl, coachingName);

  const faculty: FacultyItem[] = Array.isArray(config.faculty) ? config.faculty : [];
  const testimonials: TestimonialItem[] = Array.isArray(config.testimonials) ? config.testimonials : [];

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
  }, [educatorId, featuredKey]);

  // UPDATED NAVIGATION
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
  };

  // CUET Subjects hardcoded for the "Our Tests" section
  const cuetSubjects = [
    "English", "General Test", "Physics", "Chemistry", "Mathematics", 
    "Biology", "Accountancy", "Economics", "Business Studies", 
    "History", "Political Science", "Geography"
  ];

  return (
    <div id="top" className="min-h-screen bg-[#0a0a0a] text-neutral-200 font-sans selection:bg-orange-500/30 selection:text-white scroll-smooth">
      
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* FLOATING NAVBAR */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
        <nav className="rounded-full border border-neutral-800 bg-[#111111]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-2xl">
          <Link to="/" className="flex items-center gap-2.5 pl-2">
            {logoUrl ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0 bg-neutral-900">
                <img src={logoUrl} alt={`${coachingName} logo`} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm flex-shrink-0">
                <span className="text-sm font-bold">
                  {coachingName?.trim()?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <span className="text-base font-semibold text-white hidden sm:block">
              {coachingName}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-neutral-400 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 pr-1">
            <Link to="/login?role=student">
              <Button size="sm" className="hidden md:inline-flex rounded-full px-6 bg-orange-600 text-white hover:bg-orange-700 border-none transition-all">
                Login <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            <button className="md:hidden text-neutral-300" onClick={() => setMobileOpen((s) => !s)}>
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="absolute top-16 left-0 w-full rounded-2xl border border-neutral-800 bg-[#111111]/95 backdrop-blur-xl p-4 md:hidden shadow-2xl flex flex-col gap-2">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <Link to="/login?role=student" onClick={() => setMobileOpen(false)} className="mt-2">
              <Button size="sm" className="w-full rounded-full bg-orange-600 hover:bg-orange-700 text-white border-none py-5">
                Login
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 px-4 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container mx-auto max-w-4xl relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-[#151515] px-4 py-1.5 text-xs font-medium text-neutral-300 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              {tagline}
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-bold leading-[1.05] tracking-tight text-white">
              Unlock your potential <br className="hidden sm:block" />
              with <span className="text-orange-500">{coachingName}</span>.
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-neutral-400 mt-6 leading-relaxed">
              Explore structured test series, expert faculty guidance, and performance insights — all designed to move your score up.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-8 w-full justify-center">
              <Link to="/login?role=student">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-full bg-orange-600 px-8 py-6 text-base text-white hover:bg-orange-700 border-none transition-transform hover:scale-105"
                >
                  Enroll Today <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#tests">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 py-6 text-base border-neutral-700 text-white bg-neutral-900/50 hover:bg-neutral-800 hover:text-white">
                  Explore Tests
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* NEW SECTION: WHAT WE STAND FOR */}
      <section className="py-16 border-y border-neutral-800/50 bg-[#0f0f0f]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-sm font-bold tracking-widest text-neutral-500 uppercase">What We Stand For</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#141414] border border-neutral-800/60 hover:border-orange-500/30 transition-colors">
              <Target className="h-8 w-8 text-orange-500 mb-4" />
              <h3 className="font-semibold text-white">Proven Results</h3>
            </div>
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#141414] border border-neutral-800/60 hover:border-orange-500/30 transition-colors">
              <Users className="h-8 w-8 text-orange-500 mb-4" />
              <h3 className="font-semibold text-white">Expert Faculty</h3>
            </div>
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#141414] border border-neutral-800/60 hover:border-orange-500/30 transition-colors">
              <BookOpen className="h-8 w-8 text-orange-500 mb-4" />
              <h3 className="font-semibold text-white">Personalised Mentorship</h3>
            </div>
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#141414] border border-neutral-800/60 hover:border-orange-500/30 transition-colors">
              <MessageSquare className="h-8 w-8 text-orange-500 mb-4" />
              <h3 className="font-semibold text-white">1:1 Doubt Support</h3>
            </div>
          </div>
        </div>
      </section>

      {/* NEW FEATURES SECTION */}
      <section id="features" className="py-24 relative bg-[#0a0a0a]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Designed for <span className="text-orange-500">Maximum Impact</span>
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Everything you need to master your exams, built right into the platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl border border-neutral-800 bg-[#121212] hover:bg-[#161616] transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <MonitorPlay className="h-24 w-24 text-orange-500" />
              </div>
              <MonitorPlay className="h-10 w-10 text-orange-500 mb-6 relative z-10" />
              <h3 className="text-2xl font-bold text-white mb-4 relative z-10">Real Exam–Like Test Experience</h3>
              <p className="text-neutral-400 leading-relaxed relative z-10">
                Feels exactly like the actual CUET exam with an authentic interface, realistic timer, and seamless navigation. Practice in the exact environment you'll face on test day.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-neutral-800 bg-[#121212] hover:bg-[#161616] transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="h-24 w-24 text-orange-500" />
              </div>
              <BrainCircuit className="h-10 w-10 text-orange-500 mb-6 relative z-10" />
              <h3 className="text-2xl font-bold text-white mb-4 relative z-10">AI-Powered Advanced Analytics</h3>
              <p className="text-neutral-400 leading-relaxed relative z-10">
                Question-wise accuracy, time taken per question/section, and clear identification of strengths and weak areas. Let data drive your study plan.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-neutral-800 bg-[#121212] hover:bg-[#161616] transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="h-24 w-24 text-orange-500" />
              </div>
              <Clock className="h-10 w-10 text-orange-500 mb-6 relative z-10" />
              <h3 className="text-2xl font-bold text-white mb-4 relative z-10">Time & Accuracy Insights</h3>
              <p className="text-neutral-400 leading-relaxed relative z-10">
                Pinpoint exactly where you lose time. Master your pacing, eliminate guesswork, and optimize your test-taking strategy to maximize your final score.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* EXAM CENTER / TEST SERIES */}
      <section id="tests" className="py-24 bg-[#0c0c0c] border-t border-neutral-800/50 relative">
        <div className="container mx-auto px-4 max-w-6xl relative">
          
          {/* Featured Tests Sub-section */}
          <div className="mb-24">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Featured Series</h2>
                <p className="text-neutral-400">Hand-picked by our experts.</p>
              </div>
            </div>

            {loadingFeatured ? (
              <div className="py-20 flex justify-center text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin mr-3 text-orange-500" />
                Loading curriculum...
              </div>
            ) : featured.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 border border-neutral-800 rounded-2xl bg-[#111]">
                No featured series available right now.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {featured.slice(0, 4).map((t) => (
                  <div key={t.id} className="group flex flex-col rounded-2xl border border-neutral-800 bg-[#141414] overflow-hidden hover:border-neutral-600 transition-all">
                    <div className="aspect-video bg-[#1a1a1a] relative overflow-hidden">
                      {t.coverImage ? (
                        <img src={t.coverImage} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <FileText className="h-10 w-10 opacity-40" />
                        </div>
                      )}
                      {t.subject && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-black/80 backdrop-blur-md text-white rounded border border-white/10">
                            {t.subject}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{t.title}</h3>
                      <div className="flex items-center justify-between mt-auto pt-4">
                        <span className="text-base font-bold text-orange-500">
                          {t.price === "Included" || t.price == 0 ? "Free" : `$${t.price}`}
                        </span>
                        <Link to="/login?role=student">
                          <Button size="sm" variant="ghost" className="text-white hover:text-orange-500 hover:bg-orange-500/10 p-0 h-auto">
                            View <ArrowRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Section: Our Tests (Subject-wise) */}
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Our Tests</h2>
              <p className="text-lg text-neutral-400">Subject-wise mock tests designed specifically for CUET.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cuetSubjects.map((subject, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-neutral-800 bg-[#121212] hover:bg-[#181818] transition-all group flex flex-col justify-between min-h-[160px]">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-neutral-700 text-neutral-400 font-normal">CUET</Badge>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{subject}</h3>
                    <p className="text-sm text-neutral-500">Chapter-wise & Full Mocks</p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-neutral-800/60 flex justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                    <Link to="/login?role=student" className="w-full">
                      <Button size="sm" className="w-full rounded-xl bg-white/5 hover:bg-orange-600 text-white border-none transition-colors">
                        Get Started
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* REVIEWS / TESTIMONIALS */}
      <section id="reviews" className="py-24 border-t border-neutral-800/50">
        <div className="container mx-auto px-4 max-w-6xl">
           <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Happy students sharing experiences :
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {(testimonials.length ? testimonials : []).slice(0, 6).map((t, idx) => (
              <div key={idx} className="p-8 rounded-3xl border border-neutral-800 bg-[#121212] relative">
                <Quote className="absolute top-6 right-6 h-8 w-8 text-orange-500/20" />
                
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="h-12 w-12 border border-neutral-700">
                    <AvatarImage src={t.avatar} />
                    <AvatarFallback className="bg-neutral-800 text-neutral-300">{initials(t.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-white">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.course || "Student"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: Math.max(1, Math.min(5, t.rating || 5)) }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-orange-500 text-orange-500" />
                  ))}
                </div>

                <p className="text-neutral-300 text-sm leading-relaxed italic">
                  "{t.text}"
                </p>
              </div>
            ))}
          </div>
          
          {(!testimonials || testimonials.length === 0) && (
            <div className="text-sm text-neutral-500 text-center border border-neutral-800 rounded-3xl bg-[#111] p-10">
              No reviews available yet.
            </div>
          )}
        </div>
      </section>

      {/* NEW CONTACT SECTION */}
      <section id="contact" className="py-32 bg-[#0c0c0c] border-t border-neutral-800/50 relative overflow-hidden">
        {/* Decorative background blurs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[150px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neutral-600/5 blur-[150px] pointer-events-none rounded-full" />
        
        <div className="container mx-auto px-4 max-w-4xl relative text-center">
          <Badge className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20 px-4 py-1.5 mb-8 rounded-full">
            Get In Touch
          </Badge>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Let's connect.
          </h2>
          <p className="text-xl text-neutral-400 mb-12 max-w-2xl mx-auto">
            Have questions about the courses or need guidance? Reach out to us directly or follow us on our social channels.
          </p>

          <div className="flex flex-col items-center justify-center gap-8 bg-[#141414]/50 border border-neutral-800/60 p-12 rounded-[3rem] backdrop-blur-sm">
            
            {tenant.contact?.email && (
              <a 
                href={`mailto:${tenant.contact.email}`} 
                className="group flex flex-col sm:flex-row items-center gap-4 text-2xl md:text-4xl font-semibold text-white hover:text-orange-500 transition-colors"
              >
                <div className="h-16 w-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-orange-500/50 transition-colors">
                  <Mail className="h-8 w-8 text-neutral-400 group-hover:text-orange-500" />
                </div>
                {tenant.contact.email}
              </a>
            )}

            {!tenant.contact?.email && (
              <div className="text-2xl font-medium text-neutral-500">
                Contact information not provided.
              </div>
            )}

            <div className="w-24 h-[1px] bg-neutral-800 my-4" />

            <div className="flex flex-wrap justify-center gap-4">
              {Object.entries(socials).map(([k, v]) => {
                const Icon = socialIconMap[k];
                if (!Icon) return null;
                return (
                  <a 
                    key={k} 
                    href={v} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-center h-14 w-14 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-orange-600 hover:border-orange-600 transition-all hover:scale-110 shadow-lg" 
                    title={k}
                  >
                    <Icon className="h-6 w-6" />
                  </a>
                );
              })}
              {Object.keys(socials).length === 0 && (
                <span className="text-neutral-500 text-sm">No social links configured.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* NEW ELEGANT BOTTOM CTA CARD */}
      <section className="py-24 relative px-4 border-t border-neutral-800/50">
        <div className="container mx-auto max-w-5xl">
          <div className="relative rounded-[3rem] border border-neutral-700/50 bg-gradient-to-br from-[#1c1c1c] via-[#111111] to-[#0a0a0a] overflow-hidden p-10 md:p-20 text-center shadow-[0_0_80px_rgba(234,88,12,0.05)] group">
            
            {/* Inner subtle glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-orange-600/10 blur-[100px] pointer-events-none rounded-full transition-opacity group-hover:opacity-100 opacity-70" />
            
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Ready to Begin Your Journey <br/> at <span className="text-orange-500">{coachingName}</span>?
              </h2>
              <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-2xl">
                Join thousands of students who have already transformed their preparation strategy. Get instant access to our premium content.
              </p>
              <Link to="/login?role=student">
                <Button size="lg" className="rounded-full bg-orange-600 hover:bg-orange-500 text-white px-12 py-8 text-xl border-none shadow-[0_0_40px_rgba(234,88,12,0.3)] transition-all hover:scale-105 font-semibold">
                  Get Started <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-800 bg-[#050505] pt-16 pb-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid gap-12 md:grid-cols-4 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                {logoUrl ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900 flex-shrink-0">
                    <img src={logoUrl} alt={`${coachingName} logo`} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white flex-shrink-0">
                    <span className="text-sm font-bold">{coachingName?.trim()?.[0]?.toUpperCase() || "U"}</span>
                  </div>
                )}
                <div className="font-bold text-xl text-white">{coachingName}</div>
              </div>
              <p className="text-sm text-neutral-500 mb-6 max-w-xs">{tagline}</p>
            </div>

            <div>
              <div className="font-semibold text-white mb-6">Navigation</div>
              <div className="space-y-4 text-sm text-neutral-400">
                {navLinks.map((l) => (
                  <a key={l.label} className="block hover:text-orange-500 transition-colors" href={l.href}>{l.label}</a>
                ))}
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-6">Legal</div>
              <div className="space-y-4 text-sm text-neutral-400">
                  <Link to="/terms-of-use" className="block hover:text-white transition-colors">Terms of Service</Link>
                  <Link to="/privacy-policy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                <a href="#" className="block hover:text-white transition-colors">Refund Policy</a>
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-6">Powered By</div>
              <div className="text-sm text-neutral-400 leading-relaxed">
                UNIV.LIVE helps educators publish test series, onboard students, and track progress at scale.
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-600">
            <span>© {new Date().getFullYear()} {coachingName}. All rights reserved.</span>
            <span>Built with <span className="text-neutral-500 font-medium">UNIV.LIVE</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
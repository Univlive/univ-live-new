// src/themes/coaching/theme1/TenantHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2,
  Menu,
  X,
  FileText,
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
  Search,
  Laptop,
  BrainCircuit,
  Clock,
  CheckCircle2,
  Users,
  Target,
  Award,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

import { useTenant } from "@app/providers/TenantProvider";
import { db } from "@shared/lib/firebase";
import { collection, documentId, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { Button } from "@shared/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@shared/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/ui/avatar";

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
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfaf8] text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfaf8] text-stone-900">
        <div className="text-center px-6">
          <h2 className="text-3xl font-medium tracking-tight">Coaching not found</h2>
          <p className="text-stone-500 mt-2">
            This coaching website does not exist. Check the URL or contact support.
          </p>
        </div>
      </div>
    );
  }

  const config = tenant.websiteConfig || {};

  const coachingName = config.coachingName || tenant.coachingName || "Your Institute";
  const tagline = config.tagline || tenant.tagline || "Learn smarter. Score higher.";
  
  const defaultHeroImage = "https://plus.unsplash.com/premium_photo-1683887034491-f58b4c4fca72?q=80&w=869&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  const finalHeroImage = config.heroImage || defaultHeroImage;

  const stats: StatItem[] = Array.isArray(config.stats) ? config.stats : [];
  const achievements: AchievementItem[] = Array.isArray(config.achievements) ? config.achievements : [];
  const faculty: FacultyItem[] = Array.isArray(config.faculty) ? config.faculty : [];
  const testimonials: TestimonialItem[] = Array.isArray(config.testimonials) ? config.testimonials : [];

  const faqs: FAQItem[] = Array.isArray(config.faqs) && config.faqs.length > 0 ? config.faqs : [];

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
        if (rows.length > 0) setActiveTestId(rows[0].id);
      } catch {
        setFeatured([]);
      } finally {
        setLoadingFeatured(false);
      }
    }

    loadFeatured();
  }, [educatorId, featuredKey]);

  // UPDATED NAVIGATION LINKS
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

  // Mock Data for CUET Cards
  const cuetSubjects = [
    { name: "English", total: 440, free: 6, lang: "English", attempts: "87,241" },
    { name: "Economics", total: 231, free: 5, lang: "English, हिन्दी", attempts: "47,695" },
    { name: "Business Studies", total: 214, free: 5, lang: "English, हिन्दी", attempts: "38,535" },
    { name: "Mathematics", total: 310, free: 3, lang: "English, हिन्दी", attempts: "65,200" },
    { name: "Accountancy", total: 250, free: 4, lang: "English, हिन्दी", attempts: "41,000" },
    { name: "General Test", total: 500, free: 10, lang: "English, हिन्दी", attempts: "92,000" },
  ];

  return (
    <div id="top" className="min-h-screen bg-[#fcfaf8] text-stone-900 font-sans selection:bg-[#3424d1] selection:text-white">
      
      {/* TOP INFO BAR */}
      <div className="hidden md:flex bg-[#eb5a28] text-white/90 text-sm py-2 px-6 items-center justify-between font-medium">
        <div className="flex items-center gap-6">
          {tenant.contact?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> {tenant.contact.phone}
            </div>
          )}
          {tenant.contact?.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> {tenant.contact.email}
            </div>
          )}
        </div>
        <div className="flex items-center gap-6">
          {tenant.contact?.address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {tenant.contact.address}
            </div>
          )}
          <span className="opacity-75 hidden lg:inline-block">|</span>
          <span className="hidden lg:inline-block">Empowering Futures</span>
        </div>
      </div>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#fcfaf8]/90 backdrop-blur-md border-b border-stone-200">
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3424d1] text-white shadow-sm">
              <span className="text-lg font-bold">
                {coachingName?.trim()?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <span className="text-xl font-medium tracking-tight text-stone-900">
              {coachingName}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-stone-600 transition-colors hover:text-[#3424d1]"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button className="hidden md:flex items-center gap-2 text-stone-600 hover:text-stone-900 font-medium text-[15px]">
              <Search className="h-4 w-4" /> Search
            </button>
            <Link to="/login?role=student">
              <Button variant="outline" className="hidden lg:inline-flex rounded-full px-6 border-stone-300 text-stone-900 font-medium hover:bg-stone-100">
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="rounded-full px-6 bg-[#1a1a1a] text-white hover:bg-[#333] font-medium hidden sm:inline-flex">
                Apply Now
              </Button>
            </Link>

            <button className="md:hidden text-stone-900" onClick={() => setMobileOpen((s) => !s)}>
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-stone-200 bg-[#fcfaf8] px-4 py-4 md:hidden shadow-lg">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-lg font-medium text-stone-600 hover:text-[#3424d1] border-b border-stone-100"
              >
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4">
              <Link to="/login?role=student" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full rounded-full border-stone-300">
                  Log in
                </Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}>
                <Button className="w-full rounded-full bg-[#1a1a1a] text-white">
                  Apply Now
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto z-10 relative">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl sm:text-7xl lg:text-[5.5rem] font-medium leading-[1.05] tracking-tight text-stone-900"
            >
              Your Journey <br />
              Begins at {coachingName.split(' ')[0]}
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 sm:mt-8 max-w-xl text-lg sm:text-xl text-stone-500 leading-relaxed font-light"
            >
              {tagline}. These words reflect a strong educational mission and personal growth journey in our programs.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4"
            >
              <Link to="/signup">
                <Button size="lg" className="rounded-full px-8 h-14 text-base font-medium bg-[#3424d1] hover:bg-[#281baf] text-white">
                  Start Your Journey
                </Button>
              </Link>
              <span className="text-sm font-medium text-stone-500 mt-2 sm:mt-0 sm:ml-4">
                Trusted by {(stats[0]?.value) || "thousands of"} students
              </span>
            </motion.div>
          </div>

          <div className="mt-16 relative w-full h-[400px] sm:h-[500px] lg:h-auto lg:mt-0">
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="lg:absolute lg:top-[-450px] lg:-left-4 w-[280px] h-[360px] lg:w-[320px] lg:h-[440px] rounded-sm overflow-hidden shadow-2xl mx-auto lg:mx-0 z-0 hidden lg:block"
            >
              <img src={finalHeroImage} alt="Students" className="w-full h-full object-cover" />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="lg:absolute lg:top-[-320px] lg:-right-4 w-[280px] h-[360px] lg:w-[320px] lg:h-[400px] rounded-sm overflow-hidden shadow-2xl mx-auto mt-8 lg:mt-0 lg:mx-0 z-0 hidden lg:block"
            >
               <img 
		          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=871&auto=format&fit=crop&ixlib=rb-4.1.0" 
		          alt="Hero Decoration" 
		          className="w-full h-full object-cover" 
		        />
            </motion.div>
          </div>
        </div>
      </section>

      {/* NEW FEATURES SECTION */}
      <section id="features" className="py-24 bg-white border-y border-stone-200">
        <div className="container mx-auto px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-stone-900">
              Powerful Features
            </h2>
            <p className="mt-4 text-stone-500 text-lg font-light">
              Everything you need to succeed, built right into the platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-stone-50 p-8 rounded-2xl border border-stone-100 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-[#3424d1]/10 text-[#3424d1] rounded-xl flex items-center justify-center mb-6">
                <Laptop className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-stone-900 mb-3">Real Exam–Like Test Experience</h3>
              <p className="text-stone-600 font-light leading-relaxed">
                Feels exactly like the actual CUET exam with authentic interface, timer, and navigation.
              </p>
            </div>

            <div className="bg-stone-50 p-8 rounded-2xl border border-stone-100 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-[#eb5a28]/10 text-[#eb5a28] rounded-xl flex items-center justify-center mb-6">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-stone-900 mb-3">AI-Powered Advanced Analytics</h3>
              <p className="text-stone-600 font-light leading-relaxed">
                Question-wise accuracy, time taken per question/section, and clear identification of strengths and weak areas.
              </p>
            </div>

            <div className="bg-stone-50 p-8 rounded-2xl border border-stone-100 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-green-600/10 text-green-600 rounded-xl flex items-center justify-center mb-6">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-stone-900 mb-3">Time & Accuracy Insights</h3>
              <p className="text-stone-600 font-light leading-relaxed">
                Track your pacing across sections to eliminate guesswork, manage your time effectively, and optimize your performance under pressure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE STAND FOR SECTION */}
      <section className="py-24 bg-[#1c1815] text-[#f5f0e6]">
        <div className="container mx-auto px-4 md:px-8">
           <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-white">
              What We Stand For
            </h2>
            <p className="mt-4 text-stone-400 text-lg font-light">
              Our core pillars designed to ensure your absolute success.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center p-6">
              <Award className="h-12 w-12 text-[#eb5a28] mb-4" />
              <h3 className="text-xl font-medium text-white">Proven Result</h3>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <Users className="h-12 w-12 text-[#3424d1] mb-4" />
              <h3 className="text-xl font-medium text-white">Expert Faculty</h3>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <Target className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-white">Personalised Learning & Mentorship</h3>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <ShieldCheck className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-xl font-medium text-white">1:1 Doubt Support</h3>
            </div>
          </div>
        </div>
      </section>

      {/* TEST SERIES SECTION (Combined Existing + New CUET Cards) */}
      <section id="tests" className="py-24 bg-[#fcfaf8]">
        <div className="container mx-auto px-4 md:px-8">
          
          {/* Part 1: Existing Featured Programs */}
          <div className="mb-32">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-stone-900 mb-16">
              Our Academic Programs
            </h2>

            {loadingFeatured ? (
              <div className="flex justify-center text-stone-500 py-20">
                <Loader2 className="h-6 w-6 animate-spin mr-3" /> Loading programs...
              </div>
            ) : featured.length === 0 ? (
              <div className="py-20 text-stone-500 font-light text-xl">
                No featured programs available right now.
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-16 items-start">
                <div className="sticky top-32 overflow-hidden rounded-sm aspect-square lg:aspect-[4/5] bg-stone-100 shadow-xl order-last lg:order-first">
                  {featured.find(f => f.id === activeTestId)?.coverImage ? (
                    <img 
                      key={activeTestId}
                      src={featured.find(f => f.id === activeTestId)?.coverImage} 
                      alt="Program cover" 
                      className="w-full h-full object-cover animate-in fade-in duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-200 text-stone-400">
                      <FileText className="h-16 w-16 opacity-30" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex flex-col mb-12">
                    {featured.slice(0, 6).map((t) => {
                      const isActive = t.id === activeTestId;
                      return (
                        <button
                          key={t.id}
                          onMouseEnter={() => setActiveTestId(t.id)}
                          onClick={() => setActiveTestId(t.id)}
                          className={`text-left py-6 border-b border-stone-200 transition-colors duration-300 ${
                            isActive ? "text-stone-900 border-stone-400" : "text-stone-400 hover:text-stone-600"
                          }`}
                        >
                          <h3 className="text-2xl sm:text-3xl font-medium tracking-tight">{t.title}</h3>
                        </button>
                      )
                    })}
                  </div>

                  <div className="bg-white p-8 rounded-sm shadow-sm border border-stone-100 min-h-[200px]">
                    {featured.map(t => (
                      t.id === activeTestId && (
                        <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <h4 className="text-xl font-medium mb-3">Learn {t.subject || t.title} from the best</h4>
                          <p className="text-stone-600 font-light leading-relaxed mb-6 line-clamp-3">
                            {t.description || "The program is designed to equip students with a strong foundation in the chosen subject, preparing them for advanced challenges."}
                          </p>
                          <div className="flex items-center justify-between mt-auto">
                            <span className={`text-lg font-medium ${t.price === "Included" || t.price == 0 ? "text-[#eb5a28]" : "text-stone-900"}`}>
                              {t.price === "Included" || t.price == 0 ? "Free Access" : `₹${t.price}`}
                            </span>
                            <Link to="/login?role=student">
                              <Button className="rounded-full bg-[#1a1a1a] text-white hover:bg-[#333]">
                                Apply Now
                              </Button>
                            </Link>
                          </div>
                        </motion.div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Part 2: NEW CUET Test Series Cards */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
              <div>
                <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-stone-900">
                  Subject-wise Test Series
                </h2>
                <p className="mt-4 text-stone-500 font-light text-lg">
                  Master individual subjects with comprehensive mocks.
                </p>
              </div>
              <Link to="/login?role=student">
                <Button className="rounded-full bg-[#3424d1] text-white hover:bg-[#281baf] px-6">
                  View All Subjects <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cuetSubjects.map((subject, idx) => (
                <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-xl transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-semibold text-stone-900">{subject.name}</h3>
                      <p className="text-stone-500 text-sm mt-1">{subject.total} Total Tests</p>
                    </div>
                    {/* Simulated Logo/Checkmark from inspiration image */}
                    <div className="bg-orange-500 rounded-full h-10 w-10 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-green-600"></div>
                      <CheckCircle2 className="text-white h-6 w-6 relative z-10" />
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <span className="inline-block bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-sm">
                      {subject.free} Free Test(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-8">
                    <span className="bg-stone-100 text-stone-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> {subject.lang}
                    </span>
                    <span className="bg-stone-100 text-stone-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> {subject.attempts} attempted
                    </span>
                  </div>

                  <Link to="/login?role=student" className="mt-auto w-full">
                    <Button variant="outline" className="w-full rounded-xl border-stone-300 text-stone-700 hover:bg-[#3424d1] hover:text-white hover:border-[#3424d1] transition-colors">
                      Get Started
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <h2 className="text-5xl sm:text-6xl lg:text-[4.5rem] font-medium tracking-tight leading-[1.05] text-stone-900">
                Happy students sharing experiences :
              </h2>
            </div>
            <div>
              <p className="text-stone-500 mb-8 font-light uppercase tracking-widest text-sm">
                Inspired Journeys, Honest Reflections.
              </p>
              {(!testimonials || testimonials.length === 0) ? (
                 <p className="text-stone-400 font-light">No reflections added yet.</p>
              ) : (
                <div className="space-y-16">
                  {testimonials.slice(0, 2).map((t, idx) => (
                    <motion.div 
                      key={`${t.name}-${idx}`}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6 }}
                      className="flex flex-col gap-6"
                    >
                      <p className="text-2xl sm:text-3xl font-light leading-snug text-stone-800">
                        "{t.text}"
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <Avatar className="h-14 w-14 border border-stone-200">
                          <AvatarImage src={t.avatar} />
                          <AvatarFallback className="bg-stone-200 text-stone-600">{initials(t.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-lg text-stone-900">{t.name}</p>
                          <p className="text-sm text-stone-500 mt-0.5">
                            {t.course || "Student"}
                            {t.rating ? ` • ${t.rating} Stars` : ""}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* NEW CONTACT SECTION */}
      <section id="contact" className="py-32 bg-[#1a1a1a] text-white">
        <div className="container mx-auto px-4 md:px-8 flex flex-col items-center text-center">
          <h2 className="text-5xl sm:text-7xl font-medium tracking-tight mb-6">Let's Talk.</h2>
          <p className="text-xl text-stone-400 font-light mb-16 max-w-2xl">
            Have questions about our programs or need mentorship? Reach out directly to our team. We are here to help you succeed.
          </p>

          <div className="bg-[#242424] p-10 md:p-16 rounded-3xl w-full max-w-4xl shadow-2xl border border-stone-800">
            {tenant.contact?.email ? (
               <a 
                 href={`mailto:${tenant.contact.email}`} 
                 className="block text-3xl sm:text-4xl md:text-5xl font-medium text-white hover:text-[#3424d1] transition-colors break-words mb-8"
               >
                 {tenant.contact.email}
               </a>
            ) : (
               <p className="text-2xl text-stone-500 mb-8">Contact email not provided.</p>
            )}

            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 text-stone-300 font-light text-lg border-t border-stone-700 pt-8 mt-8">
               {tenant.contact?.phone && (
                 <div className="flex items-center gap-3">
                   <Phone className="h-5 w-5 text-[#eb5a28]" />
                   <span>{tenant.contact.phone}</span>
                 </div>
               )}
               {tenant.contact?.address && (
                 <div className="flex items-center gap-3">
                   <MapPin className="h-5 w-5 text-[#eb5a28]" />
                   <span>{tenant.contact.address}</span>
                 </div>
               )}
            </div>

            <div className="flex justify-center gap-6 mt-12">
              {Object.entries(socials).map(([k, v]) => {
                const Icon = socialIconMap[k];
                if (!Icon) return null;
                return (
                  <a
                    key={k}
                    href={v}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-stone-800 p-4 rounded-full hover:bg-[#3424d1] hover:text-white hover:scale-110 transition-all shadow-lg"
                    title={k}
                  >
                    <Icon className="h-6 w-6" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* NEW PRE-FOOTER CTA CARD */}
      <section className="py-16 bg-[#fcfaf8]">
        <div className="container mx-auto px-4 md:px-8">
          <div className="bg-gradient-to-r from-[#7a5af8] to-[#5b3cdd] rounded-[2rem] p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

            <div className="relative z-10 max-w-3xl mx-auto">
              <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-white/30">
                🚀 No Payment Required for Trial
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Ready to Begin Your Journey at {coachingName}?
              </h2>
              <p className="text-lg text-white/80 font-light mb-10">
                Experience the real exam environment before you commit. Start your free trial today and access premium study material.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/login?role=student">
                  <Button className="rounded-full bg-white text-[#5b3cdd] hover:bg-stone-100 font-semibold px-8 py-6 text-lg w-full sm:w-auto shadow-lg transition-transform hover:scale-105">
                    Get Started For Free <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="#contact">
                  <Button variant="outline" className="rounded-full bg-transparent border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg w-full sm:w-auto transition-colors">
                    Book a Demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#111] text-stone-400 py-16">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid gap-12 md:grid-cols-4 md:gap-8 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-900 shadow-sm">
                  <span className="text-lg font-bold">{coachingName?.trim()?.[0]?.toUpperCase() || "U"}</span>
                </div>
                <span className="text-2xl font-medium tracking-tight text-white">{coachingName}</span>
              </div>
              <p className="text-stone-400 font-light leading-relaxed">
                {tagline}
              </p>
            </div>

            <div>
              <h4 className="text-white font-medium mb-6 uppercase tracking-wider text-sm">Explore</h4>
              <div className="space-y-3 font-light">
                <a className="block hover:text-white transition-colors cursor-pointer" href="#top">Home</a>
                <a className="block hover:text-white transition-colors cursor-pointer" href="#features">Features</a>
                <a className="block hover:text-white transition-colors cursor-pointer" href="#tests">Programs & Tests</a>
                <Link className="block hover:text-white transition-colors" to="/login?role=student">Student Portal</Link>
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-6 uppercase tracking-wider text-sm">Contact Us</h4>
              <div className="space-y-4 font-light">
                {tenant.contact?.address && (
                  <p className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-stone-500" />
                    <span>{tenant.contact.address}</span>
                  </p>
                )}
                {tenant.contact?.phone && (
                  <p className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-stone-500" />
                    <a className="hover:text-white transition-colors" href={`tel:${tenant.contact.phone}`}>{tenant.contact.phone}</a>
                  </p>
                )}
                {tenant.contact?.email && (
                  <p className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-stone-500" />
                    <a className="hover:text-white transition-colors" href={`mailto:${tenant.contact.email}`}>{tenant.contact.email}</a>
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-6 uppercase tracking-wider text-sm">Connect</h4>
              <div className="flex gap-4 mb-8">
                {Object.entries(socials).map(([k, v]) => {
                  const Icon = socialIconMap[k];
                  if (!Icon) return null;
                  return (
                    <a
                      key={k}
                      href={v}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-stone-800 p-3 rounded-full hover:bg-[#3424d1] hover:text-white transition-all"
                      title={k}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
              <p className="text-xs font-light text-stone-500">
                Powered by UNIV.LIVE to help educators publish and scale.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-light">
            <span>© {new Date().getFullYear()} {coachingName}. All rights reserved.</span>
            <div className="flex gap-6">
              <Link to="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
              <Link to="/terms-of-use" className="hover:text-white">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
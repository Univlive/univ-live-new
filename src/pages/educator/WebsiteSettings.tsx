import { useEffect, useRef, useMemo, useState } from "react";
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  Trophy,
  BookOpen,
  CheckSquare,
  Square,
  User,
  Quote,
  Layout,
  BarChart,
  ImageIcon,
  ArrowRight,
  Sparkles,
  X,
  Palette,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Facebook,
  Globe,
  Mail,
  Phone,
  Wand2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthProvider"; 
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  orderBy
} from "firebase/firestore";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useTenant } from "@/contexts/TenantProvider";
import { uploadToImageKit } from "@/lib/imagekitUpload";
import { aiFeatureFlags, getAiFeatureDisabledMessage } from "@/lib/aiFeatureFlags";
import { DEFAULT_EDUCATOR_THEME, isThemeUnlocked, sanitizeEducatorTheme } from "@/lib/themeFeatureFlags";
import { useAIStream } from "@/hooks/useAIStream";

// --- Types ---
type StatItem = { label: string; value: string; icon: string };
type AchievementItem = { title: string; description: string; icon: string };
type FacultyItem = { name: string; subject: string; designation: string; experience: string; bio: string; image: string };
type TestimonialItem = { name: string; course: string; rating: number; text: string; avatar: string };

// NEW: Social Links (stored inside websiteConfig)
type SocialLinks = {
  website?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  email?: string;
  phone?: string;
};

// New Type for Featured Tests
type AvailableTest = {
  id: string;
  title: string;
  subject: string;
  price: string | number;
};

export default function WebsiteSettings() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- AI Generation with streaming ---
  const { data: generatedContent, loading: aiGenerating, error: aiError, progress: aiProgress, request: requestAI, cancel: cancelAI } = useAIStream();
  
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // AI Input Form
  const [aiEducatorName, setAiEducatorName] = useState("");
  const [aiSubjects, setAiSubjects] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiYearEstablished, setAiYearEstablished] = useState<number | "">("");
  const [aiStudentCount, setAiStudentCount] = useState<number | "">("");

  // --- Existing Website Content State ---
  const [coachingName, setCoachingName] = useState("");
  const [tagline, setTagline] = useState("");
  const [heroImage, setHeroImage] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  // NEW: Theme selection
  const [themeId, setThemeId] = useState<"theme1" | "theme2" | "theme3">(DEFAULT_EDUCATOR_THEME);

  // NEW: Social handles
  const [socials, setSocials] = useState<SocialLinks>({});
  
  const [stats, setStats] = useState<StatItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [faculty, setFaculty] = useState<FacultyItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);

  // --- NEW: Featured Courses State ---
  const [availableTests, setAvailableTests] = useState<AvailableTest[]>([]); 
  const [featuredTestIds, setFeaturedTestIds] = useState<string[]>([]); 

  const [theme2SelectedSubjects, setTheme2SelectedSubjects] = useState<string[]>([]);

  const {tenant} = useTenant();


  const availableSubjects = useMemo(() => {
    return Array.from(
      new Set(
        availableTests
          .map((test) => String(test.subject || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [availableTests]);

  const isAiWebsiteContentEnabled = aiFeatureFlags.websiteContent;
  const theme1Unlocked = isThemeUnlocked("theme1");
  const theme3Unlocked = isThemeUnlocked("theme3");

  // --- AI Generation Function with streaming ---
  const handleGenerateWithAI = async () => {
    if (!isAiWebsiteContentEnabled) {
      toast.error(getAiFeatureDisabledMessage("websiteContent"));
      return;
    }

    if (!aiEducatorName || !aiSubjects || !aiDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const subjectsArray = aiSubjects.split(",").map(s => s.trim()).filter(Boolean);
      if (subjectsArray.length === 0) {
        toast.error("Please enter at least one subject");
        return;
      }

      const content = await requestAI("/api/ai/generate-website-content", {
        coachingName: coachingName || tenant?.coachingName || "Coaching Center",
        educatorName: aiEducatorName,
        subjects: subjectsArray,
        description: aiDescription,
        yearEstablished: aiYearEstablished ? Number(aiYearEstablished) : undefined,
        studentCount: aiStudentCount ? Number(aiStudentCount) : undefined,
      });

      if (content) {
        setShowAIDialog(false);
        setShowConfirmModal(true);
      }
    } catch (err) {
      console.error("Error generating content:", err);
    }
  };

  // --- Cancel AI Generation ---
  const handleCancelAI = () => {
    cancelAI();
    toast.info("Generation cancelled");
  };

  // --- Apply Generated Content ---
  const handleApplyGeneratedContent = () => {
    if (!generatedContent) return;

    setStats(generatedContent.stats || []);
    setAchievements(generatedContent.achievements || []);
    setTestimonials(generatedContent.testimonials || []);
    setFaculty(generatedContent.faculty || []);

    setShowConfirmModal(false);
    toast.success("AI-generated content applied! Review and publish when ready.");
  };

  // --- 1. Fetch All Data ---
  useEffect(() => {
    if (!firebaseUser) return;

    const fetchData = async () => {
      try {
        // A. Fetch Educator Profile (Where websiteConfig lives)
        const educatorRef = doc(db, "educators", firebaseUser.uid);
        const educatorSnap = await getDoc(educatorRef);

        if (educatorSnap.exists()) {
          const data = educatorSnap.data().websiteConfig || {};
          
          // Load existing settings
          setCoachingName(data.coachingName || "");
          setTagline(data.tagline || "");
          setHeroImage(data.heroImage || "");
          setLogoUrl(data.logoUrl || "");
          setStats(data.stats || []);
          setAchievements(data.achievements || []);
          setFaculty(data.faculty || []);
          setTestimonials(data.testimonials || []);

          // NEW: theme + socials
          setThemeId(sanitizeEducatorTheme(data.themeId));
          setSocials((data.socials || {}) as SocialLinks);
          
          // Load Featured Tests selection
          setFeaturedTestIds(data.featuredTestIds || []);

          setTheme2SelectedSubjects(
            Array.isArray(data.theme2SelectedSubjects) ? data.theme2SelectedSubjects : []
          );
        }

        // B. Fetch Educator's Tests (To display in the selection list)
        // We query the 'my_tests' sub-collection
        const testsQuery = query(
          collection(db, "educators", firebaseUser.uid, "my_tests"),
          orderBy("createdAt", "desc")
        );
        const testsSnap = await getDocs(testsQuery);
        
        const testsData = testsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AvailableTest[];
        
        setAvailableTests(testsData);

      } catch (err) {
        console.error("Error loading settings:", err);
        toast.error("Failed to load website settings");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [firebaseUser]);

  
  // --- Image Upload Helpers (ImageKit) ---
  const uploadWebsiteImage = async (file: File, kind: "logo" | "hero") => {
    if (!firebaseUser) throw new Error("Not logged in");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ts = Date.now();
    const folder = `/website-assets/${firebaseUser.uid}`;
    const res = await uploadToImageKit(file, `${kind}-${ts}-${safeName}`, folder, "website");
    return res.url;
  };

  const handleLogoFilePick = async (file?: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadWebsiteImage(file, "logo");
      setLogoUrl(url);
      toast.success("Logo uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleHeroFilePick = async (file?: File | null) => {
    if (!file) return;
    setUploadingHero(true);
    try {
      const url = await uploadWebsiteImage(file, "hero");
      setHeroImage(url);
      toast.success("Hero image uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to upload hero image");
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  };

// --- 2. Save Data ---
  const handleSave = async () => {
    if (!firebaseUser) return;
    setSaving(true);

    try {
      const educatorRef = doc(db, "educators", firebaseUser.uid);
      const safeThemeId = sanitizeEducatorTheme(themeId);

      if (safeThemeId !== themeId) {
        setThemeId(safeThemeId);
      }
      
      // Construct the config object with ALL fields
      const websiteConfig: any = {
        coachingName,
        tagline,
        logoUrl,
        heroImage,
        themeId: safeThemeId,
        socials: {
          website: socials.website || "",
          instagram: socials.instagram || "",
          youtube: socials.youtube || "",
          linkedin: socials.linkedin || "",
          twitter: socials.twitter || "",
          facebook: socials.facebook || "",
          email: socials.email || "",
          phone: socials.phone || "",
        },
        stats,
        achievements,
        faculty,
        testimonials,
        featuredTestIds, // Includes the new selection
        theme2SelectedSubjects,
        updatedAt: new Date()
      };

      // Remove empty social links (keeps Firestore clean)
      if (websiteConfig.socials) {
        Object.keys(websiteConfig.socials).forEach((k) => {
          if (!websiteConfig.socials[k]) delete websiteConfig.socials[k];
        });
        if (Object.keys(websiteConfig.socials).length === 0) {
          delete websiteConfig.socials;
        }
      }

      // Clean undefined values to prevent Firebase errors
      Object.keys(websiteConfig).forEach(key => 
        (websiteConfig as any)[key] === undefined && delete (websiteConfig as any)[key]
      );

      // Save to Firestore
      await updateDoc(educatorRef, { websiteConfig });
      
      toast.success("Website published successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // --- Helper: Toggle Featured Course ---
  const toggleFeatured = (testId: string) => {
    setFeaturedTestIds(prev => 
      prev.includes(testId) 
        ? prev.filter(id => id !== testId) // Remove if already selected
        : [...prev, testId] // Add if not selected
    );
  };


  const toggleTheme2Subject = (subject: string) => {
    setTheme2SelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1 max-w-5xl mx-auto">

      {/* Welcome Banner */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="gradient-bg rounded-2xl p-6 text-white relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYyaDR2MmgtNHYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
              <div className="relative z-10">
                <h1 className="text-2xl sm:text-3xl font-display font-bold mb-2">
                  Welcome back, {tenant?.coachingName || "Educator"}! 👋
                </h1>
                <p className="text-white/80 text-sm sm:text-base max-w-xl">
                  Your website is love! on {" "}
                  <span className="font-semibold text-white">https://{tenant.tenantSlug}.univ.live</span>
                </p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => navigate("/educator/website-builder")}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Open Website Builder
                  </Button>
                  <Button
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => {
                      const slug = tenant?.tenantSlug;
                      if (!slug) {
                        toast.error("Website not available — tenant slug is missing.");
                        return;
                      }
                      const url = `https://${slug}.univ.live`;
                      // Open in a new tab safely
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Visit Your Website
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Website Builder</h1>
          <p className="text-muted-foreground">Manage the content visible on your public website.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-primary/30 hover:bg-primary/5"
                disabled={!isAiWebsiteContentEnabled}
                title={!isAiWebsiteContentEnabled ? getAiFeatureDisabledMessage("websiteContent") : undefined}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Generate Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Website Content with AI</DialogTitle>
                <DialogDescription>
                  Tell us about your coaching center, and our AI will generate professional website content.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="educator-name">Educator Name *</Label>
                  <Input
                    id="educator-name"
                    placeholder="e.g., Dr. Rajesh Kumar"
                    value={aiEducatorName}
                    onChange={(e) => setAiEducatorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subjects">Subjects (comma-separated) *</Label>
                  <Input
                    id="subjects"
                    placeholder="e.g., Physics, Chemistry, Mathematics"
                    value={aiSubjects}
                    onChange={(e) => setAiSubjects(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">About Your Coaching *</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell us about your coaching center, specializations, teaching methodology, etc."
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    className="resize-none"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year-established">Year Established (Optional)</Label>
                    <Input
                      id="year-established"
                      type="number"
                      placeholder="e.g., 2015"
                      value={aiYearEstablished}
                      onChange={(e) => setAiYearEstablished(e.target.value ? Number(e.target.value) : "")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-count">Approx. Students (Optional)</Label>
                    <Input
                      id="student-count"
                      type="number"
                      placeholder="e.g., 500"
                      value={aiStudentCount}
                      onChange={(e) => setAiStudentCount(e.target.value ? Number(e.target.value) : "")}
                    />
                  </div>
                </div>
              </div>
              {aiProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <Loader2 className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" />
                    <div>{aiProgress}</div>
                  </div>
                </div>
              )}
              {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                  <div className="font-medium">Error</div>
                  <div>{aiError}</div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (aiGenerating) {
                      handleCancelAI();
                    } else {
                      setShowAIDialog(false);
                    }
                  }}
                >
                  {aiGenerating ? "Cancel Generation" : "Close"}
                </Button>
                <Button 
                  onClick={handleGenerateWithAI} 
                  disabled={aiGenerating || !isAiWebsiteContentEnabled}
                  className="gradient-bg text-white"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* {!isAiWebsiteContentEnabled ? (
            <p className="text-xs text-muted-foreground">
              {getAiFeatureDisabledMessage("websiteContent")}
            </p>
          ) : null} */}

          <Button onClick={handleSave} disabled={saving} className="gradient-bg text-white shadow-md">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Publish Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 justify-start mb-6">
          <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card shadow-sm"><Layout className="w-4 h-4 mr-2" /> General</TabsTrigger>
          <TabsTrigger value="courses" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card shadow-sm"><BookOpen className="w-4 h-4 mr-2" /> Featured</TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card shadow-sm"><BarChart className="w-4 h-4 mr-2" /> Stats</TabsTrigger>
          <TabsTrigger value="achievements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card shadow-sm"><Trophy className="w-4 h-4 mr-2" /> Awards</TabsTrigger>
          <TabsTrigger value="faculty" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card shadow-sm"><User className="w-4 h-4 mr-2" /> Faculty</TabsTrigger>
          <TabsTrigger value="testimonials" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card shadow-sm"><Quote className="w-4 h-4 mr-2" /> Reviews</TabsTrigger>
        </TabsList>

        {/* --- 1. General Tab --- */}
        <TabsContent value="general" className="space-y-6">
          {/* Theme selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Website Theme
              </CardTitle>
              <CardDescription>
                Choose how your public landing page looks on your subdomain. (Student dashboard stays the same.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!theme1Unlocked) return;
                    setThemeId("theme1");
                  }}
                  disabled={!theme1Unlocked}
                  className={
                    `text-left rounded-xl border p-4 transition-all hover:bg-muted/40 ` +
                    (!theme1Unlocked
                      ? "border-border opacity-60 cursor-not-allowed"
                      : themeId === "theme1"
                        ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                        : "border-border")
                  }
                >
                  <div className="font-semibold">Theme 1</div>
                  <div className="text-xs text-muted-foreground mt-1">Classic Univ.Live landing</div>
                  <div className="text-xs mt-3">{theme1Unlocked ? "Available" : "Locked by config"}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeId("theme2")}
                  className={
                    `text-left rounded-xl border p-4 transition-all hover:bg-muted/40 ` +
                    (themeId === "theme2" ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "border-border")
                  }
                >
                  <div className="font-semibold">Theme 2</div>
                  <div className="text-xs text-muted-foreground mt-1">Modern creator-style landing</div>
                  <div className="text-xs mt-3">✅ Available</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!theme3Unlocked) return;
                    setThemeId("theme3");
                  }}
                  disabled={!theme3Unlocked}
                  className={
                    `text-left rounded-xl border p-4 transition-all hover:bg-muted/40 ` +
                    (!theme3Unlocked
                      ? "border-border opacity-60 cursor-not-allowed"
                      : themeId === "theme3"
                        ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                        : "border-border")
                  }
                >
                  <div className="font-semibold">Theme 3</div>
                  <div className="text-xs text-muted-foreground mt-1">More advanced</div>
                  <div className="text-xs mt-3">{theme3Unlocked ? "New arrival" : "Locked by config"}</div>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: After selecting a theme, click <span className="font-medium">Publish Changes</span>.
              </p>
            </CardContent>
          </Card>

           <Card>
             <CardHeader>
               <CardTitle>Hero Section</CardTitle>
               <CardDescription>This is the first thing students see on your landing page.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo Image URL (Suggested dimentions: 512*512)</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                    <div className="flex gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoFilePick(e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                      >
                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                      </Button>
                      {logoUrl ? (
                        <Button type="button" variant="ghost" onClick={() => setLogoUrl("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {logoUrl ? (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-14 w-14 rounded-xl overflow-hidden border bg-muted/30">
                        <img src={logoUrl} alt="Logo Preview" className="h-full w-full object-cover" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Tip: Use a square logo (512×512) for best results.
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No logo provided</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Institute Name</Label>
                  <Input 
                    value={coachingName} 
                    onChange={e => setCoachingName(e.target.value)} 
                    placeholder="e.g. Acme Academy"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tagline / Headline</Label>
                  <Input 
                    value={tagline} 
                    onChange={e => setTagline(e.target.value)} 
                    placeholder="e.g. Empowering Next Gen Leaders"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hero Image URL (Suggested dimentions: 1080*1080)</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      value={heroImage} 
                      onChange={e => setHeroImage(e.target.value)} 
                      placeholder="https://example.com/hero.jpg"
                    />
                    <div className="flex gap-2">
                      <input
                        ref={heroInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleHeroFilePick(e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => heroInputRef.current?.click()}
                        disabled={uploadingHero}
                      >
                        {uploadingHero ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                      </Button>
                      {heroImage ? (
                        <Button type="button" variant="ghost" onClick={() => setHeroImage("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {heroImage ? (
                    <div className="mt-2 relative h-40 rounded-md overflow-hidden border">
                      <img src={heroImage} alt="Hero Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="mt-2 h-40 rounded-md border border-dashed flex items-center justify-center bg-muted/30">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <span className="text-xs">No image provided</span>
                      </div>
                    </div>
                  )}
                </div>
             </CardContent>
           </Card>

           {/* Social Links */}
           <Card>
             <CardHeader>
               <CardTitle>Social Links</CardTitle>
               <CardDescription>Add your social handles (shown on your landing page footer).</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={socials.email || ""}
                      onChange={(e) => setSocials((p) => ({ ...p, email: e.target.value }))}
                      placeholder="support@yourcoaching.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Phone
                    </Label>
                    <Input
                      value={socials.phone || ""}
                      onChange={(e) => setSocials((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                    />
                  </div>

                 <div className="space-y-2">
                   <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Website</Label>
                   <Input
                     value={socials.website || ""}
                     onChange={(e) => setSocials((p) => ({ ...p, website: e.target.value }))}
                     placeholder="https://your-site.com"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label className="flex items-center gap-2"><Instagram className="h-4 w-4" /> Instagram</Label>
                   <Input
                     value={socials.instagram || ""}
                     onChange={(e) => setSocials((p) => ({ ...p, instagram: e.target.value }))}
                     placeholder="https://instagram.com/yourhandle"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label className="flex items-center gap-2"><Youtube className="h-4 w-4" /> YouTube</Label>
                   <Input
                     value={socials.youtube || ""}
                     onChange={(e) => setSocials((p) => ({ ...p, youtube: e.target.value }))}
                     placeholder="https://youtube.com/@yourchannel"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label className="flex items-center gap-2"><Linkedin className="h-4 w-4" /> LinkedIn</Label>
                   <Input
                     value={socials.linkedin || ""}
                     onChange={(e) => setSocials((p) => ({ ...p, linkedin: e.target.value }))}
                     placeholder="https://linkedin.com/in/yourprofile"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label className="flex items-center gap-2"><Twitter className="h-4 w-4" /> X (Twitter)</Label>
                   <Input
                     value={socials.twitter || ""}
                     onChange={(e) => setSocials((p) => ({ ...p, twitter: e.target.value }))}
                     placeholder="https://x.com/yourhandle"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label className="flex items-center gap-2"><Facebook className="h-4 w-4" /> Facebook</Label>
                   <Input
                     value={socials.facebook || ""}
                     onChange={(e) => setSocials((p) => ({ ...p, facebook: e.target.value }))}
                     placeholder="https://facebook.com/yourpage"
                   />
                 </div>
               </div>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- 2. Featured Courses Tab (NEW SECTION) --- */}
        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>Featured Test Series</CardTitle>
              <CardDescription>
                Select which tests appear on your home page. 
                <span className="block mt-1 text-xs text-muted-foreground">
                  Note: If you don't select any, the 4 newest tests will be shown automatically.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableTests.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/20">
                  <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No tests found</p>
                  <p className="text-sm text-muted-foreground">Go to the "Test Series" tab to create your first exam.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTests.map((test) => {
                    const isSelected = featuredTestIds.includes(test.id);
                    return (
                      <div 
                        key={test.id}
                        onClick={() => toggleFeatured(test.id)}
                        className={`
                          cursor-pointer flex items-center gap-3 p-4 rounded-lg border transition-all select-none
                          ${isSelected 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                            : 'border-border hover:bg-muted/50'}
                        `}
                      >
                        <div className={`
                          flex items-center justify-center
                          ${isSelected ? 'text-primary' : 'text-muted-foreground'}
                        `}>
                           {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-1">{test.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">
                               {test.subject}
                             </span>
                             <span className={`text-xs font-medium ${test.price === "Included" ? "text-green-600" : ""}`}>
                               {test.price === "Included" ? "Free" : `₹${test.price}`}
                             </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>


          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Theme 2 Subject Visibility</CardTitle>
              <CardDescription>
                Select which subjects should appear in the “Our Tests” section of Theme 2.
                <span className="block mt-1 text-xs text-muted-foreground">
                  If you leave this empty, Theme 2 can fall back to showing top subjects automatically.
                </span>
              </CardDescription>
            </CardHeader>

            <CardContent>
              {availableSubjects.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No subjects found yet. Create tests with subject names first, then they will appear here.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTheme2SelectedSubjects(availableSubjects)}
                    >
                      Select all
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTheme2SelectedSubjects([])}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableSubjects.map((subject) => {
                      const isSelected = theme2SelectedSubjects.includes(subject);

                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleTheme2Subject(subject)}
                          className={`
                            w-full text-left cursor-pointer flex items-center gap-3 p-4 rounded-lg border transition-all
                            ${isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:bg-muted/50"}
                          `}
                        >
                          <div className={isSelected ? "text-primary" : "text-muted-foreground"}>
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5" />
                            ) : (
                              <Square className="h-5 w-5" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{subject}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- 3. Stats Tab --- */}
        <TabsContent value="stats">
           <Card>
             <CardHeader>
               <CardTitle>Key Statistics</CardTitle>
               <CardDescription>Showcase your institute's impact.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               {stats.map((stat, idx) => (
                 <div key={idx} className="flex gap-4 items-end p-3 border rounded-lg bg-card">
                    <div className="flex-1 space-y-2">
                       <Label>Label</Label>
                       <Input 
                         value={stat.label} 
                         onChange={e => {
                           const list = [...stats]; list[idx].label = e.target.value; setStats(list);
                         }} 
                         placeholder="e.g. Students"
                       />
                    </div>
                    <div className="flex-1 space-y-2">
                       <Label>Value</Label>
                       <Input 
                         value={stat.value} 
                         onChange={e => {
                           const list = [...stats]; list[idx].value = e.target.value; setStats(list);
                         }} 
                         placeholder="e.g. 1000+"
                       />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => {
                       setStats(stats.filter((_, i) => i !== idx));
                    }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                 </div>
               ))}
               <Button variant="outline" className="w-full border-dashed" onClick={() => setStats([...stats, { label: "", value: "", icon: "Users" }])}>
                 <Plus className="mr-2 h-4 w-4" /> Add Stat
               </Button>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- 4. Achievements Tab --- */}
        <TabsContent value="achievements">
           <Card>
             <CardHeader>
               <CardTitle>Awards & Achievements</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               {achievements.map((item, idx) => (
                 <div key={idx} className="p-4 border rounded-lg space-y-4 relative bg-card">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2"
                      onClick={() => setAchievements(achievements.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Title</Label>
                          <Input value={item.title} onChange={e => {
                            const list = [...achievements]; list[idx].title = e.target.value; setAchievements(list);
                          }} placeholder="e.g. Best Coaching 2024" />
                       </div>
                       <div className="space-y-2">
                          <Label>Description</Label>
                          <Input value={item.description} onChange={e => {
                            const list = [...achievements]; list[idx].description = e.target.value; setAchievements(list);
                          }} placeholder="Short detail..." />
                       </div>
                    </div>
                 </div>
               ))}
               <Button variant="outline" className="w-full border-dashed" onClick={() => setAchievements([...achievements, { title: "", description: "", icon: "Trophy" }])}>
                 <Plus className="mr-2 h-4 w-4" /> Add Achievement
               </Button>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- 5. Faculty Tab --- */}
        <TabsContent value="faculty">
           <Card>
             <CardHeader>
               <CardTitle>Our Faculty</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               {faculty.map((item, idx) => (
                 <div key={idx} className="p-4 border rounded-lg space-y-4 relative bg-card">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2"
                      onClick={() => setFaculty(faculty.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Name</Label>
                          <Input value={item.name} onChange={e => {
                            const list = [...faculty]; list[idx].name = e.target.value; setFaculty(list);
                          }} placeholder="Dr. Smith" />
                       </div>
                       <div className="space-y-2">
                          <Label>Subject / Designation</Label>
                          <Input value={item.subject} onChange={e => {
                            const list = [...faculty]; list[idx].subject = e.target.value; setFaculty(list);
                          }} placeholder="Physics HOD" />
                       </div>
                       <div className="space-y-2 md:col-span-2">
                          <Label>Bio</Label>
                          <Textarea value={item.bio} onChange={e => {
                            const list = [...faculty]; list[idx].bio = e.target.value; setFaculty(list);
                          }} placeholder="10+ years experience..." />
                       </div>
                       <div className="space-y-2 md:col-span-2">
                          <Label>Image URL</Label>
                          <Input value={item.image} onChange={e => {
                            const list = [...faculty]; list[idx].image = e.target.value; setFaculty(list);
                          }} placeholder="https://..." />
                       </div>
                    </div>
                 </div>
               ))}
               <Button variant="outline" className="w-full border-dashed" onClick={() => setFaculty([...faculty, { name: "", subject: "", designation: "", experience: "", bio: "", image: "" }])}>
                 <Plus className="mr-2 h-4 w-4" /> Add Faculty Member
               </Button>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- 6. Testimonials Tab --- */}
        <TabsContent value="testimonials">
          <Card>
            <CardHeader>
               <CardTitle>Student Reviews</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-6">
                {testimonials.map((item, idx) => (
                  <div key={idx} className="p-4 border rounded-lg relative bg-card">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2"
                      onClick={() => setTestimonials(testimonials.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Student Name</Label>
                          <Input value={item.name} onChange={e => {
                            const list = [...testimonials]; list[idx].name = e.target.value; setTestimonials(list);
                          }} />
                       </div>
                       <div className="space-y-2">
                          <Label>Course/Exam</Label>
                          <Input value={item.course} onChange={e => {
                            const list = [...testimonials]; list[idx].course = e.target.value; setTestimonials(list);
                          }} />
                       </div>
                       <div className="space-y-2 md:col-span-2">
                          <Label>Review Text</Label>
                          <Textarea value={item.text} onChange={e => {
                            const list = [...testimonials]; list[idx].text = e.target.value; setTestimonials(list);
                          }} />
                       </div>
                       <div className="space-y-2">
                          <Label>Avatar URL</Label>
                          <Input value={item.avatar} onChange={e => {
                            const list = [...testimonials]; list[idx].avatar = e.target.value; setTestimonials(list);
                          }} placeholder="https://..." />
                       </div>
                       <div className="space-y-2">
                          <Label>Rating (1-5)</Label>
                          <Input type="number" max={5} min={1} value={item.rating} onChange={e => {
                            const list = [...testimonials]; list[idx].rating = Number(e.target.value); setTestimonials(list);
                          }} />
                       </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full border-dashed" onClick={() => setTestimonials([...testimonials, { name: "", course: "", text: "", rating: 5, avatar: "" }])}>
                   <Plus className="mr-2 h-4 w-4" /> Add Testimonial
                </Button>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- AI Content Confirmation Modal --- */}
      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Review AI-Generated Content
            </AlertDialogTitle>
            <AlertDialogDescription>
              Here's the professional content our AI generated for your website. Review and make adjustments as needed before applying.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {generatedContent && (
            <div className="space-y-6 py-4">
              {/* Stats Preview */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">📊 Key Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {generatedContent.stats?.map((stat: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg text-center text-sm">
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                      <div className="font-bold text-lg mt-1">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements Preview */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">🏆 Awards & Achievements</h3>
                <div className="space-y-2">
                  {generatedContent.achievements?.map((achievement: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                      <div className="font-semibold">{achievement.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{achievement.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Faculty Preview */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">👥 Faculty</h3>
                <div className="space-y-2">
                  {generatedContent.faculty?.map((member: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-xs text-muted-foreground">{member.subject} • {member.designation}</div>
                      <div className="text-xs mt-2">{member.bio}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Testimonials Preview */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">⭐ Student Reviews</h3>
                <div className="space-y-2">
                  {generatedContent.testimonials?.map((testimonial: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{testimonial.name}</div>
                          <div className="text-xs text-muted-foreground">{testimonial.course}</div>
                        </div>
                        <div className="text-xs">⭐ {testimonial.rating}/5</div>
                      </div>
                      <div className="text-xs mt-2 italic">"{testimonial.text}"</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Discard & Edit Manually</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApplyGeneratedContent}
              className="gradient-bg text-white"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Apply Generated Content
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

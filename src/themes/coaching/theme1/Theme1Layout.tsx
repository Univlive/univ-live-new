// src/themes/coaching/theme1/Theme1Layout.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Menu,
  X,
  Moon,
  Sun,
  Globe,
  Send,
  MessageCircle,
} from "lucide-react";

import { useTenant } from "@app/providers/TenantProvider";
import { useFavicon } from "@shared/hooks/useFavicon";
import { Button } from "@shared/ui/button";

interface Theme1LayoutProps {
  children?: React.ReactNode;
}

export default function Theme1Layout({ children }: Theme1LayoutProps) {
  const { tenant } = useTenant();

  const config = tenant?.websiteConfig || {};
  const coachingName = config.coachingName || tenant?.coachingName || "Your Institute";
  const tagline = config.tagline || tenant?.tagline || "";
  const socials = (config.socials || {}) as Record<string, string>;
  const logoUrl: string | undefined = config.logoUrl;

  // Set dynamic favicon + page title for this educator's subdomain
  useFavicon(logoUrl, coachingName);

  const phone = tenant?.contact?.phone || "";
  const email = tenant?.contact?.email || "";
  const address = tenant?.contact?.address || "";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const navItems = [
    { label: "Home", path: "/" },
    { label: "Courses", path: "/courses" },
    { label: "Login", path: "/login?role=student" },
  ];

  const socialIcons: Record<string, any> = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    linkedin: Linkedin,
    website: Globe,
    telegram: Send,
    whatsapp: MessageCircle,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      {(phone || email || Object.keys(socials || {}).length > 0) && (
        <div className="bg-muted/40 text-sm">
          <div className="container mx-auto px-4 py-2 flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              {phone ? <span>{phone}</span> : null}
              {email ? <span>{email}</span> : null}
            </div>

            <div className="flex items-center gap-3">
              {Object.entries(socials || {}).map(([platform, url]) => {
                const Icon = socialIcons[platform];
                if (!Icon || !url) return null;
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary"
                    title={platform}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {logoUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden border bg-muted/30 flex items-center justify-center flex-shrink-0">
                <img
                  src={logoUrl}
                  alt={`${coachingName} logo`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white flex-shrink-0">
                🎓
              </div>
            )}
            <div>
              <div className="font-bold">{coachingName}</div>
              <div className="text-xs text-muted-foreground">{tagline}</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className="text-muted-foreground hover:text-foreground font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-md">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <Link to="/login?role=student">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/signup">
              <Button>Enroll Now</Button>
            </Link>

            {/* Mobile Toggle */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-background z-50">
            <div className="p-4 flex justify-between items-center border-b">
              <span className="font-bold">{coachingName}</span>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-muted/30 border-t mt-12">
        <div className="container mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {logoUrl ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center flex-shrink-0">
                  <img src={logoUrl} alt={`${coachingName} logo`} className="h-full w-full object-contain" />
                </div>
              ) : null}
              <div className="font-bold">{coachingName}</div>
            </div>
            <p className="text-sm text-muted-foreground">{tagline}</p>
          </div>

          <div>
            <div className="font-semibold mb-3">Quick Links</div>
            <ul className="space-y-2 text-sm">
              {navItems.map((item) => (
                <li key={item.label}>
                  <Link to={item.path}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-semibold mb-3">Contact</div>
            <p className="text-sm">{address || "Contact details not set"}</p>
            {phone ? <p className="text-sm">{phone}</p> : null}
            {email ? <p className="text-sm">{email}</p> : null}
          </div>

          <div>
            <div className="font-semibold mb-3">Follow Us</div>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(socials || {}).map(([platform, url]) => {
                const Icon = socialIcons[platform];
                if (!Icon || !url) return null;
                return (
                  <a key={platform} href={url} target="_blank" rel="noreferrer">
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-center text-sm py-4 border-t">
          © {new Date().getFullYear()} {coachingName}. Powered by UNIV.LIVE
        </div>
      </footer>
    </div>
  );
}


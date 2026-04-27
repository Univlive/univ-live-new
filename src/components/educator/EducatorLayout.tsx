import { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  Key,
  MessageSquare,
  Globe,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, stringToColor } from "@/lib/utils";
import { buildTenantUrl } from "@/lib/tenant";
import univLogo from "@/assets/univ-logo-1.png";
import { useAuth } from "@/contexts/AuthProvider";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type SidebarItem = {
  icon: any;
  label: string;
  href: string;
  badge?: number;
};

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ED";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function EducatorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const { profile } = useAuth();

  const educatorName = profile?.displayName || profile?.fullName || "Educator";
  const educatorEmail = profile?.email || "No email";
  const tenantSlug = profile?.tenantSlug || "";
  const photoURL = profile?.photoURL;
  const userInitials = initials(educatorName);

  useEffect(() => {
    const uid = profile?.uid;
    if (!uid) {
      setUnreadMessages(0);
      return;
    }

    const unreadQuery = query(collection(db, "support_threads"), where("educatorId", "==", uid));

    const unsub = onSnapshot(
      unreadQuery,
      (snap) => {
        let total = 0;
        snap.docs.forEach((docSnap) => {
          total += Number((docSnap.data() as any)?.unreadCountEducator || 0);
        });
        setUnreadMessages(total);
      },
      () => setUnreadMessages(0)
    );

    return () => unsub();
  }, [profile?.uid]);

  const sidebarItems = useMemo<SidebarItem[]>(
    () => [
      { icon: LayoutDashboard, label: "Dashboard", href: "/educator/dashboard" },
      { icon: Users, label: "Learners", href: "/educator/learners" },
      { icon: FileText, label: "Test Series", href: "/educator/test-series" },
      { icon: Library, label: "Question Bank", href: "/educator/question-bank" },
      { icon: Key, label: "Access Codes", href: "/educator/access-codes" },
      { icon: Globe, label: "Edit Theme/Website", href: "/educator/website-settings" },
      { icon: CreditCard, label: "Billing & Plan", href: "/educator/billing" },
      { icon: Settings, label: "Settings", href: "/educator/settings" },
      {
        icon: MessageSquare,
        label: "Help",
        href: "/educator/messages",
        badge: unreadMessages > 0 ? unreadMessages : undefined,
      },
    ],
    [unreadMessages]
  );

  const isActive = (href: string) => {
    if (href === "/educator/dashboard") {
      return location.pathname === "/educator" || location.pathname === href;
    }
    if (href === "/educator/learners") {
      return location.pathname === href || location.pathname.startsWith("/educator/learners/");
    }
    return location.pathname === href;
  };

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith("/educator/learners/")) return "Learner Deep Dive";
    const tail = location.pathname.split("/").pop() || "dashboard";
    return tail.replace(/-/g, " ");
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login?role=educator");
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewWebsite = () => {
    if (!tenantSlug) {
      navigate("/educator/website-settings");
      return;
    }

    window.open(buildTenantUrl(tenantSlug, "/"), "_blank");
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0 lg:static lg:top-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <Link to="/" className="flex items-center gap-2">
              <img src={univLogo} alt="UNIV.LIVE" className="h-8 w-auto" />
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {sidebarItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                    active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 gradient-bg rounded-lg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <item.icon className={cn("h-5 w-5 relative z-10", active && "text-white")} />
                  <span className="relative z-10">{item.label}</span>
                  {item.badge ? (
                    <Badge variant="secondary" className={cn("ml-auto relative z-10 text-xs", active && "bg-white/20 text-white")}>
                      {item.badge}
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border mt-auto">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Educator</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground capitalize">
                {pageTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    {photoURL && <AvatarImage src={photoURL} />}
                    <AvatarFallback style={{ backgroundColor: stringToColor(userInitials) }}>
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium">{educatorName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{educatorName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{educatorEmail}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/educator/settings")}> 
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewWebsite}>
                  <Globe className="h-4 w-4 mr-2" />
                  View Website
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

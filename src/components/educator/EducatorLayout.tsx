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
  Bell,
  ChevronRight,
  Shield,
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
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import univLogo from "@/assets/univ-logo-1.png";

import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";

type SidebarItem = {
  icon: any;
  label: string;
  href: string;
  badge?: number;
};

export default function EducatorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();

  const educatorId = tenant?.educatorId || profile?.educatorId || null;

  const [unreadMessages, setUnreadMessages] = useState(0);

  // Live unread count for support threads
  useEffect(() => {
    if (!educatorId) {
      setUnreadMessages(0);
      return;
    }

    const q = query(
      collection(db, "support_threads"),
      where("educatorId", "==", educatorId),
      where("unreadCountEducator", ">", 0)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setUnreadMessages(snap.size);
      },
      (err) => {
        console.error(err);
        setUnreadMessages(0);
      }
    );

    return () => unsub();
  }, [educatorId]);

  const sidebarItems = useMemo<SidebarItem[]>(
    () => [
      { icon: LayoutDashboard, label: "Dashboard", href: "/educator/dashboard" },
      { icon: Users, label: "Learners", href: "/educator/learners" },
      { icon: FileText, label: "Test Series", href: "/educator/test-series" },
      { icon: Key, label: "Access Codes", href: "/educator/access-codes" },
      {
        icon: MessageSquare,
        label: "Messages",
        href: "/educator/messages",
        badge: unreadMessages > 0 ? unreadMessages : undefined,
      },
      { icon: Globe, label: "Edit Theme/Website", href: "/educator/website-settings" },
      { icon: CreditCard, label: "Billing & Plan", href: "/educator/billing" },
      { icon: Settings, label: "Settings", href: "/educator/settings" },
    ],
    [unreadMessages]
  );

  const isActive = (href: string) => {
    if (href === "/educator/test-series") return location.pathname.startsWith("/educator/test-series");
    return location.pathname === href;
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      navigate("/login");
    } catch (e) {
      console.error(e);
    }
  };

  const initials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (authLoading || tenantLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
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

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight">Educator Hub</span>
            </div>
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
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {item.badge != null && (
                    <Badge variant="secondary" className={cn("ml-auto", active ? "bg-primary-foreground/20 text-white" : "")}>
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive rounded-xl" onClick={handleLogout}>
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Educator</span>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground capitalize">
                {location.pathname.split("/").pop()?.replace("-", " ") || "Dashboard"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative rounded-xl">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadMessages > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-3 px-2 hover:bg-muted rounded-xl">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={firebaseUser?.photoURL || ""} />
                    <AvatarFallback>{initials(firebaseUser?.displayName || "Ed")}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold leading-none">{firebaseUser?.displayName || "Educator"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Admin</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/educator/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/educator/billing">Billing</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

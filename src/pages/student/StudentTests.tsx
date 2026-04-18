import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldOff, ShieldCheck, Search, Folder, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { TestCard } from "@/components/student/TestCard";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function StudentTests() {
  const nav = useNavigate();
  const { firebaseUser, role, enrolledTenants, loading: authLoading } = useAuth();
  const { tenant, tenantSlug, isTenantDomain, loading: tenantLoading } = useTenant();

  const educatorId = tenant?.educatorId || "";
    const [seatActive, setSeatActive] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);

  const [tests, setTests] = useState<any[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Map<string, number | null>>(new Map());
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && role && role !== "STUDENT") nav("/login?role=student");
  }, [authLoading, role, nav]);

  // Ensure student appears in educator learners list (idempotent)
  useEffect(() => {
    (async () => {
      if (!firebaseUser || !tenantSlug || !isTenantDomain) return;
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch("/api/tenant/register-student", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tenantSlug }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn("[StudentTests] register-student failed:", data?.error || res.statusText);
        }
      } catch (err) {
        console.warn("[StudentTests] register-student request failed:", err);
      }
    })();
  }, [firebaseUser, tenantSlug, isTenantDomain]);

  // Subscribe to billing access (subscription + seat)
  useEffect(() => {
    if (!firebaseUser?.uid || !educatorId) {
      setBillingLoading(false);
      return;
    }

    setBillingLoading(true);

    const unsubSeat = onSnapshot(doc(db, "educators", educatorId, "billingSeats", firebaseUser.uid), (snap) => {
      const s = String((snap.data() as any)?.status || "").toLowerCase();
      setSeatActive(s === "active");
      setBillingLoading(false);
    });

    return () => {
      unsubSeat();
    };
  }, [firebaseUser?.uid, educatorId]);

  const enrolledHere = tenantSlug ? enrolledTenants.includes(tenantSlug) : false;
  const allowed = enrolledHere && seatActive;

  // Load tests (only if allowed)
  useEffect(() => {
    if (!allowed || !educatorId) {
      setTests([]);
      return;
    }

    const qTests = query(collection(db, "educators", educatorId, "my_tests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qTests, (snap) => {
      setTests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });

    return () => unsub();
  }, [allowed, educatorId]);

  // Load unlocked tests (optional feature you already had)
  useEffect(() => {
    if (!firebaseUser?.uid || !educatorId) return;

    const qUnlock = query(
      collection(db, "testUnlocks"),
      where("studentId", "==", firebaseUser.uid),
      where("educatorId", "==", educatorId)
    );

    const unsub = onSnapshot(qUnlock, (snap) => {
      const m = new Map<string, number | null>();
      snap.docs.forEach((d) => {
        const data: any = d.data();
        const tid = String(data.testSeriesId || data.testId || "");
        if (!tid) return;
        const we = data?.windowExpiresAt;
        const expMs = typeof we?.toMillis === "function" ? we.toMillis() : null;
        const existing = m.get(tid);
        // Keep most permissive: null (no expiry) wins; otherwise take latest expiry
        if (existing === undefined) {
          m.set(tid, expMs);
        } else if (existing !== null && expMs === null) {
          m.set(tid, null);
        } else if (existing !== null && expMs !== null && expMs > existing) {
          m.set(tid, expMs);
        }
      });
      setUnlockedIds(m);
    });

    return () => unsub();
  }, [firebaseUser?.uid, educatorId]);

  // Fetch student attempt counts for this educator
  useEffect(() => {
    if (!firebaseUser?.uid || !educatorId) return;

    const qAttempts = query(
      collection(db, "attempts"),
      where("studentId", "==", firebaseUser.uid),
      where("educatorId", "==", educatorId),
      where("status", "==", "submitted")
    );

    const unsub = onSnapshot(qAttempts, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const a = d.data();
        const tid = String(a.testId || "");
        if (tid) {
          counts[tid] = (counts[tid] || 0) + 1;
        }
      });
      setAttemptCounts(counts);
    });

    return () => unsub();
  }, [firebaseUser?.uid, educatorId]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const normalizeSubjectName = (sub: string) => {
    const s = sub.trim().toLowerCase();
    
    // Exact mapping for requested subjects
    if (s === "bst" || s === "business studies" || s === "business study") return "Business Studies";
    if (s === "phy" || s === "physics") return "Physics";
    if (s === "chem" || s === "chemistry") return "Chemistry";
    if (s === "math" || s === "maths" || s === "mathematics") return "Maths";
    if (s === "eng" || s === "english") return "English";
    if (s === "gt" || s === "general test") return "General Test";
    if (s === "acc" || s === "accountancy" || s === "accounts") return "Accountancy";
    if (s === "eco" || s === "economics") return "Economics";
    if (s === "geo" || s === "geography") return "Geography";
    if (s === "pol sc" || s === "political science" || s === "polscience" || s === "polity") return "Political Science";
    if (s === "hist" || s === "history") return "History";

    // Default: Capitalize first letter of each word
    return sub.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q));
  }, [tests, search]);

  const groupedTests = useMemo(() => {
    const groups: Record<string, { name: string; type: "subject" | "uncategorized", tests: any[] }> = {};

    filteredTests.forEach(t => {
      if (t.subject) {
        const normalizedName = normalizeSubjectName(t.subject);
        const subKey = `subject_${normalizedName.toLowerCase().replace(/\s+/g, "_")}`;
        if (!groups[subKey]) {
          groups[subKey] = { name: normalizedName, type: "subject", tests: [] };
        }
        groups[subKey].tests.push(t);
      } else {
        const unKey = "uncategorized";
        if (!groups[unKey]) {
          groups[unKey] = { name: "Uncategorized", type: "uncategorized", tests: [] };
        }
        groups[unKey].tests.push(t);
      }
    });

    return groups;
  }, [filteredTests]);

  // Unlock codes (kept, but only reachable if allowed)
  // Accepts optional expectedTestId to ensure student is unlocking the intended test
  const unlockWithCode = async (code: string, expectedTestId?: string) => {
    if (!firebaseUser?.uid || !educatorId) return;
    const c = String(code || "").trim().toUpperCase();
    if (!c) return;

    try {
      await runTransaction(db, async (tx) => {
        const codeRef = doc(db, "educators", educatorId, "accessCodes", c);
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists()) throw new Error("Invalid code");

        const data = codeSnap.data() as any;
        const testId = String(data.testSeriesId || data.testId || "");
        if (!testId) throw new Error("Code not linked to any test");

        // If caller expected a specific test, ensure code maps to it
        if (expectedTestId && expectedTestId !== testId) throw new Error("Code is not valid for this test");

        // Check expiry
        const expiresAt = data.expiresAt;
        const expiresMs =
          typeof expiresAt?.toMillis === "function"
            ? expiresAt.toMillis()
            : typeof expiresAt?.seconds === "number"
            ? expiresAt.seconds * 1000
            : null;
        if (typeof expiresMs === "number" && Date.now() > expiresMs) throw new Error("Code has expired");

        // Check max uses
        const max = Number(data.maxUses || 0);
        const used = Number(data.usesUsed || 0);
        if (max > 0 && used >= max) throw new Error("Code has been exhausted");

        // increment usesUsed
        const newUsed = used + 1;
        tx.update(codeRef, { usesUsed: newUsed });

        const windowMinutes = Number(data.windowMinutes || 0);
        let windowExpiresAt = null;
        if (windowMinutes > 0) {
          const codeCreatedMs =
            typeof data.createdAt?.toMillis === "function"
              ? data.createdAt.toMillis()
              : Date.now();
          windowExpiresAt = new Date(codeCreatedMs + windowMinutes * 60 * 1000);
        }

        const unlockRef = doc(collection(db, "testUnlocks"));
        tx.set(unlockRef, {
          studentId: firebaseUser.uid,
          educatorId,
          testSeriesId: testId,
          code: c,
          createdAt: serverTimestamp(),
          windowExpiresAt,
        });
      });

      toast.success("Unlocked successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to unlock");
    }
  };

  if (authLoading || tenantLoading || billingLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    );
  }

  if (!isTenantDomain) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Open your coaching URL</h1>
        </div>
        <p className="text-sm text-muted-foreground">Students must use their coaching website to access tests.</p>
        <Button onClick={() => nav("/login?role=student")}>Go to Login</Button>
      </div>
    );
  }

  if (!tenantSlug || !educatorId) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Invalid coaching URL</h1>
        </div>
        <p className="text-sm text-muted-foreground">This tenant domain is not linked to any educator.</p>
      </div>
    );
  }

  if (!enrolledHere) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Not enrolled</h1>
        </div>
        <p className="text-sm text-muted-foreground">Please signup on this coaching URL first.</p>
        <Button onClick={() => nav("/signup?role=student")}>Signup</Button>
      </div>
    );
  }

  if (!seatActive) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Tests Locked</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your educator has not granted you a seat yet. Ask your educator to grant a seat from the Learners panel.
        </p>
      </div>
    );
  }

  // Allowed
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-green-600" />
        <h1 className="text-xl font-semibold">Available Tests</h1>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search tests..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Optional unlock UI (keep if you want) */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Enter access code to unlock..." className="max-w-sm" onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = (e.target as HTMLInputElement).value;
            unlockWithCode(val);
            (e.target as HTMLInputElement).value = "";
          }
        }} />
        <div className="text-sm text-muted-foreground">Press Enter to unlock</div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedTests).map(([groupId, group]) => {
          const isExpanded = !!expandedFolders[groupId];
          return (
            <div key={groupId} className="space-y-4">
              <div
                className="flex items-center justify-between group cursor-pointer bg-muted/20 p-2 rounded-xl"
                onClick={() => toggleFolder(groupId)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-lg">{group.name}</h3>
                  <Badge variant="secondary" className="rounded-full ml-2">
                    {group.tests.length}
                  </Badge>
                </div>
              </div>

              {isExpanded && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pl-4">
                  {group.tests.map((t) => {
                    const unlockEntry = unlockedIds.get(t.id);
                    const windowValid = unlockEntry !== undefined &&
                      (unlockEntry === null || unlockEntry > Date.now());
                    const locked = !(t.isPublic === true || windowValid);
                    return (
                      <TestCard
                        key={t.id}
                        test={{ ...t, isLocked: locked, windowExpiresAt: unlockEntry ?? null }}
                        attemptsUsed={attemptCounts[t.id] || 0}
                        onView={() => nav(`/student/tests/${t.id}`)}
                        onStart={() => nav(`/student/tests/${t.id}`)}
                        onUnlock={(testId: string) => {
                          const entered = window.prompt("Enter access code to unlock this test:");
                          if (entered && entered.trim()) {
                            unlockWithCode(entered.trim(), testId);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

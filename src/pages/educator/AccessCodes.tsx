import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Copy,
  Check,
  Key,
  Calendar,
  Users,
  MoreVertical,
  Trash2,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DataTable from "@/components/educator/DataTable";
import EmptyState from "@/components/educator/EmptyState";
import { toast } from "@/hooks/use-toast";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AccessCode {
  id: string;
  code: string;
  testSeries: string;
  testSeriesId?: string;
  maxUses: number;
  usesLeft: number;
  expiry: string;
  status: "active" | "expired" | "exhausted";
  createdAt: string;

  usesUsed?: number;
  expiresAtTs?: Timestamp | null;
  windowMinutes?: number;
}

type TestSeriesOption = { id: string; title: string };

function toDateLabel(ts?: Timestamp | null) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function toExpiryLabel(ts?: Timestamp | null) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function toEndOfDayTimestamp(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
  return Timestamp.fromDate(dt);
}

function isExpired(expiresAt?: Timestamp | null) {
  if (!expiresAt) return false;
  return expiresAt.toDate().getTime() < Date.now();
}

function isExpiringSoon(expiresAt?: Timestamp | null, days = 7) {
  if (!expiresAt) return false;
  const now = Date.now();
  const t = expiresAt.toDate().getTime();
  if (t < now) return false;
  return t - now <= days * 24 * 60 * 60 * 1000;
}

export default function AccessCodes() {
  const [uid, setUid] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [selectedTestSeriesId, setSelectedTestSeriesId] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("100");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [windowMinutes, setWindowMinutes] = useState<string>("0");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [testSeriesOptions, setTestSeriesOptions] = useState<TestSeriesOption[]>([]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // ✅ Load test series from educators/{uid}/my_tests (same source student uses)
  useEffect(() => {
    if (!uid) {
      setTestSeriesOptions([]);
      return;
    }

    const ref = collection(db, "educators", uid, "my_tests");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TestSeriesOption[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: String(data?.title || "Untitled Test Series"),
          };
        });
        setTestSeriesOptions(list);
      },
      () => setTestSeriesOptions([])
    );

    return () => unsub();
  }, [uid]);

  // Load access codes
  useEffect(() => {
    if (!uid) {
      setAccessCodes([]);
      return;
    }

    const ref = collection(db, "educators", uid, "accessCodes");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AccessCode[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const max = Number(data?.maxUses || 0);
          const used = Number(data?.usesUsed || 0);
          const left = Math.max(0, max - used);

          const expiresAt = (data?.expiresAt as Timestamp) || null;
          const createdAt = (data?.createdAt as Timestamp) || null;

          let status: "active" | "expired" | "exhausted" = "active";
          if (left <= 0 && max > 0) status = "exhausted";
          else if (isExpired(expiresAt)) status = "expired";

          return {
            id: d.id,
            code: String(data?.code || d.id),
            testSeries: String(data?.testSeriesTitle || "—"),
            testSeriesId: String(data?.testSeriesId || ""),
            maxUses: Number.isFinite(max) ? max : 0,
            usesLeft: left,
            expiry: toExpiryLabel(expiresAt),
            status,
            createdAt: toDateLabel(createdAt),
            usesUsed: used,
            expiresAtTs: expiresAt,
            windowMinutes: Number(data?.windowMinutes ?? 0),
          };
        });

        setAccessCodes(rows);
      },
      () => {
        setAccessCodes([]);
        toast({
          title: "Failed to load access codes",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    );

    return () => unsub();
  }, [uid]);

  const hasData = accessCodes.length > 0;

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({ title: "Code copied!", description: "Access code has been copied to clipboard." });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewCode(code);
  };

  const resetDialog = () => {
    setEditingId(null);
    setNewCode("");
    setSelectedTestSeriesId("");
    setMaxUses("100");
    setExpiryDate("");
    setWindowMinutes("0");
  };

  const openCreate = () => {
    resetDialog();
    setIsCreateOpen(true);
  };

  const openEdit = (item: AccessCode) => {
    setEditingId(item.id);
    setNewCode(item.code || item.id);
    setSelectedTestSeriesId(item.testSeriesId || "");
    setMaxUses(String(item.maxUses || 0));
    setExpiryDate(item.expiresAtTs ? item.expiresAtTs.toDate().toISOString().slice(0, 10) : "");
    setWindowMinutes(String(item.windowMinutes ?? 0));
    setIsCreateOpen(true);
  };

  const handleDelete = async (item: AccessCode) => {
    if (!uid) return;
    const ok = window.confirm(`Delete access code "${item.code}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "educators", uid, "accessCodes", item.id));
      toast({ title: "Deleted", description: "Access code removed successfully." });
    } catch {
      toast({ title: "Delete failed", description: "Could not delete the access code.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!uid) {
      toast({ title: "Please login", description: "You must be logged in as educator.", variant: "destructive" });
      return;
    }

    const codeUpper = String(newCode || "").trim().toUpperCase();
    const max = Number(maxUses);

    if (!selectedTestSeriesId) {
      toast({ title: "Select test series", description: "Please choose a test series." });
      return;
    }
    if (!codeUpper) {
      toast({ title: "Enter code", description: "Please enter or generate an access code." });
      return;
    }
    if (!Number.isFinite(max) || max <= 0) {
      toast({ title: "Invalid max uses", description: "Max uses must be a positive number." });
      return;
    }

    const testTitle = testSeriesOptions.find((t) => t.id === selectedTestSeriesId)?.title || "Test Series";
    const expiresAt = expiryDate ? toEndOfDayTimestamp(expiryDate) : null;

    setIsSaving(true);
    try {
      if (!editingId) {
        const ref = doc(db, "educators", uid, "accessCodes", codeUpper);
        const existing = await getDoc(ref);
        if (existing.exists()) {
          toast({ title: "Code already exists", description: "Please generate a different code.", variant: "destructive" });
          setIsSaving(false);
          return;
        }

        await setDoc(ref, {
          code: codeUpper,
          testSeriesId: selectedTestSeriesId,
          testSeriesTitle: testTitle,
          maxUses: max,
          usesUsed: 0,
          expiresAt: expiresAt ?? null,
          windowMinutes: Number(windowMinutes) || 0,
          createdAt: serverTimestamp(),
        });

        toast({ title: "Access code created!", description: "Your new access code is ready to share." });
      } else {
        const ref = doc(db, "educators", uid, "accessCodes", editingId);

        const current = accessCodes.find((c) => c.id === editingId);
        const used = current?.usesUsed || 0;
        if (max < used) {
          toast({ title: "Max uses too low", description: `This code already used ${used} times.`, variant: "destructive" });
          setIsSaving(false);
          return;
        }

        await updateDoc(ref, {
          testSeriesId: selectedTestSeriesId,
          testSeriesTitle: testTitle,
          maxUses: max,
          expiresAt: expiresAt ?? null,
          windowMinutes: Number(windowMinutes) || 0,
          updatedAt: serverTimestamp(),
        });

        toast({ title: "Updated", description: "Access code updated successfully." });
      }

      setIsCreateOpen(false);
      resetDialog();
    } catch {
      toast({ title: "Save failed", description: "Could not save access code. Try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const expiringSoonCount = useMemo(() => {
    return accessCodes.filter((c) => c.status === "active" && isExpiringSoon(c.expiresAtTs, 7)).length;
  }, [accessCodes]);

  const totalUses = useMemo(() => {
    return accessCodes.reduce((acc, c) => acc + (c.maxUses - c.usesLeft), 0);
  }, [accessCodes]);

  const activeCount = useMemo(() => {
    return accessCodes.filter((c) => c.status === "active").length;
  }, [accessCodes]);

  const columns = [
    {
      key: "code",
      header: "Access Code",
      render: (item: AccessCode) => (
        <div className="flex items-center gap-2">
          <code className="px-2 py-1 rounded bg-muted font-mono text-sm">{item.code}</code>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(item.code);
            }}
          >
            {copiedCode === item.code ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      ),
    },
    { key: "testSeries", header: "Test Series", className: "hidden md:table-cell" },
    {
      key: "uses",
      header: "Uses",
      render: (item: AccessCode) => {
        const max = item.maxUses || 0;
        const used = max - item.usesLeft;
        const pct = max > 0 ? Math.min(100, Math.max(0, (used / max) * 100)) : 0;

        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full gradient-bg" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm text-muted-foreground">
              {used}/{max}
            </span>
          </div>
        );
      },
    },
    { key: "expiry", header: "Expiry", className: "hidden sm:table-cell" },
    {
      key: "status",
      header: "Status",
      render: (item: AccessCode) => (
        <Badge
          variant="secondary"
          className={
            item.status === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : item.status === "expired"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
          }
        >
          {item.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (item: AccessCode) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                openEdit(item);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(item.code);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ✅ Dialog is ALWAYS rendered (this fixes “button does nothing”)
  const canCreate = testSeriesOptions.length > 0;

  return (
    <div className="space-y-6">
      {/* Dialog (always mounted) */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Access Code" : "Create New Access Code"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Test Series</Label>
              <Select value={selectedTestSeriesId} onValueChange={setSelectedTestSeriesId}>
                <SelectTrigger>
                  <SelectValue placeholder={testSeriesOptions.length ? "Select test series" : "No test series yet"} />
                </SelectTrigger>
                <SelectContent>
                  {testSeriesOptions.length ? (
                    testSeriesOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none" disabled>
                      Create a test series first
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!canCreate && (
                <p className="text-xs text-muted-foreground">
                  You don’t have any test series yet. Create one in <span className="font-medium">Test Series</span> first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Access Code</Label>
              <div className="flex gap-2">
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Enter or generate code"
                  className="font-mono uppercase"
                  disabled={!!editingId}
                />
                <Button variant="outline" onClick={generateCode} disabled={!!editingId}>
                  Generate
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Access Window (minutes, 0 = no limit)</Label>
              <Input
                type="number"
                min={0}
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Students can only unlock within this many minutes after this code was generated. 0 = no limit.
              </p>
            </div>

            <Button
              className="w-full gradient-bg text-white"
              onClick={handleSave}
              disabled={isSaving || !canCreate}
            >
              {isSaving ? "Saving..." : editingId ? "Update Access Code" : "Create Access Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* If not logged in */}
      {!uid ? (
        <>
          <div>
            <h1 className="text-2xl font-display font-bold">Access Codes</h1>
            <p className="text-muted-foreground text-sm">Create and manage access codes for your test series</p>
          </div>
          <EmptyState
            icon={Key}
            title="Please login as Educator"
            description="You must be logged in to manage access codes."
            actionLabel="Go to Login"
            onAction={() => (window.location.href = "/login?role=educator")}
          />
        </>
      ) : !hasData ? (
        <>
          {/* Empty state (no codes) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold">Access Codes</h1>
              <p className="text-muted-foreground text-sm">Create and manage access codes for your test series</p>
            </div>
            <Button className="gradient-bg text-white" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Access Code
            </Button>
          </div>

          <EmptyState
            icon={Key}
            title="No access codes created yet"
            description="Create access codes to let students access your test series. Share them via WhatsApp, email, etc."
            actionLabel="Create Access Code"
            onAction={openCreate}
          />
        </>
      ) : (
        <>
          {/* Normal state */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold">Access Codes</h1>
              <p className="text-muted-foreground text-sm">Create and manage access codes for your test series</p>
            </div>
            <Button className="gradient-bg text-white" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Access Code
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Key, label: "Total Codes", value: accessCodes.length },
              { icon: Users, label: "Total Uses", value: totalUses },
              { icon: Check, label: "Active", value: activeCount },
              { icon: Calendar, label: "Expiring Soon", value: expiringSoonCount },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <stat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-bold">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <DataTable data={accessCodes} columns={columns} />
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronDown, ChevronUp, Copy, Download,
  Loader2, RefreshCw, Search, Upload, UserCheck, UserPlus, UserX,
} from "lucide-react";
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthProvider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

const API = import.meta.env.VITE_MONKEY_KING_API_URL;

type Learner = {
  id: string;
  name?: string;
  email?: string;
  status?: "ACTIVE" | "INACTIVE";
  joinedAt?: any;
};

type Branch = { id: string; name: string };
type Course = { id: string; name: string };
type Batch = { id: string; name: string; seatLimit: number; usedSeats: number };

type BulkRow = {
  row: number;
  name: string;
  email: string;
  branch_name: string;
  course_name: string;
  batch_name: string;
  token: string | null;
  invite_url: string | null;
  error: string | null;
};

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export default function Learners() {
  const nav = useNavigate();
  const { firebaseUser, role, loading: authLoading } = useAuth();
  const educatorId = firebaseUser?.uid || "";

  const [learners, setLearners] = useState<Learner[]>([]);
  const [seatMap, setSeatMap] = useState<Record<string, boolean>>({});
  const [educator, setEducator] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Division selectors (shared for invite link + bulk)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selBranch, setSelBranch] = useState("");
  const [selCourse, setSelCourse] = useState("");
  const [selBatch, setSelBatch] = useState("");

  // Invite link
  const [inviteOpen, setInviteOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Bulk upload
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && role && role !== "EDUCATOR" && role !== "ADMIN") nav("/login?role=educator");
  }, [authLoading, role, nav]);

  useEffect(() => {
    if (!educatorId) return;

    const qLearners = query(collection(db, "educators", educatorId, "students"), orderBy("joinedAt", "desc"));
    const unsubL = onSnapshot(qLearners, (snap) => {
      setLearners(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    const unsubSeats = onSnapshot(collection(db, "educators", educatorId, "billingSeats"), (snap) => {
      const map: Record<string, boolean> = {};
      snap.docs.forEach((d) => {
        map[d.id] = String((d.data() as any)?.status || "").toLowerCase() === "active";
      });
      setSeatMap(map);
    });
    const unsubEdu = onSnapshot(doc(db, "educators", educatorId), (snap) => {
      setEducator(snap.exists() ? snap.data() : null);
    });

    // Load branches
    getDocs(collection(db, "educators", educatorId, "branches")).then((snap) =>
      setBranches(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })))
    );

    return () => { unsubL(); unsubSeats(); unsubEdu(); };
  }, [educatorId, refreshTick]);

  // Load courses when branch changes
  useEffect(() => {
    if (!educatorId || !selBranch) { setCourses([]); setSelCourse(""); return; }
    getDocs(collection(db, "educators", educatorId, "branches", selBranch, "courses")).then((snap) =>
      setCourses(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })))
    );
  }, [educatorId, selBranch]);

  // Load batches when course changes
  useEffect(() => {
    if (!educatorId || !selBranch || !selCourse) { setBatches([]); setSelBatch(""); return; }
    getDocs(
      collection(db, "educators", educatorId, "branches", selBranch, "courses", selCourse, "batches")
    ).then((snap) =>
      setBatches(snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id,
        seatLimit: d.data().seatLimit || 0,
        usedSeats: d.data().usedSeats || 0,
      })))
    );
  }, [educatorId, selBranch, selCourse]);

  const selectedBatch = batches.find((b) => b.id === selBatch);
  const availableSeats = selectedBatch ? selectedBatch.seatLimit - selectedBatch.usedSeats : 0;

  const seatLimit = Math.max(0, Number(educator?.seatLimit || 0));
  const usedSeats = useMemo(() => Object.values(seatMap).filter(Boolean).length, [seatMap]);
  const canAssign = seatLimit > 0 && usedSeats < seatLimit;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter(
      (l) => (l.name || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q)
    );
  }, [learners, search]);

  async function postWithToken(path: string, body: any) {
    if (!firebaseUser) throw new Error("Not logged in");
    const token = await firebaseUser.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  const grantSeat = async (studentId: string) => {
    setBusyId(studentId);
    try {
      await postWithToken("/api/billing/assign-seat", { studentId });
      toast.success("Seat granted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to grant seat");
    } finally { setBusyId(null); }
  };

  const revokeSeat = async (studentId: string) => {
    setBusyId(studentId);
    try {
      await postWithToken("/api/billing/revoke-seat", { studentId });
      toast.success("Seat revoked");
    } catch (e: any) {
      toast.error(e?.message || "Failed to revoke seat");
    } finally { setBusyId(null); }
  };

  const toggleActive = async (studentId: string, next: "ACTIVE" | "INACTIVE") => {
    try {
      await updateDoc(doc(db, "educators", educatorId, "students", studentId), { status: next });
      toast.success(`Learner set to ${next}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update learner");
    }
  };

  async function generateInviteLink() {
    if (!selBranch || !selCourse || !selBatch) { toast.error("Select branch, course and batch"); return; }
    if (availableSeats <= 0) { toast.error("No available seats in this batch"); return; }
    setGeneratingLink(true);
    try {
      const data = await apiFetch("/api/invites/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_id: selBranch, course_id: selCourse, batch_id: selBatch }),
      });
      setInviteUrl(`${window.location.origin}/join/${data.token}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate link");
    } finally { setGeneratingLink(false); }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTemplate() {
    const csv = "name,email,branch_name,course_name,batch_name\nJohn Doe,john@example.com,Branch Name,Course Name,Batch Name\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "student_invite_template.csv";
    a.click();
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setBulkRows([]);
    try {
      const token = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/api/invites/bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      // Rewrite invite_url to use the current origin (backend doesn't know the frontend URL)
      const rows = (data.rows || []).map((r: any) =>
        r.token ? { ...r, invite_url: `${window.location.origin}/join/${r.token}` } : r
      );
      setBulkRows(rows);
      toast.success(`${data.success} invite(s) generated, ${data.failed} failed`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function copyAllLinks() {
    const links = bulkRows
      .filter((r) => r.invite_url)
      .map((r) => `${r.name} <${r.email}>: ${r.invite_url}`)
      .join("\n");
    navigator.clipboard.writeText(links).then(() => toast.success("All links copied"));
  }

  if (authLoading || !role) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Learners</h1>
          <p className="text-sm text-muted-foreground">
            Seats used: <b>{usedSeats}</b> / <b>{seatLimit}</b>
          </p>
        </div>
        <Button variant="outline" onClick={() => setRefreshTick((x) => x + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Invite via Link */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg"
          onClick={() => setInviteOpen((o) => !o)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Invite via Link</span>
            {inviteOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {inviteOpen && (
          <CardContent className="space-y-4 pt-0">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Branch</Label>
                  <Select value={selBranch} onValueChange={(v) => { setSelBranch(v); setSelCourse(""); setSelBatch(""); setInviteUrl(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Course</Label>
                  <Select value={selCourse} onValueChange={(v) => { setSelCourse(v); setSelBatch(""); setInviteUrl(""); }} disabled={!selBranch}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Batch</Label>
                  <Select value={selBatch} onValueChange={(v) => { setSelBatch(v); setInviteUrl(""); }} disabled={!selCourse}>
                    <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.seatLimit - b.usedSeats} free)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedBatch && (
                availableSeats > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    <b>{availableSeats}</b> seats available in {selectedBatch.name}
                  </p>
                ) : (
                  <p className="text-sm text-destructive">
                    No seats available - purchase more seats in Billing
                  </p>
                )
              )}

              <div className="flex gap-2">
                <Button onClick={generateInviteLink} disabled={!selBatch || generatingLink || availableSeats <= 0}>
                  {generatingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Generate Link
                </Button>
              </div>

              {inviteUrl && (
                <div className="flex gap-2">
                  <Input value={inviteUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyLink(inviteUrl)}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
          </CardContent>
        )}
      </Card>

      {/* Bulk CSV Upload */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg"
          onClick={() => setBulkOpen((o) => !o)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Upload className="h-4 w-4" />Bulk Upload via CSV</span>
            {bulkOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {bulkOpen && (
          <CardContent className="space-y-4 pt-0">
              <p className="text-sm text-muted-foreground">
                Upload a CSV with columns: <code className="bg-muted px-1 rounded text-xs">name, email, branch_name, course_name, batch_name</code>
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload CSV
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
              </div>

              {bulkRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Results</p>
                    <Button variant="outline" size="sm" onClick={copyAllLinks}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy All Links
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Batch</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Invite Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((r) => (
                          <tr key={r.row} className="border-t">
                            <td className="px-3 py-2">{r.row}</td>
                            <td className="px-3 py-2">{r.name}</td>
                            <td className="px-3 py-2">{r.email}</td>
                            <td className="px-3 py-2">{r.batch_name}</td>
                            <td className="px-3 py-2">
                              {r.error
                                ? <Badge variant="destructive">Error: {r.error}</Badge>
                                : <Badge variant="default">Generated</Badge>}
                            </td>
                            <td className="px-3 py-2">
                              {r.invite_url && (
                                <button
                                  className="flex items-center gap-1 text-primary hover:underline font-mono"
                                  onClick={() => navigator.clipboard.writeText(r.invite_url!).then(() => toast.success("Copied"))}
                                >
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </CardContent>
        )}
      </Card>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search learners..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filtered.map((l) => {
          const seatOn = Boolean(seatMap[l.id]);
          const inactive = l.status === "INACTIVE";
          return (
            <div key={l.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <button type="button" onClick={() => nav(`/educator/learners/${l.id}`)} className="text-left group">
                <div className="font-semibold">
                  {l.name || "Student"}
                  {inactive && <span className="text-xs text-red-500 ml-2">(INACTIVE)</span>}
                </div>
                <div className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{l.email || l.id}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Seat:{" "}
                  {seatOn
                    ? <span className="text-green-600 font-medium">GRANTED</span>
                    : <span className="text-orange-600 font-medium">NOT GRANTED</span>}
                </div>
              </button>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => nav(`/educator/learners/${l.id}`)}>
                  View Details <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                {!seatOn ? (
                  <Button disabled={!canAssign || busyId === l.id || inactive} onClick={() => grantSeat(l.id)}>
                    {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                    Grant Seat
                  </Button>
                ) : (
                  <Button variant="outline" disabled={busyId === l.id} onClick={() => revokeSeat(l.id)}>
                    {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
                    Revoke Seat
                  </Button>
                )}
                {inactive
                  ? <Button variant="outline" onClick={() => toggleActive(l.id, "ACTIVE")}>Set ACTIVE</Button>
                  : <Button variant="outline" onClick={() => toggleActive(l.id, "INACTIVE")}>Set INACTIVE</Button>}
              </div>
            </div>
          );
        })}
      </div>

      {seatLimit <= 0 && (
        <div className="text-sm text-muted-foreground border rounded-lg p-4">
          No seats are assigned to your coaching yet. Purchase seats in Billing to get started.
        </div>
      )}
    </div>
  );
}

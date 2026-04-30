import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where, updateDoc, serverTimestamp, writeBatch, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TxRow = {
  id: string;
  transactionId?: string;
  previousSeatLimit?: number;
  newSeatLimit?: number;
  delta?: number;
  note?: string | null;
  usedSeatsAtUpdate?: number;
  updatedAt?: Timestamp | null;
  updatedBy?: string;
  updatedByEmail?: string | null;
};

type BillingSeat = {
  id: string;
  status: string;
  assignedAt: Timestamp | null;
  studentName?: string;
  studentEmail?: string;
};

type EducatorDoc = {
  seatLimit?: number;
  status?: string;
  lastSeatTransactionId?: string;
  seatUpdatedAt?: Timestamp | null;
  lastSeatTransactionAt?: Timestamp | null;
};

function fmtTs(ts: Timestamp | null | undefined) {
  if (!ts) return "-";
  try {
    return new Date(ts.seconds * 1000).toLocaleString();
  } catch {
    return "-";
  }
}

export default function SeatManagement() {
  const { firebaseUser } = useAuth();

  const [tenantSlug, setTenantSlug] = useState("");
  const [educatorId, setEducatorId] = useState("");

  const [targetId, setTargetId] = useState<string>("");

  const [educator, setEducator] = useState<EducatorDoc | null>(null);
  const [usedSeats, setUsedSeats] = useState<number>(0);

  const [tx, setTx] = useState<TxRow[]>([]);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const [open, setOpen] = useState(false);
  const [newSeatLimit, setNewSeatLimit] = useState<number>(0);
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [activeSeats, setActiveSeats] = useState<BillingSeat[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);

  const seatLimit = Math.max(0, Number(educator?.seatLimit || 0));
  const available = Math.max(0, seatLimit - usedSeats);

  const canUpdate = useMemo(() => !!(targetId && firebaseUser), [targetId, firebaseUser]);

  async function postWithToken(path: string, body: Record<string, unknown>) {
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

  const resolveTarget = async () => {
    setLoadingTarget(true);
    try {
      let id = educatorId.trim();

      if (!id && tenantSlug.trim()) {
        const slug = tenantSlug.trim().toLowerCase();
        const tSnap = await getDoc(doc(db, "tenants", slug));
        if (!tSnap.exists()) throw new Error("Tenant not found");
        id = String((tSnap.data() as { educatorId?: string })?.educatorId || "").trim();
      }

      if (!id) throw new Error("Enter educatorId or tenantSlug");
      setTargetId(id);
      toast.success("Loaded coaching");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      toast.error(msg);
      setTargetId("");
      setEducator(null);
      setTx([]);
      setUsedSeats(0);
    } finally {
      setLoadingTarget(false);
    }
  };

  // subscribe to educator + seat usage + transactions
  useEffect(() => {
    if (!targetId) return;

    const un1 = onSnapshot(doc(db, "educators", targetId), (snap) => {
      setEducator(snap.exists() ? snap.data() as EducatorDoc : null);
    });

    const qSeats = query(
      collection(db, "educators", targetId, "billingSeats"),
      where("status", "==", "active")
    );
    const un2 = onSnapshot(qSeats, async (snap) => {
      setUsedSeats(snap.size);
      
      setLoadingSeats(true);
      const rows: BillingSeat[] = [];
      for (const d of snap.docs) {
          const data = d.data();
          // Try to get student name from learners subcollection
          const learnerSnap = await getDoc(doc(db, "educators", targetId, "students", d.id));
          const learnerData = learnerSnap.exists() ? learnerSnap.data() as { name?: string; email?: string } : {};
          
          rows.push({
              id: d.id,
              status: String(data.status),
              assignedAt: data.assignedAt as Timestamp,
              studentName: learnerData.name || "Unknown",
              studentEmail: learnerData.email || "No Email"
          });
      }
      setActiveSeats(rows);
      setLoadingSeats(false);
    });

    const qTx = query(
      collection(db, "educators", targetId, "seatTransactions"),
      orderBy("updatedAt", "desc")
    );
    const un3 = onSnapshot(qTx, (snap) => {
      const rows: TxRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as TxRow) }));
      setTx(rows);
    });

    return () => {
      un1();
      un2();
      un3();
    };
  }, [targetId]);

  const openUpdateDialog = () => {
    setNewSeatLimit(seatLimit);
    setTransactionId("");
    setNote("");
    setOpen(true);
  };

  const submitUpdate = async () => {
    if (!canUpdate) return;
    setBusy(true);
    try {
      await postWithToken("/api/admin/update-seats", {
        educatorId: targetId,
        newSeatLimit: Math.max(0, Math.floor(newSeatLimit || 0)),
        transactionId: transactionId.trim(),
        note: note.trim(),
      });
      toast.success("Seats updated");
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update seats";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const revokeSeat = async (studentId: string) => {
    if (!confirm("Are you sure you want to revoke this student's seat? they will lose access immediately.")) return;
    try {
        await updateDoc(doc(db, "educators", targetId, "billingSeats", studentId), {
            status: "revoked",
            revokedAt: serverTimestamp(),
            revokedBy: firebaseUser?.uid
        });
        toast.success("Seat revoked");
    } catch (e) {
        console.error(e);
        toast.error("Failed to revoke seat");
    }
  };

  const toggleEducatorStatus = async () => {
      const newStatus = educator?.status === "suspended" ? "active" : "suspended";
      if (!confirm(`Are you sure you want to set educator status to ${newStatus}?`)) return;
      
      setBusy(true);
      try {
          const batch = writeBatch(db);
          batch.update(doc(db, "educators", targetId), { status: newStatus, updatedAt: serverTimestamp() });
          batch.update(doc(db, "users", targetId), { status: newStatus, updatedAt: serverTimestamp() });
          await batch.commit();
          toast.success(`Educator ${newStatus}`);
      } catch (e) {
          console.error(e);
          toast.error("Failed to update status");
      } finally {
          setBusy(false);
      }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Seat & Access Management</h1>
            <Badge variant="secondary">Admin</Badge>
        </div>
        
        {targetId && educator && (
            <Button 
                variant={educator.status === "suspended" ? "success" as any : "destructive"} 
                size="sm"
                onClick={toggleEducatorStatus}
                disabled={busy}
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : educator.status === "suspended" ? <UserCheck className="h-4 w-4 mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
                {educator.status === "suspended" ? "Reactivate Educator" : "Suspend Educator"}
            </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find Coaching / Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Tenant Slug (optional)</label>
              <Input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="e.g. tayaari-exam" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Educator UID (optional)</label>
              <Input value={educatorId} onChange={(e) => setEducatorId(e.target.value)} placeholder="Firebase UID" />
            </div>
            <div className="flex items-end">
              <Button onClick={resolveTarget} disabled={loadingTarget} className="w-full">
                {loadingTarget ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Load
              </Button>
            </div>
          </div>

          {targetId ? (
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Target educatorId: <span className="font-mono text-foreground">{targetId}</span>
                </div>
                {educator?.status === "suspended" && (
                    <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Account Suspended
                    </Badge>
                )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Current Seats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Assigned</span>
              <span className="text-xl font-bold">{seatLimit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Used</span>
              <span className="text-xl font-bold">{usedSeats}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available</span>
              <span className="text-xl font-bold">{available}</span>
            </div>

            <div className="pt-2 space-y-1 text-sm text-muted-foreground">
              <div>
                Last Tx ID: <span className="font-mono text-foreground">{educator?.lastSeatTransactionId || "-"}</span>
              </div>
              <div>Last update: {fmtTs(educator?.seatUpdatedAt || educator?.lastSeatTransactionAt)}</div>
            </div>

            <Button onClick={openUpdateDialog} disabled={!canUpdate} className="w-full">
              Update Seats
            </Button>
            <p className="text-xs text-muted-foreground">
              Note: You cannot reduce below currently used active seats ({usedSeats}).
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <Tabs defaultValue="history">
                <div className="px-6 pt-4">
                    <TabsList>
                        <TabsTrigger value="history">Transaction History</TabsTrigger>
                        <TabsTrigger value="active-seats">Active Students ({usedSeats})</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="history" className="p-6 mt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Transaction ID</TableHead>
                                <TableHead className="text-right">Seats</TableHead>
                                <TableHead className="text-right">Δ</TableHead>
                                <TableHead>Updated By</TableHead>
                                <TableHead>Note</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {tx.length === 0 ? (
                                <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                    No transactions yet.
                                </TableCell>
                                </TableRow>
                            ) : (
                                tx.slice(0, 30).map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{fmtTs(r.updatedAt)}</TableCell>
                                    <TableCell className="font-mono">{r.transactionId || "-"}</TableCell>
                                    <TableCell className="text-right">{Number(r.newSeatLimit ?? 0)}</TableCell>
                                    <TableCell className="text-right">{Number(r.delta ?? 0)}</TableCell>
                                    <TableCell className="text-sm">{r.updatedByEmail || r.updatedBy || "-"}</TableCell>
                                    <TableCell className="text-sm">{r.note || "-"}</TableCell>
                                </TableRow>
                                ))
                            )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="active-seats" className="p-6 mt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Assigned On</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingSeats ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : activeSeats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                                            No active seats.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    activeSeats.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{s.studentName}</span>
                                                    <span className="text-xs text-muted-foreground">{s.studentEmail}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {fmtTs(s.assignedAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => revokeSeat(s.id)} className="text-destructive">
                                                    Revoke
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Assigned Seats</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Current total: <span className="font-semibold text-foreground">{seatLimit}</span> • Used:{" "}
              <span className="font-semibold text-foreground">{usedSeats}</span>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">New Total Seats</label>
              <Input
                type="number"
                value={newSeatLimit}
                onChange={(e) => setNewSeatLimit(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Transaction ID (required)</label>
              <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="e.g. TXN-2026-00021" />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid via UPI, 10 seats added" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submitUpdate} disabled={busy || !transactionId.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

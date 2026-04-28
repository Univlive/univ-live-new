import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck } from "lucide-react";

type TxRow = {
  id: string;
  transactionId?: string;
  previousSeatLimit?: number;
  newSeatLimit?: number;
  delta?: number;
  note?: string | null;
  usedSeatsAtUpdate?: number;
  updatedAt?: any;
  updatedBy?: string;
  updatedByEmail?: string | null;
};

function fmtTs(ts: any) {
  if (!ts) return "-";
  try {
    const ms = typeof ts?.toMillis === "function" ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : null;
    if (!ms) return "-";
    return new Date(ms).toLocaleString();
  } catch {
    return "-";
  }
}

export default function SeatManagement() {
  const { firebaseUser } = useAuth();

  const [tenantSlug, setTenantSlug] = useState("");
  const [educatorId, setEducatorId] = useState("");

  const [targetId, setTargetId] = useState<string>("");

  const [educator, setEducator] = useState<any>(null);
  const [usedSeats, setUsedSeats] = useState<number>(0);

  const [tx, setTx] = useState<TxRow[]>([]);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const [open, setOpen] = useState(false);
  const [newSeatLimit, setNewSeatLimit] = useState<number>(0);
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Division controls
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([]);
  const [maxBranchesInput, setMaxBranchesInput] = useState<number>(5);
  const [allowedSubjectIds, setAllowedSubjectIds] = useState<string[]>([]);
  const [savingDivision, setSavingDivision] = useState(false);

  const seatLimit = Math.max(0, Number(educator?.seatLimit || 0));
  const available = Math.max(0, seatLimit - usedSeats);

  const canUpdate = useMemo(() => targetId && firebaseUser, [targetId, firebaseUser]);

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

  const resolveTarget = async () => {
    setLoadingTarget(true);
    try {
      let id = educatorId.trim();

      if (!id && tenantSlug.trim()) {
        const slug = tenantSlug.trim().toLowerCase();
        const tSnap = await getDoc(doc(db, "tenants", slug));
        if (!tSnap.exists()) throw new Error("Tenant not found");
        id = String((tSnap.data() as any)?.educatorId || "").trim();
      }

      if (!id) throw new Error("Enter educatorId or tenantSlug");
      setTargetId(id);
      toast.success("Loaded coaching");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
      setTargetId("");
      setEducator(null);
      setTx([]);
      setUsedSeats(0);
    } finally {
      setLoadingTarget(false);
    }
  };

  // Load global subjects once
  useEffect(() => {
    getDocs(collection(db, "subjects")).then((snap) =>
      setAllSubjects(snap.docs.map((d) => ({ id: d.id, name: d.data().name })))
    );
  }, []);

  // Sync division controls from educator doc
  useEffect(() => {
    if (!educator) return;
    setMaxBranchesInput(educator.maxBranches ?? 5);
    setAllowedSubjectIds(educator.allowedSubjectIds ?? []);
  }, [educator]);

  // subscribe to educator + seat usage + transactions
  useEffect(() => {
    if (!targetId) return;

    const un1 = onSnapshot(doc(db, "educators", targetId), (snap) => {
      setEducator(snap.exists() ? snap.data() : null);
    });

    const qSeats = query(
      collection(db, "educators", targetId, "billingSeats"),
      where("status", "==", "active")
    );
    const un2 = onSnapshot(qSeats, (snap) => setUsedSeats(snap.size));

    const qTx = query(
      collection(db, "educators", targetId, "seatTransactions"),
      orderBy("updatedAt", "desc")
    );
    const un3 = onSnapshot(qTx, (snap) => {
      const rows: TxRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
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
    } catch (e: any) {
      toast.error(e?.message || "Failed to update seats");
    } finally {
      setBusy(false);
    }
  };

  const saveDivisionControls = async () => {
    if (!targetId) return;
    setSavingDivision(true);
    try {
      await updateDoc(doc(db, "educators", targetId), {
        maxBranches: maxBranchesInput,
        allowedSubjectIds,
      });
      toast.success("Division controls saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingDivision(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Seat Management</h1>
        <Badge variant="secondary">Admin</Badge>
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
            <div className="text-sm text-muted-foreground">
              Target educatorId: <span className="font-mono text-foreground">{targetId}</span>
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
          <CardHeader>
            <CardTitle>Seat Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {targetId && (
        <Card>
          <CardHeader>
            <CardTitle>Division Controls</CardTitle>
            <p className="text-sm text-muted-foreground">Set branch limit and allowed subjects for this educator</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Max Branches</label>
              <Input
                type="number"
                min={1}
                value={maxBranchesInput}
                onChange={(e) => setMaxBranchesInput(Number(e.target.value))}
                className="max-w-xs"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-2">
                Allowed Subjects (empty = all subjects allowed)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allSubjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded text-sm">
                    <input
                      type="checkbox"
                      checked={allowedSubjectIds.includes(s.id)}
                      onChange={(e) =>
                        setAllowedSubjectIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
                {allSubjects.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-3">
                    No subjects defined yet. Add subjects in the Subjects page first.
                  </p>
                )}
              </div>
            </div>
            <Button onClick={saveDivisionControls} disabled={savingDivision}>
              {savingDivision && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Division Controls
            </Button>
          </CardContent>
        </Card>
      )}

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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Search, UserCheck, UserX } from "lucide-react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthProvider";

type Learner = {
  id: string;
  name?: string;
  email?: string;
  status?: "ACTIVE" | "INACTIVE";
  joinedAt?: any;
};

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

  useEffect(() => {
    if (!authLoading && role && role !== "EDUCATOR" && role !== "ADMIN") nav("/login?role=educator");
  }, [authLoading, role, nav]);

  useEffect(() => {
    if (!educatorId) return;

    const qLearners = query(collection(db, "educators", educatorId, "students"), orderBy("joinedAt", "desc"));
    const unsubL = onSnapshot(qLearners, (snap) => {
      const arr: Learner[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setLearners(arr);
    });

    const unsubSeats = onSnapshot(collection(db, "educators", educatorId, "billingSeats"), (snap) => {
      const map: Record<string, boolean> = {};
      snap.docs.forEach((d) => {
        const s = String((d.data() as any)?.status || "").toLowerCase();
        map[d.id] = s === "active";
      });
      setSeatMap(map);
    });

    const unsubEdu = onSnapshot(doc(db, "educators", educatorId), (snap) => {
      setEducator(snap.exists() ? snap.data() : null);
    });

    return () => {
      unsubL();
      unsubSeats();
      unsubEdu();
    };
  }, [educatorId, refreshTick]);

  const seatLimit = Math.max(0, Number(educator?.seatLimit || 0));
  const usedSeats = useMemo(() => Object.values(seatMap).filter(Boolean).length, [seatMap]);
  const canAssign = seatLimit > 0 && usedSeats < seatLimit;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((l) => (l.name || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q));
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
    } finally {
      setBusyId(null);
    }
  };

  const revokeSeat = async (studentId: string) => {
    setBusyId(studentId);
    try {
      await postWithToken("/api/billing/revoke-seat", { studentId });
      toast.success("Seat revoked");
    } catch (e: any) {
      toast.error(e?.message || "Failed to revoke seat");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (studentId: string, next: "ACTIVE" | "INACTIVE") => {
    try {
      await updateDoc(doc(db, "educators", educatorId, "students", studentId), { status: next });
      toast.success(`Learner set to ${next}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update learner");
    }
  };

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
            Seats used: <b>{usedSeats}</b> / <b>{seatLimit}</b>{" "}
          </p>
        </div>
        <Button variant="outline" onClick={() => setRefreshTick((x) => x + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

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
              <div>
                <div className="font-semibold">
                  {l.name || "Student"}{" "}
                  {inactive ? <span className="text-xs text-red-500 ml-2">(INACTIVE)</span> : null}
                </div>
                <div className="text-sm text-muted-foreground">{l.email || l.id}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Seat:{" "}
                  {seatOn ? <span className="text-green-600 font-medium">GRANTED</span> : <span className="text-orange-600 font-medium">NOT GRANTED</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!seatOn ? (
                  <Button
                    disabled={!canAssign || busyId === l.id || inactive}
                    onClick={() => grantSeat(l.id)}
                  >
                    {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                    Grant Seat
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={busyId === l.id}
                    onClick={() => revokeSeat(l.id)}
                  >
                    {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
                    Revoke Seat
                  </Button>
                )}

                {inactive ? (
                  <Button variant="outline" onClick={() => toggleActive(l.id, "ACTIVE")}>Set ACTIVE</Button>
                ) : (
                  <Button variant="outline" onClick={() => toggleActive(l.id, "INACTIVE")}>Set INACTIVE</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {seatLimit <= 0 && (
        <div className="text-sm text-muted-foreground border rounded-lg p-4">
          No seats are assigned to your coaching yet. Please contact Univ.Live admin/sales to get seats assigned.
        </div>
      )}
    </div>
  );
}


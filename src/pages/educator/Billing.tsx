import { useEffect, useState } from "react";
import { Loader2, ShoppingCart, Tag, CheckCircle2, XCircle } from "lucide-react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const API = import.meta.env.VITE_MONKEY_KING_API_URL;

type Plan = { id: string; name: string; pricePerSeat: number; features: string[] };
type Branch = { id: string; name: string };
type Course = { id: string; branchId: string; name: string };
type Batch = { id: string; branchId: string; courseId: string; name: string; planId: string; seatLimit: number; usedSeats: number };
type PaymentLog = {
  id: number;
  cashfree_order_id: string;
  batch_id: string;
  plan_id: string;
  seats_purchased: number;
  amount: number;
  discount_amount: number;
  coupon_code: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  created_at: string;
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  SUCCESS: "default",
  PENDING: "secondary",
  FAILED: "destructive",
};

function fmtAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export default function Billing() {
  const { profile, firebaseUser, role, loading: authLoading } = useAuth();
  const educatorId = firebaseUser?.uid || "";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Purchase form
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [seatCount, setSeatCount] = useState("1");
  const [couponCode, setCouponCode] = useState("");
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pendingVerifyOrderId, setPendingVerifyOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!educatorId) return;

    // Load plans
    getDocs(collection(db, "plans")).then((snap) =>
      setPlans(snap.docs.filter((d) => d.data().isActive).map((d) => ({
        id: d.id, ...(d.data() as Omit<Plan, "id">),
      })))
    );

    // Load branches
    onSnapshot(collection(db, "educators", educatorId, "branches"), (snap) =>
      setBranches(snap.docs.map((d) => ({ id: d.id, name: d.data().name })))
    );
  }, [educatorId]);

  // Load courses when branch changes
  useEffect(() => {
    if (!educatorId || !selectedBranchId) { setCourses([]); setSelectedCourseId(""); return; }
    const unsub = onSnapshot(
      collection(db, "educators", educatorId, "branches", selectedBranchId, "courses"),
      (snap) => setCourses(snap.docs.map((d) => ({ id: d.id, branchId: selectedBranchId, name: d.data().name })))
    );
    return () => unsub();
  }, [educatorId, selectedBranchId]);

  // Load batches when course changes
  useEffect(() => {
    if (!educatorId || !selectedBranchId || !selectedCourseId) { setBatches([]); setSelectedBatchId(""); return; }
    const unsub = onSnapshot(
      collection(db, "educators", educatorId, "branches", selectedBranchId, "courses", selectedCourseId, "batches"),
      (snap) => setBatches(snap.docs.map((d) => ({
        id: d.id,
        branchId: selectedBranchId,
        courseId: selectedCourseId,
        ...(d.data() as Omit<Batch, "id" | "branchId" | "courseId">),
      })))
    );
    return () => unsub();
  }, [educatorId, selectedBranchId, selectedCourseId]);

  // Load payment logs
  useEffect(() => {
    if (!educatorId) return;
    apiFetch("/api/payment/logs")
      .then((data) => setPaymentLogs(data || []))
      .catch(() => setPaymentLogs([]))
      .finally(() => setLoadingLogs(false));
  }, [educatorId]);

  // On mount: detect Cashfree redirect and stash order_id for verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      window.history.replaceState({}, "", "/educator/billing");
      // Cashfree v3 appends order_id; fall back to sessionStorage
      const orderId = params.get("order_id") || sessionStorage.getItem("pendingOrderId");
      sessionStorage.removeItem("pendingOrderId");
      if (orderId) setPendingVerifyOrderId(orderId);
      else toast.success("Payment completed!");
    }
  }, []);

  // Once auth is ready and we have a pending order, verify with backend
  useEffect(() => {
    if (!pendingVerifyOrderId || !educatorId) return;
    apiFetch(`/api/payment/verify/${pendingVerifyOrderId}`, { method: "POST" })
      .then((r) => {
        if (r?.status === "SUCCESS") toast.success("Payment successful! Seats have been allocated.");
        else toast.info("Payment received. Status will update shortly.");
        return apiFetch("/api/payment/logs");
      })
      .then((data) => data && setPaymentLogs(data))
      .catch(() => toast.info("Payment received. Status will update shortly."))
      .finally(() => setPendingVerifyOrderId(null));
  }, [pendingVerifyOrderId, educatorId]);

  // Auto-select plan from batch
  useEffect(() => {
    const batch = batches.find((b) => b.id === selectedBatchId);
    if (batch?.planId) setSelectedPlanId(batch.planId);
  }, [selectedBatchId, batches]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const seats = Math.max(1, parseInt(seatCount) || 1);
  const baseAmount = selectedPlan ? selectedPlan.pricePerSeat * seats : 0;
  const finalAmount = Math.max(0, baseAmount - couponDiscount);

  async function handleValidateCoupon() {
    if (!couponCode.trim() || !baseAmount) return;
    setValidatingCoupon(true);
    try {
      const result = await apiFetch(
        `/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}&amount=${baseAmount}`
      );
      setCouponValid(result.valid);
      setCouponDiscount(result.valid ? result.discount_amount : 0);
      setCouponMsg(result.valid
        ? `Coupon applied — saving ${fmtAmount(result.discount_amount)} (${result.discount_percent}% off)`
        : result.error_message || "Invalid coupon"
      );
    } catch {
      setCouponValid(false);
      setCouponMsg("Could not validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  }

  function resetCoupon() {
    setCouponCode("");
    setCouponValid(null);
    setCouponDiscount(0);
    setCouponMsg("");
  }

  async function handlePay() {
    if (!selectedBranchId || !selectedCourseId || !selectedBatchId || !selectedPlanId) {
      toast.error("Select branch, course, batch and plan");
      return;
    }
    if (seats < 1) { toast.error("At least 1 seat required"); return; }

    setPaying(true);
    try {
      const body = {
        branch_id: selectedBranchId,
        course_id: selectedCourseId,
        batch_id: selectedBatchId,
        plan_id: selectedPlanId,
        seats,
        coupon_code: couponValid ? couponCode.trim() : null,
        educator_name: profile?.displayName || profile?.fullName || "Educator",
        educator_email: profile?.email || firebaseUser?.email || "",
        educator_phone: "9999999999",  // TODO: pull from educator profile
        return_url: `${window.location.origin}/educator/billing?payment=success`,
      };

      const result = await apiFetch("/api/payment/initiate", { method: "POST", body: JSON.stringify(body) });

      // Load Cashfree JS SDK and open checkout
      const cashfreeEnv = import.meta.env.VITE_CASHFREE_ENV || "sandbox";
      const cashfree = (window as any).Cashfree?.({ mode: cashfreeEnv });
      if (!cashfree) {
        toast.error("Cashfree SDK not loaded. Check your index.html script tag.");
        return;
      }

      // Stash order_id so we can verify status after redirect
      sessionStorage.setItem("pendingOrderId", result.order_id);

      cashfree.checkout({
        paymentSessionId: result.payment_session_id,
        redirectTarget: "_self",
      });
    } catch (e: any) {
      toast.error(e.message || "Payment initiation failed");
    } finally {
      setPaying(false);
    }
  }

  if (authLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plan</h1>
        <p className="text-sm text-muted-foreground">Purchase seats for your batches</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Purchase Form */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Purchase Seats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Branch */}
            <div className="space-y-1">
              <Label>Branch</Label>
              <Select value={selectedBranchId} onValueChange={(v) => { setSelectedBranchId(v); setSelectedCourseId(""); setSelectedBatchId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Course */}
            <div className="space-y-1">
              <Label>Course</Label>
              <Select value={selectedCourseId} onValueChange={(v) => { setSelectedCourseId(v); setSelectedBatchId(""); }} disabled={!selectedBranchId}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Batch */}
            <div className="space-y-1">
              <Label>Batch</Label>
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId} disabled={!selectedCourseId}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — {b.usedSeats}/{b.seatLimit} seats used
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plan */}
            <div className="space-y-2">
              <Label>Plan</Label>
              <div className="grid gap-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-primary ${selectedPlanId === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-sm font-semibold">{fmtAmount(p.pricePerSeat)}<span className="text-xs font-normal text-muted-foreground">/seat</span></span>
                    </div>
                    {p.features && p.features.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {p.features.map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                ))}
                {plans.length === 0 && (
                  <p className="text-sm text-muted-foreground">No plans available.</p>
                )}
              </div>
            </div>

            {/* Seat count */}
            <div className="space-y-1">
              <Label>Number of Seats</Label>
              <Input
                type="number"
                min={1}
                value={seatCount}
                onChange={(e) => { setSeatCount(e.target.value); resetCoupon(); }}
              />
            </div>

            {/* Coupon */}
            <div className="space-y-1">
              <Label>Coupon Code (optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); if (couponValid !== null) resetCoupon(); }}
                  placeholder="ENTER CODE"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={handleValidateCoupon}
                  disabled={!couponCode.trim() || !baseAmount || validatingCoupon}
                >
                  {validatingCoupon ? <Loader2 className="animate-spin h-4 w-4" /> : <Tag className="h-4 w-4" />}
                  Apply
                </Button>
              </div>
              {couponMsg && (
                <p className={`text-sm flex items-center gap-1 ${couponValid ? "text-green-600" : "text-destructive"}`}>
                  {couponValid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {couponMsg}
                </p>
              )}
            </div>

            <Separator />

            {/* Price breakdown */}
            {selectedPlan && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{seats} × {selectedPlan.name} ({fmtAmount(selectedPlan.pricePerSeat)}/seat)</span>
                  <span>{fmtAmount(baseAmount)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon Discount</span>
                    <span>− {fmtAmount(couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total Payable</span>
                  <span>{fmtAmount(finalAmount)}</span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handlePay}
              disabled={paying || !selectedBatchId || !selectedPlanId || seats < 1}
            >
              {paying && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
              Pay {finalAmount > 0 ? fmtAmount(finalAmount) : ""}
            </Button>
          </CardContent>
        </Card>

        {/* Batch Seat Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Batch Seat Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select a branch and course to see batch seats.</p>
            ) : (
              <div className="space-y-3">
                {batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{plans.find((p) => p.id === b.planId)?.name}</p>
                    </div>
                    <Badge variant={b.usedSeats >= b.seatLimit && b.seatLimit > 0 ? "destructive" : "secondary"}>
                      {b.usedSeats}/{b.seatLimit} seats
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loadingLogs ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin h-5 w-5" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.cashfree_order_id}</TableCell>
                    <TableCell>{l.seats_purchased}</TableCell>
                    <TableCell>{fmtAmount(l.amount)}</TableCell>
                    <TableCell>{l.discount_amount > 0 ? fmtAmount(l.discount_amount) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.coupon_code || "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_BADGE[l.status] ?? "secondary"}>{l.status}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {paymentLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No payment history yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

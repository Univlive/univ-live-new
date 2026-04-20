import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TxRow = {
  id: string;
  transactionId?: string;
  previousSeatLimit?: number;
  newSeatLimit?: number;
  delta?: number;
  note?: string | null;
  usedSeatsAtUpdate?: number;
  updatedAt?: any;
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

function getWhatsAppNumber(): string {
  // Use Vite env if set, else fallback
  const fromEnv = (import.meta as any)?.env?.VITE_SALES_WHATSAPP_NUMBER;
  const n = String(fromEnv || "").replace(/\D/g, "");
  return n || "918319937769"; // CHANGE this fallback to your real sales number
}

function waLink(number: string, message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}

export default function Billing() {
  const { firebaseUser, role, loading: authLoading } = useAuth();
  const educatorId = firebaseUser?.uid || "";

  const [educator, setEducator] = useState<any>(null);
  const [usedSeats, setUsedSeats] = useState<number>(0);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSeatPopupOpen, setNewSeatPopupOpen] = useState(false);
  const [popupTxId, setPopupTxId] = useState<string>("");
  const [popupSeatLimit, setPopupSeatLimit] = useState<number>(0);

  const seatLimit = Math.max(0, Number(educator?.seatLimit || 0));
  const available = Math.max(0, seatLimit - usedSeats);

  const lastTxId = String(educator?.lastSeatTransactionId || "");
  const lastUpdatedAt = educator?.seatUpdatedAt || educator?.lastSeatTransactionAt;

  useEffect(() => {
    if (!educatorId) return;

    setLoading(true);

    const unEdu = onSnapshot(doc(db, "educators", educatorId), (snap) => {
      setEducator(snap.exists() ? snap.data() : null);
      setLoading(false);
    });

    const unSeats = onSnapshot(
      query(collection(db, "educators", educatorId, "billingSeats"), where("status", "==", "active")),
      (snap) => setUsedSeats(snap.size)
    );

    const unTx = onSnapshot(
      query(collection(db, "educators", educatorId, "seatTransactions"), orderBy("updatedAt", "desc")),
      (snap) => {
        setTx(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      }
    );

    return () => {
      unEdu();
      unSeats();
      unTx();
    };
  }, [educatorId]);

  // Popup when admin updates seats
  useEffect(() => {
    if (!educatorId) return;
    if (!lastTxId) return;

    const key = `seen_seat_tx_${educatorId}`;
    const seen = localStorage.getItem(key) || "";

    if (seen !== lastTxId) {
      setPopupTxId(lastTxId);
      setPopupSeatLimit(seatLimit);
      setNewSeatPopupOpen(true);
      localStorage.setItem(key, lastTxId);
    }
  }, [educatorId, lastTxId, seatLimit]);

  const openWhatsApp = (plan: string) => {
    const number = getWhatsAppNumber();
    const name = String(educator?.coachingName || educator?.name || educator?.displayName || "");
    const email = String(firebaseUser?.email || "");
    const msg =
      `Hi Univ.Live Sales,\n\n` +
      `I want to discuss the ${plan} plan / seat upgrade.\n` +
      `Coaching: ${name || "-"}\n` +
      `Educator UID: ${educatorId}\n` +
      `Email: ${email || "-"}\n` +
      `Current Seats: ${seatLimit} (Used: ${usedSeats})\n\n` +
      `Please guide me for increasing seats and payment details.`;
    window.open(waLink(number, msg), "_blank");
  };

  const plans = useMemo(
    () => [
      {
        name: "Essential",
        price: "₹169/seat",
        badge: "",
        features: [
          "Includes: 5-Day Free Trial",
          "No restriction on subject selection",
          "10 CBT tests per subject (expert-created)",
          "AI-powered advanced analytics",
          "Upload your own content (test series, question bank)",
          "AI-powered solutions",
          "Full student performance analytics",
          "Email support",
        ],
      },
      {
        name: "Growth",
        price: "₹199/seat",
        badge: "Most Popular",
        features: [
          "Everything in Essential",
          "Priority call & chat support",
          "Personalised Preference Sheet",
          "1-on-1 mentorship sessions",
          "Exclusive WhatsApp teacher community",
          "Complete post-CUET support",
        ],
      },
      {
        name: "Executive",
        price: "Custom pricing",
        badge: "",
        features: ["Custom plan for large institutions", "Bulk pricing discounts", "Dedicated account manager"],
      },
    ],
    []
  );

  if (authLoading || loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!firebaseUser || role !== "EDUCATOR") {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You must be logged in as an Educator to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Billing & Plan</h1>
          <p className="text-sm text-muted-foreground">
            Seats are assigned by Univ.Live Admin. To increase seats, contact Sales/Support.
          </p>
        </div>

        <Button onClick={() => openWhatsApp("Seat Upgrade")} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          Contact Sales on WhatsApp
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Assigned Seats
              {seatLimit > 0 ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Not Assigned</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
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

            <div className="pt-2 text-sm text-muted-foreground space-y-1">
              <div>
                Last Tx ID: <span className="font-mono text-foreground">{lastTxId || "-"}</span>
              </div>
              <div>Last Update: {fmtTs(lastUpdatedAt)}</div>
            </div>

            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={() => openWhatsApp("Seat Upgrade")}>
                Request More Seats
              </Button>
            </div>
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
                        <TableCell className="text-sm">{r.updatedByEmail || "-"}</TableCell>
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

      {/* <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <p className="text-sm text-muted-foreground">
            Plans are shown for reference. To purchase or upgrade, contact the Sales team on WhatsApp.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-5 bg-card shadow-sm ${
                  p.badge ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.badge ? <Badge>{p.badge}</Badge> : null}
                </div>
                <div className="text-2xl font-bold mt-2">{p.price}</div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>

                <Button onClick={() => openWhatsApp(p.name)} className="w-full mt-5 gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Contact Sales
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}

      <Dialog open={newSeatPopupOpen} onOpenChange={setNewSeatPopupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seats Updated</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your total seats have been updated by Univ.Live Admin.
            </p>

            <div className="rounded-xl border p-4 bg-muted/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Total Seats</span>
                <span className="text-lg font-bold">{popupSeatLimit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="font-mono">{popupTxId || "-"}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setNewSeatPopupOpen(false)}>OK</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

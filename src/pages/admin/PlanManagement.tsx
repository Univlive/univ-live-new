import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Plan = {
  id: string;
  name: string;
  pricePerSeat: number;
  features: string[];
  isActive: boolean;
};

export default function PlanManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [features, setFeatures] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "plans"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Plan, "id">) })));
      setLoading(false);
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setPricePerSeat("");
    setFeatures("");
    setIsActive(true);
    setOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setName(plan.name);
    setPricePerSeat(String(plan.pricePerSeat));
    setFeatures(plan.features.join(", "));
    setIsActive(plan.isActive);
    setOpen(true);
  }

  async function handleSave() {
    const price = parseInt(pricePerSeat, 10);
    if (!name.trim() || isNaN(price) || price <= 0) {
      toast.error("Name and valid price per seat required");
      return;
    }
    const featureList = features.split(",").map((f) => f.trim()).filter(Boolean);
    setBusy(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "plans", editing.id), {
          name, pricePerSeat: price, features: featureList, isActive,
        });
        toast.success("Plan updated");
      } else {
        await addDoc(collection(db, "plans"), {
          name, pricePerSeat: price, features: featureList, isActive,
          createdAt: new Date(),
        });
        toast.success("Plan created");
      }
      setOpen(false);
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    await deleteDoc(doc(db, "plans", plan.id));
    toast.success("Deleted");
  }

  async function toggleActive(plan: Plan) {
    await updateDoc(doc(db, "plans", plan.id), { isActive: !plan.isActive });
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="text-muted-foreground text-sm">Manage seat plans and pricing</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Plan</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <Badge variant={plan.isActive ? "default" : "secondary"}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-bold">
                ₹{(plan.pricePerSeat / 100).toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground"> / seat</span>
              </p>
              {plan.features.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {plan.features.map((f) => <li key={f}>• {f}</li>)}
                </ul>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(plan)}>
                  {plan.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(plan)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <p className="text-muted-foreground col-span-3 text-center py-8">No plans yet. Create one.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Plan Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic, Pro" />
            </div>
            <div className="space-y-1">
              <Label>Price Per Seat (paise)</Label>
              <Input
                type="number"
                value={pricePerSeat}
                onChange={(e) => setPricePerSeat(e.target.value)}
                placeholder="e.g. 19900 = ₹199"
              />
              <p className="text-xs text-muted-foreground">
                {pricePerSeat && !isNaN(parseInt(pricePerSeat))
                  ? `= ₹${(parseInt(pricePerSeat) / 100).toFixed(2)}`
                  : "Enter amount in paise (1 rupee = 100 paise)"}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Features (comma-separated)</Label>
              <Input value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="Unlimited tests, AI analysis, ..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={busy}>
                {busy && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

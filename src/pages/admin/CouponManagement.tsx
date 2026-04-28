import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const API = import.meta.env.VITE_MONKEY_KING_API_URL;

type Coupon = {
  id: number;
  code: string;
  discount_percent: number;
  max_discount_cap: number | null;
  min_order_amount: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
};

const ADMIN_KEY = import.meta.env.VITE_MONKEY_KING_ADMIN_KEY;

async function adminFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_KEY}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

const emptyForm = {
  code: "",
  discount_percent: "",
  max_discount_cap: "",
  min_order_amount: "",
  valid_from: "",
  valid_until: "",
  max_uses: "",
};

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await adminFetch("/api/admin/coupons");
      setCoupons(data);
    } catch { toast.error("Failed to load coupons"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      discount_percent: String(c.discount_percent),
      max_discount_cap: c.max_discount_cap != null ? String(c.max_discount_cap) : "",
      min_order_amount: String(c.min_order_amount),
      valid_from: c.valid_from ? c.valid_from.slice(0, 16) : "",
      valid_until: c.valid_until ? c.valid_until.slice(0, 16) : "",
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.code || !form.discount_percent) { toast.error("Code and discount required"); return; }
    setBusy(true);
    try {
      const body = {
        code: form.code,
        discount_percent: parseFloat(form.discount_percent),
        max_discount_cap: form.max_discount_cap ? parseInt(form.max_discount_cap) : null,
        min_order_amount: form.min_order_amount ? parseInt(form.min_order_amount) : 0,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      };

      if (editing) {
        await adminFetch(`/api/admin/coupons/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Updated");
      } else {
        await adminFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(body) });
        toast.success("Created");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setBusy(false); }
  }

  async function handleDeactivate(c: Coupon) {
    if (!confirm(`Deactivate coupon "${c.code}"?`)) return;
    try {
      await adminFetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      toast.success("Deactivated");
      load();
    } catch { toast.error("Failed"); }
  }

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString();
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-muted-foreground text-sm">Create and manage discount coupons for educators</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Coupon</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Cap (₹)</TableHead>
                <TableHead>Min Order (₹)</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.code}</TableCell>
                  <TableCell>{c.discount_percent}%</TableCell>
                  <TableCell>{c.max_discount_cap != null ? `₹${c.max_discount_cap / 100}` : "—"}</TableCell>
                  <TableCell>{c.min_order_amount > 0 ? `₹${c.min_order_amount / 100}` : "—"}</TableCell>
                  <TableCell>{fmtDate(c.valid_until)}</TableCell>
                  <TableCell>{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {c.is_active && (
                        <Button size="sm" variant="destructive" onClick={() => handleDeactivate(c)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {coupons.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No coupons yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Coupon" : "New Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Coupon Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE10" disabled={!!editing} />
            </div>
            <div className="space-y-1">
              <Label>Discount %</Label>
              <Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} placeholder="10" />
            </div>
            <div className="space-y-1">
              <Label>Max Discount Cap (paise)</Label>
              <Input type="number" value={form.max_discount_cap} onChange={(e) => setForm({ ...form, max_discount_cap: e.target.value })} placeholder="50000 = ₹500" />
            </div>
            <div className="space-y-1">
              <Label>Min Order (paise)</Label>
              <Input type="number" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} placeholder="100000 = ₹1000" />
            </div>
            <div className="space-y-1">
              <Label>Max Uses</Label>
              <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Blank = unlimited" />
            </div>
            <div className="space-y-1">
              <Label>Valid From</Label>
              <Input type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Valid Until</Label>
              <Input type="datetime-local" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="animate-spin h-4 w-4 mr-2" />}Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

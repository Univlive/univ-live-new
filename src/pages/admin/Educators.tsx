import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, updateDoc, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, Loader2, Plus, Users, Mail, ExternalLink, BookOpen, Bot } from "lucide-react";
import { toast } from "sonner";

type Educator = {
  uid: string;
  displayName: string;
  email: string;
  tenantSlug?: string;
  studentCount?: number;
  createdAt?: Timestamp | null;
};

type Student = {
  uid: string;
  name: string;
  email: string;
  status: string;
  joinedAt?: Timestamp | null;
};

type Test = {
  id: string;
  title: string;
  subject: string;
  questionsCount: number;
  durationMinutes: number;
  createdAt?: Timestamp | null;
};

export default function AdminEducators() {
  const { firebaseUser } = useAuth();

  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);

  // Create educator dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [created, setCreated] = useState<{ uid: string; email: string; tenantSlug: string; password: string } | null>(null);
  const [credCopied, setCredCopied] = useState(false);

  const [selectedEducator, setSelectedEducator] = useState<Educator | null>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);

  const [tests, setTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);

  const [chatLimitOpen, setChatLimitOpen] = useState(false);
  const [chatLimitValue, setChatLimitValue] = useState("100000");
  const [savingLimit, setSavingLimit] = useState(false);

  async function loadEducators() {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "EDUCATOR"));
      const snap = await getDocs(q);
      
      const list: Educator[] = [];
      
      for (const d of snap.docs) {
        const data = d.data();
        const eduId = d.id;
        
        // Find tenant slug
        let tenantSlug = data.tenantSlug;
        if (!tenantSlug) {
            const tSnap = await getDocs(query(collection(db, "tenants"), where("educatorId", "==", eduId)));
            if (!tSnap.empty) {
                tenantSlug = tSnap.docs[0].id;
            }
        }

        const sSnap = await getDocs(collection(db, "educators", eduId, "students"));
        
        list.push({
          uid: eduId,
          displayName: data.displayName || "No Name",
          email: data.email || "No Email",
          tenantSlug,
          studentCount: sSnap.size,
          createdAt: data.createdAt as Timestamp,
        });
      }
      
      setEducators(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load educators");
    } finally {
      setLoading(false);
    }
  }

  async function viewStudents(edu: Educator) {
    setSelectedEducator(edu);
    setStudentsOpen(true);
    setLoadingStudents(true);
    try {
      const q = query(collection(db, "educators", edu.uid, "students"), orderBy("joinedAt", "desc"));
      const snap = await getDocs(q);
      const list: Student[] = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          name: data.name || "Unknown",
          email: data.email || "No Email",
          status: data.status || "INACTIVE",
          joinedAt: data.joinedAt as Timestamp
        };
      });
      setStudents(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  }

  async function openChatLimit(edu: Educator) {
    setSelectedEducator(edu);
    try {
      const snap = await getDoc(doc(db, "educators", edu.uid));
      const limit = (snap.exists() ? snap.data()?.chatDailyTokenLimit : undefined) ?? 100000;
      setChatLimitValue(String(limit));
    } catch {
      setChatLimitValue("100000");
    }
    setChatLimitOpen(true);
  }

  async function saveChatLimit() {
    if (!selectedEducator) return;
    const val = parseInt(chatLimitValue, 10);
    if (isNaN(val) || val < 0) return toast.error("Enter a valid number");
    setSavingLimit(true);
    try {
      await updateDoc(doc(db, "educators", selectedEducator.uid), { chatDailyTokenLimit: val });
      toast.success("Chat limit updated");
      setChatLimitOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSavingLimit(false);
    }
  }

  async function viewTests(edu: Educator) {
    setSelectedEducator(edu);
    setTestsOpen(true);
    setLoadingTests(true);
    try {
      const q = query(collection(db, "educators", edu.uid, "my_tests"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list: Test[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "Untitled Test",
          subject: data.subject || "N/A",
          questionsCount: data.questionsCount || 0,
          durationMinutes: data.durationMinutes || 0,
          createdAt: data.createdAt as Timestamp
        };
      });
      setTests(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tests");
    } finally {
      setLoadingTests(false);
    }
  }

  async function createEducator() {
    if (!firebaseUser) return;
    setCreating(true);
    try {
      const token = await firebaseUser.getIdToken();
      const base = import.meta.env.VITE_MONKEY_KING_API_URL || "";
      const res = await fetch(`${base}/api/admin/create-educator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: cName, email: cEmail, phone: cPhone, tenant_slug: cSlug, password: cPassword || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Failed");
      setCreated(data);
      loadEducators();
    } catch (e: any) {
      toast.error(e.message || "Failed to create educator");
    } finally {
      setCreating(false);
    }
  }

  function resetCreate() {
    setCName(""); setCEmail(""); setCPhone(""); setCSlug(""); setCPassword("");
    setCreated(null); setCredCopied(false);
  }

  function copyCredentials() {
    if (!created) return;
    navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}\nPortal: https://${created.tenantSlug}.univ.live`);
    setCredCopied(true);
    setTimeout(() => setCredCopied(false), 2000);
  }

  useEffect(() => {
    loadEducators();
  }, []);

  function fmtTs(ts?: Timestamp | null) {
    if (!ts) return "N/A";
    return new Date(ts.seconds * 1000).toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Educators & Institutes</h1>
          <p className="text-muted-foreground">Manage and view all registered educators</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { resetCreate(); setCreateOpen(true); }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Educator
          </Button>
          <Button onClick={loadEducators} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Educator</TableHead>
                <TableHead>Institute Slug</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">Loading educators...</p>
                  </TableCell>
                </TableRow>
              ) : educators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No educators found.
                  </TableCell>
                </TableRow>
              ) : (
                educators.map((edu) => (
                  <TableRow key={edu.uid}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{edu.displayName}</span>
                        <span className="text-xs text-muted-foreground">{edu.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {edu.tenantSlug ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{edu.tenantSlug}</Badge>
                          <a 
                            href={`https://${edu.tenantSlug}.univ.live`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No slug</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {edu.studentCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtTs(edu.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => viewStudents(edu)}>
                          Students
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => viewTests(edu)}>
                          Tests
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openChatLimit(edu)}>
                          <Bot className="mr-1 h-3 w-3" /> Chat Limit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Students Dialog */}
      <Dialog open={studentsOpen} onOpenChange={setStudentsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students for {selectedEducator?.displayName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4">
            {loadingStudents ? (
              <div className="py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No students enrolled yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Email / Credentials</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.uid}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {s.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === "ACTIVE" ? "success" as any : "secondary"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtTs(s.joinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Educator Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{created ? "Educator Created" : "New Educator Account"}</DialogTitle>
          </DialogHeader>

          {created ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Account created successfully. Share these credentials with the educator.</p>
              <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm font-mono">
                <div><span className="text-muted-foreground">UID: </span>{created.uid}</div>
                <div><span className="text-muted-foreground">Email: </span>{created.email}</div>
                <div><span className="text-muted-foreground">Password: </span>{created.password}</div>
                <div><span className="text-muted-foreground">Portal: </span>https://{created.tenantSlug}.univ.live</div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={copyCredentials}>
                  {credCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {credCopied ? "Copied!" : "Copy Credentials"}
                </Button>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Institute Name <span className="text-destructive">*</span></Label>
                <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Sharma Classes" className="mt-1" />
              </div>
              <div>
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="educator@example.com" className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="10-digit mobile (optional)" className="mt-1" />
              </div>
              <div>
                <Label>Subdomain (Tenant Slug) <span className="text-destructive">*</span></Label>
                <div className="flex items-center mt-1">
                  <Input
                    value={cSlug}
                    onChange={(e) => setCSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="sharma-classes"
                    className="rounded-r-none"
                  />
                  <span className="h-10 px-3 flex items-center border border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground whitespace-nowrap">.univ.live</span>
                </div>
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="text"
                  value={cPassword}
                  onChange={(e) => setCPassword(e.target.value)}
                  placeholder="Auto-generate if blank"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
                <Button onClick={createEducator} disabled={creating || !cName || !cEmail || !cSlug}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Account
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tests Dialog */}
      <Dialog open={testsOpen} onOpenChange={setTestsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Tests uploaded by {selectedEducator?.displayName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4">
            {loadingTests ? (
              <div className="py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : tests.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No tests uploaded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>{t.subject}</TableCell>
                      <TableCell>{t.questionsCount}</TableCell>
                      <TableCell>{t.durationMinutes} mins</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtTs(t.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Token Limit Dialog */}
      <Dialog open={chatLimitOpen} onOpenChange={setChatLimitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Chat Daily Limit — {selectedEducator?.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Daily token limit</Label>
              <Input
                type="number"
                min={0}
                value={chatLimitValue}
                onChange={(e) => setChatLimitValue(e.target.value)}
                placeholder="e.g. 100000"
              />
              <p className="text-xs text-muted-foreground">
                Shared across all students in this institute per day. Resets at midnight.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setChatLimitOpen(false)}>Cancel</Button>
              <Button onClick={saveChatLimit} disabled={savingLimit}>
                {savingLimit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

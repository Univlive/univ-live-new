import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users, Mail, ExternalLink, BookOpen } from "lucide-react";
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
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedEducator, setSelectedEducator] = useState<Educator | null>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);

  const [tests, setTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);

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
        <Button onClick={loadEducators} disabled={loading} variant="outline" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
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
    </div>
  );
}

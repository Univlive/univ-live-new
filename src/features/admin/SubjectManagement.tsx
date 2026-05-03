import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { toast } from "sonner";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { Loader2, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Label } from "@shared/ui/label";
import { Switch } from "@shared/ui/switch";

type Course = { id: string; name: string; isActive: boolean };
type Subject = { id: string; name: string; courseId: string; isActive: boolean };

export default function SubjectManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"course" | "subject">("course");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [activeCourseId, setActiveCourseId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let coursesReady = false, subjectsReady = false;
    const check = () => { if (coursesReady && subjectsReady) setLoading(false); };

    const un1 = onSnapshot(query(collection(db, "courses"), orderBy("name")), (snap) => {
      setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Course, "id">) })));
      coursesReady = true; check();
    });
    const un2 = onSnapshot(query(collection(db, "subjects"), orderBy("name")), (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, "id">) })));
      subjectsReady = true; check();
    });
    return () => { un1(); un2(); };
  }, []);

  function openCreateCourse() {
    setDialogMode("course"); setEditingId(null); setName(""); setIsActive(true); setOpen(true);
  }

  function openEditCourse(c: Course) {
    setDialogMode("course"); setEditingId(c.id); setName(c.name); setIsActive(c.isActive); setOpen(true);
  }

  function openAddSubject(courseId: string) {
    setDialogMode("subject"); setEditingId(null); setActiveCourseId(courseId);
    setName(""); setIsActive(true); setOpen(true);
  }

  function openEditSubject(s: Subject) {
    setDialogMode("subject"); setEditingId(s.id); setActiveCourseId(s.courseId);
    setName(s.name); setIsActive(s.isActive); setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      if (dialogMode === "course") {
        if (editingId) {
          await updateDoc(doc(db, "courses", editingId), { name: name.trim(), isActive });
        } else {
          await addDoc(collection(db, "courses"), { name: name.trim(), isActive, createdAt: serverTimestamp() });
        }
      } else {
        if (editingId) {
          await updateDoc(doc(db, "subjects", editingId), { name: name.trim(), isActive });
        } else {
          await addDoc(collection(db, "subjects"), {
            name: name.trim(), courseId: activeCourseId, isActive, createdAt: serverTimestamp(),
          });
        }
      }
      toast.success("Saved");
      setOpen(false);
    } catch { toast.error("Save failed"); }
    finally { setBusy(false); }
  }

  async function toggleCourse(c: Course) {
    await updateDoc(doc(db, "courses", c.id), { isActive: !c.isActive });
  }

  async function toggleSubject(s: Subject) {
    await updateDoc(doc(db, "subjects", s.id), { isActive: !s.isActive });
  }

  const subjectsByCourse = subjects.reduce<Record<string, Subject[]>>((acc, s) => {
    const key = s.courseId || "__ungrouped__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const ungrouped = subjectsByCourse["__ungrouped__"] || [];

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted-foreground text-sm">Manage exam courses and their subjects</p>
        </div>
        <Button onClick={openCreateCourse}><Plus className="h-4 w-4 mr-2" />Add Course</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {courses.length === 0 && ungrouped.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">No courses yet. Add one to get started.</div>
          ) : (
            <div className="divide-y">
              {courses.map((c) => {
                const courseSubjects = subjectsByCourse[c.id] || [];
                const isExpanded = expanded[c.id] ?? false;
                return (
                  <div key={c.id}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <button
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                        onClick={() => setExpanded((p) => ({ ...p, [c.id]: !isExpanded }))}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="font-semibold truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-1 shrink-0">
                          ({courseSubjects.length})
                        </span>
                      </button>
                      <Badge variant={c.isActive ? "default" : "secondary"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => openAddSubject(c.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Subject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditCourse(c)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleCourse(c)}>
                        {c.isActive ? "Hide" : "Show"}
                      </Button>
                    </div>

                    {isExpanded && (
                      courseSubjects.length === 0 ? (
                        <div className="pl-12 py-3 text-sm text-muted-foreground border-t border-border/40">
                          No subjects yet — click "+ Subject" to add one.
                        </div>
                      ) : (
                        courseSubjects.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 px-4 py-2.5 pl-10 border-t border-border/40 bg-background hover:bg-muted/20 transition-colors"
                          >
                            <span className="text-muted-foreground text-xs w-4 shrink-0">└</span>
                            <span className="flex-1 text-sm">{s.name}</span>
                            <Badge variant={s.isActive ? "outline" : "secondary"} className="text-xs">
                              {s.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => openEditSubject(s)}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleSubject(s)}>
                              {s.isActive ? "Hide" : "Show"}
                            </Button>
                          </div>
                        ))
                      )
                    )}
                  </div>
                );
              })}

              {ungrouped.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/10">
                    <button
                      className="flex items-center gap-2 flex-1 text-left"
                      onClick={() => setExpanded((p) => ({ ...p, __ungrouped__: !p["__ungrouped__"] }))}
                    >
                      {expanded["__ungrouped__"]
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium text-muted-foreground">Ungrouped</span>
                      <span className="text-xs text-muted-foreground ml-1">({ungrouped.length})</span>
                    </button>
                  </div>
                  {expanded["__ungrouped__"] && ungrouped.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-2.5 pl-10 border-t border-border/40 bg-background hover:bg-muted/20 transition-colors"
                    >
                      <span className="text-muted-foreground text-xs w-4 shrink-0">└</span>
                      <span className="flex-1 text-sm">{s.name}</span>
                      <Badge variant={s.isActive ? "outline" : "secondary"} className="text-xs">
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => openEditSubject(s)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleSubject(s)}>
                        {s.isActive ? "Hide" : "Show"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (dialogMode === "course" ? "Edit Course" : "Edit Subject")
                : (dialogMode === "course" ? "Add Course" : "Add Subject")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{dialogMode === "course" ? "Course Name" : "Subject Name"}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={dialogMode === "course" ? "e.g. JEE, NEET, UPSC" : "e.g. Physics, Chemistry"}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={busy}>
                {busy && <Loader2 className="animate-spin h-4 w-4 mr-2" />}Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

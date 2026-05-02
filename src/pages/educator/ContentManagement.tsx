import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, ExternalLink, BookOpen, FileText, Library } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadToImageKit, getContentUploadLimit } from "@/lib/imagekitUpload";
import { auth } from "@/lib/firebase";

const MONKEY_KING = import.meta.env.VITE_MONKEY_KING_API_URL as string;

async function triggerIngest(payload: {
  file_url: string;
  content_id: string;
  educator_id: string;
  course_id: string;
  branch_id: string;
  title: string;
  content_type: string;
  mime_type: string;
}) {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch(`${MONKEY_KING}/api/chat/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    // ingestion is best-effort; don't block the UX
  }
}

type Branch = { id: string; name: string };
type Course = { id: string; branchId: string; name: string };
type ContentItem = {
  id: string;
  type: "book" | "note";
  title: string;
  description?: string;
  fileUrl: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  source: "educator" | "admin_library";
  adminLibraryId?: string;
  addedBy: string;
  createdAt: Timestamp;
};
type AdminLibraryItem = {
  id: string;
  type: "book" | "note";
  title: string;
  description?: string;
  subjectId: string;
  subjectName: string;
  fileUrl: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContentManagement() {
  const { profile } = useAuth();
  const educatorId = profile?.uid ?? "";
  const fileRef = useRef<HTMLInputElement>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allowedCourseIds, setAllowedCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLimitMB, setUploadLimitMB] = useState(20);

  // Selected course
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // Content for selected course
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Admin library modal
  const [adminItems, setAdminItems] = useState<AdminLibraryItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  // Upload own content modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"book" | "note">("book");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!educatorId) return;

    getDoc(doc(db, "educators", educatorId)).then((snap) => {
      if (snap.exists()) {
        setAllowedCourseIds(snap.data().allowedCourseIds ?? []);
      }
    });

    const unsub = onSnapshot(
      collection(db, "educators", educatorId, "branches"),
      (snap) => {
        setBranches(snap.docs.map((d) => ({ id: d.id, name: d.data().name as string })));
        setLoading(false);
      }
    );

    getContentUploadLimit().then(setUploadLimitMB);

    return () => unsub();
  }, [educatorId]);

  // Load courses when branches change
  useEffect(() => {
    if (!educatorId || branches.length === 0) { setCourses([]); return; }
    const unsubs = branches.map((branch) =>
      onSnapshot(
        collection(db, "educators", educatorId, "branches", branch.id, "courses"),
        (snap) => {
          const bc = snap.docs.map((d) => ({
            id: d.id,
            branchId: branch.id,
            name: d.data().name as string,
          }));
          setCourses((prev) => [...prev.filter((c) => c.branchId !== branch.id), ...bc]);
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [branches, educatorId]);

  // Load content when course selected
  useEffect(() => {
    if (!educatorId || !selectedBranchId || !selectedCourseId) {
      setContent([]);
      return;
    }
    setContentLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, "educators", educatorId, "branches", selectedBranchId, "courses", selectedCourseId, "content"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setContent(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContentItem, "id">) })));
        setContentLoading(false);
      }
    );
    return () => unsub();
  }, [educatorId, selectedBranchId, selectedCourseId]);

  async function openImport() {
    const libSnap = await getDocs(query(collection(db, "admin_library"), orderBy("createdAt", "desc")));
    const all = libSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminLibraryItem, "id">) }));

    if (allowedCourseIds.length === 0) {
      // No restriction — show everything
      setAdminItems(all);
    } else {
      // Resolve subjects that belong to the educator's allowed courses
      const subjectSnap = await getDocs(
        query(collection(db, "subjects"), where("courseId", "in", allowedCourseIds))
      );
      const allowedSubjectIds = subjectSnap.docs.map((d) => d.id);
      setAdminItems(all.filter((i) => allowedSubjectIds.includes(i.subjectId)));
    }
    setImportOpen(true);
  }

  async function handleImport(item: AdminLibraryItem) {
    if (!selectedCourseId) return toast.error("Select a course first");
    setImportBusy(true);
    try {
      await addDoc(
        collection(db, "educators", educatorId, "branches", selectedBranchId, "courses", selectedCourseId, "content"),
        {
          type: item.type,
          title: item.title,
          description: item.description ?? null,
          fileUrl: item.fileUrl,
          fileId: item.fileId,
          fileName: item.fileName,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
          source: "admin_library",
          adminLibraryId: item.id,
          addedBy: educatorId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          indexed: false,
        }
      );
      toast.success(`"${item.title}" added to course`);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  function openUpload() {
    setTitle("");
    setDescription("");
    setType("book");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (!selectedCourseId) return toast.error("Select a course first");
    if (!title.trim()) return toast.error("Title required");
    if (!file) return toast.error("File required");

    const limitBytes = uploadLimitMB * 1024 * 1024;
    if (file.size > limitBytes) {
      return toast.error(`File exceeds ${uploadLimitMB} MB limit`);
    }

    setUploadBusy(true);
    try {
      const result = await uploadToImageKit(file, file.name, `/content/educator/${educatorId}`, "content");

      const ref = await addDoc(
        collection(db, "educators", educatorId, "branches", selectedBranchId, "courses", selectedCourseId, "content"),
        {
          type,
          title: title.trim(),
          description: description.trim() || null,
          fileUrl: result.url,
          fileId: result.fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          source: "educator",
          addedBy: educatorId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          indexed: false,
        }
      );

      // Best-effort: index the file for AI chatbot (non-blocking)
      triggerIngest({
        file_url: result.url,
        content_id: ref.id,
        educator_id: educatorId,
        course_id: selectedCourseId,
        branch_id: selectedBranchId,
        title: title.trim(),
        content_type: type,
        mime_type: file.type,
      });

      toast.success("Content added");
      setUploadOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleDelete(item: ContentItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteDoc(
        doc(db, "educators", educatorId, "branches", selectedBranchId, "courses", selectedCourseId, "content", item.id)
      );
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-sm text-muted-foreground">Manage books and notes per course</p>
      </div>

      {/* Course selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Course</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Select
            value={selectedBranchId}
            onValueChange={(v) => { setSelectedBranchId(v); setSelectedCourseId(""); }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedCourseId}
            onValueChange={setSelectedCourseId}
            disabled={!selectedBranchId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              {courses
                .filter((c) => c.branchId === selectedBranchId)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Content list */}
      {selectedCourseId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Content — {selectedCourse?.name}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openImport}>
                <Library className="mr-2 h-4 w-4" /> Import from Library
              </Button>
              <Button size="sm" onClick={openUpload}>
                <Plus className="mr-2 h-4 w-4" /> Add Content
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {contentLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
              </div>
            ) : content.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No content yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {content.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge variant={item.type === "book" ? "default" : "secondary"}>
                          {item.type === "book" ? <BookOpen className="mr-1 h-3 w-3" /> : <FileText className="mr-1 h-3 w-3" />}
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.source === "admin_library" ? "outline" : "secondary"}>
                          {item.source === "admin_library" ? "Admin Library" : "Own"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatBytes(item.fileSize)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.createdAt?.toDate().toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" asChild>
                            <a href={item.fileUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 1 Notes" />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "book" | "note")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="book">Book</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>File <span className="text-muted-foreground text-xs">(max {uploadLimitMB} MB)</span></Label>
              <input
                ref={fileRef}
                type="file"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full" onClick={handleUpload} disabled={uploadBusy}>
              {uploadBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from admin library dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import from Admin Library</DialogTitle>
          </DialogHeader>
          {adminItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No admin content available for your assigned courses
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.subjectName}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === "book" ? "default" : "secondary"}>
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={importBusy}
                        onClick={() => handleImport(item)}
                      >
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

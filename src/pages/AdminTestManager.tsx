import { useState, useEffect } from "react";
import { 
  Plus, Save, Trash2, Edit, List, Check, X, Loader2, LayoutGrid 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Firebase
import { 
  collection, addDoc, updateDoc, doc, deleteDoc, 
  onSnapshot, query, where, serverTimestamp, getDocs, writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminTestManager() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  // --- 1. Fetch Admin Tests ---
  useEffect(() => {
    const q = query(collection(db, "test_series"), where("authorId", "==", "admin"));
    const unsub = onSnapshot(q, (snap) => {
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- 2. Create / Edit Metadata ---
  const handleSaveMetadata = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      subject: formData.get("subject"),
      level: formData.get("level"),
      durationMinutes: Number(formData.get("duration")),
      authorId: "admin",
      createdAt: serverTimestamp(),
    };

    try {
      if (selectedTest?.id) {
        await updateDoc(doc(db, "test_series", selectedTest.id), data);
        toast.success("Test updated");
      } else {
        await addDoc(collection(db, "test_series"), data);
        toast.success("New Master Test Created");
      }
      setSelectedTest(null); // Close form
    } catch (err) {
      toast.error("Error saving test");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Test Manager</h1>
          <p className="text-muted-foreground">Create master tests for the global bank.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedTest(null)}>
              <Plus className="mr-2 h-4 w-4" /> Create New Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{selectedTest ? "Edit Test" : "Create Master Test"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveMetadata} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input name="title" defaultValue={selectedTest?.title} required />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input name="subject" defaultValue={selectedTest?.subject} placeholder="e.g. Physics" required />
                </div>
                <div className="space-y-2">
                   <Label>Level</Label>
                   <Select name="level" defaultValue={selectedTest?.level || "Medium"}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Easy">Easy</SelectItem>
                       <SelectItem value="Medium">Medium</SelectItem>
                       <SelectItem value="Hard">Hard</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (Mins)</Label>
                  <Input type="number" name="duration" defaultValue={selectedTest?.durationMinutes} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" defaultValue={selectedTest?.description} required />
              </div>
              <Button type="submit" className="w-full">Save Details</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tests.map(test => (
            <Card key={test.id} className="relative group">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="truncate">{test.title}</span>
                  <Badge>{test.subject}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{test.level}</span> • <span>{test.durationMinutes} mins</span>
                </div>
                
                <div className="flex gap-2 pt-2">
                   <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                     setSelectedTest(test);
                     setIsManageOpen(true);
                   }}>
                     <List className="mr-2 h-4 w-4" /> Manage Questions
                   </Button>
                   <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, "test_series", test.id))}>
                     <Trash2 className="h-4 w-4 text-red-500" />
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Questions Manager Pop-up */}
      {isManageOpen && selectedTest && (
        <QuestionsManager 
          testId={selectedTest.id} 
          collectionPath="test_series" // Admin edits root
          onClose={() => setIsManageOpen(false)} 
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENT: Questions Manager (Reusable) ---
function QuestionsManager({ testId, collectionPath, onClose }: { testId: string, collectionPath: string, onClose: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [editingQ, setEditingQ] = useState<any>(null); // Null = Create Mode

  // Fetch Questions
  useEffect(() => {
    // Determine path based on collection (Root has subcollection 'questions', Nested might differ)
    // We assume standard subcollection 'questions' for both
    const qRef = collection(db, collectionPath, testId, "questions");
    getDocs(qRef).then(snap => setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [testId, collectionPath]);

  const handleSaveQuestion = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    const qData = {
      text: fd.get("text"),
      options: [fd.get("opt1"), fd.get("opt2"), fd.get("opt3"), fd.get("opt4")],
      correctOptionIndex: Number(fd.get("correctIdx")),
      positiveMarks: Number(fd.get("pos")),
      negativeMarks: Number(fd.get("neg")),
    };

    try {
      const parentRef = collection(db, collectionPath, testId, "questions");
      if (editingQ) {
        await updateDoc(doc(parentRef, editingQ.id), qData);
        setQuestions(questions.map(q => q.id === editingQ.id ? { ...q, ...qData } : q));
        toast.success("Question updated");
      } else {
        const docRef = await addDoc(parentRef, qData);
        setQuestions([...questions, { id: docRef.id, ...qData }]);
        toast.success("Question added");
      }
      setEditingQ(null);
      e.target.reset(); // Reset form
    } catch (err) {
      console.error(err);
      toast.error("Failed to save question");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-4xl h-[85vh] rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-muted/30">
          <h2 className="font-bold text-lg">Manage Questions</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: List */}
          <div className="w-1/3 border-r overflow-y-auto p-4 space-y-3 bg-muted/10">
             <Button className="w-full mb-4" onClick={() => setEditingQ(null)}>
               <Plus className="mr-2 h-4 w-4" /> Add New Question
             </Button>
             {questions.map((q, idx) => (
               <div key={q.id} 
                 onClick={() => setEditingQ(q)}
                 className={`p-3 rounded-lg border cursor-pointer text-sm hover:bg-accent ${editingQ?.id === q.id ? 'border-primary bg-accent' : ''}`}>
                 <div className="font-medium line-clamp-1">Q{idx + 1}: {q.text}</div>
                 <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                    <span>Marks: +{q.positiveMarks} / -{q.negativeMarks}</span>
                 </div>
               </div>
             ))}
          </div>

          {/* Right: Form */}
          <div className="flex-1 p-6 overflow-y-auto">
             <form id="q-form" onSubmit={handleSaveQuestion} className="space-y-6 max-w-2xl mx-auto">
                <div>
                   <h3 className="text-lg font-semibold mb-4">{editingQ ? "Edit Question" : "New Question"}</h3>
                   <Label>Question Text</Label>
                   <Textarea name="text" defaultValue={editingQ?.text} className="mt-1.5" required placeholder="Type the question here..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-1.5">
                       <Label className="text-xs text-muted-foreground">Option {i}</Label>
                       <Input name={`opt${i}`} defaultValue={editingQ?.options?.[i-1]} required placeholder={`Option ${i}`} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                   <div className="space-y-1.5">
                      <Label>Correct Option</Label>
                      <Select name="correctIdx" defaultValue={editingQ ? String(editingQ.correctOptionIndex) : "0"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Option 1</SelectItem>
                          <SelectItem value="1">Option 2</SelectItem>
                          <SelectItem value="2">Option 3</SelectItem>
                          <SelectItem value="3">Option 4</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-green-600">Positive Marks</Label>
                      <Input type="number" name="pos" defaultValue={editingQ?.positiveMarks || 5} min={0} />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-red-600">Negative Marks</Label>
                      <Input type="number" name="neg" defaultValue={editingQ?.negativeMarks || 1} min={0} />
                   </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  {editingQ && (
                    <Button type="button" variant="destructive" onClick={async () => {
                       if(!confirm("Delete this question?")) return;
                       await deleteDoc(doc(db, collectionPath, testId, "questions", editingQ.id));
                       setQuestions(questions.filter(q => q.id !== editingQ.id));
                       setEditingQ(null);
                    }}>Delete</Button>
                  )}
                  <Button type="submit" className="min-w-[120px]">Save Question</Button>
                </div>
             </form>
          </div>
        </div>
      </div>
    </div>
  );
}

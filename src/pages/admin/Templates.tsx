import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	BookTemplate,
	CheckCircle2,
	Copy,
	FileText,
	Loader2,
	MoreVertical,
	Pencil,
	Plus,
	Search,
	Trash2,
	XCircle,
} from "lucide-react";
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
	serverTimestamp,
	Timestamp,
	updateDoc,
	writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/admin/EmptyState";
import { toast } from "@/hooks/use-toast";
import CreateTemplateModal from "@/components/admin/CreateTemplateModal";

type TemplateStatus = "all" | "published" | "draft";

type AdminTemplate = {
	id: string;
	title: string;
	description?: string;
	subject: string;
	level?: string;
	difficultyLevel?: number;
	durationMinutes: number;
	attemptsAllowed: number;
	questionsCount: number;
	isPublished: boolean;
	sections: Array<{ name: string; questionsCount: number; attemptConstraints?: { min: number; max: number } | null; selectionRule?: string | null }>;
	markingScheme?: { correct: number; incorrect: number; unanswered: number };
	syllabusCount: number;
	updatedAtTs?: Timestamp | null;
};

function safeNum(value: any, fallback: number) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function fmtDate(ts?: Timestamp | null) {
	if (!ts) return "-";
	try {
		return ts.toDate().toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "2-digit",
		});
	} catch {
		return "-";
	}
}

export default function Templates() {
	const navigate = useNavigate();
	const { profile, loading: authLoading } = useAuth();

	const [loading, setLoading] = useState(true);
	const [templates, setTemplates] = useState<AdminTemplate[]>([]);

	const [search, setSearch] = useState("");
	const [subject, setSubject] = useState("All");
	const [status, setStatus] = useState<TemplateStatus>("all");

	const [modalOpen, setModalOpen] = useState(false);
	const [templateToEdit, setTemplateToEdit] = useState<any | null>(null);

	const isAdmin = profile?.role === "ADMIN";

	useEffect(() => {
		if (authLoading) return;

		if (!isAdmin) {
			setLoading(false);
			setTemplates([]);
			return;
		}

		setLoading(true);
		const qRef = query(collection(db, "templates"), orderBy("updatedAt", "desc"));

		const unsub = onSnapshot(
			qRef,
			(snap) => {
				const rows: AdminTemplate[] = snap.docs
					.map((docSnap) => {
						const data = docSnap.data() as any;

						return {
							id: docSnap.id,
							title: String(data?.title || "Untitled Template"),
							description: data?.description ? String(data.description) : "",
							subject: String(data?.subject || "General"),
							level: data?.level ? String(data.level) : undefined,
							difficultyLevel: typeof data?.difficultyLevel === 'number' ? data.difficultyLevel : undefined,
							durationMinutes: safeNum(data?.durationMinutes ?? data?.duration, 60),
							attemptsAllowed: Math.max(1, safeNum(data?.attemptsAllowed, 3)),
							questionsCount: Math.max(
								0,
								safeNum(data?.questionsCount ?? data?.totalQuestions ?? data?.questionCount, 0)
							),
							isPublished: data?.isPublished !== false,
							sections: Array.isArray(data?.sections) ? data.sections : [],
							markingScheme: data?.markingScheme,
							syllabusCount: Array.isArray(data?.syllabus) ? data.syllabus.length : 0,
							syllabus: data?.syllabus,
							updatedAtTs: (data?.updatedAt as Timestamp) || (data?.createdAt as Timestamp) || null,
						};
					})
					.filter(Boolean) as AdminTemplate[];

				setTemplates(rows);
				setLoading(false);
			},
			() => {
				setTemplates([]);
				setLoading(false);
				toast({
					title: "Failed to load templates",
					description: "Please refresh and try again.",
					variant: "destructive",
				});
			}
		);

		return () => unsub();
	}, [authLoading, isAdmin]);

	const subjects = useMemo(() => {
		const set = new Set<string>(["All"]);
		templates.forEach((item) => item.subject && set.add(item.subject));
		return Array.from(set);
	}, [templates]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return templates.filter((item) => {
			const matchesSearch =
				!q ||
				item.title.toLowerCase().includes(q) ||
				String(item.description || "").toLowerCase().includes(q);

			const matchesSubject = subject === "All" || item.subject === subject;

			const matchesStatus =
				status === "all" || (status === "published" ? item.isPublished : !item.isPublished);

			return matchesSearch && matchesSubject && matchesStatus;
		});
	}, [templates, search, subject, status]);

	const stats = useMemo(() => {
		const total = templates.length;
		const published = templates.filter((item) => item.isPublished).length;
		const draft = total - published;
		return { total, published, draft };
	}, [templates]);

	async function toggleTemplateStatus(item: AdminTemplate) {
		try {
			await updateDoc(doc(db, "templates", item.id), {
				isPublished: !item.isPublished,
				updatedAt: serverTimestamp(),
			});
			toast({
				title: !item.isPublished ? "Template published" : "Template moved to draft",
			});
		} catch {
			toast({
				title: "Update failed",
				description: "Could not update template status.",
				variant: "destructive",
			});
		}
	}

	async function duplicateTemplate(item: AdminTemplate) {
		try {
			const srcRef = doc(db, "templates", item.id);
			const srcSnap = await getDoc(srcRef);

			if (!srcSnap.exists()) {
				toast({
					title: "Template not found",
					description: "Original template no longer exists.",
					variant: "destructive",
				});
				return;
			}

			const srcData = srcSnap.data() as any;
			const newRef = await addDoc(collection(db, "templates"), {
				...srcData,
				title: `${String(srcData?.title || item.title)} (Copy)`,
				isPublished: false,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});

			toast({
				title: "Template duplicated",
				description: "Copy created as draft.",
			});
		} catch {
			toast({
				title: "Duplicate failed",
				description: "Could not duplicate template.",
				variant: "destructive",
			});
		}
	}

	async function deleteTemplate(item: AdminTemplate) {
		const ok = window.confirm(`Delete template "${item.title}"?`);
		if (!ok) return;

		try {
			await deleteDoc(doc(db, "templates", item.id));
			toast({ title: "Template deleted" });
		} catch {
			toast({
				title: "Delete failed",
				description: "Could not delete template.",
				variant: "destructive",
			});
		}
	}

	if (loading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-display font-bold">Templates</h1>
					<p className="text-muted-foreground text-sm">Manage reusable test templates for educators</p>
				</div>
				<Card className="card-soft border-0">
					<CardContent className="p-8 flex items-center justify-center text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading templates...
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!isAdmin) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-display font-bold">Templates</h1>
					<p className="text-muted-foreground text-sm">Admin access required</p>
				</div>
				<EmptyState
					icon={BookTemplate}
					title="Admin only"
					description="Please login with an Admin account to manage templates."
					actionLabel="Go to Login"
					onAction={() => (window.location.href = "/login?role=admin")}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-display font-bold">Templates</h1>
					<p className="text-muted-foreground text-sm">Create and publish test templates available for educators</p>
				</div>
				<Button className="gradient-bg text-white" onClick={() => {
					setTemplateToEdit(null);
					setModalOpen(true);
				}}> 
					<Plus className="h-4 w-4 mr-2" /> Create Template
				</Button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<Card className="card-soft border-0">
					<CardContent className="p-4">
						<p className="text-xs text-muted-foreground">Total Templates</p>
						<p className="text-xl font-semibold">{stats.total}</p>
					</CardContent>
				</Card>
				<Card className="card-soft border-0">
					<CardContent className="p-4">
						<p className="text-xs text-muted-foreground">Published</p>
						<p className="text-xl font-semibold text-green-600">{stats.published}</p>
					</CardContent>
				</Card>
				<Card className="card-soft border-0">
					<CardContent className="p-4">
						<p className="text-xs text-muted-foreground">Draft</p>
						<p className="text-xl font-semibold text-amber-600">{stats.draft}</p>
					</CardContent>
				</Card>
			</div>

			<Card className="card-soft border-0">
				<CardContent className="p-4">
					<div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
						<div className="relative lg:col-span-2">
							<Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search templates..."
								className="pl-9"
							/>
						</div>

						<select
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							className="h-10 rounded-md border border-input bg-background px-3 text-sm"
						>
							{subjects.map((item) => (
								<option key={item} value={item}>{item}</option>
							))}
						</select>

						<select
							value={status}
							onChange={(e) => setStatus(e.target.value as TemplateStatus)}
							className="h-10 rounded-md border border-input bg-background px-3 text-sm"
						>
							<option value="all">All Status</option>
							<option value="published">Published</option>
							<option value="draft">Draft</option>
						</select>
					</div>
				</CardContent>
			</Card>

			{filtered.length === 0 ? (
				<EmptyState
					icon={BookTemplate}
					title="No templates found"
					description="Create your first template or adjust filters."
					actionLabel="Create Template"
					onAction={() => navigate("/admin/tests/new")}
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{filtered.map((item) => (
						<Card key={item.id} className="card-soft">
							<CardHeader className="pb-3">
								<CardTitle className="text-base flex items-start justify-between gap-2">
									<span className="line-clamp-2">{item.title}</span>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
												<MoreVertical className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => {
												setTemplateToEdit(item);
												setModalOpen(true);
											}}>
												<Pencil className="h-4 w-4 mr-2" /> Edit Template
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => duplicateTemplate(item)}>
												<Copy className="h-4 w-4 mr-2" /> Duplicate
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={() => toggleTemplateStatus(item)}>
												{item.isPublished ? (
													<>
														<XCircle className="h-4 w-4 mr-2" /> Move to Draft
													</>
												) : (
													<>
														<CheckCircle2 className="h-4 w-4 mr-2" /> Publish
													</>
												)}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem className="text-destructive" onClick={() => deleteTemplate(item)}>
												<Trash2 className="h-4 w-4 mr-2" /> Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</CardTitle>
							</CardHeader>

							<CardContent className="space-y-3">
								{/* <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{item.description || "No description"}</p> */}

								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary" className="rounded-full">{item.subject}</Badge>
									{item.level ? <Badge variant="outline" className="rounded-full">{item.level}</Badge> : null}
									{item.isPublished ? (
										<Badge className="rounded-full bg-green-100 text-green-700">Published</Badge>
									) : (
										<Badge variant="outline" className="rounded-full text-amber-700 border-amber-300">Draft</Badge>
									)}
								</div>

								<div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-2 border-b border-border/40">
									<div>
										<p>Duration</p>
										<p className="font-medium text-foreground">{item.durationMinutes}m</p>
									</div>
									<div>
										<p>Attempts</p>
										<p className="font-medium text-foreground">{item.attemptsAllowed}</p>
									</div>
									<div>
										<p>Questions</p>
										<p className="font-medium text-foreground">{item.questionsCount}</p>
									</div>
								</div>

								{/* Template Details: Sections & Marking */}
								<div className="space-y-2 text-xs">
									{item.sections && item.sections.length > 0 && (
										<div>
											<p className="text-muted-foreground font-medium mb-1">Sections ({item.sections.length})</p>
											<div className="flex flex-wrap gap-1">
												{item.sections.slice(0, 3).map((sec, idx) => (
													<span key={idx} className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
														{sec.name} ({safeNum(sec.questionsCount, 0)}
														{sec.attemptConstraints ? `, attempt ${sec.selectionRule === 'EXACT' ? '=' : '≤'}${sec.attemptConstraints.max}` : ''})
													</span>
												))}
												{item.sections.length > 3 && (
													<span className="text-muted-foreground text-[10px] pl-1">+{item.sections.length - 3} more</span>
												)}
											</div>
										</div>
									)}

									{(item.markingScheme || item.syllabusCount > 0) && (
										<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
											{item.markingScheme ? (
												<span className="flex gap-1.5">
													<span className="text-green-600 font-medium">+{safeNum(item.markingScheme.correct, 0)}</span>
													<span className="text-red-500">{safeNum(item.markingScheme.incorrect, 0)}</span>
												</span>
											) : <span>No marking scheme</span>}

											{item.syllabusCount > 0 && (
												<span>{item.syllabusCount} topics</span>
											)}
										</div>
									)}
								</div>

								<p className="text-[10px] text-muted-foreground pt-2">Updated: {fmtDate(item.updatedAtTs)}</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<CreateTemplateModal 
				open={modalOpen} 
				onOpenChange={setModalOpen} 
				templateToEdit={templateToEdit} 
			/>
		</div>
	);
}


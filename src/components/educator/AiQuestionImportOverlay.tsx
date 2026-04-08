import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNegativeMarksDisplay, type AiImportPreviewItem, type AiImportSummary } from "@/lib/aiQuestionImport";
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, X } from "lucide-react";

function statusTone(status: AiImportPreviewItem["status"]) {
  if (status === "ready") return "default" as const;
  if (status === "partial") return "secondary" as const;
  return "destructive" as const;
}

type Props = {
  open: boolean;
  fileName: string;
  summary: AiImportSummary | null;
  items: AiImportPreviewItem[];
  importing: boolean;
  saving: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onItemIncludeChange: (sourceIndex: number, include: boolean) => void;
  onSelectReadyOnly: () => void;
  onToggleAllPartials: (include: boolean) => void;
  onSaveSelected: () => void;
};

export default function AiQuestionImportOverlay({
  open,
  fileName,
  summary,
  items,
  importing,
  saving,
  onClose,
  onCancel,
  onItemIncludeChange,
  onSelectReadyOnly,
  onToggleAllPartials,
  onSaveSelected,
}: Props) {
  if (!open) return null;

  const selectedCount = items.filter((item) => item.include && item.status !== "rejected").length;
  const partialSelected = items.some((item) => item.status === "partial" && item.include);

  return (
    <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold truncate">AI PDF Import Preview</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {fileName || "Uploaded PDF"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {importing ? (
            <>
              <Button variant="outline" className="rounded-xl" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing PDF...
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={saving}>
                <X className="mr-2 h-4 w-4" /> Close
              </Button>
              <Button className="rounded-xl" onClick={onSaveSelected} disabled={saving || selectedCount === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Selected ({selectedCount})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-0 flex-1 min-h-0">
        <div className="border-r bg-muted/20 p-5 space-y-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Import Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {importing ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Extracting and analyzing PDF...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border p-3">
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-lg font-semibold">{summary?.total ?? items.length}</p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-muted-foreground">Ready</p>
                      <p className="text-lg font-semibold">{summary?.ready ?? 0}</p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-muted-foreground">Partial</p>
                      <p className="text-lg font-semibold">{summary?.partial ?? 0}</p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-muted-foreground">Rejected</p>
                      <p className="text-lg font-semibold">{summary?.rejected ?? 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button variant="outline" className="w-full rounded-xl" onClick={onSelectReadyOnly}>
                      Select Ready Only
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => onToggleAllPartials(!partialSelected)}
                    >
                      {partialSelected ? "Unselect Partial" : "Select Partial as Inactive Drafts"}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <div>
                        <p className="font-medium">How partial questions are saved</p>
                        <p className="text-xs mt-1">
                          Partial questions can be kept, but they will be saved as inactive review drafts so students do not see them until you fix them.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <ScrollArea className="min-h-0">
          <div className="p-5 space-y-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                No questions were found in this PDF.
              </div>
            ) : (
              items.map((item) => {
                const canInclude = item.status !== "rejected";
                return (
                  <Card key={item.sourceIndex} className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">Question {item.sourceIndex}</CardTitle>
                            <Badge variant={statusTone(item.status)} className="capitalize rounded-full">
                              {item.status}
                            </Badge>
                            {item.status === "ready" ? (
                              <Badge variant="outline" className="rounded-full">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Active on save
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                            {item.question || "Question text could not be extracted clearly."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Checkbox
                            checked={item.include}
                            disabled={!canInclude || saving}
                            onCheckedChange={(checked) => onItemIncludeChange(item.sourceIndex, checked === true)}
                          />
                          <span className="text-sm text-muted-foreground">Keep</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="grid gap-2">
                        {(item.options || []).length > 0 ? (
                          item.options.map((option, index) => (
                            <div key={index} className="rounded-xl border px-3 py-2 flex items-start gap-3">
                              <span className="font-medium text-muted-foreground">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">{option || "—"}</div>
                              {item.correctOption === index ? (
                                <Badge className="rounded-full shrink-0">Correct</Badge>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed px-3 py-2 text-muted-foreground">
                            Options could not be extracted.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="rounded-full">Marks: +{item.marks}</Badge>
                        <Badge variant="outline" className="rounded-full">Negative: {formatNegativeMarksDisplay(item.negativeMarks)}</Badge>
                        <Badge variant="outline" className="rounded-full">
                          Correct Option: {typeof item.correctOption === "number" ? String.fromCharCode(65 + item.correctOption) : "Not found"}
                        </Badge>
                      </div>

                      {item.reasons?.length ? (
                        <div className="rounded-xl border border-dashed p-3 bg-muted/20">
                          <p className="font-medium mb-2">Report</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {item.reasons.map((reason, index) => (
                              <li key={index}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

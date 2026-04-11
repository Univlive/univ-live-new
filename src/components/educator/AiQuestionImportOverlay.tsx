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
  onSelectAll: () => void;
  onSelectOnlyReady: () => void;
  onSelectOnlyPartial: () => void;
  onSelectOnlyRejected: () => void;
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
  onSelectAll,
  onSelectOnlyReady,
  onSelectOnlyPartial,
  onSelectOnlyRejected,
  onSaveSelected,
}: Props) {
  if (!open) return null;

  const selectedCount = items.filter((item) => item.include).length;
  const readyCount = summary?.ready ?? items.filter((item) => item.status === "ready").length;
  const partialCount = summary?.partial ?? items.filter((item) => item.status === "partial").length;
  const rejectedCount = summary?.rejected ?? items.filter((item) => item.status === "rejected").length;
  const acceptedCount = readyCount + partialCount;

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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Import Summary</CardTitle>
                {importing && items.length > 0 && (
                  <Badge variant="secondary" className="text-xs animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Processing...
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {importing && items.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Extracting and analyzing PDF...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border p-3 bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                        {summary?.total ?? items.length}
                        {importing && <span className="text-xs ml-1">+</span>}
                      </p>
                    </div>
                    <div className="rounded-xl border p-3 bg-green-50 dark:bg-green-950/20">
                      <p className="text-muted-foreground text-xs">Ready</p>
                      <p className="text-lg font-semibold text-green-700 dark:text-green-300">{summary?.ready ?? 0}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-yellow-50 dark:bg-yellow-950/20">
                      <p className="text-muted-foreground text-xs">Partial</p>
                      <p className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">{summary?.partial ?? 0}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-red-50 dark:bg-red-950/20">
                      <p className="text-muted-foreground text-xs">Rejected</p>
                      <p className="text-lg font-semibold text-red-700 dark:text-red-300">{summary?.rejected ?? 0}</p>
                    </div>
                  </div>

                  {!importing && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div>
                          <p className="font-medium">How partial questions are saved</p>
                          <p className="text-xs mt-1">
                            Any non-ready question (partial, incomplete, or rejected by AI) can be kept and will be saved as an inactive review draft so students do not see it until you fix it.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <ScrollArea className="min-h-0">
          <div className="p-5 space-y-4">
            {!importing && items.length > 0 && (
              <Card className="rounded-2xl sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="rounded-full">Accepted: {acceptedCount}</Badge>
                    <Badge variant="default" className="rounded-full">Complete: {readyCount}</Badge>
                    <Badge variant="secondary" className="rounded-full">Partial: {partialCount}</Badge>
                    <Badge variant="destructive" className="rounded-full">Rejected: {rejectedCount}</Badge>
                    <Badge variant="outline" className="rounded-full">Selected: {selectedCount}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={onSelectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={onSelectOnlyReady}>
                      Only Complete
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={onSelectOnlyPartial}>
                      Only Partial
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={onSelectOnlyRejected}>
                      Only Rejected
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                No questions were found in this PDF.
              </div>
            ) : (
              items.map((item) => {
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
                            disabled={saving}
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

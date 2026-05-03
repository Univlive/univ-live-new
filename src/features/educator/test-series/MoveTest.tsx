import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { cn } from "@shared/lib/utils";
import {
  BookOpen,
  Image as ImageIcon,
  Folder
} from "lucide-react";

const MoveTest = ({moveTestOpen,setMoveTestOpen,testToMove,handleMoveTest,folders}) => {
    return (
        <Dialog open={moveTestOpen} onOpenChange={setMoveTestOpen}>
            <DialogContent className="rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Move to Folder</DialogTitle>
                    <DialogDescription>Select a folder to move "{testToMove?.title}" into.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <div
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-accent transition-colors",
                            !testToMove?.folderId && "border-primary bg-primary/5"
                        )}
                        onClick={() => handleMoveTest(testToMove.id, null)}
                    >
                        <div className="p-2 rounded-lg bg-muted">
                            <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">Subject Folder (Default)</p>
                            <p className="text-xs text-muted-foreground">Move back to auto-subject grouping</p>
                        </div>
                    </div>

                    {folders.map(f => (
                        <div
                            key={f.id}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-accent transition-colors",
                                testToMove?.folderId === f.id && "border-primary bg-primary/5"
                            )}
                            onClick={() => handleMoveTest(testToMove.id, f.id)}
                        >
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Folder className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">{f.name}</p>
                            </div>
                        </div>
                    ))}

                    {folders.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4 italic">No custom folders created yet.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default MoveTest
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";

const CreateCustomTest = ({createOpen, setCreateOpen, handleCreateCustom ,creating}) => {
    return (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
                <Button className="gradient-bg text-white shadow-lg">
                    <Plus className="mr-2 h-4 w-4" /> Create Custom Test
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Test</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleCreateCustom} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input name="title" required placeholder="e.g. Weekly Biology Mock" className="rounded-xl" />
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            name="description"
                            placeholder="Short instructions / overview..."
                            className="rounded-xl min-h-[90px]"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input name="subject" required className="rounded-xl" placeholder="e.g. Maths" />
                        </div>
                        <div className="space-y-2">
                            <Label>Level</Label>
                            <Input name="level" className="rounded-xl" placeholder="e.g. Medium" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input name="duration" required type="number" min={1} defaultValue={60} className="rounded-xl" />
                    </div>

                    <div className="space-y-2">
                        <Label>Access Window (minutes, 0 = no limit)</Label>
                        <Input name="accessWindowMinutes" type="number" min={0} defaultValue={0} className="rounded-xl" />
                        <p className="text-xs text-muted-foreground">Students can only unlock within this time after code is generated. 0 means no limit.</p>
                    </div>

                    <Button type="submit" className="w-full rounded-xl" disabled={creating}>
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Test"}
                    </Button>

                    <p className="text-xs text-muted-foreground">
                        Note: Educators cannot import from the global question bank. Add questions manually inside the test.
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default CreateCustomTest
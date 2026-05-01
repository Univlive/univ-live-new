import { useState, useEffect } from "react";
import { Clock, Loader2, Calendar as CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ScheduleTestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: any;
  userId: string;
}

export default function ScheduleTest({ open, onOpenChange, test, userId }: ScheduleTestProps) {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (test) {
      if (test.startTime) {
        const start = test.startTime instanceof Timestamp ? test.startTime.toDate() : new Date(test.startTime);
        setStartTime(formatDateTimeLocal(start));
      } else {
        setStartTime("");
      }

      if (test.endTime) {
        const end = test.endTime instanceof Timestamp ? test.endTime.toDate() : new Date(test.endTime);
        setEndTime(formatDateTimeLocal(end));
      } else {
        setEndTime("");
      }
    }
  }, [test, open]);

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSave = async () => {
    if (!test || !userId) return;

    if (!startTime || !endTime) {
      // If one is set, both must be set, or both cleared
      if (startTime || endTime) {
        toast.error("Please set both start and end times, or clear both to remove schedule.");
        return;
      }
    }

    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      toast.error("End time must be after start time.");
      return;
    }

    setLoading(true);
    try {
      const testRef = doc(db, "educators", userId, "my_tests", test.id);
      
      const payload: any = {
        updatedAt: serverTimestamp(),
      };

      if (startTime && endTime) {
        payload.startTime = Timestamp.fromDate(new Date(startTime));
        payload.endTime = Timestamp.fromDate(new Date(endTime));
      } else {
        // Clear schedule
        payload.startTime = null;
        payload.endTime = null;
      }

      await updateDoc(testRef, payload);
      toast.success(startTime ? "Test scheduled successfully!" : "Schedule removed successfully!");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update schedule.");
    } finally {
      setLoading(false);
    }
  };

  const clearSchedule = () => {
    setStartTime("");
    setEndTime("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Schedule Test
          </DialogTitle>
          <DialogDescription>
            Set a time window when all enrolled students can access this test without an access code.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Date & Time</Label>
            <div className="relative">
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End Date & Time</Label>
            <div className="relative">
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {(startTime || endTime) && (
            <Button variant="ghost" size="sm" onClick={clearSchedule} className="w-fit text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
              <X className="h-4 w-4 mr-1" /> Clear Schedule
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-xl gradient-bg text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

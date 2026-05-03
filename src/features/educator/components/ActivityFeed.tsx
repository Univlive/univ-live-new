import { motion } from "framer-motion";
import {
  UserPlus,
  Key,
  FileCheck,
  CreditCard,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { cn } from "@shared/lib/utils";

export type EducatorActivity = {
  id: string;
  type: "student_joined" | "access_code" | "test_attempted" | "seat_update" | "message";
  title: string;
  description: string;
  time: string;
};

const iconMap: Record<EducatorActivity["type"], LucideIcon> = {
  student_joined: UserPlus,
  access_code: Key,
  test_attempted: FileCheck,
  seat_update: CreditCard,
  message: MessageSquare,
};

const colorMap: Record<EducatorActivity["type"], string> = {
  student_joined: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  access_code: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  test_attempted: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  seat_update: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  message: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
};

interface ActivityFeedProps {
  activities?: EducatorActivity[];
  delay?: number;
}

export default function ActivityFeed({ activities = [], delay = 0 }: ActivityFeedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="h-64 overflow-hidden">
          {activities.length === 0 ? (
            <div className="h-full overflow-y-auto rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No recent activity yet. New learner joins, attempts, access-code activity, and messages will appear here.
            </div>
          ) : (
            <div className="h-full space-y-4 overflow-y-auto pr-1">
              {activities.map((activity, index) => {
                const Icon = iconMap[activity.type];
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: delay + index * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <div className={cn("p-2 rounded-lg shrink-0", colorMap[activity.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{activity.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

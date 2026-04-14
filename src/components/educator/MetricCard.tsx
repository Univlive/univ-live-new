import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon: LucideIcon;
  iconColor?: string;
  delay?: number;
  blendWithGradient?: boolean;
}

export default function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor = "text-primary",
  delay = 0,
  blendWithGradient = false,
}: MetricCardProps) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card
        className={cn(
          "card-hover h-full",
          blendWithGradient && "border-white/30 bg-white/10 text-white backdrop-blur-sm"
        )}
      >
        <CardContent className="p-5 h-full">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className={cn("text-sm font-medium", blendWithGradient ? "text-white/85" : "text-muted-foreground")}>{title}</p>
              <p className="text-2xl sm:text-3xl font-bold font-display">{value}</p>
              {/* Kept prop for backward compatibility; hidden by request to remove percentage strip */}
              {change && null}
            </div>
            <div
              className={cn(
                "p-3 rounded-xl",
                blendWithGradient ? "bg-white/15" : "bg-muted",
                iconColor
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

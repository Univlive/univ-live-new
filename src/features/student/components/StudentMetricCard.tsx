import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@shared/ui/card";
import { cn } from "@shared/lib/utils";

interface StudentMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "mint" | "yellow" | "lavender" | "peach" | "pink";
  className?: string;
}

const colorClasses = {
  mint: "bg-pastel-mint",
  yellow: "bg-pastel-yellow",
  lavender: "bg-pastel-lavender",
  peach: "bg-pastel-peach",
  pink: "bg-pastel-pink",
};

export function StudentMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "mint",
  className,
}: StudentMetricCardProps) {
  return (
    <Card className={cn("card-soft card-hover border-0", colorClasses[color], className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p className={cn(
                "text-xs font-medium flex items-center gap-1",
                trend.isPositive ? "text-green-600" : "text-red-500"
              )}>
                <span>{trend.isPositive ? "↑" : "↓"}</span>
                {Math.abs(trend.value)}% from last week
              </p>
            )}
          </div>
          <div className="p-3 rounded-xl bg-background/60">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

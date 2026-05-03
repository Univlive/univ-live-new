import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@shared/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32 }}
      className={className}
    >
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        {Icon ? (
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.24 7.76L13 15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        {description && <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>}

        {actionLabel && onAction && (
          <Button onClick={onAction} className="gradient-bg text-white rounded-xl">
            {actionLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

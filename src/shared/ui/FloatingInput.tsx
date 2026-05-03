import { InputHTMLAttributes } from "react";
import { cn } from "@shared/lib/utils";

type FloatingInputProps = {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>;

export default function FloatingInput({
  label,
  className,
  ...props
}: FloatingInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      
      <input
        {...props}
        placeholder=" "
        className={cn(
          "peer w-full rounded-xl border border-border bg-background px-3 pt-3 pb-2 text-sm outline-none transition",
          "focus:border-ring focus:ring-2 focus:ring-ring/30"
        )}
      />

      <label
        className={cn(
          "absolute left-3 -top-2 z-10 px-1 text-xs",
          "bg-background text-muted-foreground transition-all",
          "peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm",
          "peer-focus:-top-2 peer-focus:text-xs peer-focus:text-ring"
        )}
      >
        {label}
      </label>

    </div>
  );
}
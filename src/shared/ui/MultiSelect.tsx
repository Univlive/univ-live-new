import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@shared/ui/badge";
import { Input } from "@shared/ui/input";
import { X, ChevronDown, Check } from "lucide-react";
import { cn } from "@shared/lib/utils";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const remove = (value: string) => onChange(selected.filter((v) => v !== value));

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 min-h-[2.5rem] border rounded-md bg-background transition-colors",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-muted-foreground/40",
          open && !disabled ? "ring-1 ring-ring border-primary" : ""
        )}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
      >
        {selected.length === 0 && (
          <span className="text-sm text-muted-foreground px-1 flex-1">{placeholder}</span>
        )}
        {selected.map((v) => (
          <Badge key={v} variant="secondary" className="flex items-center gap-1 px-2 py-0.5 text-sm font-medium rounded-md">
            {v}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); remove(v); }}
            />
          </Badge>
        ))}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform", open && "rotate-180")} />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? "No matches" : "No options available"}
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/5 text-primary"
                    )}
                    onClick={() => toggle(opt)}
                  >
                    <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span>{opt}</span>
                  </div>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="p-2 border-t flex justify-between items-center bg-muted/20">
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              <button className="text-xs text-destructive hover:underline" onClick={() => onChange([])}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

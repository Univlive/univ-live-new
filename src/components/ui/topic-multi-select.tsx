import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicMultiSelectProps {
  selectedTopics: string[];
  setSelectedTopics: (topics: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TopicMultiSelect({
  selectedTopics,
  setSelectedTopics,
  placeholder = "Search and select topics...",
  className,
}: TopicMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch unique topics from question_bank
  useEffect(() => {
    let cancelled = false;
    setLoadingTopics(true);
    getDocs(collection(db, "question_bank"))
      .then((snap) => {
        if (cancelled) return;
        const topicSet = new Set<string>();
        snap.docs.forEach((d) => {
          const t = (d.data() as any)?.topic;
          if (t && typeof t === "string" && t.trim()) {
            topicSet.add(t.trim());
          }
        });
        setAllTopics(Array.from(topicSet).sort());
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingTopics(false); });
    return () => { cancelled = true; };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? allTopics.filter((t) => t.toLowerCase().includes(q))
      : allTopics;
  }, [allTopics, search]);

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const removeTopic = (topic: string) => {
    setSelectedTopics(selectedTopics.filter((t) => t !== topic));
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 min-h-[2.5rem] border rounded-md bg-background cursor-pointer transition-colors",
          open ? "ring-1 ring-ring border-primary" : "hover:border-muted-foreground/40"
        )}
        onClick={() => {
          setOpen(!open);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
      >
        {selectedTopics.length === 0 && (
          <span className="text-sm text-muted-foreground px-1 flex-1">
            {placeholder}
          </span>
        )}
        {selectedTopics.map((topic) => (
          <Badge
            key={topic}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-0.5 text-sm font-medium rounded-md"
          >
            {topic}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                removeTopic(topic);
              }}
            />
          </Badge>
        ))}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b">
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics..."
              className="h-8 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Topic list */}
          <div className="max-h-48 overflow-y-auto">
            {loadingTopics ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading topics...</span>
              </div>
            ) : filteredTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? "No topics match your search" : "No topics found in question bank"}
              </p>
            ) : (
              filteredTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <div
                    key={topic}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/5 text-primary"
                    )}
                    onClick={() => toggleTopic(topic)}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span>{topic}</span>
                  </div>
                );
              })
            )}
          </div>

          {selectedTopics.length > 0 && (
            <div className="p-2 border-t flex justify-between items-center bg-muted/20">
              <span className="text-xs text-muted-foreground">{selectedTopics.length} selected</span>
              <button
                className="text-xs text-destructive hover:underline"
                onClick={() => setSelectedTopics([])}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

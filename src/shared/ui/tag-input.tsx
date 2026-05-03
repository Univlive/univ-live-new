import React, { useState, KeyboardEvent, useRef } from "react";
import { Badge } from "@shared/ui/badge";
import { X } from "lucide-react";
import { cn } from "@shared/lib/utils";

interface TagInputProps {
  placeholder?: string;
  tags: string[];
  setTags: (tags: string[]) => void;
  className?: string;
}

export function TagInput({ placeholder, tags, setTags, className }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/,$/, "");
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-2 border rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-colors cursor-text min-h-[2.5rem]",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <Badge key={index} variant="secondary" className="flex items-center gap-1 px-2 py-0.5 text-sm font-medium rounded-md">
          {tag}
          <X
            className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors ml-1"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(index);
            }}
          />
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? (placeholder || "Type and press Enter...") : ""}
        className="flex-1 bg-transparent outline-none min-w-[120px] text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

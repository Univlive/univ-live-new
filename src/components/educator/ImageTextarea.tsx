// components/educator/ImageTextarea.tsx
// A rich textarea that supports:
//   – Drag-and-drop image upload
//   – Clipboard paste image upload
//   – File picker ("Add Image" button)
//   – Live image preview with remove buttons
//
// IMPORTANT: Image `<img>` tags are NEVER shown in the textarea.
// The user only sees/edits the plain text portion. Images are stored
// as `<img>` tags appended at the end of the value string but are
// presented only as visual thumbnails below the textarea. This
// prevents accidental corruption of HTML markup.

import { useState, useRef, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon,
  Loader2,
  X,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { uploadToImageKit } from "@/lib/imagekitUpload";
import { cn } from "@/lib/utils";

interface ImageTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  folder?: string;
  disabled?: boolean;
  /** Hide the bottom "Add Image" button + hint row */
  hideControls?: boolean;
}

// ─── Helpers to split / combine text and images ────────────────────────

const IMG_TAG_REGEX = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;

/** Split a combined value into { text, imageUrls }. */
function splitContent(raw: string): { text: string; imageUrls: string[] } {
  const imageUrls: string[] = [];
  const regex = new RegExp(IMG_TAG_REGEX.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (match[1]) imageUrls.push(match[1]);
  }

  // Strip all <img …> tags and collapse resulting blank lines
  const text = raw
    .replace(new RegExp(IMG_TAG_REGEX.source, "gi"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, imageUrls };
}

/** Combine plain text + image URLs back into a single stored value. */
function combineContent(text: string, imageUrls: string[]): string {
  if (imageUrls.length === 0) return text;
  const tags = imageUrls.map((url) => `<img src="${url}" alt="" />`).join("\n");
  const trimmed = text.trimEnd();
  return trimmed ? `${trimmed}\n${tags}` : tags;
}

// ─── Component ─────────────────────────────────────────────────────────

export default function ImageTextarea({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "140px",
  folder = "/test-questions",
  disabled = false,
  hideControls = false,
}: ImageTextareaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dragCounter = useRef(0);

  // Derive text (shown in textarea) and imageUrls (shown as previews)
  const { text, imageUrls } = useMemo(() => splitContent(value), [value]);

  // ─── When the user edits the textarea, keep existing images ────────
  const handleTextChange = useCallback(
    (newText: string) => {
      onChange(combineContent(newText, imageUrls));
    },
    [onChange, imageUrls]
  );

  // ─── Upload a single image file ───────────────────────────────────
  const uploadAndAppend = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Only image files are supported");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be under 10 MB");
        return;
      }

      setUploading(true);
      try {
        const { url } = await uploadToImageKit(
          file,
          file.name,
          folder,
          "website"
        );
        // Re-read the latest split (avoids stale closure)
        const latest = splitContent(value);
        onChange(combineContent(latest.text, [...latest.imageUrls, url]));
        toast.success("Image uploaded");
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Image upload failed";
        console.error("[ImageTextarea upload error]", msg);
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
    [value, onChange, folder]
  );

  // ─── Remove an image by URL ────────────────────────────────────────
  const removeImage = useCallback(
    (urlToRemove: string) => {
      const latest = splitContent(value);
      const next = latest.imageUrls.filter((u) => u !== urlToRemove);
      onChange(combineContent(latest.text, next));
    },
    [value, onChange]
  );

  // ─── Drag-and-drop handlers ───────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (imageFile) {
        await uploadAndAppend(imageFile);
      }
    },
    [uploadAndAppend]
  );

  // ─── Paste handler ────────────────────────────────────────────────
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return; // allow normal text paste

      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        await uploadAndAppend(file);
      }
    },
    [uploadAndAppend]
  );

  // ─── File picker ──────────────────────────────────────────────────
  const handlePickFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) uploadAndAppend(f);
    };
    input.click();
  }, [uploadAndAppend]);

  const busy = uploading || disabled;

  return (
    <div className="space-y-2">
      {/* Textarea with drag-and-drop overlay */}
      <div
        className={cn(
          "relative rounded-xl transition-all duration-200",
          isDragging &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.005]"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 backdrop-blur-[2px] border-2 border-dashed border-primary pointer-events-none">
            <div className="flex flex-col items-center gap-1.5 text-primary">
              <Upload className="h-7 w-7 animate-bounce" />
              <p className="text-sm font-semibold">Drop image here</p>
            </div>
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm font-medium">Uploading image…</p>
            </div>
          </div>
        )}

        {/* The textarea shows ONLY the text portion — no HTML img tags */}
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onPaste={handlePaste}
          className={cn("rounded-xl", className)}
          style={{ minHeight }}
          placeholder={
            placeholder ||
            "Type your text here. You can drag & drop or paste images too."
          }
          disabled={busy}
        />
      </div>

      {/* ─── Image previews ─────────────────────────────────────────── */}
      {imageUrls.length > 0 && (
        <div className="flex flex-wrap gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/60">
          <p className="w-full text-[11px] text-muted-foreground font-medium mb-0.5">
            Attached images ({imageUrls.length})
          </p>
          {imageUrls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative group rounded-lg overflow-hidden shadow-sm border border-border/50 bg-background"
            >
              <img
                src={url}
                alt={`Preview ${i + 1}`}
                className="h-[72px] w-[72px] object-cover transition-transform group-hover:scale-105"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                }}
              />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className={cn(
                  "absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full",
                  "bg-destructive text-white flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity shadow-md",
                  "hover:bg-destructive/90 focus:opacity-100 focus:outline-none"
                )}
                title="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Bottom controls ────────────────────────────────────────── */}
      {!hideControls && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs gap-1.5"
            disabled={busy}
            onClick={handlePickFile}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            Add Image
          </Button>
          <span className="text-[11px] text-muted-foreground">
            or drag &amp; drop · paste from clipboard
          </span>
        </div>
      )}
    </div>
  );
}

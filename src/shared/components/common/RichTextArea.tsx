import React, { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { uploadToImageKit } from "@shared/lib/imagekitUpload";
import { Button } from "@shared/ui/button";
import { Textarea } from "@shared/ui/textarea";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  folder?: string;
  disabled?: boolean;
};

function insertAtCursor(el: HTMLTextAreaElement, text: string, current: string) {
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + text + current.slice(end);
  const nextPos = start + text.length;

  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(nextPos, nextPos);
  });

  return next;
}

export function RichTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
  folder = "question_bank",
  disabled,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadAndInsert = async (blob: Blob, fileName?: string) => {
    if (!ref.current) return;
    setUploading(true);
    try {
        const res = await uploadToImageKit(blob, fileName, `/${folder}`);

      const tag = `\n<img src="${res.url}" alt="" />\n`;
      const next = insertAtCursor(ref.current, tag, value);
      onChange(next);
      toast.success("Image inserted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = async (e) => {
    if (disabled) return;

    const items = e.clipboardData?.items;
    if (!items?.length) return;

    const imgItem = Array.from(items).find((it) => it.type?.startsWith("image/"));
    if (!imgItem) return;

    e.preventDefault();

    const file = imgItem.getAsFile();
    if (!file) return;

    await uploadAndInsert(file, `paste_${Date.now()}.png`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Tip: Ctrl+V to paste image
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => uploadAndInsert(e.target.files?.[0]!, e.target.files?.[0]?.name)}
        />

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="ml-2">Attach image</span>
        </Button>
      </div>

      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
        onPaste={onPaste}
        disabled={disabled}
      />
    </div>
  );
}


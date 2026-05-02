import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLBAR_ITEMS = [
  "heading",
  "|",
  "bold",
  "italic",
  "|",
  "MathType",
  "ChemType",
  "|",
  "uploadImage",
  "bulletedList",
  "numberedList",
] as const;

interface CkEditorLike {
  getData: () => string;
}

interface CkEditorUiLike {
  ui?: {
    view?: {
      editable?: {
        element?: HTMLElement | null;
      };
    };
  };
}

type CkEditorChangeEvent = unknown;
type CkEditorReadyEvent = unknown;

interface CkEditorComponentProps {
  editor: unknown;
  data: string;
  config: Record<string, unknown>;
  onChange: (event: CkEditorChangeEvent, editor: CkEditorLike) => void;
  onReady?: (editor: CkEditorUiLike) => void;
}

type CkEditorComponent = (props: CkEditorComponentProps) => JSX.Element;

type CkEditorPlugin = unknown;

type CkEditorDeps = {
  CKEditor: CkEditorComponent;
  BalloonEditor: unknown;
  Essentials: CkEditorPlugin;
  Paragraph: CkEditorPlugin;
  Heading: CkEditorPlugin;
  Bold: CkEditorPlugin;
  Italic: CkEditorPlugin;
  List: CkEditorPlugin;
  Link: CkEditorPlugin;
  Image: CkEditorPlugin;
  ImageToolbar: CkEditorPlugin;
  ImageUpload: CkEditorPlugin;
  Base64UploadAdapter: CkEditorPlugin;
  MathTypePlugin: unknown;
};

export interface MathRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  disabled?: boolean;
}

export default function MathRichTextEditor({
  value,
  onChange,
  placeholder = "Click to start typing...",
  minHeight = 100,
  className,
  disabled = false,
}: MathRichTextEditorProps) {
  const [deps, setDeps] = useState<CkEditorDeps | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadEditorDeps() {
      const [{ CKEditor }, ckeditor5Module, wirisModule] = await Promise.all([
        import("@ckeditor/ckeditor5-react"),
        import("ckeditor5/src/index.js"),
        import("@wiris/mathtype-ckeditor5"),
      ]);

      if (!mounted) return;

      const ckeditor5 = ckeditor5Module as Record<string, unknown>;
      const BalloonEditor = ckeditor5.BalloonEditor;
      const MathTypePlugin = (wirisModule as { default?: unknown }).default ?? wirisModule;

      if (!BalloonEditor) {
        throw new Error("BalloonEditor export not found from ckeditor5 package");
      }

      setDeps({
        CKEditor: CKEditor as unknown as CkEditorComponent,
        BalloonEditor,
        Essentials: ckeditor5.Essentials,
        Paragraph: ckeditor5.Paragraph,
        Heading: ckeditor5.Heading,
        Bold: ckeditor5.Bold,
        Italic: ckeditor5.Italic,
        List: ckeditor5.List,
        Link: ckeditor5.Link,
        Image: ckeditor5.Image,
        ImageToolbar: ckeditor5.ImageToolbar,
        ImageUpload: ckeditor5.ImageUpload,
        Base64UploadAdapter: ckeditor5.Base64UploadAdapter,
        MathTypePlugin,
      });
    }

    loadEditorDeps().catch((error: unknown) => {
      console.error("Failed to load CKEditor dependencies", error);
      setDeps(null);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const config = useMemo<Record<string, unknown>>(() => {
    if (!deps) {
      return {
        placeholder,
      };
    }

    return {
      licenseKey: "GPL",
      plugins: [
        deps.Essentials,
        deps.Paragraph,
        deps.Heading,
        deps.Bold,
        deps.Italic,
        deps.List,
        deps.Link,
        deps.Image,
        deps.ImageToolbar,
        deps.ImageUpload,
        deps.Base64UploadAdapter,
        deps.MathTypePlugin,
      ],
      toolbar: {
        items: [...TOOLBAR_ITEMS],
        shouldNotGroupWhenFull: true,
      },
      placeholder,
      image: {
        toolbar: ["imageTextAlternative", "imageStyle:inline", "imageStyle:block", "imageStyle:side"],
      },
    };
  }, [deps, placeholder]);

  if (!deps) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-muted/20 px-3 py-6", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading editor...
        </div>
      </div>
    );
  }

  const { CKEditor, BalloonEditor } = deps;

  return (
    <div
      className={cn(
        "rounded-xl border border-transparent bg-background/60 transition-colors focus-within:border-border focus-within:bg-background",
        disabled && "pointer-events-none opacity-70",
        className
      )}
    >
      <CKEditor
        editor={BalloonEditor}
        data={value}
        config={config}
        onChange={(_event: CkEditorChangeEvent, editor: CkEditorLike) => {
          onChange(editor.getData());
        }}
        onReady={(_eventEditor: CkEditorUiLike) => {
          const editable = _eventEditor.ui?.view?.editable?.element;
          if (!editable) return;

          editable.style.minHeight = `${minHeight}px`;
          editable.style.padding = "0.75rem";
          editable.style.border = "0";
          editable.style.outline = "0";
          editable.style.background = "transparent";
        }}
      />
    </div>
  );
}

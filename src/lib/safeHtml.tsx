import React from "react";
import { cn } from "@/lib/utils";
import katex from "katex";
import "katex/dist/katex.min.css";

// Basic, dependency-free sanitization.
// Admin content is trusted, but this blocks obvious script injection.
export function sanitizeHtmlBasic(html: string) {
  if (!html) return "";
  return String(html)
    // strip script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // strip inline handlers (onclick=...)
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // strip javascript: urls
    .replace(/javascript:/gi, "");
}

export function stripHtml(html: string) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractImgUrls(html: string) {
  const out: string[] = [];
  const s = String(html || "");
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) out.push(m[1]);
  }
  return Array.from(new Set(out));
}

export function extractImgUrlsFromParts(parts: string[]) {
  const urls = parts.flatMap((p) => extractImgUrls(p));
  return Array.from(new Set(urls));
}

export function HtmlView({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const rendered = React.useMemo(() => {
    const safe = sanitizeHtmlBasic(html);
    if (!safe) return "";

    const normalized = safe
      .replace(/\\{2,}\(/g, "\\(")
      .replace(/\\{2,}\)/g, "\\)")
      .replace(/\\{2,}\[/g, "\\[")
      .replace(/\\{2,}\]/g, "\\]")
      // Collapse over-escaped LaTeX commands that often come from JSON/PDF extraction.
      .replace(
        /\\{2,}(?=(?:begin|end|frac|dfrac|tfrac|sqrt|sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|omega|xi|psi|zeta|eta|kappa|upsilon|varsigma|Delta|Omega|times|cdot|div|pm|leq|geq|neq|approx|to|infty|partial|left|right)\b)/g,
        "\\"
      )
      // Normalize escaped braces in LaTeX fragments, e.g. \frac\{1\}\{2\}.
      .replace(/\\([{}])/g, "$1");

    const renderLatex = (expr: string, displayMode: boolean) => {
      try {
        return katex.renderToString(expr, {
          displayMode,
          throwOnError: false,
          strict: "ignore",
          trust: false,
        });
      } catch {
        return displayMode ? `$$${expr}$$` : `\\(${expr}\\)`;
      }
    };

    const renderBareLatexCommands = (text: string) => {
      const source = String(text || "");
      if (!source.includes("\\")) return source;

      // Render only explicit LaTeX command fragments and keep surrounding prose untouched.
      const bareCommandPattern =
        /\\(?:frac|dfrac|tfrac)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\sqrt\s*(?:\[[^\]]+\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\(?:sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|omega|xi|psi|zeta|eta|kappa|upsilon|varsigma|Delta|Omega|times|cdot|div|pm|leq|geq|neq|approx|to|infty|partial)(?:\s*_[^\s^{}]+|\s*_\{[^}]+\})?(?:\s*\^[^\s_{}]+|\s*\^\{[^}]+\})?/g;

      return source.replace(bareCommandPattern, (expr: string) =>
        renderLatex(String(expr || "").trim(), false)
      );
    };

    let output = normalized;

    // Render block math first, then inline math.
    output = output.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) =>
      renderLatex(String(expr || "").trim(), true)
    );

    output = output.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr: string) =>
      renderLatex(String(expr || "").trim(), true)
    );

    output = output.replace(/\\\(([^]+?)\\\)/g, (_, expr: string) =>
      renderLatex(String(expr || "").trim(), false)
    );

    // Support common LaTeX environments like \begin{align}...\end{align}
    output = output.replace(
      /\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*?)\\end\{\1\}/g,
      (_, _env: string, expr: string) => renderLatex(String(expr || "").trim(), true)
    );

    // Optional: support single-dollar inline math as fallback.
    output = output.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, prefix: string, expr: string) =>
      `${prefix}${renderLatex(String(expr || "").trim(), false)}`
    );

    // Fallback: render bare LaTeX command fragments inside text nodes only.
    // This preserves regular prose around math, e.g. "Find value of \\frac{a}{b}".
    output = output.replace(/(^|>)([^<]+)(?=<|$)/g, (_, before: string, text: string) => {
      return `${before}${renderBareLatexCommands(text)}`;
    });

    return output;
  }, [html]);

  return (
    <div
      className={cn(
        "leading-relaxed",
        "[&>img]:max-w-full [&>img]:h-auto [&_img]:max-w-full [&_img]:h-auto",
        "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2",
        className
      )}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}


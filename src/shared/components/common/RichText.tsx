import React from "react";

type Props = {
  html?: string;
  className?: string;
};

function looksLikeHtml(s: string) {
  return /<\w+[\s\S]*>/i.test(s);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function RichText({ html, className }: Props) {
  const raw = (html ?? "").trim();
  const safe = raw
    ? looksLikeHtml(raw)
      ? raw
      : escapeHtml(raw).replace(/\n/g, "<br />")
    : "";

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}


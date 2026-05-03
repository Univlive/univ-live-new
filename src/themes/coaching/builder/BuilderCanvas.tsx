import React from "react";
import { COMPONENT_REGISTRY, THEME_PRESETS, type ThemeKey, type Section } from "@features/educator/InstituteBuilder";

type BuilderCanvasProps = {
  sections: Section[];
  themeKey?: ThemeKey | string;
};

export default function BuilderCanvas({ sections, themeKey = "indigo" }: BuilderCanvasProps) {
  const safeThemeKey = (themeKey in THEME_PRESETS ? themeKey : "indigo") as ThemeKey;
  const theme = THEME_PRESETS[safeThemeKey];

  return (
    <div style={{ background: theme.bg }}>
      {sections.map((section) => {
        const reg = COMPONENT_REGISTRY[section.type];
        if (!reg) return null;
        const Comp = reg.component;
        return (
          <Comp
            key={section.id}
            data={section.data || {}}
            theme={theme}
            selected={false}
            onClick={() => {}}
            previewMode
          />
        );
      })}
    </div>
  );
}

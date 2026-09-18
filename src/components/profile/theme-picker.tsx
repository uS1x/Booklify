"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { Segmented } from "@/components/ui/segmented";
import { useTheme } from "@/components/theme-provider";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <Segmented
        id="theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: "Hell", icon: <Sun size={14} /> },
          { value: "dark", label: "Dunkel", icon: <Moon size={14} /> },
          { value: "system", label: "System", icon: <Monitor size={14} /> },
        ]}
      />
      <p className="mt-2 text-xs text-ink-faint">
        „System“ folgt der Einstellung deines Geräts – abends also automatisch dunkel.
      </p>
    </div>
  );
}

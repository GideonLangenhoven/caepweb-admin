"use client";
import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "../lib/supabase";

type ThemeData = {
  color_main: string | null;
  color_secondary: string | null;
  color_cta: string | null;
  chatbot_avatar: string | null;
};

var ThemeCtx = createContext<ThemeData>({ color_main: null, color_secondary: null, color_cta: null, chatbot_avatar: null });

export function useTheme() { return useContext(ThemeCtx); }

function hexToRgb(hex: string) {
  var h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function darken(hex: string, pct: number) {
  var { r, g, b } = hexToRgb(hex);
  var f = 1 - pct / 100;
  return "#" + [Math.round(r * f), Math.round(g * f), Math.round(b * f)].map(v => v.toString(16).padStart(2, "0")).join("");
}

function lighten(hex: string, pct: number) {
  var { r, g, b } = hexToRgb(hex);
  var f = pct / 100;
  return "#" + [Math.round(r + (255 - r) * f), Math.round(g + (255 - g) * f), Math.round(b + (255 - b) * f)].map(v => v.toString(16).padStart(2, "0")).join("");
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  var [theme, setTheme] = useState<ThemeData>({ color_main: null, color_secondary: null, color_cta: null, chatbot_avatar: null });

  useEffect(() => {
    (async () => {
      var { data } = await supabase.from("businesses").select("color_main, color_secondary, color_cta, chatbot_avatar").limit(1).single();
      if (data) setTheme(data);
    })();
    // Load dotlottie script for animated avatars
    if (!document.getElementById("dotlottie-script")) {
      var script = document.createElement("script");
      script.id = "dotlottie-script";
      script.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js";
      script.type = "module";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    var root = document.documentElement;
    if (theme.color_main) {
      root.style.setProperty("--accent", theme.color_main);
      root.style.setProperty("--accentHover", darken(theme.color_main, 15));
      root.style.setProperty("--accentSoft", lighten(theme.color_main, 85));
      root.style.setProperty("--focusRing", theme.color_main);
    }
    if (theme.color_secondary) {
      root.style.setProperty("--text", theme.color_secondary);
      root.style.setProperty("--textMuted", lighten(theme.color_secondary, 35));
    }
    if (theme.color_cta) {
      root.style.setProperty("--cta", theme.color_cta);
      root.style.setProperty("--ctaHover", darken(theme.color_cta, 15));
    }
  }, [theme]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

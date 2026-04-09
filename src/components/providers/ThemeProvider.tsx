"use client";

import {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// HTML 요소에 클래스 적용
function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("sc-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // 마운트 시: localStorage 우선 → Supabase에서 계정 설정 로드
  useEffect(() => {
    const local = localStorage.getItem("sc-theme") as Theme | null;
    if (local) {
      setTheme(local);
      applyTheme(local);
    }

    // Supabase 계정 설정 로드 (비동기, 백그라운드)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.theme && data.theme !== local) {
            const t = data.theme as Theme;
            setTheme(t);
            applyTheme(t);
          }
        });
    });
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);

      // Supabase에 비동기 저장
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase
          .from("profiles")
          .update({ theme: next })
          .eq("id", user.id);
      });

      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

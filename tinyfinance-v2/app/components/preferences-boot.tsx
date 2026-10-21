"use client";
import { useEffect } from "react";
export default function PreferencesBoot() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("tf-theme");
      const size = localStorage.getItem("tf-size");
      document.documentElement.dataset.theme = [
        "light",
        "dark",
        "system",
      ].includes(theme || "")
        ? theme!
        : "system";
      document.documentElement.dataset.size = [
        "small",
        "normal",
        "large",
      ].includes(size || "")
        ? size!
        : "normal";
    } catch {
      document.documentElement.dataset.theme = "system";
    }
  }, []);
  return null;
}

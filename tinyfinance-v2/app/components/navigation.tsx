"use client";
import { useState } from "react";
export default function Navigation({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"navigation " + (open ? "is-open" : "")}>
      <button
        className="mobile-toggle secondary"
        type="button"
        aria-expanded={open}
        aria-controls="finance-navigation"
        onClick={() => setOpen(!open)}
      >
        ☰ Navigation
      </button>
      <div id="finance-navigation">{children}</div>
    </div>
  );
}

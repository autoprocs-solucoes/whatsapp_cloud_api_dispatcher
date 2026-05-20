"use client";

import { useEffect } from "react";

export function RecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/reset-password") return;
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    if (params.get("type") === "recovery") {
      window.location.replace(`/reset-password${hash}`);
    }
  }, []);

  return null;
}

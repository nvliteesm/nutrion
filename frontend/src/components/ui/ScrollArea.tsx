"use client";

import type { CSSProperties } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { cn } from "@/lib/cn";

/**
 * Themed overlay scrollbar for compact scroll regions (e.g. entry lists).
 */
export function ScrollArea({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <OverlayScrollbarsComponent
      className={cn("nutrion-scroll", className)}
      style={style}
      options={{
        scrollbars: {
          theme: "os-theme-nutrion",
          autoHide: "leave",
          autoHideDelay: 600,
          clickScroll: true,
        },
        overflow: {
          x: "hidden",
        },
      }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}

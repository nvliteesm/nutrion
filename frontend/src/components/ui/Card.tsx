"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";

type CardProps = HTMLMotionProps<"div"> & {
  /** Entrance animation delay in seconds. */
  delay?: number;
  /** Skip hover lift (useful for nested / dense layouts). */
  quiet?: boolean;
};

export function Card({
  className,
  delay = 0,
  quiet = false,
  ...props
}: CardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn("bg-card rounded-card-lg shadow-card", className)}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={
        reduce || quiet
          ? undefined
          : {
              y: -3,
              transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
            }
      }
      {...props}
    />
  );
}

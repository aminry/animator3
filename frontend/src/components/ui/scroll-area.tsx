import type { HTMLAttributes } from "react";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {}

export function ScrollArea({ className = "", ...props }: ScrollAreaProps) {
  const base = "relative overflow-y-auto";
  const mergedClassName = className ? base + " " + className : base;
  return <div {...props} className={mergedClassName} />;
}

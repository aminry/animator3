import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", ...props }: CardProps) {
  const base = "rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-sm";
  const mergedClassName = className ? base + " " + className : base;
  return <div {...props} className={mergedClassName} />;
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className = "", ...props }: CardHeaderProps) {
  const base = "mb-3 flex flex-col space-y-1.5";
  const mergedClassName = className ? base + " " + className : base;
  return <div {...props} className={mergedClassName} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className = "", ...props }: CardTitleProps) {
  const base = "text-sm font-semibold leading-none tracking-tight";
  const mergedClassName = className ? base + " " + className : base;
  return <h3 {...props} className={mergedClassName} />;
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className = "", ...props }: CardDescriptionProps) {
  const base = "text-sm text-zinc-400";
  const mergedClassName = className ? base + " " + className : base;
  return <p {...props} className={mergedClassName} />;
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className = "", ...props }: CardContentProps) {
  const base = "text-sm";
  const mergedClassName = className ? base + " " + className : base;
  return <div {...props} className={mergedClassName} />;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className = "", ...props }: CardFooterProps) {
  const base = "mt-4 flex items-center justify-end gap-2";
  const mergedClassName = className ? base + " " + className : base;
  return <div {...props} className={mergedClassName} />;
}

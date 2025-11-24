import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

type NativeButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

export interface ButtonProps extends NativeButtonProps {}

export function Button(props: ButtonProps) {
  const { className = "", ...rest } = props;
  const base =
    "inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 shadow-sm transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
  const mergedClassName = className ? base + " " + className : base;
  return <button {...rest} className={mergedClassName} />;
}

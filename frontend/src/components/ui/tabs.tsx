import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { createContext, useContext, useState } from "react";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs root component");
  }
  return context;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
}

export function Tabs({ defaultValue, className = "", children, ...props }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  const contextValue: TabsContextValue = { value, setValue };
  const base = "flex flex-col gap-2";
  const mergedClassName = className ? base + " " + className : base;
  return (
    <TabsContext.Provider value={contextValue}>
      <div {...props} className={mergedClassName}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}

export function TabsList({ className = "", ...props }: TabsListProps) {
  const base = "inline-flex items-center rounded-md bg-zinc-900/80 p-1 text-xs";
  const mergedClassName = className ? base + " " + className : base;
  return <div {...props} className={mergedClassName} />;
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ value, className = "", children, onClick, ...props }: TabsTriggerProps) {
  const { value: activeValue, setValue } = useTabsContext();
  const isActive = activeValue === value;
  const base =
    "inline-flex min-w-[72px] items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors";
  const activeClass = "bg-zinc-800 text-zinc-50";
  const inactiveClass = "text-zinc-400 hover:text-zinc-100";
  const mergedClassName =
    (className ? base + " " + className : base) + " " + (isActive ? activeClass : inactiveClass);
  return (
    <button
      type="button"
      {...props}
      className={mergedClassName}
      onClick={(event) => {
        setValue(value);
        if (onClick) {
          onClick(event);
        }
      }}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value, className = "", children, ...props }: TabsContentProps) {
  const { value: activeValue } = useTabsContext();
  const isActive = activeValue === value;
  const base = "mt-2";
  const hiddenClass = isActive ? "" : " hidden";
  const mergedClassName = className ? base + " " + className + hiddenClass : base + hiddenClass;
  return (
    <div {...props} className={mergedClassName}>
      {children}
    </div>
  );
}

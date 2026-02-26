import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`glass rounded-md hover:bg-glass-hover transition-all duration-200 overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

import { type ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary:
    "bg-primary/80 hover:bg-primary text-white glow-primary hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]",
  accent:
    "bg-accent/80 hover:bg-accent text-white glow-accent hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]",
  secondary:
    "glass hover:bg-glass-hover text-text-secondary hover:text-white",
  ghost:
    "bg-transparent hover:bg-white/5 text-text-muted hover:text-white",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-sm",
  md: "px-6 py-2.5 text-sm rounded-md",
  lg: "px-8 py-3 text-base rounded-md",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", fullWidth, className = "", ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={[
        variants[variant],
        sizes[size],
        "font-medium transition-all duration-200 inline-flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        fullWidth && "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  ),
);
Button.displayName = "Button";

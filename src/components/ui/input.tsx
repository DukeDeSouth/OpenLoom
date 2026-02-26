import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, className = "", ...props }, ref) => (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-secondary mb-1"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={[
          "w-full rounded-sm bg-white/5 border border-glass-border",
          "px-4 py-2.5 text-text-primary placeholder-text-faint",
          "backdrop-blur-sm transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 focus:bg-white/8",
          className,
        ].join(" ")}
        {...props}
      />
    </div>
  ),
);
Input.displayName = "Input";

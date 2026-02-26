const styles = {
  error:
    "bg-red-500/10 border-red-500/20 text-error backdrop-blur-sm",
  warning:
    "bg-yellow-500/10 border-yellow-500/20 text-warning backdrop-blur-sm",
  success:
    "bg-green-500/10 border-green-500/20 text-success backdrop-blur-sm",
} as const;

export function Alert({
  variant = "error",
  children,
  className = "",
}: {
  variant?: keyof typeof styles;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${styles[variant]} border rounded-md px-4 py-3 text-sm ${className}`}
    >
      {children}
    </div>
  );
}

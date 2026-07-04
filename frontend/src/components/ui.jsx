export function cn(...tokens) {
  return tokens.filter(Boolean).join(" ");
}

export function Button({
  variant = "default",
  size = "md",
  type = "button",
  className,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn("ui-btn", `ui-btn-${variant}`, `ui-btn-${size}`, className)}
      {...props}
    />
  );
}

export function Card({ className, as = "section", children }) {
  const Component = as;
  return <Component className={cn("ui-card", className)}>{children}</Component>;
}

export function Badge({ tone = "slate", className, children }) {
  return (
    <span className={cn("ui-badge", `ui-badge-${tone}`, className)}>
      {children}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

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

export function Masthead() {
  return (
    <div className="masthead" role="banner">
      <div className="masthead-inner">
        <div className="masthead-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>Awaaz Civic Response System</span>
        </div>
        <span className="masthead-tag">Prototype build &middot; Jaipur constituency wards</span>
      </div>
    </div>
  );
}

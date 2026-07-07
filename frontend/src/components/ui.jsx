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

/**
 * The Awaaz seal: rising signal bars (voice → signal → action) on a
 * stamped double ring. Deliberately drawn as solid shapes, not a
 * feather-style stroke icon, so it reads as a mark rather than UI chrome.
 */
export function Seal({ size = 24, className, ringed = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {ringed && (
        <circle
          cx="50"
          cy="50"
          r="37"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="1 5.2"
        />
      )}
      <line x1="27" y1="73" x2="73" y2="73" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="32" y="54" width="8" height="19" rx="1.5" fill="currentColor" />
      <rect x="46" y="41" width="8" height="32" rx="1.5" fill="currentColor" />
      <rect x="60" y="28" width="8" height="45" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function Masthead() {
  return (
    <div className="masthead" role="banner">
      <div className="masthead-inner">
        <div className="masthead-mark">
          <Seal size={18} />
          <span>Awaaz Civic Response System</span>
        </div>
        <span className="masthead-tag">Prototype build &middot; Jaipur constituency wards</span>
      </div>
    </div>
  );
}

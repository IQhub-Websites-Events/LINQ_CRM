import { useState } from "react";

const inputStyle = {
  width: "100%", backgroundColor: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 7, padding: "7px 10px", fontSize: 12.5,
  color: "var(--text)", fontFamily: "inherit", outline: "none",
  transition: "border-color .15s",
};

export function Input({ value, onChange, onKeyDown, placeholder, type = "text",
  readOnly, autoFocus, className, style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value ?? ""} readOnly={readOnly} autoFocus={autoFocus}
      placeholder={placeholder} onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? "var(--accent)" : "var(--border)",
        boxShadow: focused ? "0 0 0 3px var(--accent-soft, rgba(99,102,241,.12))" : "none",
        backgroundColor: readOnly ? "var(--surface-alt)" : "var(--surface)",
        color: readOnly ? "var(--text-faint)" : "var(--text)",
        cursor: readOnly ? "not-allowed" : "text",
        ...style,
      }}
    />
  );
}

export function Select({ value, onChange, options, placeholder, style = {} }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputStyle,
          appearance: "none",
          cursor: "pointer",
          paddingRight: 30,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          backgroundSize: "10px 6px",
          ...style,
        }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FieldLabel({ children, required }) {
  return (
    <label style={{ display: "block", fontSize: 10, fontWeight: 600,
      color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>
      {children}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
    </label>
  );
}

export function FormField({ label, required, children }) {
  return (
    <div>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      {children}
    </div>
  );
}

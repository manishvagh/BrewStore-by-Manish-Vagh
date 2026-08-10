import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "../theme";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

interface ThemeToggleProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" role="group" aria-label="Appearance">
      <div className="theme-toggle-label">Appearance</div>
      <div className="theme-segment">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`theme-option ${value === id ? "active" : ""}`}
            aria-pressed={value === id}
            title={label}
            onClick={() => onChange(id)}
          >
            <Icon size={14} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

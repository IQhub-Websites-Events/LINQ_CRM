import { useTheme } from "../../contexts/ThemeContext";
import { fmt } from "../../utils/helpers";

const PALETTES = {
  light: ["#0d7a4f", "#a3650a", "#6b21a8", "#1e40af", "#a82a2a", "#0c4a6e", "#7c2d12"],
  dark:  ["#34d399", "#fbbf24", "#c084fc", "#60a5fa", "#f87171", "#22d3ee", "#fb923c"],
};

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h;
}

export function Avatar({ name = "", size = 28 }) {
  const { mode } = useTheme();
  const palette = PALETTES[mode] || PALETTES.light;
  const bg = palette[hashName(name) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.floor(size * 0.37), fontWeight: 600, flexShrink: 0,
      fontFamily: "var(--font-sans)",
    }}>
      {fmt.initials(name)}
    </div>
  );
}

export type UserId = "renter" | "batcher_a" | "batcher_b" | "solo";

const USERS: { id: UserId; label: string; colour: string }[] = [
  { id: "renter", label: "🏠 Renter", colour: "#8b5cf6" },
  { id: "batcher_a", label: "⚡ Batcher A", colour: "#3b82f6" },
  { id: "batcher_b", label: "⚡ Batcher B", colour: "#06b6d4" },
  { id: "solo", label: "🚀 Solo", colour: "#f59e0b" },
];

interface Props {
  current: UserId;
  onChange: (id: UserId) => void;
}

export function UserSwitcher({ current, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {USERS.map((u) => (
        <button
          key={u.id}
          onClick={() => onChange(u.id)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: current === u.id ? `2px solid ${u.colour}` : "2px solid #374151",
            background: current === u.id ? u.colour + "22" : "transparent",
            color: current === u.id ? u.colour : "#9ca3af",
            cursor: "pointer",
            fontWeight: current === u.id ? 700 : 400,
            fontSize: "13px",
          }}
        >
          {u.label}
        </button>
      ))}
    </div>
  );
}

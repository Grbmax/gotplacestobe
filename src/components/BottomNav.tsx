"use client";

export type AppTab = "map" | "post" | "active" | "you";

type Props = {
  tab: AppTab;
  hasActive: boolean;
  remainingLabel?: string;
  onChange: (tab: AppTab) => void;
};

export function BottomNav({ tab, hasActive, remainingLabel, onChange }: Props) {
  return (
    <nav className="grid grid-cols-4 border-t border-paper/10 bg-ink/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
      <NavBtn active={tab === "map"} onClick={() => onChange("map")} label="Map" icon="◎" />
      <NavBtn active={tab === "post"} onClick={() => onChange("post")} label="Post" icon="＋" />
      <NavBtn
        active={tab === "active"}
        onClick={() => onChange("active")}
        label={hasActive && remainingLabel ? remainingLabel : "Active"}
        icon="◷"
        badge={hasActive}
      />
      <NavBtn active={tab === "you"} onClick={() => onChange("you")} label="You" icon="●" />
    </nav>
  );
}

function NavBtn({
  active,
  onClick,
  label,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] uppercase tracking-[0.14em] ${
        active ? "text-leaf" : "text-paper/45"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
      {badge && <span className="absolute right-5 top-1 h-1.5 w-1.5 rounded-full bg-gold" />}
    </button>
  );
}

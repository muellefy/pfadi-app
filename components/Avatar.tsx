const PALETTE = ["#2f5d3a", "#b8913f", "#b4482a", "#3f6f8f", "#7a4f8c", "#4f7d6b", "#a3632c", "#5b6b2f"];

/** Coloured circle with someone's initials; the colour is stable per name. */
export function Avatar({ name }: { name: string }) {
  const sum = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const initials = name.split(/[\s,/]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <span className="avatar" style={{ background: PALETTE[sum % PALETTE.length] }}>{initials}</span>;
}

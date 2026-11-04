import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 18, ...p }: P) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const Tent = (p: P) => (<svg {...base(p)}><path d="M3 20 12 4l9 16" /><path d="M12 4v16M8.5 20 12 13l3.5 7" /><path d="M2 20h20" /></svg>);
export const Home = (p: P) => (<svg {...base(p)}><path d="M4 11 12 4l8 7v9H4z" /><path d="M10 20v-5h4v5" /></svg>);
export const Calendar = (p: P) => (<svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>);
export const Users = (p: P) => (<svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" /></svg>);
export const Grid = (p: P) => (<svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>);
export const Folder = (p: P) => (<svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>);
export const FileIcon = (p: P) => (<svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>);
export const Sheet = (p: P) => (<svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 9v12" /></svg>);
export const Check = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const External = (p: P) => (<svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const Download = (p: P) => (<svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M4 20h16" /></svg>);
export const Alert = (p: P) => (<svg {...base(p)}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></svg>);

/** Ridge line used as quiet decoration in the hero */
export const Ridge = () => (
  <svg className="ridge" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden>
    <path d="M0 160 L80 70 L130 110 L210 30 L290 120 L350 80 L420 140 L500 50 L600 130 L600 160 Z" fill="currentColor" />
  </svg>
);

const PALETTE = ["#2f5d3a", "#b8913f", "#b4482a", "#3f6f8f", "#7a4f8c", "#4f7d6b", "#a3632c", "#5b6b2f"];
export function Avatar({ name }: { name: string }) {
  const sum = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const initials = name.split(/[\s,/]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <span className="avatar" style={{ background: PALETTE[sum % PALETTE.length] }}>{initials}</span>;
}

import type { Hal } from "./data/ecamp";
import { htmlToText, type BlockContent } from "./coach.ts";

/** eCamp text content types → the BlockContent field they fill */
const TEXT: Record<string, "goals" | "safety" | "story" | "notes" | "topics"> = {
  LearningObjectives: "goals",
  SafetyConsiderations: "safety",
  Storycontext: "story",
  Notes: "notes",
  LearningTopics: "topics",
};

const empty = (): BlockContent => ({ goals: "", safety: "", story: "", notes: "", topics: "", storyboard: [], material: [], characteristics: [] });
const link = (h: Hal, rel: string): string | undefined => h._links?.[rel]?.href;

/**
 * Turns all content nodes and material items of a camp into one BlockContent per
 * activity, keyed by the activity's root content node.
 */
export function toBlockContent(nodes: Hal[], materials: Hal[]): Record<string, BlockContent> {
  const out: Record<string, BlockContent> = {};
  const rootOf = new Map<string, string>();
  for (const n of nodes) {
    const root = link(n, "root");
    if (!root) continue;
    const self = link(n, "self");
    if (self) rootOf.set(self, root);
    const block = (out[root] ??= empty());
    const field = TEXT[n.contentTypeName];
    if (field) {
      const text = htmlToText(n.data?.html ?? "");
      if (text) block[field] = block[field] ? `${block[field]}\n${text}` : text;
    } else if (n.contentTypeName === "Storyboard") {
      const sections = Object.values<Hal>(n.data?.sections ?? {}).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const s of sections) {
        const line = [htmlToText(s.column1 ?? ""), htmlToText(s.column2Html ?? ""), htmlToText(s.column3 ?? "")].filter(Boolean).join(" · ");
        if (line) block.storyboard.push(line);
      }
    } else if (n.contentTypeName === "YSActivityCharacteristics") {
      block.characteristics.push(...Object.entries<Hal>(n.data?.options ?? {}).filter(([, o]) => o?.checked).map(([k]) => k));
    }
  }
  for (const m of materials) {
    const root = rootOf.get(link(m, "materialNode") ?? "");
    if (!root) continue;
    const text = [m.quantity, m.unit, m.article].filter((x) => x != null && x !== "").join(" ");
    if (text) out[root].material.push(text);
  }
  return out;
}

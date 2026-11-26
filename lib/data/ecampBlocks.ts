import "server-only";
import { cached } from "../cache";
import type { BlockContent } from "../coach";
import { toBlockContent } from "../ecampContent";
import { get, items } from "./ecamp";

/**
 * The content of every block of a camp (goals, safety notes, storyboard, material …),
 * keyed by the activity's root content node. Two requests for the whole camp, cached
 * like the program: fresh for 2 minutes, then served stale while it reloads.
 */
export const getBlockContent = (campId: string): Promise<Record<string, BlockContent>> =>
  cached(`ecamp-content:${campId}`, 120_000, async () => {
    const camp = encodeURIComponent(`/api/camps/${campId}`);
    const [nodes, materials] = await Promise.all([
      get(`/api/content_nodes?camp=${camp}`),
      get(`/api/material_items?camp=${camp}`).catch(() => ({})),
    ]);
    return toBlockContent(items(nodes), items(materials));
  }, 12 * 3_600_000);

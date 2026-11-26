/**
 * J+S minimums for Lagersport/Trekking camps, as read from the J+S guidelines for 2027
 * (via jubla.netz, 11/2026). Change them here when J+S changes them; confirm with your Coach.
 */
export const JS_RULES = {
  minHoursPerDay: 4,
  minMovementMinPerDay: 120,
  minBlockMin: 30,
  minPartsOfDay: 2,
  /** eCamp category short names that are not a J+S activity */
  nonJsCategories: ["LP"],
  /** hour at which the afternoon and the evening start */
  parts: { afternoonFrom: 12, eveningFrom: 18 },
} as const;

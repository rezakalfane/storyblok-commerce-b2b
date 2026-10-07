/** Edit tags added to entries in preview (`entry.$.<field>` spreads `data-cslp` attributes onto elements). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tags = Record<string, any>;
export type Tagged = { $?: Tags };

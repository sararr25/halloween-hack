// Case numbers along the chain (owner, 2026-10-05). E.V. is always case 0415. Whoever opens
// the site without a link is case 0418; at the end their next session is scheduled as their
// case + 1 and the case they pass on is their case + 2, which becomes the friend's own case.
// So the chain reads 0418 → 0420 → 0422… The registry works out a player's place in it from
// who invited whom (app/api/operators/route.ts).

export const EV_CASE = 415;
export const FIRST_CASE = 418;

/** "0418" */
export const caseId = (n: number) => String(n).padStart(4, "0");

/** The session scheduled for tomorrow. */
export const tomorrowCase = (n: number) => n + 1;

/** The case handed to whoever opens this player's link. */
export const passOnCase = (n: number) => n + 2;

/** The case passed on by an inviter who is `depth` links below the first player. */
export const passedCase = (depth: number) => passOnCase(FIRST_CASE + 2 * depth);

// The last pop-up: tomorrow's case (the player's case + 1), tomorrow at the minute the player
// came in. Only in the story since round 8: nothing is downloaded.

const DAY = 86_400_000;

export function reminderStart(openedAt: number): number {
  const at = new Date(openedAt + DAY);
  at.setSeconds(0, 0);
  return at.getTime();
}

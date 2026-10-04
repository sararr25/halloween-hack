// The last pop-up (docs/plan-round6.md B6.7): case 0419, tomorrow at the minute the player
// came in. Only in the story since round 8: nothing is downloaded.

const DAY = 86_400_000;

export function reminderStart(openedAt: number): number {
  const at = new Date(openedAt + DAY);
  at.setSeconds(0, 0);
  return at.getTime();
}

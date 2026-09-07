import { comparePoints, instantString } from './primitives';
/** Exact ordering of valid UTC-offset instants; undefined for invalid or unresolvable input. */
export function compareUtcInstants(left: string, right: string): -1 | 0 | 1 | undefined {
  if (!instantString.safeParse(left).success || !instantString.safeParse(right).success) return undefined;
  const result = comparePoints({kind:'instant',value:left,timeScale:'UTC'}, {kind:'instant',value:right,timeScale:'UTC'});
  return result === -1 || result === 0 || result === 1 ? result : undefined;
}

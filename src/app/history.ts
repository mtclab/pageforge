export interface TextEditMarker {
  field: string;
  at: number;
}

/** Only adjacent keystrokes in the same control share one undo snapshot. */
export function shouldCoalesceHistory(
  previous: TextEditMarker | undefined,
  structural: boolean,
  textField: string | undefined,
  now: number,
  atHistoryTip: boolean,
): boolean {
  return !structural && textField !== undefined && previous?.field === textField
    && now - previous.at < 800 && atHistoryTip;
}

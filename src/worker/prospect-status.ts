import {
  ControlPlane,
  PROSPECT_STATUSES,
  type Prospect,
  type ProspectStatus,
} from './db.js';

export const PROSPECT_TRANSITIONS: Readonly<Record<ProspectStatus, readonly ProspectStatus[]>> = {
  loytynyt: ['arvioitu', 'hylatty'],
  arvioitu: ['luonnos', 'hylatty'],
  luonnos: ['yhteydenotto', 'hylatty'],
  yhteydenotto: ['vastasi', 'hylatty'],
  vastasi: ['myyty', 'hylatty'],
  myyty: ['julkaistu'],
  julkaistu: ['yllapidossa'],
  yllapidossa: [],
  hylatty: ['arvioitu'],
};

/** The single validation point for every prospect state change. */
export function validateProspectTransition(
  current: ProspectStatus,
  target: string,
  statusReason?: string,
): { status: ProspectStatus; statusReason?: string } | { error: string } {
  if (!PROSPECT_STATUSES.includes(target as ProspectStatus)) {
    return { error: 'Tuntematon prospektin tila.' };
  }
  const status = target as ProspectStatus;
  if (!PROSPECT_TRANSITIONS[current].includes(status)) {
    return { error: `Siirtymä ${current} → ${status} ei ole sallittu.` };
  }
  const reason = statusReason?.trim();
  if (status === 'hylatty' && !reason) {
    return { error: 'Hylkäyksen syy vaaditaan.' };
  }
  return { status, ...(reason ? { statusReason: reason } : {}) };
}

/** Advance an early pipeline prospect one legal transition at a time. */
export async function advanceProspectToResponded(
  cp: ControlPlane,
  prospect: Prospect,
): Promise<void> {
  const path: ProspectStatus[] = [
    'loytynyt',
    'arvioitu',
    'luonnos',
    'yhteydenotto',
    'vastasi',
  ];
  let index = path.indexOf(prospect.status);
  if (index < 0 || prospect.status === 'vastasi') return;
  let current: ProspectStatus = prospect.status;
  while (index < path.length - 1) {
    const target = path[index + 1]!;
    const validation = validateProspectTransition(current, target);
    if ('error' in validation) return;
    const changed = await cp.updateProspectStatus({
      publicId: prospect.publicId,
      status: validation.status,
      actor: 'system',
    });
    if (!changed) return;
    current = validation.status;
    index += 1;
  }
}

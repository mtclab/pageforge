export type StructureSectionKind =
  | 'about'
  | 'hours'
  | 'services'
  | 'menu'
  | 'gallery'
  | 'location'
  | 'contact';

export type VerticalGroup = 'food' | 'appearance' | 'repair' | 'general';

export interface StructureProfile {
  sections: StructureSectionKind[];
  required: string[];
}

/**
 * Owner-editable structure deck. This data may choose fields and sections only;
 * visual themes, palettes, imagery, and copy tone must never be added here.
 */
export const STRUCTURE_PROFILES: Record<VerticalGroup, StructureProfile> = {
  food: {
    sections: ['about', 'menu', 'hours', 'gallery', 'location', 'contact'],
    required: ['identity.name', 'menu', 'hours'],
  },
  appearance: {
    sections: ['about', 'services', 'hours', 'gallery', 'location', 'contact'],
    required: ['identity.name', 'services', 'contact'],
  },
  repair: {
    sections: ['about', 'services', 'hours', 'location', 'contact'],
    required: ['identity.name', 'services', 'contact'],
  },
  general: {
    sections: ['about', 'services', 'hours', 'gallery', 'location', 'contact'],
    required: ['identity.name'],
  },
};

/** TOL-ish code/label aliases, deliberately used for structure only. */
export const VERTICAL_GROUP_ALIASES: Record<Exclude<VerticalGroup, 'general'>, readonly string[]> = {
  food: ['food', 'grilli', 'ravintola', 'kahvila', 'lounas', 'catering', 'pitopalvelu'],
  appearance: ['appearance', 'hius', 'kauneus', 'parturi', 'kampaamo', 'kosmetologi'],
  repair: ['repair', 'korjaamo', 'huolto', 'autohuolto', 'konehuolto'],
};

function normalizeVertical(value: string): string {
  return value.trim().toLocaleLowerCase('fi');
}

export function verticalGroupFor(code?: string, label?: string): VerticalGroup {
  const values = [code, label].filter((value): value is string => Boolean(value)).map(normalizeVertical);
  for (const [group, aliases] of Object.entries(VERTICAL_GROUP_ALIASES) as [
    Exclude<VerticalGroup, 'general'>,
    readonly string[],
  ][]) {
    if (values.some((value) => aliases.some((alias) => value === alias || value.includes(alias)))) {
      return group;
    }
  }
  return 'general';
}

export function structureProfileFor(code?: string, label?: string): StructureProfile {
  return STRUCTURE_PROFILES[verticalGroupFor(code, label)];
}

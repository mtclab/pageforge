import type { SiteData } from '../engine/types.js';

/**
 * Starters are two things at once: example content that kills the
 * blank-page problem, and page TYPES - the same engine renders a personal
 * page, a link hub, an event page, a business one-pager or a club page,
 * only the content skeleton differs. All text is placeholder the user
 * overwrites.
 */
export interface Starter {
  id: string;
  label: string;
  blurb: string;
  data: SiteData;
}

export const STARTERS: Starter[] = [
  {
    id: 'personal',
    label: 'Personal page',
    blurb: 'You, your links, your things',
    data: {
      version: 1,
      name: 'Anna Virtanen',
      tagline: 'Gardener, baker, occasional poet',
      links: [
        { label: 'Instagram', url: 'https://instagram.com/yourname' },
        { label: 'Email me', url: 'mailto:you@example.com' },
      ],
      sections: [
        {
          kind: 'about',
          text: 'A few sentences about you. What you do, what you care about, where you are.\n\nWrite it like you would say it to a friend.',
        },
        { kind: 'hobbies', items: ['Gardening', 'Baking', 'Winter swimming'] },
        { kind: 'contact', email: 'you@example.com', note: 'Happy to hear from you.' },
      ],
      meta: { themeId: 'linen', paletteId: 'clay', fontId: 'humanist' },
    },
  },
  {
    id: 'links',
    label: 'Link hub',
    blurb: 'One page with all your links',
    data: {
      version: 1,
      name: 'Your Name',
      tagline: 'All my stuff, one place',
      links: [
        { label: 'Instagram', url: 'https://instagram.com/yourname' },
        { label: 'YouTube', url: 'https://youtube.com/@yourname' },
        { label: 'My shop', url: 'https://example.com' },
        { label: 'Email', url: 'mailto:you@example.com' },
      ],
      sections: [],
      meta: { themeId: 'ink', paletteId: 'cobalt', fontId: 'impact' },
    },
  },
  {
    id: 'event',
    label: 'Event page',
    blurb: 'Party, wedding, reunion, meetup',
    data: {
      version: 1,
      name: 'Midsummer Party 2026',
      tagline: 'Saturday 20 June, from 4 pm - at the summer cottage',
      links: [{ label: 'Directions on the map', url: 'https://maps.google.com' }],
      sections: [
        {
          kind: 'about',
          text: 'We are gathering for midsummer again! Food and sauna included, bring swimwear and good mood.\n\nKids and dogs welcome.',
        },
        {
          kind: 'custom',
          title: 'Practical things',
          text: 'When: Saturday 20 June, 16:00 onward\nWhere: Mokkitie 12, Tampere\nBring: swimwear, a towel, something for the grill',
        },
        { kind: 'contact', email: 'host@example.com', note: 'Tell us by 10 June if you are coming.' },
      ],
      footerNote: 'See you there!',
      meta: { themeId: 'meadow', paletteId: 'meadow', fontId: 'rounded' },
    },
  },
  {
    id: 'business',
    label: 'Small business',
    blurb: 'Services, hours, contact',
    data: {
      version: 1,
      name: 'Virtanen Carpentry',
      tagline: 'Custom furniture and renovations in Tampere',
      links: [
        { label: 'Email us', url: 'mailto:info@example.com' },
        { label: 'Instagram', url: 'https://instagram.com/yourbusiness' },
      ],
      sections: [
        {
          kind: 'about',
          text: 'Small carpentry shop with 15 years of experience. Kitchens, wardrobes, stairs and one-off pieces - built to fit your home.',
        },
        {
          kind: 'projects',
          title: 'What we do',
          items: [
            { name: 'Custom kitchens', desc: 'Design, build and install.' },
            { name: 'Built-in wardrobes', desc: 'Made to measure.' },
            { name: 'Renovation carpentry', desc: 'Doors, floors, trim.' },
          ],
        },
        {
          kind: 'custom',
          title: 'Hours and area',
          text: 'Mon-Fri 8-16\nServing Tampere and 50 km around.',
        },
        { kind: 'contact', email: 'info@example.com', note: 'Free quote - tell us about your project.' },
      ],
      meta: { themeId: 'atelier', paletteId: 'navy', fontId: 'grotesk' },
    },
  },
  {
    id: 'club',
    label: 'Club or group',
    blurb: 'Hobby club, team, association',
    data: {
      version: 1,
      name: 'Tampere Disc Golf Club',
      tagline: 'Weekly rounds, all levels welcome',
      links: [
        { label: 'Our group chat', url: 'https://example.com/chat' },
        { label: 'Email', url: 'mailto:club@example.com' },
      ],
      sections: [
        {
          kind: 'about',
          text: 'We play every week, year round. Beginners get a friendly intro round and loaner discs.',
        },
        {
          kind: 'custom',
          title: 'When we meet',
          text: 'Wednesdays 18:00 - Kauppi course\nSundays 11:00 - Hervanta course',
        },
        { kind: 'contact', email: 'club@example.com', note: 'Just show up, or message us first if you are unsure.' },
      ],
      meta: { themeId: 'slate', paletteId: 'sage', fontId: 'system' },
    },
  },
];

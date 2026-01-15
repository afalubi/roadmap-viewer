export type ColorTheme =
  | 'coastal'
  | 'orchard'
  | 'sunset'
  | 'sand'
  | 'mono'
  | 'forest'
  | 'metro'
  | 'metro-dark'
  | 'executive';

const EXECUTIVE_HEADER_LANE = [
  'bg-[#16A085]/45',
  'bg-[#F39c12]/50',
  'bg-[#E74c3c]/45',
  'bg-[#F7Dc6F]/85',
  'bg-[#34495e]/45',
  'bg-[#5DADE2]/48',
  'bg-[#34495e]/52',
  'bg-[#16A085]/52',
  'bg-[#F39c12]/55',
  'bg-[#5DADE2]/52',
];

const MONO_HEADER_LANE = [
  'bg-slate-300',
  'bg-slate-400',
  'bg-gray-300',
  'bg-gray-400',
  'bg-zinc-300',
  'bg-zinc-400',
  'bg-stone-300',
  'bg-stone-400',
  'bg-neutral-300',
  'bg-neutral-400',
];

const PALETTES: Record<
  ColorTheme,
  { item: string[]; lane: string[] }
> = {
  coastal: {
    item: [
      'bg-sky-100 hover:bg-sky-200 border-sky-300',
      'bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
      'bg-amber-100 hover:bg-amber-200 border-amber-300',
      'bg-rose-100 hover:bg-rose-200 border-rose-300',
      'bg-indigo-100 hover:bg-indigo-200 border-indigo-300',
    ],
    lane: [
      'bg-sky-50',
      'bg-emerald-50',
      'bg-amber-50',
      'bg-rose-50',
      'bg-indigo-50',
      'bg-teal-50',
      'bg-cyan-50',
      'bg-lime-50',
      'bg-orange-50',
      'bg-fuchsia-50',
    ],
  },
  orchard: {
    item: [
      'bg-lime-100 hover:bg-lime-200 border-lime-300',
      'bg-amber-100 hover:bg-amber-200 border-amber-300',
      'bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
      'bg-orange-100 hover:bg-orange-200 border-orange-300',
      'bg-teal-100 hover:bg-teal-200 border-teal-300',
    ],
    lane: [
      'bg-lime-50',
      'bg-amber-50',
      'bg-emerald-50',
      'bg-orange-50',
      'bg-teal-50',
      'bg-yellow-50',
      'bg-green-50',
      'bg-rose-50',
      'bg-cyan-50',
      'bg-sky-50',
    ],
  },
  sunset: {
    item: [
      'bg-rose-100 hover:bg-rose-200 border-rose-300',
      'bg-orange-100 hover:bg-orange-200 border-orange-300',
      'bg-amber-100 hover:bg-amber-200 border-amber-300',
      'bg-fuchsia-100 hover:bg-fuchsia-200 border-fuchsia-300',
      'bg-violet-100 hover:bg-violet-200 border-violet-300',
    ],
    lane: [
      'bg-rose-50',
      'bg-orange-50',
      'bg-amber-50',
      'bg-fuchsia-50',
      'bg-violet-50',
      'bg-pink-50',
      'bg-red-50',
      'bg-yellow-50',
      'bg-indigo-50',
      'bg-purple-50',
    ],
  },
  sand: {
    item: [
      'bg-amber-50 hover:bg-amber-100 border-amber-200',
      'bg-orange-50 hover:bg-orange-100 border-orange-200',
      'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
      'bg-stone-100 hover:bg-stone-200 border-stone-300',
      'bg-rose-50 hover:bg-rose-100 border-rose-200',
    ],
    lane: [
      'bg-amber-50',
      'bg-orange-50',
      'bg-yellow-50',
      'bg-stone-50',
      'bg-rose-50',
      'bg-amber-100/60',
      'bg-orange-100/60',
      'bg-yellow-100/60',
      'bg-stone-100/60',
      'bg-rose-100/60',
    ],
  },
  mono: {
    item: [
      'bg-slate-50 hover:bg-slate-100 border-slate-200',
      'bg-slate-100 hover:bg-slate-200 border-slate-300',
      'bg-gray-50 hover:bg-gray-100 border-gray-200',
      'bg-gray-100 hover:bg-gray-200 border-gray-300',
      'bg-zinc-50 hover:bg-zinc-100 border-zinc-200',
    ],
    lane: [
      'bg-slate-200',
      'bg-slate-300',
      'bg-gray-200',
      'bg-gray-300',
      'bg-zinc-200',
      'bg-zinc-300',
      'bg-stone-200',
      'bg-stone-300',
      'bg-neutral-200',
      'bg-neutral-300',
    ],
  },
  forest: {
    item: [
      'bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
      'bg-teal-100 hover:bg-teal-200 border-teal-300',
      'bg-lime-100 hover:bg-lime-200 border-lime-300',
      'bg-green-100 hover:bg-green-200 border-green-300',
      'bg-cyan-100 hover:bg-cyan-200 border-cyan-300',
    ],
    lane: [
      'bg-emerald-50',
      'bg-teal-50',
      'bg-lime-50',
      'bg-green-50',
      'bg-cyan-50',
      'bg-emerald-100/60',
      'bg-teal-100/60',
      'bg-lime-100/60',
      'bg-green-100/60',
      'bg-cyan-100/60',
    ],
  },
  metro: {
    item: [
      'bg-blue-400 hover:bg-blue-500 border-blue-500',
      'bg-green-400 hover:bg-green-500 border-green-500',
      'bg-orange-400 hover:bg-orange-500 border-orange-500',
      'bg-teal-400 hover:bg-teal-500 border-teal-500',
      'bg-fuchsia-400 hover:bg-fuchsia-500 border-fuchsia-500',
    ],
    lane: [
      'bg-blue-50',
      'bg-green-50',
      'bg-orange-50',
      'bg-teal-50',
      'bg-fuchsia-50',
      'bg-blue-100/50',
      'bg-green-100/50',
      'bg-orange-100/50',
      'bg-teal-100/50',
      'bg-fuchsia-100/50',
    ],
  },
  'metro-dark': {
    item: [
      'bg-indigo-600/60 hover:bg-indigo-600/70 border-indigo-700',
      'bg-teal-600/60 hover:bg-teal-600/70 border-teal-700',
      'bg-emerald-600/60 hover:bg-emerald-600/70 border-emerald-700',
      'bg-amber-600/60 hover:bg-amber-600/70 border-amber-700',
      'bg-rose-600/60 hover:bg-rose-600/70 border-rose-700',
    ],
    lane: [
      'bg-indigo-100/50',
      'bg-teal-100/50',
      'bg-emerald-100/50',
      'bg-amber-100/50',
      'bg-rose-100/50',
      'bg-indigo-50',
      'bg-teal-50',
      'bg-emerald-50',
      'bg-amber-50',
      'bg-rose-50',
    ],
  },
  executive: {
    item: [
      'bg-[#16A085]/15 hover:bg-[#16A085]/25 border-[#16A085]',
      'bg-[#F39c12]/18 hover:bg-[#F39c12]/28 border-[#F39c12]',
      'bg-[#E74c3c]/15 hover:bg-[#E74c3c]/25 border-[#E74c3c]',
      'bg-[#F7Dc6F]/40 hover:bg-[#F7Dc6F]/55 border-[#F7Dc6F]',
      'bg-[#34495e]/15 hover:bg-[#34495e]/25 border-[#34495e]',
      'bg-[#5DADE2]/18 hover:bg-[#5DADE2]/30 border-[#5DADE2]',
    ],
    lane: [
      'bg-[#16A085]/8',
      'bg-[#F39c12]/10',
      'bg-[#E74c3c]/8',
      'bg-[#F7Dc6F]/28',
      'bg-[#34495e]/8',
      'bg-[#5DADE2]/10',
      'bg-[#34495e]/12',
      'bg-[#16A085]/12',
      'bg-[#F39c12]/14',
      'bg-[#5DADE2]/14',
    ],
  },
};

export function getItemClassesByIndex(
  index: number,
  theme: ColorTheme,
): string {
  const palette = PALETTES[theme];
  if (!Number.isFinite(index) || index < 0) {
    return 'bg-slate-100 hover:bg-slate-200 border-slate-300';
  }
  return palette.item[index % palette.item.length];
}

export function getLaneClassesByIndex(
  index: number,
  theme: ColorTheme,
): string {
  if (!Number.isFinite(index) || index < 0) return 'bg-slate-50';
  const palette = PALETTES[theme];
  return palette.lane[index % palette.lane.length];
}

export function getLaneHeaderClassesByIndex(
  index: number,
  theme: ColorTheme,
): string {
  if (!Number.isFinite(index) || index < 0) return 'bg-slate-50';
  if (theme === 'executive') {
    return EXECUTIVE_HEADER_LANE[index % EXECUTIVE_HEADER_LANE.length];
  }
  if (theme === 'mono') {
    return MONO_HEADER_LANE[index % MONO_HEADER_LANE.length];
  }
  return getLaneClassesByIndex(index, theme);
}

export function getLaneBackgroundClassFromItem(itemClasses: string): string {
  const bgClass = itemClasses
    .split(' ')
    .find((cls) => cls.startsWith('bg-'));
  return bgClass || 'bg-slate-50';
}


const LINE_BG_CLASS_MAP: Record<
  string,
  { fill: string; hover: string }
> = {
  'border-sky-200': { fill: 'bg-sky-200', hover: 'hover:bg-sky-200' },
  'border-sky-300': { fill: 'bg-sky-300', hover: 'hover:bg-sky-300' },
  'border-emerald-300': {
    fill: 'bg-emerald-300',
    hover: 'hover:bg-emerald-300',
  },
  'border-emerald-600': {
    fill: 'bg-emerald-600',
    hover: 'hover:bg-emerald-600',
  },
  'border-emerald-700': {
    fill: 'bg-emerald-700',
    hover: 'hover:bg-emerald-700',
  },
  'border-amber-200': { fill: 'bg-amber-200', hover: 'hover:bg-amber-200' },
  'border-amber-300': { fill: 'bg-amber-300', hover: 'hover:bg-amber-300' },
  'border-amber-600': { fill: 'bg-amber-600', hover: 'hover:bg-amber-600' },
  'border-amber-700': { fill: 'bg-amber-700', hover: 'hover:bg-amber-700' },
  'border-rose-200': { fill: 'bg-rose-200', hover: 'hover:bg-rose-200' },
  'border-rose-300': { fill: 'bg-rose-300', hover: 'hover:bg-rose-300' },
  'border-rose-600': { fill: 'bg-rose-600', hover: 'hover:bg-rose-600' },
  'border-rose-700': { fill: 'bg-rose-700', hover: 'hover:bg-rose-700' },
  'border-indigo-200': { fill: 'bg-indigo-200', hover: 'hover:bg-indigo-200' },
  'border-indigo-300': { fill: 'bg-indigo-300', hover: 'hover:bg-indigo-300' },
  'border-indigo-600': { fill: 'bg-indigo-600', hover: 'hover:bg-indigo-600' },
  'border-indigo-700': { fill: 'bg-indigo-700', hover: 'hover:bg-indigo-700' },
  'border-lime-300': { fill: 'bg-lime-300', hover: 'hover:bg-lime-300' },
  'border-orange-200': {
    fill: 'bg-orange-200',
    hover: 'hover:bg-orange-200',
  },
  'border-orange-300': {
    fill: 'bg-orange-300',
    hover: 'hover:bg-orange-300',
  },
  'border-teal-300': { fill: 'bg-teal-300', hover: 'hover:bg-teal-300' },
  'border-teal-600': { fill: 'bg-teal-600', hover: 'hover:bg-teal-600' },
  'border-teal-700': { fill: 'bg-teal-700', hover: 'hover:bg-teal-700' },
  'border-fuchsia-300': {
    fill: 'bg-fuchsia-300',
    hover: 'hover:bg-fuchsia-300',
  },
  'border-violet-200': {
    fill: 'bg-violet-200',
    hover: 'hover:bg-violet-200',
  },
  'border-violet-300': {
    fill: 'bg-violet-300',
    hover: 'hover:bg-violet-300',
  },
  'border-slate-200': { fill: 'bg-slate-200', hover: 'hover:bg-slate-200' },
  'border-slate-300': { fill: 'bg-slate-300', hover: 'hover:bg-slate-300' },
  'border-gray-200': { fill: 'bg-gray-200', hover: 'hover:bg-gray-200' },
  'border-gray-300': { fill: 'bg-gray-300', hover: 'hover:bg-gray-300' },
  'border-zinc-200': { fill: 'bg-zinc-200', hover: 'hover:bg-zinc-200' },
  'border-zinc-300': { fill: 'bg-zinc-300', hover: 'hover:bg-zinc-300' },
  'border-stone-300': {
    fill: 'bg-stone-300',
    hover: 'hover:bg-stone-300',
  },
  'border-neutral-300': {
    fill: 'bg-neutral-300',
    hover: 'hover:bg-neutral-300',
  },
  'border-yellow-200': {
    fill: 'bg-yellow-200',
    hover: 'hover:bg-yellow-200',
  },
  'border-cyan-200': { fill: 'bg-cyan-200', hover: 'hover:bg-cyan-200' },
  'border-cyan-300': { fill: 'bg-cyan-300', hover: 'hover:bg-cyan-300' },
  'border-blue-200': { fill: 'bg-blue-200', hover: 'hover:bg-blue-200' },
  'border-blue-500': { fill: 'bg-blue-500', hover: 'hover:bg-blue-500' },
  'border-green-300': { fill: 'bg-green-300', hover: 'hover:bg-green-300' },
  'border-green-500': { fill: 'bg-green-500', hover: 'hover:bg-green-500' },
  'border-orange-500': { fill: 'bg-orange-500', hover: 'hover:bg-orange-500' },
  'border-teal-500': { fill: 'bg-teal-500', hover: 'hover:bg-teal-500' },
  'border-fuchsia-500': {
    fill: 'bg-fuchsia-500',
    hover: 'hover:bg-fuchsia-500',
  },
  'border-[#34495e]': {
    fill: 'bg-[#34495e]',
    hover: 'hover:bg-[#34495e]',
  },
  'border-[#16A085]': {
    fill: 'bg-[#16A085]',
    hover: 'hover:bg-[#16A085]',
  },
  'border-[#F39c12]': {
    fill: 'bg-[#F39c12]',
    hover: 'hover:bg-[#F39c12]',
  },
  'border-[#E74c3c]': {
    fill: 'bg-[#E74c3c]',
    hover: 'hover:bg-[#E74c3c]',
  },
  'border-[#F7Dc6F]': {
    fill: 'bg-[#F7Dc6F]',
    hover: 'hover:bg-[#F7Dc6F]',
  },
  'border-[#5DADE2]': {
    fill: 'bg-[#5DADE2]',
    hover: 'hover:bg-[#5DADE2]',
  },
};

export function getLineFillClasses(itemClasses: string): {
  fill: string;
  hover: string;
} {
  const borderClass = itemClasses
    .split(' ')
    .find((cls) => cls.startsWith('border-'));
  return borderClass ? LINE_BG_CLASS_MAP[borderClass] ?? { fill: '', hover: '' } : { fill: '', hover: '' };
}

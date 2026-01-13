export type ColorTheme =
  | 'coastal'
  | 'orchard'
  | 'sunset'
  | 'slate'
  | 'sand'
  | 'mist'
  | 'mono'
  | 'forest'
  | 'metro'
  | 'metro-dark';

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
  slate: {
    item: [
      'bg-slate-100 hover:bg-slate-200 border-slate-300',
      'bg-gray-100 hover:bg-gray-200 border-gray-300',
      'bg-zinc-100 hover:bg-zinc-200 border-zinc-300',
      'bg-stone-100 hover:bg-stone-200 border-stone-300',
      'bg-neutral-100 hover:bg-neutral-200 border-neutral-300',
    ],
    lane: [
      'bg-slate-50',
      'bg-gray-50',
      'bg-zinc-50',
      'bg-stone-50',
      'bg-neutral-50',
      'bg-slate-100/60',
      'bg-gray-100/60',
      'bg-zinc-100/60',
      'bg-stone-100/60',
      'bg-neutral-100/60',
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
  mist: {
    item: [
      'bg-sky-50 hover:bg-sky-100 border-sky-200',
      'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
      'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
      'bg-blue-50 hover:bg-blue-100 border-blue-200',
      'bg-violet-50 hover:bg-violet-100 border-violet-200',
    ],
    lane: [
      'bg-sky-50',
      'bg-cyan-50',
      'bg-indigo-50',
      'bg-blue-50',
      'bg-violet-50',
      'bg-sky-100/60',
      'bg-cyan-100/60',
      'bg-indigo-100/60',
      'bg-blue-100/60',
      'bg-violet-100/60',
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
      'bg-slate-50',
      'bg-slate-100/50',
      'bg-gray-50',
      'bg-gray-100/50',
      'bg-zinc-50',
      'bg-zinc-100/50',
      'bg-stone-50',
      'bg-stone-100/50',
      'bg-neutral-50',
      'bg-neutral-100/50',
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
      'bg-indigo-500/70 hover:bg-indigo-500/80 border-indigo-600',
      'bg-teal-500/70 hover:bg-teal-500/80 border-teal-600',
      'bg-emerald-500/70 hover:bg-emerald-500/80 border-emerald-600',
      'bg-amber-500/70 hover:bg-amber-500/80 border-amber-600',
      'bg-rose-500/70 hover:bg-rose-500/80 border-rose-600',
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

export function getLaneBackgroundClassFromItem(itemClasses: string): string {
  const bgClass = itemClasses
    .split(' ')
    .find((cls) => cls.startsWith('bg-') && !cls.startsWith('bg-['));
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
  'border-amber-200': { fill: 'bg-amber-200', hover: 'hover:bg-amber-200' },
  'border-amber-300': { fill: 'bg-amber-300', hover: 'hover:bg-amber-300' },
  'border-amber-600': { fill: 'bg-amber-600', hover: 'hover:bg-amber-600' },
  'border-rose-200': { fill: 'bg-rose-200', hover: 'hover:bg-rose-200' },
  'border-rose-300': { fill: 'bg-rose-300', hover: 'hover:bg-rose-300' },
  'border-rose-600': { fill: 'bg-rose-600', hover: 'hover:bg-rose-600' },
  'border-indigo-200': { fill: 'bg-indigo-200', hover: 'hover:bg-indigo-200' },
  'border-indigo-300': { fill: 'bg-indigo-300', hover: 'hover:bg-indigo-300' },
  'border-indigo-600': { fill: 'bg-indigo-600', hover: 'hover:bg-indigo-600' },
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

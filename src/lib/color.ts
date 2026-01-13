export type ColorTheme = 'coastal' | 'orchard' | 'sunset';

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

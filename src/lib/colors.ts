// Accent color system — used by branch cards, direction cards, dashboard cards and pickers.
// All class strings are static so Tailwind keeps them in the build.

export type AccentColor = 'green' | 'blue' | 'red' | 'yellow' | 'purple';

export const ACCENT_COLORS: AccentColor[] = ['green', 'blue', 'red', 'yellow', 'purple'];

export interface ColorClasses {
  bg: string;     // soft tinted background
  text: string;   // text / icon color
  border: string; // border
  solid: string;  // solid swatch (color strip, picker dot)
  ring: string;   // selected ring
}

export const colorClasses: Record<AccentColor, ColorClasses> = {
  green:  { bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-600 dark:text-green-400',   border: 'border-green-200 dark:border-green-800',   solid: 'bg-green-500',  ring: 'ring-green-500' },
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-800',     solid: 'bg-blue-500',   ring: 'ring-blue-500' },
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-600 dark:text-red-400',       border: 'border-red-200 dark:border-red-800',       solid: 'bg-red-500',    ring: 'ring-red-500' },
  yellow: { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800',   solid: 'bg-amber-500',  ring: 'ring-amber-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', solid: 'bg-purple-500', ring: 'ring-purple-500' },
};

export function colorOf(name?: string | null): ColorClasses {
  return colorClasses[(name as AccentColor)] ?? colorClasses.blue;
}

// Localized color labels
export const colorLabel: Record<AccentColor, { en: string; ru: string; uz: string }> = {
  green:  { en: 'Green',  ru: 'Зелёный',   uz: 'Yashil' },
  blue:   { en: 'Blue',   ru: 'Синий',     uz: "Ko'k" },
  red:    { en: 'Red',    ru: 'Красный',   uz: 'Qizil' },
  yellow: { en: 'Yellow', ru: 'Жёлтый',    uz: 'Sariq' },
  purple: { en: 'Purple', ru: 'Фиолетовый', uz: 'Binafsha' },
};

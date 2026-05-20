import type { ChromeGroupColor } from '../storage/schema';

/** Maps ChromeGroupColor names to their hex values, matching the kit palette. */
export const CHROME_GROUP_COLOR_HEX: Record<ChromeGroupColor, string> = {
  grey:   '#5F6368',
  blue:   '#1A73E8',
  red:    '#D93025',
  yellow: '#F29900',
  green:  '#188038',
  pink:   '#D01884',
  purple: '#9334E9',
  cyan:   '#007B83',
  orange: '#FA903E',
};

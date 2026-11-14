/**
 * The colours of a downloaded picture. A file can't use the stylesheet's custom properties, so
 * they are read from @eurth/style's tokens as plain values: the same names, the same colours.
 */
import { resolveColors } from '@eurth/style';
import tokens from '@eurth/style/tokens.json';
import type { Palette } from '../dynasty/render';

export type Theme = 'dark' | 'light';

/** Which token each part of the drawing takes its colour from. */
export const paletteTokens: Record<keyof Palette, string> = {
  surface: 'surface',
  surfaceRaised: 'surface-raised',
  ink: 'ink',
  inkMuted: 'ink-muted',
  lineStrong: 'line-strong',
  accentText: 'accent-text',
  crown: 'caution-text',
};

export function paletteFor(theme: Theme): Palette {
  const colours = resolveColors(tokens, theme);
  return Object.fromEntries(Object.entries(paletteTokens).map(([role, token]) => [role, colours[token]])) as unknown as Palette;
}

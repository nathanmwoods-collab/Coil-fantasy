import type { TextStyle } from 'react-native';

/**
 * Coil type system (personality spec §2.7).
 * Big Shoulders for display and big numbers, Schibsted Grotesk for UI,
 * DM Mono for numeric columns so digits don't jitter.
 * Custom families carry their own weight: never pair them with `fontWeight`.
 */
export const fonts = {
  display: 'BigShoulders_800ExtraBold',
  displayHeavy: 'BigShoulders_900Black',
  body: 'SchibstedGrotesk_400Regular',
  strong: 'SchibstedGrotesk_600SemiBold',
  heavy: 'SchibstedGrotesk_800ExtraBold',
  mono: 'DMMono_500Medium',
} as const;

export const type = {
  display40: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42 },
  display32: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  display24: { fontFamily: fonts.display, fontSize: 24, lineHeight: 27 },
  title: { fontFamily: fonts.strong, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.strong, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.strong, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.strong, fontSize: 11, lineHeight: 14 },
  micro: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14 },
  num: { fontFamily: fonts.mono, fontSize: 13, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

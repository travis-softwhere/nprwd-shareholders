// Breakpoints in pixels
export const breakpoints = {
  xs: 320,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Media query strings for use in styled-components or CSS-in-JS
export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints.xs}px)`,
  sm: `@media (min-width: ${breakpoints.sm}px)`,
  md: `@media (min-width: ${breakpoints.md}px)`,
  lg: `@media (min-width: ${breakpoints.lg}px)`,
  xl: `@media (min-width: ${breakpoints.xl}px)`,
  '2xl': `@media (min-width: ${breakpoints['2xl']}px)`,
} as const;

// Tailwind-style breakpoint classes
export const screens = {
  xs: `min-width: ${breakpoints.xs}px`,
  sm: `min-width: ${breakpoints.sm}px`,
  md: `min-width: ${breakpoints.md}px`,
  lg: `min-width: ${breakpoints.lg}px`,
  xl: `min-width: ${breakpoints.xl}px`,
  '2xl': `min-width: ${breakpoints['2xl']}px`,
} as const; 
// Shared design tokens - plain JS so they can be used directly in inline
// `style={{ ... }}` objects without any Tailwind config.

export const colors = {
  primary: "#e31e24",
  primaryContainer: "#e31e24",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#fffafa",
  secondary: "#5d5e61",
  onSecondary: "#ffffff",
  secondaryContainer: "#e2e2e5",
  background: "#f6faff",
  onBackground: "#141d23",
  surface: "#f6faff",
  onSurface: "#141d23",
  onSurfaceVariant: "#5d3f3c",
  surfaceContainer: "#e6eff8",
  surfaceContainerLow: "#ecf5fe",
  surfaceContainerHigh: "#e0e9f2",
  surfaceContainerHighest: "#dbe4ed",
  surfaceVariant: "#dbe4ed",
  outline: "#926f6b",
  outlineVariant: "#e7bdb8",
  white: "#ffffff",
};

export const spacing = {
  base: 8,
  stackSm: 8,
  stackMd: 16,
  stackLg: 32,
  gutter: 24,
  marginMobile: 16,
  marginDesktop: 40,
  containerMax: 1280,
};

export const fonts = {
  display: "'Montserrat', sans-serif",
  headline: "'Montserrat', sans-serif",
  body: "'Inter', sans-serif",
  label: "'Inter', sans-serif",
};

export const fontSizes = {
  displayLg: { fontSize: 48, lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: 800 },
  headlineLg: { fontSize: 32, lineHeight: "40px", fontWeight: 700 },
  headlineMd: { fontSize: 24, lineHeight: "32px", fontWeight: 600 },
  bodyLg: { fontSize: 18, lineHeight: "28px", fontWeight: 400 },
  bodyMd: { fontSize: 16, lineHeight: "24px", fontWeight: 400 },
  labelBold: { fontSize: 14, lineHeight: "20px", fontWeight: 600 },
  labelSm: { fontSize: 12, lineHeight: "16px", fontWeight: 500 },
};

// Small helper so "container-max mx-auto px-margin..." becomes one style object
export const containerStyle = (extra = {}) => ({
  maxWidth: spacing.containerMax,
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: spacing.marginMobile,
  paddingRight: spacing.marginMobile,
  ...extra,
});

export const iconStyle = (extra = {}) => ({
  fontFamily: "'Material Symbols Outlined'",
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
  display: "inline-block",
  verticalAlign: "middle",
  lineHeight: 1,
  ...extra,
});
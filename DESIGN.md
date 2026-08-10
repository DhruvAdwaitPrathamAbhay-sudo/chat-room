---
name: Veil Nocturne
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#f8f5f5'
  on-tertiary: '#303030'
  tertiary-container: '#dbd9d8'
  on-tertiary-container: '#5f5e5e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies a "Nocturne" aesthetic—a sophisticated blend of deep, near-black environments punctuated by electric, high-energy accents. The personality is mysterious yet approachable, combining the precision of a professional tool with the tactile playfulness of a high-end physical interface. 

The design style is **Tactile Minimalism**. It leverages layered depth, soft physical metaphors, and exaggerated rounding to create a UI that feels "squishy" and interactive. The emotional goal is to evoke a sense of focused immersion, where the interface recedes into the shadows, leaving only essential, vibrant controls to guide the user.

## Colors
The palette is centered on a charcoal spectrum to create layered depth without relying on traditional borders.

- **Background (#0a0a0a):** The deepest base layer, used for the main application canvas.
- **Surface (#1a1a1a):** The primary container color for cards and sections.
- **Elevated Surface (#262626):** Used for interactive elements or modals that sit atop the standard surface.
- **Electric Accent (#00f0ff):** A sparse, high-intensity cyan reserved for primary actions, active states, and critical notifications. It should represent less than 5% of the total screen real estate to maintain its "electric" impact.

## Typography
The system utilizes **Inter** exclusively to maintain a high-contrast, systematic feel. To lean into the "playful" aspect of the brief, headings use extra-bold weights and tight letter-spacing. Body text remains generous in line-height to ensure legibility against the dark background. All typography should favor high-contrast white (#FFFFFF) for primary content and muted grey (#A1A1A1) for secondary descriptions.

## Layout & Spacing
The layout follows a **fluid grid** logic with strict 4px increments (the "unit"). 

- **Desktop:** 12-column grid with 24px gutters. Use large outer margins (64px) to create a focused, "letterboxed" feel for the content.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters and 16px side margins.

Transitions between surfaces should use **expressive motion curves**. Specifically, use a "Back Out" easing (cubic-bezier(0.34, 1.56, 0.64, 1)) for entering elements to create a subtle bounce, reinforcing the tactile nature of the UI.

## Elevation & Depth
Depth is communicated through **Tonal Layering** supplemented by soft, ambient shadows.

1.  **Level 0 (Base):** #0a0a0a. No shadows.
2.  **Level 1 (Surface):** #1a1a1a. 16px blur, 4% opacity black shadow.
3.  **Level 2 (Elevated):** #262626. 32px blur, 8% opacity black shadow.

For the primary accent color (#00f0ff), use a subtle "outer glow" instead of a shadow (4px blur, 30% opacity of the accent color) to simulate an emissive light source.

## Shapes
The shape language is overtly rounded to create a friendly, tactile response.

- **Small Components:** Buttons and input fields use a consistent **10px** radius (the median of the requested 8-12px range).
- **Large Components:** Cards and main surfaces use a **20px-24px** radius to emphasize the container's structural role.
- **Status Elements:** Tags, badges, and pill-buttons must use a **999px** (full-round) radius to distinguish them as floating, metadata elements.

## Components
- **Buttons:** Primary buttons are filled with #00f0ff with black text. Secondary buttons use #262626 with white text. All buttons feature a 2px scale-down transform on "active" states to simulate a physical press.
- **Inputs:** Dark backgrounds (#1a1a1a) with a subtle 1px border (#333). On focus, the border glows with #00f0ff.
- **Cards:** Use the "Surface" color (#1a1a1a). Padding should be generous (24px) to match the large corner radius.
- **Status Badges:** Use #999px rounding. For active or "on" states, use a tiny dot of #00f0ff next to the label.
- **Lists:** Items should be separated by space rather than lines, using the "Elevated Surface" for hover states with a transition speed of 200ms using the defined motion curve.
- **Interactive Triggers:** Any element that is clickable should have a slight "lift" effect (moving -2px on Y-axis) when hovered.
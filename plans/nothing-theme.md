# Nothing Theme - Design Specification

Inspired by Nothing by CMF's bold, minimalist tech aesthetic.

## Core Philosophy

- **Utilitarian Minimalism**: Strip away unnecessary elements, focus on function
- **High Contrast**: Bold blacks, pure whites, strategic red accents
- **Tech-Forward**: Industrial design language with modern typography
- **Dot Matrix Pattern**: Signature visual element used subtly throughout

## Color Palette

```css
/* Primary Colors */
--nothing-black: #000000;
--nothing-white: #FFFFFF;
--nothing-red: #FF0000;

/* Grays */
--nothing-gray-100: #F5F5F5;
--nothing-gray-200: #E8E8E8;
--nothing-gray-300: #D1D1D1;
--nothing-gray-400: #B0B0B0;
--nothing-gray-500: #808080;
--nothing-gray-600: #606060;
--nothing-gray-700: #404040;
--nothing-gray-800: #202020;
--nothing-gray-900: #0A0A0A;

/* Accent Colors */
--nothing-red-light: #FF3333;
--nothing-red-dark: #CC0000;
--nothing-red-glow: rgba(255, 0, 0, 0.15);

/* Semantic Colors */
--nothing-background: #000000;
--nothing-surface: #0A0A0A;
--nothing-surface-elevated: #202020;
--nothing-text-primary: #FFFFFF;
--nothing-text-secondary: #B0B0B0;
--nothing-text-tertiary: #606060;
--nothing-border: #202020;
--nothing-border-focus: #FF0000;
```

## Typography

### Font Families

```css
/* Primary: Monospace for tech aesthetic */
--nothing-font-mono: 'SF Mono', 'Consolas', 'Liberation Mono', monospace;

/* Secondary: Sans-serif for readability */
--nothing-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Display: For headers - slightly condensed */
--nothing-font-display: 'SF Pro Display', -apple-system, sans-serif;
```

### Typography Scale

```css
--nothing-text-xs: 0.75rem;    /* 12px - Labels */
--nothing-text-sm: 0.875rem;   /* 14px - Body small */
--nothing-text-base: 1rem;     /* 16px - Body */
--nothing-text-lg: 1.125rem;   /* 18px - Subheading */
--nothing-text-xl: 1.25rem;    /* 20px - Heading */
--nothing-text-2xl: 1.5rem;    /* 24px - Title */
--nothing-text-3xl: 2rem;      /* 32px - Display */
--nothing-text-4xl: 2.5rem;    /* 40px - Hero */
```

### Font Weights

```css
--nothing-weight-normal: 400;
--nothing-weight-medium: 500;
--nothing-weight-bold: 700;
```

## Spacing System

8px base unit, aggressive spacing for minimalism

```css
--nothing-space-1: 0.25rem;  /* 4px */
--nothing-space-2: 0.5rem;   /* 8px */
--nothing-space-3: 0.75rem;  /* 12px */
--nothing-space-4: 1rem;     /* 16px */
--nothing-space-6: 1.5rem;   /* 24px */
--nothing-space-8: 2rem;     /* 32px */
--nothing-space-12: 3rem;    /* 48px */
--nothing-space-16: 4rem;    /* 64px */
```

## UI Components

### Dot Matrix Background Pattern

```css
.nothing-dot-matrix {
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
  background-size: 8px 8px;
  background-position: 0 0;
}
```

### Buttons

**Primary (Red Accent)**
- Background: `#FF0000`
- Text: `#FFFFFF`
- Border: None
- Hover: `#FF3333` with subtle glow
- Height: 40px
- Padding: 12px 24px
- Border-radius: 2px (minimal)
- Font: 14px, 500 weight, uppercase tracking

**Secondary (Outlined)**
- Background: Transparent
- Text: `#FFFFFF`
- Border: 1px solid `#FFFFFF`
- Hover: Background `#FFFFFF`, Text `#000000`
- Same dimensions as primary

**Ghost**
- Background: Transparent
- Text: `#B0B0B0`
- Border: None
- Hover: Text `#FFFFFF`

### Input Fields

```css
.nothing-input {
  background: #0A0A0A;
  border: 1px solid #202020;
  color: #FFFFFF;
  padding: 12px 16px;
  border-radius: 2px;
  font-family: var(--nothing-font-mono);
  font-size: 14px;
  transition: all 0.2s ease;
}

.nothing-input:focus {
  border-color: #FF0000;
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.15);
  outline: none;
}

.nothing-input::placeholder {
  color: #606060;
}
```

### Cards/Surfaces

```css
.nothing-card {
  background: #0A0A0A;
  border: 1px solid #202020;
  border-radius: 4px;
  padding: 24px;
  transition: border-color 0.2s ease;
}

.nothing-card:hover {
  border-color: #404040;
}

.nothing-card-elevated {
  background: #202020;
  border: 1px solid #404040;
}
```

### Sidebar

```css
.nothing-sidebar {
  background: #000000;
  border-right: 1px solid #202020;
  /* Dot matrix overlay */
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
  background-size: 8px 8px;
}

.nothing-sidebar-item {
  color: #B0B0B0;
  padding: 8px 16px;
  border-left: 2px solid transparent;
  transition: all 0.15s ease;
}

.nothing-sidebar-item:hover {
  color: #FFFFFF;
  background: #0A0A0A;
}

.nothing-sidebar-item.active {
  color: #FFFFFF;
  border-left-color: #FF0000;
  background: #0A0A0A;
}
```

### Editor Area

```css
.nothing-editor {
  background: #000000;
  color: #FFFFFF;
  /* Clean, minimal with subtle grid */
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.02) 1px, transparent 0);
  background-size: 16px 16px;
  padding: 48px 64px;
}

.nothing-editor p {
  color: #E8E8E8;
  line-height: 1.8;
  margin-bottom: 16px;
}

.nothing-editor h1,
.nothing-editor h2,
.nothing-editor h3 {
  color: #FFFFFF;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.nothing-editor h1 {
  font-size: 2.5rem;
  margin-bottom: 24px;
  position: relative;
}

.nothing-editor h1::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 0;
  width: 48px;
  height: 2px;
  background: #FF0000;
}

.nothing-editor a {
  color: #FF0000;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.nothing-editor a:hover {
  border-bottom-color: #FF0000;
}

.nothing-editor code {
  background: #0A0A0A;
  color: #FF0000;
  padding: 2px 6px;
  border-radius: 2px;
  font-family: var(--nothing-font-mono);
  font-size: 0.9em;
}

.nothing-editor pre {
  background: #0A0A0A;
  border: 1px solid #202020;
  border-left: 2px solid #FF0000;
  padding: 16px;
  border-radius: 2px;
  overflow-x: auto;
}

.nothing-editor blockquote {
  border-left: 3px solid #FF0000;
  padding-left: 24px;
  color: #B0B0B0;
  font-style: italic;
  margin: 24px 0;
}
```

### Tags

```css
.nothing-tag {
  background: #0A0A0A;
  color: #FFFFFF;
  border: 1px solid #202020;
  padding: 4px 12px;
  border-radius: 2px;
  font-size: 12px;
  font-family: var(--nothing-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s ease;
}

.nothing-tag:hover {
  border-color: #FF0000;
  color: #FF0000;
}

.nothing-tag-active {
  background: #FF0000;
  border-color: #FF0000;
  color: #FFFFFF;
}
```

### Icons

- Use outline style icons (not filled)
- 20px default size
- Stroke width: 1.5px
- Color: `#B0B0B0` (hover: `#FFFFFF` or `#FF0000` for actions)

### Scrollbar

```css
.nothing-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.nothing-scrollbar::-webkit-scrollbar-track {
  background: #000000;
}

.nothing-scrollbar::-webkit-scrollbar-thumb {
  background: #202020;
  border-radius: 4px;
}

.nothing-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #404040;
}
```

## Layout Principles

### 1. Brutalist Grid System
- Sharp edges, no rounded corners (max 4px)
- Strict alignment to 8px grid
- Clear visual separation between sections

### 2. Asymmetric Balance
- Sidebar: 280px fixed width
- Main content: Fluid with 64px padding
- Timeline: 320px fixed width (when active)

### 3. Information Density
- Compact spacing for lists
- Generous whitespace for reading content
- Use of negative space for emphasis

### 4. Red as Accent Only
- Never use for large areas
- Strategic placement for:
  - Call-to-action buttons
  - Active states
  - Focus indicators
  - Important notifications

## Animation & Motion

### Timing Functions
```css
--nothing-ease-out: cubic-bezier(0.2, 0, 0, 1);
--nothing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Durations
```css
--nothing-duration-fast: 150ms;
--nothing-duration-normal: 250ms;
--nothing-duration-slow: 400ms;
```

### Principles
- Snappy, mechanical transitions
- No bounce or elastic easing
- Linear or ease-out only
- Minimal animation overall (utilitarian)

## Special Effects

### Red Glow Effect (for active elements)
```css
.nothing-glow-red {
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.3),
              0 0 40px rgba(255, 0, 0, 0.1);
}
```

### Scan Line Effect (optional, for loading states)
```css
@keyframes nothing-scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.nothing-scanning::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 0, 0, 0.5),
    transparent
  );
  animation: nothing-scan 2s linear infinite;
}
```

## Dark Mode Only

This theme is inherently dark. No light variant needed - it's part of the identity.

## Accessibility Considerations

Despite the dark aesthetic:
- All text meets WCAA AA standards (white on black = 21:1 ratio)
- Red accent passes AA for large text (4.5:1+ on black backgrounds)
- Focus states are clearly visible (red outline)
- Generous tap targets (min 40px height)
- Sufficient spacing between interactive elements

## Implementation Notes

### CSS Custom Properties Structure
```css
:root[data-theme="nothing"] {
  /* Colors */
  --background: var(--nothing-black);
  --surface: var(--nothing-surface);
  --text-primary: var(--nothing-white);
  --accent: var(--nothing-red);

  /* Typography */
  --font-family: var(--nothing-font-sans);
  --font-family-mono: var(--nothing-font-mono);

  /* Spacing */
  --spacing-unit: 8px;

  /* Effects */
  --dot-matrix: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
}
```

### Component Mapping

| Component | Key Changes |
|-----------|-------------|
| Sidebar | Black background, dot matrix, red accent for active items |
| Editor | Black background with subtle grid, red accent for links/code |
| Buttons | Red primary, outlined secondary, minimal rounded corners |
| Tags | Monospace font, uppercase, outlined with red hover |
| Modal | Black surface with red border on focus elements |
| Timeline | Compact design with red date markers |

## Visual Mockup Description

### Sidebar (Left)
```
┌─────────────────────────┐
│ [LOGO]            [≡]   │ <- Red accent on hover
├─────────────────────────┤
│ • All Notes             │ <- Dot matrix background
│ ▸ Notebook 1            │
│ ▾ Notebook 2            │ <- Red line when active
│   • Note Title          │
│   • Note Title          │
│ • Draft                 │ <- Gray text, white on hover
├─────────────────────────┤
│ #tag1  #tag2  #tag3     │ <- Monospace, outlined
└─────────────────────────┘
```

### Main Editor (Center)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Chapter One                                   │
│   ────                     <- Red underline     │
│                                                 │
│   Lorem ipsum dolor sit amet, consectetur       │
│   adipiscing elit. This is a link that is red.  │
│                                                 │
│   > This is a blockquote with a red border      │
│                                                 │
│   ┌──────────────────────────────────────┐     │
│   │ console.log('code block');           │     │
│   └──────────────────────────────────────┘     │
│      ↑ Red left border                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Tags Display
```
[TAG1] [TAG2] [#special] <- Hover for red border
  ↑ Uppercase monospace
```

## Inspiration References

- Nothing Phone (1) UI design
- CMF by Nothing product aesthetic
- Industrial/utilitarian design language
- Cyberpunk minimalism
- Terminal/command-line interfaces

## Future Enhancements

1. **System Status Indicators**: Small red LED-style dots for notifications
2. **Grid Overlay Mode**: Toggle to show 8px grid for precise layout
3. **Glitch Effect**: Subtle scan-line animation on hover for images
4. **Monospace Mode**: Toggle to use monospace font throughout the editor
5. **Red Filter**: Optional red tint for deep focus mode

---

**Theme Identity**: Bold, unapologetic, tech-forward. For writers who want their tools to feel as modern as their ideas.

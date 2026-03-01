# CLAUDE.md — AdCropper: Landing Page Designer

This file is the authoritative reference for all development on the AdCropper Landing Page Designer. It describes project architecture, design decisions, implementation rules, and planned features. Always consult this file before making changes.

---

## Project Identity

**Name:** AdCropper — Landing Page Designer
**Purpose:** A visual design tool for building animated, interactive landing pages. The canvas metaphor from ad design has been repurposed: stages represent responsive breakpoints, layers are page elements, and the timeline controls scroll-triggered and interaction-triggered animations.
**Stack:** React 19, TypeScript, Vite, Tailwind CSS 3, Lucide icons, Monaco editor, html2canvas, opentype.js
**Primary Font:** Manrope (display), system-ui (UI chrome)
**Primary Color:** `#136c6c` (teal)

---

## Tech Stack & Constraints

- **React 19 + TypeScript 5** — all components are functional, typed with interfaces, no `any` unless unavoidable
- **Vite 7** — dev server and build tool; proxy config in `vite.config.js`
- **Tailwind CSS 3.4** — utility classes only; do not write raw CSS for layout unless it requires a CSS variable or dynamic value
- **State:** All primary state lives in `App.tsx`; use `useUndoRedo` hook for anything that should be undoable
- **No Redux / Zustand** — props + context only; avoid adding new state libraries
- **Icons:** `lucide-react` exclusively; do not import from other icon packages
- **No inline `<style>` blocks** — use Tailwind classes or `App.css`/`index.css` for CSS-in-JS style overrides
- **Preserve existing CSS variables:** `--primary`, `--h-bg`, `--a-bg`, timeline track colors

---

## Directory Structure

```
src/
├── App.tsx                  # Root state, event handlers, layout shell
├── components/              # All UI components (never put logic here beyond local UI state)
│   ├── PropertiesBar.tsx    # Right sidebar — property editor for selected layer/stage
│   ├── Workspace.tsx        # Canvas viewport — renders stages, handles zoom/pan
│   ├── StageContainer.tsx   # Individual stage (breakpoint) frame
│   ├── LayerPreview.tsx     # Single layer renderer with effects and animations
│   ├── Timeline.tsx         # Animation timeline scrubber (animate mode)
│   ├── Header.tsx           # Top bar — modes, export, file ops
│   ├── LeftSidebar.tsx      # Asset panel — media, text, shapes, widgets, buttons
│   ├── TopToolbar.tsx       # Secondary toolbar — align, distribute, undo/redo
│   └── ...modals/           # Popup dialogs
├── utils/
│   ├── animations.ts        # Interpolation, easing, keyframe computation
│   ├── animationData.ts     # Keyframe CSS definitions (100+ animations)
│   ├── transformSystem.ts   # Figma-style transform snapshot/apply
│   ├── stageExport.ts       # Serialise design to export format
│   ├── snapUtils.ts         # Smart guide snapping
│   └── landingPageHelper.ts # Landing page-specific utilities
├── hooks/
│   └── useUndoRedo.ts       # Generic undo/redo stack (50-item limit)
├── data/
│   └── animationData.ts     # Raw @keyframes strings per animation name
├── widgets/                 # Embeddable HTML/CSS/JS widgets
└── assets/
```

---

## Core Data Structures

### Breakpoint Stage (replaces "Ad Stage")

A **Stage** now represents a **responsive breakpoint**. Its `name` is one of the five canonical breakpoints. Width ranges follow standard Tailwind breakpoints.

```typescript
type BreakpointName = 'xlarge' | 'large' | 'medium' | 'small' | 'xsmall';

const BREAKPOINT_PRESETS: Record<BreakpointName, { width: number; height: number; label: string }> = {
  xlarge:  { width: 1920, height: 1080, label: 'XL — 1920px'  },  // ≥1280px viewport
  large:   { width: 1280, height: 800,  label: 'LG — 1280px'  },  // ≥1024px
  medium:  { width: 1024, height: 768,  label: 'MD — 1024px'  },  // ≥768px
  small:   { width: 768,  height: 1024, label: 'SM — 768px'   },  // ≥640px (tablet portrait)
  xsmall:  { width: 390,  height: 844,  label: 'XS — 390px'   },  // <640px (mobile)
};
```

**Stage interface additions / changes:**

```typescript
interface Stage {
  id: string;
  name: string;                    // Human-readable section name (e.g. "Hero", "Features")
  breakpoint: BreakpointName;      // Which viewport size this stage targets
  x: number; y: number;
  width: number; height: number;   // Set from breakpoint preset
  layers: Layer[];
  duration: number;                // Scroll or time duration for the section

  // Animation playback control (replaces auto-play)
  autoPlay: boolean;               // false by default — user must opt in
  loopCount: number;               // 0 = infinite, 1 = once, N = N times
  stopAtSecond: number | null;     // null = play to end; number = freeze at that second

  // Background
  backgroundColor?: string;
  backgroundColor2?: string;
  bgType?: 'none' | 'solid' | 'radial' | 'linear';
  gradientAngle?: number;
  gradientCenterX?: number;
  gradientCenterY?: number;
  gradientLength?: number;
  gradientRadius?: number;

  // Layout
  guideLines?: GuideLine[];
  overflow?: 'hidden' | 'visible';
  visible?: boolean;

  // Landing Page Actions (stage-level interactions)
  actions?: LandingPageAction[];
}
```

### Layer (unchanged core, additions below)

```typescript
interface Layer {
  // ... all existing fields preserved ...

  // Animation playback overrides (per-layer)
  animationAutoPlay?: boolean;       // Overrides stage autoPlay for this layer
  animationLoopCount?: number;       // 0 = infinite, N = N times
  animationStopAt?: number | null;   // Freeze frame (seconds)

  // Interaction Actions (NEW — replaces StageAction for per-object targeting)
  interactionActions?: InteractionAction[];
}
```

### LandingPageAction (replaces StageAction)

Landing page actions connect trigger events to stage-level navigation behaviors.

```typescript
type LandingPageTrigger =
  | 'click'
  | 'hover'           // mouseenter
  | 'hoverEnd'        // mouseleave
  | 'touchStart'
  | 'touchEnd'
  | 'scroll-into-view' // IntersectionObserver — fires when element enters viewport
  | 'scroll-out-view'; // fires when element leaves viewport

type LandingPageActionType =
  | 'scroll-to-section'    // Smooth scroll to a named section/stage
  | 'open-menu'            // Toggle a navigation menu layer (show/hide)
  | 'close-menu'           // Force-close a menu layer
  | 'toggle-layer'         // Show or hide any layer by id
  | 'navigate-url'         // Open an external URL
  | 'play-animation'       // Trigger a layer's animation
  | 'stop-animation'       // Stop a layer's animation
  | 'toggle-animation';    // Play if stopped, stop if playing

interface LandingPageAction {
  id: string;
  triggerSourceId: string;       // layerId that triggers the action
  triggerEvent: LandingPageTrigger;
  actionType: LandingPageActionType;
  targetId: string;              // layerId or stageId depending on actionType
  config?: {
    url?: string;                // For navigate-url
    openInNewTab?: boolean;
    sectionId?: string;          // For scroll-to-section
    menuLayerId?: string;        // For open-menu / close-menu
    animationPhase?: 'entry' | 'main' | 'exit' | 'all'; // For play/stop-animation
  };
}
```

### InteractionAction (per-layer, in properties panel)

Each layer can define its own interaction actions through the Properties panel. These control how the layer's **own animation** responds to user interaction.

```typescript
type AnimationTriggerEvent =
  | 'click'
  | 'hover'        // mouseenter
  | 'hoverEnd'     // mouseleave
  | 'touchStart'
  | 'touchEnd'
  | 'focus'        // keyboard / screen reader
  | 'blur';

type AnimationTriggerAction =
  | 'play-entry'
  | 'play-main'
  | 'play-exit'
  | 'play-all'     // entry → main → exit in sequence
  | 'stop'
  | 'pause'
  | 'resume'
  | 'reset';       // rewind to time 0 and stop

interface InteractionAction {
  id: string;
  event: AnimationTriggerEvent;
  action: AnimationTriggerAction;
}
```

---

## Animation System Rules

### Core Rule: Animations Do NOT Auto-Play

**Animations never start automatically.** This is the fundamental behavior change from the ad design tool. Users must explicitly configure playback.

```typescript
// Default for every new layer
const DEFAULT_LAYER_ANIMATION_CONFIG = {
  animationAutoPlay: false,
  animationLoopCount: 1,
  animationStopAt: null,
};

// Default for every new stage
const DEFAULT_STAGE_ANIMATION_CONFIG = {
  autoPlay: false,
  loopCount: 1,
  stopAtSecond: null,
};
```

**Playback is triggered by one of:**
1. An `InteractionAction` on the layer itself (hover, click, touch, etc.)
2. A `LandingPageAction` with `actionType: 'play-animation'` targeting the layer
3. `animationAutoPlay: true` explicitly set by the user in the Properties panel
4. `scroll-into-view` trigger (when element enters the viewport during scroll)

### Animation Playback State

Each layer tracks its current animation runtime state separately from its definition:

```typescript
// Live state (NOT stored in design data — ephemeral, in React state)
interface LayerAnimationState {
  layerId: string;
  isPlaying: boolean;
  currentTime: number;
  loopsCompleted: number;
  phase: 'idle' | 'entry' | 'main' | 'exit' | 'stopped';
}
```

### Playback Control Properties (Properties Panel — Animation Section)

The Properties panel must expose these controls for any selected layer:

| Property | UI Control | Description |
|---|---|---|
| Auto-Play | Toggle switch | Start animation when stage is first rendered |
| Loop Count | Number input (0 = ∞) | How many times the animation cycles |
| Stop At | Time input (seconds) or "Play to End" toggle | Freeze the animation at a specific time |
| Scroll Trigger | Toggle | Play when element scrolls into viewport |
| Interaction Triggers | Action list (see below) | Per-event animation actions |

### Interaction Triggers UI (Properties Panel — Interactions Section)

For any selected layer, show an **"Interactions"** section in the Properties panel with an **"Add Interaction"** button. Each interaction row contains:

```
[Event Trigger ▼]  →  [Animation Action ▼]   [× Remove]

Event Trigger options:
  • Click / Tap
  • Mouse Over (hover)
  • Mouse Out (hover end)
  • Touch Start
  • Touch End
  • Focus
  • Blur

Animation Action options:
  • Play Entry Animation
  • Play Main / Loop Animation
  • Play Exit Animation
  • Play Full Sequence (Entry → Main → Exit)
  • Stop Animation
  • Pause Animation
  • Resume Animation
  • Reset (rewind & stop)
```

This section replaces the old "Interactive Effects" popup for animation control, though CSS hover effects (shine, pulse, lift, glow, etc.) remain as a separate "Hover Style" section.

---

## Stage / Breakpoint Panel (replaces "Add Stage" modal)

When the user creates a new stage, present a **breakpoint selector** instead of a custom size input:

```
┌─────────────────────────────────────────────┐
│  Add Breakpoint Stage                       │
│                                             │
│  ○ XL   1920 × 1080   (Desktop Wide)       │
│  ○ LG   1280 × 800    (Desktop)            │
│  ● MD   1024 × 768    (Tablet Landscape)   │  ← default
│  ○ SM   768 × 1024    (Tablet Portrait)    │
│  ○ XS   390 × 844     (Mobile)             │
│                                             │
│  Section Name: [Hero Section         ]      │
│                                             │
│  [ Cancel ]              [ Add Stage ]      │
└─────────────────────────────────────────────┘
```

The breakpoint badge is displayed on the stage frame in the workspace (top-left corner, small pill: `XL`, `LG`, `MD`, `SM`, `XS`).

The stage panel in the left sidebar (stage list) shows stages grouped by section name and color-coded by breakpoint.

---

## Landing Page Actions Panel

The **"Actions"** tab in the stage properties (visible when no layer is selected) should show a list of page-level interactions using `LandingPageAction`. Replace the old `StageAction` UI with:

```
┌─ Stage Actions ─────────────────────────────┐
│                          [+ Add Action]     │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ [Layer: NavButton ▼]                    │ │
│ │ On: [Click ▼]  →  [Scroll to Section ▼]│ │
│ │ Target section: [Hero ▼]               │ │
│ │                              [× Delete]│ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ [Layer: HamburgerIcon ▼]               │ │
│ │ On: [Click ▼]  →  [Open Menu ▼]       │ │
│ │ Menu layer: [MobileMenu ▼]             │ │
│ │                              [× Delete]│ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Available Action Types:**

| Action | Description |
|---|---|
| Scroll to Section | Smooth-scroll viewport to another stage/section |
| Open Menu | Set `hidden: false` on a designated menu layer |
| Close Menu | Set `hidden: true` on a designated menu layer |
| Toggle Layer | Toggle `hidden` on any layer |
| Navigate to URL | Open link in same or new tab |
| Play Animation | Trigger a specific layer's animation |
| Stop Animation | Stop a specific layer's animation |
| Toggle Animation | Play if stopped / stop if playing |

---

## Trigger Events Reference

### Mouse Triggers (Desktop)
- `click` — single left-click
- `hover` — `mouseenter`
- `hoverEnd` — `mouseleave`
- `dblclick` — double-click (optional, lower priority)

### Touch / Mobile Triggers
- `touchStart` — finger touches element
- `touchEnd` — finger lifts from element

### Scroll Triggers (Viewport Intersection)
- `scroll-into-view` — element crosses the viewport edge (uses `IntersectionObserver`)
- `scroll-out-view` — element exits viewport

### Accessibility Triggers
- `focus` — keyboard focus
- `blur` — keyboard blur

---

## Responsive Breakpoint Conventions

| Breakpoint | Name | Canvas Width | Viewport Rule | Use Case |
|---|---|---|---|---|
| `xlarge` | XL | 1920px | ≥1280px | Desktop wide / full-bleed hero |
| `large` | LG | 1280px | ≥1024px | Standard desktop |
| `medium` | MD | 1024px | ≥768px | Tablet landscape |
| `small` | SM | 768px | ≥640px | Tablet portrait |
| `xsmall` | XS | 390px | <640px | Mobile / iPhone |

**Design Rules:**
- At least one stage per section per breakpoint the design supports
- `xsmall` stages use vertical (portrait) orientation by default
- Stages with the same `name` (section) across breakpoints are linked — changing section name updates all linked stages
- The workspace shows all stages tiled; user can filter by breakpoint using the top toolbar

---

## Properties Panel Sections (Updated Order)

For any selected layer, the Properties panel renders these sections in order:

1. **Layout** — Position (X, Y), Size (W, H), Rotation, Z-index
2. **Transform** — Scale (X, Y, Z), Skew, Transform Origin, Perspective
3. **Appearance** — Opacity, Background, Border, Border Radius, Box Shadow
4. **Typography** *(text layers only)* — Font, Weight, Size, Color, Alignment, Line Height, Letter Spacing
5. **Filters** — Blur, Brightness, Contrast, Grayscale, Sepia, Saturate, Hue Rotate
6. **Hover Style** — CSS interactive effects (shine, pulse, lift, glow, jelly, glitch, shake, reveal, tilt)
7. **Animation** — Entry / Main / Exit selectors, Duration, Easing
   **↳ Playback** sub-section:
   - Auto-Play toggle
   - Loop Count (number input; 0 = infinite)
   - Stop At (time picker or "Play to End")
   - Scroll Trigger toggle
8. **Interactions** — List of `InteractionAction` rows; "Add Interaction" button
9. **Widget** *(widget layers only)* — Custom property fields, Monaco code editor

---

## Design System Reference

### Colors (Tailwind config)

```javascript
"primary":           "#136c6c",   // Teal — primary brand, buttons, focus rings
"background-light":  "#f7f7f8",   // Light mode canvas background
"background-dark":   "#17191c",   // Dark mode / workspace
"entry":             "#10b981",   // Green — timeline entry phase
"middle":            "#3b82f6",   // Blue — timeline main/loop phase
"exit":              "#ef4444",   // Red — timeline exit phase
```

### CSS Variables

```css
--primary:   #136c6c;   /* Teal primary */
--h-bg:      #059669;   /* Default hover background (overridden per button) */
--a-bg:      ...;       /* Active/pressed state background */
```

### Typography

- **Display / UI:** Manrope (Google Fonts, loaded in `index.html`)
- **Weights used:** 400 (body), 600 (label), 700 (heading), 800 (button)
- **Code editor:** Mono — Monaco default

### Spacing / Sizing

- Panel widths: left sidebar `240px`, properties bar `280px`
- Header height: `48px`
- Timeline height: `200px` (animate mode)
- Stage frame border: `2px solid` with breakpoint color coding

### Breakpoint Badge Colors

```javascript
const BREAKPOINT_COLORS: Record<BreakpointName, string> = {
  xlarge: '#7c3aed',  // purple
  large:  '#2563eb',  // blue
  medium: '#059669',  // green
  small:  '#d97706',  // amber
  xsmall: '#dc2626',  // red
};
```

---

## Implementation Guidelines

### Do
- Preserve all existing CSS classes and variables; extend, do not overwrite
- Use `useUndoRedo` for any state change that modifies stages or layers
- Keep all undo-able state in `App.tsx`; lift state up, do not duplicate
- Use `lucide-react` for all icons
- Use Tailwind utility classes for all layout; reserve `App.css` for animation keyframes and CSS variable-dependent rules
- Keep each component file focused; extract sub-components when a section exceeds ~150 lines
- Type every prop, every state, every function parameter — no implicit `any`
- Use `InteractionAction[]` on `Layer` for per-object interaction definitions
- Use `LandingPageAction[]` on `Stage` for navigation and cross-layer triggers
- Implement `IntersectionObserver` for `scroll-into-view` triggers in `LayerPreview.tsx`

### Do Not
- Do not add new state management libraries (no Zustand, Redux, Jotai)
- Do not auto-play animations unless `animationAutoPlay` is explicitly `true`
- Do not use the old `StageAction` type for new features (migrate to `LandingPageAction`)
- Do not write raw CSS files; only `App.css` and `index.css` are CSS files
- Do not add `console.log` statements in production paths
- Do not break the undo/redo system — always `pushToHistory()` before mutating stages
- Do not change the Vite proxy config without confirming the new endpoint
- Do not add `any` type casts; define proper interfaces

---

## File-by-File Change Notes

### `src/App.tsx`
- Replace `StageAction` with `LandingPageAction` in `Stage` interface
- Add `breakpoint: BreakpointName` to `Stage`
- Add `autoPlay`, `loopCount`, `stopAtSecond` to `Stage`
- Add `animationAutoPlay`, `animationLoopCount`, `animationStopAt`, `interactionActions` to `Layer`
- Add `LayerAnimationState` map in component state (`Record<string, LayerAnimationState>`)
- Update `AddStageModal` call to use breakpoint preset selector
- Change default animation behavior: `animationAutoPlay: false` on all new layers

### `src/components/PropertiesBar.tsx`
- Add **"Animation Playback"** sub-section under the existing animation section:
  - Auto-Play toggle (boolean)
  - Loop Count number input (0 = infinite, label "0 = Infinite")
  - Stop At: toggle ("Play to End" / "Stop at time") + time input
  - Scroll Trigger toggle
- Add **"Interactions"** section below animation:
  - List of `InteractionAction` rows (event → action)
  - "Add Interaction" button
  - Remove row button per row
- Remove the old "Interactive Effects" popup trigger for animation; keep it only for CSS hover styles

### `src/components/StageContainer.tsx`
- Display breakpoint badge (pill with `XL`/`LG`/`MD`/`SM`/`XS`) on stage frame
- Read `stage.autoPlay`, `stage.loopCount`, `stage.stopAtSecond` for playback control

### `src/components/LayerPreview.tsx`
- Implement `IntersectionObserver` for `scroll-into-view` trigger
- Listen to `interactionActions` on each layer
- Attach event listeners: `click`, `mouseenter`, `mouseleave`, `touchstart`, `touchend`
- Call animation state dispatch functions instead of auto-starting CSS animations
- Respect `animationAutoPlay`: only auto-start if explicitly `true`
- Respect `animationLoopCount` and `animationStopAt`

### `src/components/AddStageModal.tsx` (or new `AddBreakpointModal.tsx`)
- Replace arbitrary width/height inputs with breakpoint radio buttons
- Keep optional custom size override (advanced)
- Add "Section Name" input (groups stages by name across breakpoints)

### `src/utils/landingPageHelper.ts`
- Add `applyLandingPageAction(action: LandingPageAction, stages: Stage[], layerAnimStates: ...) => void`
- Add `buildScrollTriggerObserver(layerId, callback) => IntersectionObserver`
- Add `getBreakpointForViewport(viewportWidth: number): BreakpointName`

### `src/data/animationData.ts`
- No changes required — existing animation keyframes are reused

---

## Export Format

When exporting a landing page design, the output JSON must include breakpoint metadata:

```json
{
  "version": "2.0",
  "type": "landing-page",
  "sections": [
    {
      "name": "Hero",
      "stages": {
        "xlarge": { "...stage data..." },
        "large":  { "...stage data..." },
        "xsmall": { "...stage data..." }
      }
    }
  ]
}
```

---

## Known Patterns & Gotchas

- **Undo/redo:** Always call `pushToHistory()` immediately before any `setStages()` call that modifies user data. Failure to do so will silently break undo.
- **Layer IDs:** Generated with `crypto.randomUUID()` or `Date.now().toString(36)`. Never reuse IDs when duplicating; always generate new ones.
- **Group layers:** Children are nested in `layer.children[]`. Transform controllers must recursively update children's world coordinates when a group is moved/scaled.
- **Z-index:** Managed explicitly per layer; higher `zIndex` renders on top. Do not use CSS `z-index` auto-calculation.
- **Animation CSS injection:** `animationData.ts` raw `@keyframes` strings are injected into a `<style>` tag at runtime. Do not duplicate keyframe names.
- **Workspace zoom:** The canvas is scaled with `transform: scale(zoom)` with `transform-origin: top left`. All pointer coordinates must be divided by `zoom` when hit-testing.
- **IntersectionObserver:** Must be torn down in a `useEffect` cleanup when the component unmounts or the layerId changes.
- **Touch events:** `e.preventDefault()` must be called on `touchstart` to prevent scroll interference when an interaction action is attached.

---

## Checklist Before Submitting a Change

- [ ] All new interfaces are fully typed (no implicit `any`)
- [ ] Animation auto-play is `false` by default on new layers
- [ ] `pushToHistory()` called before every undo-able mutation
- [ ] Breakpoint badge displays correctly on stage frames
- [ ] Interaction actions list renders in Properties panel
- [ ] Scroll trigger uses `IntersectionObserver` (not scroll event listener)
- [ ] Existing CSS classes and Tailwind config unchanged
- [ ] No new state management libraries added
- [ ] Lucide icons used for all new icons

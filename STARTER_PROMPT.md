# Starter Prompt — AdCropper Landing Page Designer

Paste the following prompt at the beginning of a new session in Antigravity (or any Claude conversation) after attaching this repository and the `CLAUDE.md` file.

---

## Prompt

```
You are working on the AdCropper Landing Page Designer project. The full specification is in CLAUDE.md — read it completely before doing anything else.

This is a React 19 + TypeScript + Vite + Tailwind CSS 3 visual design tool. It was originally built for creating animated banner advertisements. We are transforming it into a landing page design tool. The core visual editor, canvas, layer system, animation engine, and design system must be fully preserved. Only the following things are changing:

1. STAGE → BREAKPOINT
   The "Add Stage" flow must be replaced with an "Add Breakpoint Stage" flow. Instead of entering arbitrary pixel dimensions, the user picks from five responsive breakpoints: xlarge (1920×1080), large (1280×800), medium (1024×768), small (768×1024), xsmall (390×844). Each stage also gets a "Section Name" that groups it with other breakpoints for the same section (e.g. "Hero", "Features"). A breakpoint badge (pill showing XL/LG/MD/SM/XS) must be visible on the stage frame in the workspace.

2. ANIMATION: NO AUTO-PLAY
   Animations must NOT play automatically. Every new layer gets animationAutoPlay: false by default. Users must explicitly turn on auto-play via a toggle in the Properties panel, or configure an InteractionAction (hover, click, touch, scroll-into-view) to trigger playback. The Properties panel Animation section must gain a Playback sub-section with:
   - Auto-Play toggle (boolean, default false)
   - Loop Count number input (0 = infinite, default 1)
   - Stop At: toggle between "Play to End" and a specific time-in-seconds input

3. INTERACTIONS (per-layer, in Properties panel)
   Any layer can have one or more InteractionAction entries. Each action maps a user gesture (click, hover, hoverEnd, touchStart, touchEnd, focus, blur, scroll-into-view) to an animation command (play-entry, play-main, play-exit, play-all, stop, pause, resume, reset). The Properties panel must show a new "Interactions" section with an "Add Interaction" button and a row per action showing the event → action mapping with a delete button. Scroll-into-view must use IntersectionObserver.

4. LANDING PAGE ACTIONS (stage-level, in stage properties)
   Replace the old StageAction system with LandingPageAction. These actions connect a trigger on a specific layer to a page-level behavior: scroll-to-section, open-menu, close-menu, toggle-layer, navigate-url, play-animation, stop-animation, toggle-animation. The stage properties panel (shown when no layer is selected) must display an "Actions" tab listing these with an "Add Action" button.

The existing CSS, Tailwind config, color palette, design tokens, icon library (lucide-react), animation engine (animationData.ts + animations.ts), undo/redo system (useUndoRedo), widget system, and all other functionality must remain intact.

Implementation order:
1. Update TypeScript interfaces in App.tsx (Stage, Layer, add new action types)
2. Update AddStageModal (or create AddBreakpointModal) with breakpoint presets + section name
3. Add breakpoint badge to StageContainer
4. Add Playback sub-section + Interactions section to PropertiesBar
5. Update LayerPreview to respect animationAutoPlay and wire up interaction event listeners + IntersectionObserver
6. Update landing page actions UI in stage properties (LandingPageAction list)
7. Add helper functions to landingPageHelper.ts

Always use pushToHistory() before any setStages() mutation. Never add new state libraries. All new interfaces must be fully typed. Refer to CLAUDE.md for the complete type definitions, UI specs, and implementation rules.

Start by reading CLAUDE.md, then show me your plan for step 1 (interface updates in App.tsx).
```

---

## Tips for Antigravity Sessions

- **Attach files:** Include `CLAUDE.md`, `src/App.tsx`, and the specific component you are working on in each session context.
- **One step at a time:** The starter prompt asks Claude to plan step 1 before touching code. Approve the plan before saying "proceed".
- **Context refresh:** If the session grows long, start a new session and paste the starter prompt again. All design decisions are captured in `CLAUDE.md`.
- **Interface changes first:** Always finalize TypeScript interface changes in `App.tsx` before editing components — this prevents cascading type errors.
- **Test undo/redo early:** After any stage/layer mutation change, manually test that Ctrl+Z works correctly. If it doesn't, `pushToHistory()` was likely missing.

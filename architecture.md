# Aliens Attack: System Architecture & Specification

## 0. Status

### Done

- **Canvas Rendering Core:** 9:16 vertical viewport abstraction rendered to HTML5 2D Canvas with letterboxing on wide displays.
- **Vector Entity Pipeline:** Procedural geometric rendering for player fighter, three alien tiers (Scouts, Cruisers, Dreadnoughts), plasma projectiles, and block-degrading barrier bunkers.
- **Game Loop & State Machine:** Discrete state transitions (`MENU`, `PLAYING`, `PAUSED`, `WAVE_TRANSITION`, `GAME_OVER`) running on `requestAnimationFrame`.
- **Input Layer — Keyboard & Touch:** Desktop keyboard listeners alongside virtual touch controls (touchpad buttons, drag-to-aim slider option, touch event prevention for pull-to-refresh).
- **Input Layer — Gamepad API:** Controller polling loop with deadzone filtering (0.2 threshold), button debouncing, and dynamic input source switching (auto-hiding mobile overlays on controller activity).
- **Audio Engine (Web Audio API):** Hardware-accurate synthesized sound:
- 4-step descending square-wave bass march (58.7 Hz, 55.0 Hz, 51.9 Hz, 49.0 Hz) passed through a 200 Hz low-pass filter with exponential gain decay.
- Inverse linear tempo scaling accelerating the march interval from 900 ms down to 120 ms based on remaining enemies.
- Snappy exponential downward pitch sweep (950 Hz to 120 Hz) for earth cannon firing.

- **Local Persistence:** Local-first high score and audio/control preference storage via browser `localStorage`.

### TODO

- **Service Worker & Caching:** Register service worker utilizing Cache API for full offline execution and asset immutability.
- **Web App Manifest:** Provision `manifest.json` targeting `display: standalone`, `orientation: portrait`, theme colors, and adaptive SVG/PNG icons.
- **Screen Wake Lock:** Implement `navigator.wakeLock` request lifecycle to prevent mobile displays from timing out during active gameplay.
- **Object Pooling:** Implement allocation-free object pools for projectile entities and particle burst debris to eliminate garbage collection stutters on resource-constrained mobile engines.
- **Audio Lifecycle Recovery:** Add automated context resumption handlers for mobile browsers when returning from background states (`visibilitychange`).
- **Input Mapping Settings:** Expose a calibration overlay allowing custom keyboard key rebinding and gamepad button re-indexing.

---

## 1. System Overview

"Aliens Attack" operates as a single-page, zero-dependency runtime application designed around three decoupled functional planes:

1. **Host Environment (React / DOM):** Mounts container chrome, renders accessibility overlays, manages persistent settings dialogs, and coordinates PWA installation events.
2. **Deterministic Game Engine (Vanilla JS / Canvas 2D):** Encapsulates physics, collision detection, entity state arrays, and rendering on a tick-based timestep.
3. **Hardware I/O Abstraction:** Bridges the engine directly to the Web Audio context, Gamepad API, Touch/Pointer events, and `localStorage`.

```
+-------------------------------------------------------------------+
|                        Host DOM / React Shell                     |
|  +--------------------+  +------------------+  +---------------+  |
|  | Installation Banner|  | Settings / Pause |  | Touch Control |  |
|  | (PWA Prompts)      |  | HUD Overlay      |  | Overlays      |  |
|  +--------------------+  +------------------+  +---------------+  |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                        Aliens Attack Engine                       |
|                                                                   |
|   +-----------------------------------------------------------+   |
|   |                  requestAnimationFrame Loop                |   |
|   |   +------------------+ +-----------------+ +----------+   |   |
|   |   | Input Polling    | | State Simulation| | 2D Canvas|   |   |
|   |   | (Keys/Pad/Touch) | | & Collisions    | | Renderer |   |   |
|   |   +------------------+ +-----------------+ +----------+   |   |
|   +-----------------------------------------------------------+   |
+-------------------------------------------------------------------+
           |                                      |
           v                                      v
+-----------------------+              +-----------------------+
|    Web Audio API      |              | Local-First Storage   |
| (Dynamic Synthesizer) |              | (localStorage Engine) |
+-----------------------+              +-----------------------+

```

---

## 2. Component & Subsystem Architecture

### 2.1 Virtual Canvas & Scaling Subsystem

- **Internal Resolution:** Normalized fixed coordinate space ($360 \times 640$ points).
- **Viewport Scaling:** Canvas uses CSS letterboxing (`object-fit: contain`) to preserve a strict 9:16 ratio on arbitrary screen dimensions while matching device pixel ratios via `window.devicePixelRatio`.
- **Rendering Loop:** Clear canvas per tick, traverse active entity buffers in Z-order:

1. Starfield / background particles
2. Shield barrier grids
3. Enemy matrix
4. Player ship and thrust vectors
5. Active projectiles (player and alien)
6. Particle burst debris
7. HUD layer (score, wave, lives)

### 2.2 Input Pipeline

Inputs are collected per frame through an abstracted `InputState` interface:

- **State Vector:** `{ moveX: number (-1.0 to 1.0), fire: boolean, pause: boolean }`
- **Keyboard Provider:** Tracks `keydown` / `keyup` bitmasks for standard arrows and WASD.
- **Touch Provider:** Tracks PointerEvents from virtual touch buttons or a continuous horizontal drag zone. Suppresses default gesture actions (`touch-action: none`).
- **Gamepad Provider:** Polls `navigator.getGamepads()` during the input phase. Applies an axis deadzone filter:

$$\text{axisVal} = \vert{}\text{rawAxis}\vert{} < 0.2 \ ? \ 0 : \text{rawAxis}$$

Reads digital buttons for face inputs and triggers. Automatically toggles DOM touch controls to `hidden` when active gamepad inputs are detected.

### 2.3 Collision & Entity Matrix

- **Alien Grid:** Represented as a 2D bounding grid with unified directional velocity vector $(\vec{v}_x, \vec{v}_y)$. Reversal and drop occurs when the outermost living column encounters virtual boundaries ($x \le 10$ or $x \ge 350$).
- **Destructible Barriers:** Each of the 3 bunkers is an array of $4 \times 4$ pixel sub-blocks with binary hit states. Projectiles perform discrete bounding box checks against individual sub-blocks, destroying colliding elements without recalculating whole-bunker geometry.
- **Broad-Phase Pruning:** Axis-Aligned Bounding Box (AABB) checks limit intersection testing exclusively to projectiles located within the active Y-coordinates of the alien rack and bunker positions.

### 2.4 Procedural Audio Subsystem

Audio runs exclusively via procedural Web Audio nodes, eliminating network latency and external audio asset decoding:

- **Node Graph Architecture:**
- **Master Bus:** Connects all sources through a Master Gain Node to `AudioContext.destination`.
- **Marching Engine:** Oscillators instantiated on-demand per step; uses single-pole low-pass filters with tight gain envelopes to generate bass clicks without DC offset artifacts.
- **Laser Synthesizer:** Parameterized linear/exponential audio ramps applied to an active oscillator frequency property, freeing nodes immediately on playback completion.

---

## 3. Data & Storage Model

All persistent variables operate without external server dependencies:

```json
{
  "aliens_attack_save_v1": {
    "highScore": 14250,
    "lastWave": 6,
    "preferences": {
      "soundEnabled": true,
      "controlMode": "buttons", // "buttons" | "slider"
      "haptics": true
    }
  }
}
```

- Storage writes are debounced and executed strictly during transition states (`GAME_OVER`, settings toggle) to prevent disk I/O blocking during active frame loops.

---

## 4. PWA & Offline Strategy

- **Manifest Profile:** Configured as a standalone web application disabling standard browser chrome, locking orientation to portrait, and supplying high-DPI maskable icons.
- **Service Worker Lifecycle:**
- `install`: Pre-caches HTML, inline scripts, styles, and manifest definition.
- `activate`: Purges obsolete cache versions.
- `fetch`: Strict Cache-First policy for local resources, providing instant offline execution.

- **Device Event Guards:** Global event interception on canvas containers prevents mobile swipe-to-back, page-zoom gestures, and context menu triggers on long-press.

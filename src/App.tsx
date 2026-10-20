import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Gamepad2,
  Keyboard,
  MoveHorizontal,
  Play,
  RotateCcw,
  Skull,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { AudioEngine } from '@/lib/audio';
import { loadSettings, saveSettings, type Settings } from '@/lib/storage';
import { GameEngine } from '@/game/engine';
import { LOGICAL_H, LOGICAL_W } from '@/game/constants';
import type { PublicState } from '@/game/types';

const INITIAL_STATE: PublicState = {
  status: 'menu',
  score: 0,
  highScore: 0,
  wave: 1,
  lives: 3,
  newHigh: false,
  multiplier: 1,
};

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-slate-900/70 border border-cyan-500/20 px-3 py-1.5 min-w-[68px]">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </span>
      <span
        className="text-lg font-bold leading-tight tabular-nums"
        style={{ color: accent ?? '#67e8f9' }}
      >
        {value}
      </span>
    </div>
  );
}

function MultiplierBadge({ multiplier }: { multiplier: number }) {
  if (multiplier <= 1) return null;
  return (
    <span
      className="text-xs font-black px-1.5 py-0.5 rounded animate-pulse-glow tabular-nums"
      style={{
        color: '#fde047',
        background: 'rgba(253, 224, 71, 0.12)',
        border: '1px solid rgba(253, 224, 71, 0.4)',
      }}
    >
      x{multiplier}
    </span>
  );
}

function LivesDisplay({ lives }: { lives: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-slate-900/70 border border-cyan-500/20 px-3 py-1.5 min-w-[68px]">
      <span className="text-[10px] uppercase tracking-widest text-slate-400">Lives</span>
      <span className="flex gap-1 h-6 items-center">
        {Array.from({ length: 3 }).map((_, i) => (
          <Gamepad2
            key={i}
            size={14}
            className={i < lives ? 'text-cyan-400' : 'text-slate-700'}
          />
        ))}
      </span>
    </div>
  );
}

function SettingsRow({
  settings,
  onUpdate,
}: {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onUpdate({ sound: !settings.sound })}
        className="neon-btn h-10 w-10 text-cyan-300 border-cyan-500/30 bg-slate-900/60"
        aria-label={settings.sound ? 'Mute sound' : 'Unmute sound'}
      >
        {settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      <button
        onClick={() => onUpdate({ haptics: !settings.haptics })}
        className="neon-btn h-10 w-10 text-cyan-300 border-cyan-500/30 bg-slate-900/60"
        aria-label={settings.haptics ? 'Disable haptics' : 'Enable haptics'}
      >
        <Zap size={16} className={settings.haptics ? '' : 'opacity-40'} />
      </button>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const [state, setState] = useState<PublicState>(INITIAL_STATE);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  );
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  );
  const [gpActive, setGpActive] = useState(false);
  const [gpToast, setGpToast] = useState<string | null>(null);
  const [touchOverride, setTouchOverride] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const pullRef = useRef({ y: 0, tracking: false, fired: false });

  // engine bootstrap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const engine = new GameEngine(ctx, audioRef.current);
    engine.onState = setState;
    engine.onGamepadActivity = (active) => {
      setGpActive(active);
      if (!active) setTouchOverride(false);
    };
    engine.setHaptics(settings.haptics);
    audioRef.current.enabled = settings.sound;
    engineRef.current = engine;
    setState((s) => ({ ...s, highScore: engine.getPublicState().highScore }));
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // canvas DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(
          (rect.width * dpr) / LOGICAL_W,
          0,
          0,
          (rect.height * dpr) / LOGICAL_H,
          0,
          0
        );
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // pointer kind tracking
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const check = () => setIsTouch(mq.matches);
    check();
    mq.addEventListener?.('change', check);
    return () => mq.removeEventListener?.('change', check);
  }, []);

  // wide layout (HUD strip + side hints) vs compact in-frame layout
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const check = () => setIsWide(mq.matches);
    check();
    mq.addEventListener?.('change', check);
    return () => mq.removeEventListener?.('change', check);
  }, []);

  // borderless edge-to-edge frame while in fullscreen
  useEffect(() => {
    const check = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', check);
    return () => document.removeEventListener('fullscreenchange', check);
  }, []);

  // keyboard bindings
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      // any key (except another ESC) resumes from pause
      if (engine.status === 'paused' && e.key !== 'Escape' && !e.repeat) {
        e.preventDefault();
        engine.togglePause();
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          engine.setMove('left', true);
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          engine.setMove('right', true);
          e.preventDefault();
          break;
        case ' ':
          // secret: space starts a game from menu / game over
          if (engine.status === 'menu' || engine.status === 'gameOver') {
            audioRef.current.uiClick();
            engine.startGame();
          } else {
            engine.setFire(true);
          }
          e.preventDefault();
          break;
        case 'Escape':
          if (engine.status === 'playing') {
            engine.togglePause();
          } else if (engine.status === 'paused') {
            engine.toMenu();
          }
          e.preventDefault();
          break;
        case 'Enter':
          if (engine.status === 'menu' || engine.status === 'gameOver') {
            audioRef.current.uiClick();
            engine.startGame();
          }
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          engine.setMove('left', false);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          engine.setMove('right', false);
          break;
        case ' ':
          engine.setFire(false);
          break;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // gamepad connection lifecycle + toast
  useEffect(() => {
    const showToast = (id: string) => {
      setGpToast(id);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setGpToast(null), 2600);
    };
    const connected = (e: Event) => {
      const gp = (e as GamepadEvent).gamepad;
      showToast(gp?.id ?? 'Controller');
      navigator.vibrate?.(20);
    };
    const disconnected = () => setGpActive(false);
    window.addEventListener('gamepadconnected', connected);
    window.addEventListener('gamepaddisconnected', disconnected);
    return () => {
      window.removeEventListener('gamepadconnected', connected);
      window.removeEventListener('gamepaddisconnected', disconnected);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  // any screen touch restores on-screen controls while a gamepad is active
  useEffect(() => {
    const onTouch = () => setTouchOverride(true);
    window.addEventListener('pointerdown', onTouch);
    return () => window.removeEventListener('pointerdown', onTouch);
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      audioRef.current.enabled = next.sound;
      engineRef.current?.setHaptics(next.haptics);
      return next;
    });
  };

  const buzz = (pattern: number | number[]) => {
    if (settings.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const startGame = () => {
    audioRef.current.uiClick();
    buzz(15);
    engineRef.current?.startGame();
  };

  const toMenu = () => {
    audioRef.current.uiClick();
    engineRef.current?.toMenu();
  };

  const holdProps = (dir: 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      engineRef.current?.setMove(dir, true);
      buzz(8);
    },
    onPointerUp: () => engineRef.current?.setMove(dir, false),
    onPointerCancel: () => engineRef.current?.setMove(dir, false),
    onPointerLeave: () => engineRef.current?.setMove(dir, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const fireProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      engineRef.current?.setFire(true);
      engineRef.current?.tapFire();
      buzz(12);
    },
    onPointerUp: () => engineRef.current?.setFire(false),
    onPointerCancel: () => engineRef.current?.setFire(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  const sliderProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
      engineRef.current?.setAim(x);
      engineRef.current?.setFire(true);
      buzz(8);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1) && e.pointerType === 'mouse') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
      engineRef.current?.setAim(x);
    },
    onPointerUp: () => {
      engineRef.current?.setAim(null);
      engineRef.current?.setFire(false);
    },
    onPointerCancel: () => {
      engineRef.current?.setAim(null);
      engineRef.current?.setFire(false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  // two-stage pull-down on the play area: first full pull pauses, second quits
  const pullProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (engine.status !== 'playing' && engine.status !== 'paused') return;
      if ((e.target as HTMLElement).closest('button')) return;
      pullRef.current = { y: e.clientY, tracking: true, fired: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const p = pullRef.current;
      if (!p.tracking || p.fired) return;
      const dy = e.clientY - p.y;
      const progress = dy <= 0 ? 0 : Math.min(1, dy / 110);
      setPullProgress(progress);
      if (progress >= 1) {
        p.fired = true;
        setPullProgress(0);
        const engine = engineRef.current;
        if (!engine) return;
        if (engine.status === 'playing') {
          buzz(10);
          engine.togglePause();
        } else if (engine.status === 'paused') {
          buzz(15);
          engine.toMenu();
        }
      }
    },
    onPointerUp: () => {
      pullRef.current.tracking = false;
      setPullProgress(0);
    },
    onPointerCancel: () => {
      pullRef.current.tracking = false;
      setPullProgress(0);
    },
  };

  const playing = state.status === 'playing';
  const { status } = state;

  return (
    <div
      className="h-[100dvh] w-full arcade-bg flex items-center justify-center overflow-hidden"
      style={{ overscrollBehavior: 'none' }}
    >
      <div
        className={
          isWide
            ? 'flex h-full w-full max-w-[1200px] gap-4 px-5'
            : 'flex flex-col h-full w-full'
        }
        style={
          isWide
            ? undefined
            : {
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2px)',
                paddingLeft: 2,
              }
        }
      >
        {isWide && (
          <aside className="flex flex-col justify-center gap-3 w-[128px] shrink-0">
            <StatPill
              icon={<Crosshair size={11} />}
              label="Score"
              value={
                <span className="flex items-center gap-1">
                  {state.score}
                  <MultiplierBadge multiplier={state.multiplier} />
                </span>
              }
              accent="#67e8f9"
            />
            <StatPill
              icon={<Trophy size={11} />}
              label="Best"
              value={state.highScore}
              accent="#fde047"
            />
            <StatPill icon={<Zap size={11} />} label="Wave" value={state.wave} accent="#e879f9" />
            <LivesDisplay lives={state.lives} />
            {gpActive && (
              <span
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300 animate-pulse-glow"
                title="Gamepad active"
              >
                <Gamepad2 size={12} /> Pad
              </span>
            )}
          </aside>
        )}

        {/* Play area — flush to the viewport vertically; borderless in fullscreen */}
        <main className="flex-1 min-h-0 flex">
          <div
            {...pullProps}
            className={
              isWide || !isFullscreen
                ? 'relative w-full h-full rounded-xl overflow-hidden border-2 shadow-[0_0_32px_rgba(34,211,238,0.15)]'
                : 'relative w-full h-full overflow-hidden'
            }
            style={{
              borderColor: 'rgba(34, 211, 238, 0.35)',
              touchAction: 'none',
            }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />

            {/* Compact in-frame HUD (narrow screens) */}
            {!isWide && (
              <div className="absolute top-1.5 inset-x-2 z-30 flex items-center justify-between pointer-events-none">
                <span className="flex items-center gap-1 rounded bg-slate-950/60 px-2 py-0.5 text-xs font-bold tabular-nums text-cyan-300">
                  {state.score}
                  <MultiplierBadge multiplier={state.multiplier} />
                </span>
                <div className="flex items-center gap-1">
                  <span className="rounded bg-slate-950/60 px-2 py-0.5 text-xs font-bold tabular-nums text-yellow-300">
                    {state.highScore}
                  </span>
                  <span className="rounded bg-slate-950/60 px-2 py-0.5 text-xs font-bold tabular-nums text-fuchsia-300">
                    W{state.wave}
                  </span>
                  <span className="flex items-center gap-0.5 rounded bg-slate-950/60 px-2 py-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Gamepad2
                        key={i}
                        size={10}
                        className={i < state.lives ? 'text-cyan-400' : 'text-slate-700'}
                      />
                    ))}
                  </span>
                  {gpActive && (
                    <Gamepad2 size={12} className="text-emerald-300 animate-pulse-glow" />
                  )}
                </div>
              </div>
            )}

            {/* In-frame keyboard hint (narrow desktop) */}
            {!isWide && !isTouch && (
              <div className="absolute bottom-2 inset-x-0 z-30 flex justify-center pointer-events-none">
                <span className="flex items-center gap-1.5 rounded-full bg-slate-950/60 px-3 py-1 text-[10px] text-slate-400">
                  <Keyboard size={11} /> Arrows / A-D to move — Spacebar to fire
                </span>
              </div>
            )}

            {/* Menu */}
            {status === 'menu' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in px-6">
                <div className="text-center">
                  <h1
                    className="text-5xl font-black tracking-tight"
                    style={{ color: '#22d3ee', textShadow: '0 0 24px rgba(34, 211, 238, 0.55)' }}
                  >
                    ALIENS
                    <br />
                    ATTACK
                  </h1>
                  <p className="mt-3 text-sm text-slate-400 tracking-widest uppercase">
                    Neon Arcade Shooter
                  </p>
                </div>
                <button
                  onClick={startGame}
                  className="neon-btn h-12 px-8 text-base font-bold bg-cyan-500/15 text-cyan-300 border-cyan-400/50 hover:bg-cyan-500/25"
                >
                  <Play size={18} />
                  Start Game
                </button>
                <SettingsRow settings={settings} onUpdate={updateSettings} />
                <button
                  onClick={() =>
                    updateSettings({
                      controlMode: settings.controlMode === 'buttons' ? 'slider' : 'buttons',
                    })
                  }
                  className="neon-btn h-10 px-4 text-xs text-cyan-300 border-cyan-500/30 bg-slate-900/60"
                >
                  {settings.controlMode === 'buttons' ? (
                    <>
                      <MoveHorizontal size={14} /> Switch to Drag Slider
                    </>
                  ) : (
                    <>
                      <Gamepad2 size={14} /> Switch to Buttons
                    </>
                  )}
                </button>
                <div className="flex flex-col items-center gap-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Keyboard size={13} /> Arrows / A-D — Space to fire
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Gamepad2 size={13} /> Touch controls on mobile
                  </span>
                </div>
                {state.highScore > 0 && (
                  <p className="text-xs text-yellow-300/80 tabular-nums">
                    High Score: {state.highScore}
                  </p>
                )}
              </div>
            )}

            {/* Paused */}
            {status === 'paused' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/85 backdrop-blur-sm animate-fade-in cursor-pointer"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  engineRef.current?.togglePause();
                }}
              >
                <h2 className="text-3xl font-bold text-cyan-300 tracking-widest">PAUSED</h2>
                <p className="text-xs text-slate-400">Tap anywhere to resume</p>
                <SettingsRow settings={settings} onUpdate={updateSettings} />
                <button
                  onClick={toMenu}
                  className="neon-btn h-10 px-5 text-sm text-slate-300 border-slate-600/50 bg-slate-900/60"
                >
                  <RotateCcw size={14} />
                  Quit to Menu
                </button>
              </div>
            )}

            {/* Wave clear */}
            {status === 'waveClear' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-[2px] animate-fade-in pointer-events-none">
                <h2
                  className="text-3xl font-black tracking-widest"
                  style={{ color: '#4ade80', textShadow: '0 0 20px rgba(74, 222, 128, 0.6)' }}
                >
                  WAVE {state.wave} CLEAR
                </h2>
                <p className="text-cyan-300 text-sm tabular-nums">+{100 * state.wave} bonus</p>
                <p className="text-xs text-slate-400 animate-pulse-glow">Next wave incoming…</p>
              </div>
            )}

            {/* Game over */}
            {status === 'gameOver' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/85 backdrop-blur-sm animate-fade-in px-6">
                <Skull size={40} className="text-rose-400" />
                <h2
                  className="text-4xl font-black tracking-widest"
                  style={{ color: '#fb7185', textShadow: '0 0 24px rgba(251, 113, 133, 0.5)' }}
                >
                  GAME OVER
                </h2>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Score</p>
                    <p className="text-2xl font-bold text-cyan-300 tabular-nums">{state.score}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Best</p>
                    <p className="text-2xl font-bold text-yellow-300 tabular-nums">
                      {state.highScore}
                    </p>
                  </div>
                </div>
                {state.newHigh && (
                  <p
                    className="text-sm font-bold text-yellow-300 animate-pulse-glow"
                    style={{ textShadow: '0 0 12px rgba(253, 224, 71, 0.6)' }}
                  >
                    NEW HIGH SCORE!
                  </p>
                )}
                <button
                  onClick={startGame}
                  className="neon-btn h-12 px-8 font-bold bg-cyan-500/15 text-cyan-300 border-cyan-400/50"
                >
                  <Play size={18} />
                  Play Again
                </button>
                <button
                  onClick={toMenu}
                  className="neon-btn h-10 px-5 text-sm text-slate-300 border-slate-600/50 bg-slate-900/60"
                >
                  <RotateCcw size={14} />
                  Main Menu
                </button>
              </div>
            )}
            {/* Pull-down gesture indicator */}
            {(pullProgress > 0 || (isTouch && playing && !gpActive)) && (
              <div
                className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                style={{
                  opacity:
                    pullProgress > 0 ? 0.55 + 0.45 * pullProgress : 0.3,
                }}
              >
                <div className="flex items-center gap-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 px-3 py-1">
                  <ArrowDown
                    size={12}
                    className="text-cyan-300 transition-transform"
                    style={{ transform: `translateY(${pullProgress * 3}px)` }}
                  />
                  <span className="text-[10px] uppercase tracking-widest text-cyan-200">
                    {state.status === 'paused'
                      ? 'Pull down to quit'
                      : 'Pull down to pause'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Hints in the right bottom quadrant (wide screens) */}
        {isWide && !isTouch && (
          <aside className="flex flex-col justify-end items-start w-[180px] shrink-0 gap-2 pb-10 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Keyboard size={13} /> Arrows / A-D — move
            </span>
            <span className="flex items-center gap-1.5">
              <Crosshair size={13} /> Space — fire
            </span>
            {gpActive && (
              <span className="flex items-center gap-1.5 text-emerald-300/80">
                <Gamepad2 size={13} /> Controller active
              </span>
            )}
          </aside>
        )}

        {/* Gamepad connected toast */}
        {gpToast && (
          <div className="fixed left-1/2 -translate-x-1/2 z-50 animate-fade-in" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-slate-900/90 px-4 py-2 shadow-lg backdrop-blur-sm">
              <Gamepad2 size={16} className="text-emerald-300" />
              <span className="text-xs font-semibold text-emerald-200">Controller Connected</span>
              <span className="max-w-[180px] truncate text-[10px] text-slate-400" title={gpToast}>
                {gpToast}
              </span>
            </div>
          </div>
        )}

        {/* Controls */}
        <footer
          className="px-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
        >
          {isTouch && !(gpActive && !touchOverride) && (
            settings.controlMode === 'buttons' ? (
              <div className="flex items-center justify-center gap-3 py-1">
                <button
                  {...holdProps('left')}
                  disabled={!playing}
                  className="neon-btn h-16 w-20 text-cyan-300 border-cyan-500/40 bg-slate-900/70"
                  aria-label="Move left"
                >
                  <ChevronLeft size={30} />
                </button>
                <button
                  {...fireProps}
                  disabled={!playing}
                  className="neon-btn h-16 flex-1 max-w-[170px] font-bold tracking-widest text-fuchsia-300 border-fuchsia-500/50 bg-fuchsia-500/10"
                  aria-label="Fire"
                >
                  FIRE
                </button>
                <button
                  {...holdProps('right')}
                  disabled={!playing}
                  className="neon-btn h-16 w-20 text-cyan-300 border-cyan-500/40 bg-slate-900/70"
                  aria-label="Move right"
                >
                  <ChevronRight size={30} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-1">
                <div
                  {...sliderProps}
                  data-control-surface
                  className="flex-1 h-16 rounded-lg border border-fuchsia-500/40 bg-slate-900/70 relative overflow-hidden"
                  aria-label="Drag to aim and fire"
                >
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <ChevronLeft size={18} className="text-slate-600" />
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
                      <MoveHorizontal size={12} /> Drag to aim
                    </span>
                    <ChevronRight size={18} className="text-slate-600" />
                  </div>
                </div>
              </div>
            )
          )}
        </footer>
      </div>
    </div>
  );
}

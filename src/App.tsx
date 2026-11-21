import { useEffect, useState } from 'react';
import { createDefaultConfig } from './butterfly/flightEngine';
import {
  BUTTERFLY_PRESETS,
  ButterflyConfig,
  ButterflyPresetId,
} from './butterfly/types';
import { ButterflyStage } from './components/ButterflyStage';
import { MotionControls } from './components/MotionControls';

export default function App() {
  const [activePreset, setActivePreset] = useState<ButterflyPresetId | 'custom'>('drift');
  const [config, setConfig] = useState<ButterflyConfig>(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return createDefaultConfig(prefersReduced);
  });
  const [paused, setPaused] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [showPinboardGrid, setShowPinboardGrid] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setConfig((prev) => ({ ...prev, reducedMotion: event.matches }));
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const handleSelectPreset = (presetId: ButterflyPresetId) => {
    setActivePreset(presetId);
    setConfig((prev) => ({
      ...prev,
      ...BUTTERFLY_PRESETS[presetId].config,
      scale: prev.scale,
    }));
  };

  const handleChangeConfig = (patch: Partial<ButterflyConfig>) => {
    if (
      patch.followGentleness !== undefined ||
      patch.unevenness !== undefined ||
      patch.wingCadence !== undefined
    ) {
      setActivePreset('custom');
    }
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleReset = () => {
    setActivePreset('drift');
    setConfig((prev) => ({
      ...prev,
      ...BUTTERFLY_PRESETS.drift.config,
    }));
    setPaused(false);
    setResetToken((n) => n + 1);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Minimal quiet title whisper in top-left, keeping the paper open and peaceful */}
      <header className="pointer-events-none fixed top-6 left-7 z-10 max-w-md">
        <h1 className="font-editorial text-[22px] sm:text-[26px] font-normal tracking-tight text-[#243447] leading-tight">
          Butterfly Study
        </h1>
        <p className="mt-1 text-xs sm:text-[13px] text-[#5F748C] leading-relaxed">
          Move gently to guide it <span aria-hidden="true">·</span> Click anywhere to invite it to rest
        </p>
      </header>

      <ButterflyStage
        config={config}
        paused={paused}
        showTrail={showTrail}
        showPinboardGrid={showPinboardGrid}
        resetToken={resetToken}
      />

      <MotionControls
        activePreset={activePreset}
        config={config}
        paused={paused}
        showTrail={showTrail}
        showPinboardGrid={showPinboardGrid}
        panelOpen={panelOpen}
        onSelectPreset={handleSelectPreset}
        onChangeConfig={handleChangeConfig}
        onTogglePaused={() => setPaused((p) => !p)}
        onToggleTrail={() => setShowTrail((t) => !t)}
        onTogglePinboardGrid={() => setShowPinboardGrid((g) => !g)}
        onTogglePanel={() => setPanelOpen((o) => !o)}
        onReset={handleReset}
      />
    </main>
  );
}

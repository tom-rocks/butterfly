import { Pause, Play, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import {
  BUTTERFLY_PRESETS,
  ButterflyConfig,
  ButterflyPresetId,
} from '../butterfly/types';

interface MotionControlsProps {
  activePreset: ButterflyPresetId | 'custom';
  config: ButterflyConfig;
  paused: boolean;
  showTrail: boolean;
  showPinboardGrid: boolean;
  panelOpen: boolean;
  onSelectPreset: (preset: ButterflyPresetId) => void;
  onChangeConfig: (patch: Partial<ButterflyConfig>) => void;
  onTogglePaused: () => void;
  onToggleTrail: () => void;
  onTogglePinboardGrid: () => void;
  onTogglePanel: () => void;
  onReset: () => void;
}

const PRESET_ORDER: ButterflyPresetId[] = ['drift', 'breeze', 'rest'];

export function MotionControls({
  activePreset,
  config,
  paused,
  showTrail,
  showPinboardGrid,
  panelOpen,
  onSelectPreset,
  onChangeConfig,
  onTogglePaused,
  onToggleTrail,
  onTogglePinboardGrid,
  onTogglePanel,
  onReset,
}: MotionControlsProps) {
  return (
    <>
      {/* Collapsible Motion Tuning Panel — docked to bottom-right on desktop to keep center canvas clear */}
      {panelOpen && (
        <section
          data-ui-control="true"
          aria-label="Motion tuning controls"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-20 w-[328px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#FDFCFA]/95 backdrop-blur-md border border-[#59789c]/16 shadow-[0_14px_36px_-18px_rgba(36,52,71,0.18)] p-5 text-[#243447]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-tight text-[#243447]">
              Motion study
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onReset}
                aria-label="Reset butterfly motion"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5F748C] hover:text-[#243447] hover:bg-[#59789c]/8 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c]"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={onTogglePanel}
                aria-label="Close motion tuning panel"
                className="inline-flex items-center justify-center w-8 h-8 text-[#5F748C] hover:text-[#243447] hover:bg-[#59789c]/8 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Follow Gentleness */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-follow" className="font-medium text-[#243447]">
                  Cursor pull
                </label>
                <span className="font-mono-tabular text-[#5F748C]">
                  {Math.round(config.followGentleness * 100)}%
                </span>
              </div>
              <input
                id="slider-follow"
                type="range"
                min={0.2}
                max={1.0}
                step={0.02}
                value={config.followGentleness}
                onChange={(e) =>
                  onChangeConfig({ followGentleness: Number(e.target.value) })
                }
                className="studio-slider"
              />
            </div>

            {/* Uneven Flutter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-uneven" className="font-medium text-[#243447]">
                  Uneven flutter
                </label>
                <span className="font-mono-tabular text-[#5F748C]">
                  {Math.round(config.unevenness * 100)}%
                </span>
              </div>
              <input
                id="slider-uneven"
                type="range"
                min={0.15}
                max={1.0}
                step={0.02}
                value={config.unevenness}
                onChange={(e) =>
                  onChangeConfig({ unevenness: Number(e.target.value) })
                }
                className="studio-slider"
              />
            </div>

            {/* Wing Cadence */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-cadence" className="font-medium text-[#243447]">
                  Wing cadence
                </label>
                <span className="font-mono-tabular text-[#5F748C]">
                  {config.wingCadence.toFixed(1)} Hz
                </span>
              </div>
              <input
                id="slider-cadence"
                type="range"
                min={1.6}
                max={5.6}
                step={0.1}
                value={config.wingCadence}
                onChange={(e) =>
                  onChangeConfig({ wingCadence: Number(e.target.value) })
                }
                className="studio-slider"
              />
            </div>

            {/* Scale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-scale" className="font-medium text-[#243447]">
                  Size
                </label>
                <span className="font-mono-tabular text-[#5F748C]">
                  {config.scale.toFixed(2)}x
                </span>
              </div>
              <input
                id="slider-scale"
                type="range"
                min={0.4}
                max={1.5}
                step={0.05}
                value={config.scale}
                onChange={(e) =>
                  onChangeConfig({ scale: Number(e.target.value) })
                }
                className="studio-slider"
              />
            </div>

            <div className="pt-3 border-t border-[#59789c]/12 flex items-center justify-between gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={showTrail}
                onClick={onToggleTrail}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c] ${
                  showTrail
                    ? 'bg-[#59789c] text-[#FDFCFA] border-[#59789c]'
                    : 'bg-transparent text-[#435e7d] border-[#59789c]/22 hover:bg-[#59789c]/8'
                }`}
              >
                Flight path
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={showPinboardGrid}
                onClick={onTogglePinboardGrid}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c] ${
                  showPinboardGrid
                    ? 'bg-[#59789c] text-[#FDFCFA] border-[#59789c]'
                    : 'bg-transparent text-[#435e7d] border-[#59789c]/22 hover:bg-[#59789c]/8'
                }`}
              >
                Pinboard grid
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Whisper-quiet bottom control dock */}
      <nav
        data-ui-control="true"
        aria-label="Flight controls"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-[#FDFCFA]/88 backdrop-blur-md border border-[#59789c]/16 shadow-[0_8px_24px_-14px_rgba(36,52,71,0.16)] max-w-[calc(100vw-2rem)]"
      >
        <div
          role="group"
          aria-label="Flight feel presets"
          className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#59789c]/7"
        >
          {PRESET_ORDER.map((presetId) => {
            const preset = BUTTERFLY_PRESETS[presetId];
            const isSelected = activePreset === presetId;
            return (
              <button
                key={presetId}
                type="button"
                onClick={() => onSelectPreset(presetId)}
                aria-pressed={isSelected}
                className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c] ${
                  isSelected
                    ? 'bg-[#59789c] text-[#FDFCFA] shadow-xs'
                    : 'text-[#47607b] hover:text-[#243447]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-[#59789c]/16 mx-0.5" aria-hidden="true" />

        <button
          type="button"
          onClick={onTogglePaused}
          aria-label={paused ? 'Resume butterfly animation' : 'Pause butterfly animation'}
          aria-pressed={paused}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#47607b] hover:text-[#243447] hover:bg-[#59789c]/8 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c]"
        >
          {paused ? (
            <Play className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Pause className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-label="Toggle motion tuning controls"
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59789c] ${
            panelOpen
              ? 'bg-[#59789c]/14 text-[#243447]'
              : 'text-[#47607b] hover:text-[#243447] hover:bg-[#59789c]/8'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Tune</span>
        </button>
      </nav>
    </>
  );
}

import React, { useCallback, useRef, useState } from "react";
import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ElevenLabsVoicePickerProps {
  value: string;
  onChange: (voiceId: string) => void;
}

interface CuratedVoice {
  voice_id: string;
  name: string;
  desc: string;
  gender: "female" | "male";
  accent: string;
  preview_url: string;
}

// ─── Curated voices (Jessica first = app default) ───────────────────────────

const VOICES: CuratedVoice[] = [
  {
    voice_id: ELEVENLABS_DEFAULT_VOICE_ID,
    name: "Jessica",
    desc: "Playful, Bright, Warm",
    gender: "female",
    accent: "American",
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3",
  },
  {
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    desc: "Mature, Reassuring, Confident",
    gender: "female",
    accent: "American",
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3",
  },
  {
    voice_id: "pFZP5JQG7iQjIQuC4Bku",
    name: "Lily",
    desc: "Velvety, Warm, Clear",
    gender: "female",
    accent: "British",
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3",
  },
  {
    voice_id: "90ipbRoKi4CpHXvKVtl0",
    name: "Anika",
    desc: "Customer Care, Professional",
    gender: "female",
    accent: "Indian",
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/database/workspace/514d94e9241c48e8b7905375729c436f/voices/90ipbRoKi4CpHXvKVtl0/RHjv4PzQ8pTguUk1dcO5.mp3",
  },
  {
    voice_id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    desc: "Warm, Captivating Storyteller",
    gender: "male",
    accent: "British",
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3",
  },
  {
    voice_id: "cjVigY5qzO86Huf0OWal",
    name: "Eric",
    desc: "Smooth, Trustworthy",
    gender: "male",
    accent: "American",
    preview_url:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3",
  },
];

const VOICE_MAP = new Map(VOICES.map((v) => [v.voice_id, v]));

// ─── Animated Waveform ──────────────────────────────────────────────────────

const WaveformIcon: React.FC<{ playing: boolean; small?: boolean }> = ({
  playing,
  small,
}) => {
  const bars = [3, 5, 7, 5, 3, 7, 4];
  const h = small ? 12 : 16;
  return (
    <svg
      width={small ? 18 : 24}
      height={h}
      viewBox={`0 0 ${small ? 18 : 24} ${h}`}
      className="shrink-0"
      style={{ display: "block" }}
    >
      {bars.map((height, i) => (
        <rect
          key={i}
          x={i * (small ? 2.5 : 3) + (small ? 0.5 : 0)}
          y={(h - height) / 2}
          width={small ? 1.5 : 2}
          height={height}
          rx={1}
          fill={playing ? "#f59e0b" : "#6b7280"}
          style={
            playing
              ? {
                  animation: `elVoiceWave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                  transformOrigin: "center",
                }
              : undefined
          }
        />
      ))}
    </svg>
  );
};

// ─── Voice Card ─────────────────────────────────────────────────────────────

const VoiceCard: React.FC<{
  voice: CuratedVoice;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onPreview: (e: React.MouseEvent) => void;
}> = ({ voice, selected, playing, onSelect, onPreview }) => (
  <button
    type="button"
    onClick={onSelect}
    className={[
      "w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-150 group",
      selected
        ? "bg-amber-500/10 border-l-2 border-amber-500"
        : "border-l-2 border-transparent hover:bg-white/[0.04]",
    ].join(" ")}
  >
    {/* Avatar */}
    <div
      className={[
        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors",
        selected
          ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
          : "bg-white/[0.06] text-gray-400 group-hover:bg-white/10",
      ].join(" ")}
    >
      {voice.name.charAt(0)}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span
          className={[
            "text-[13px] font-semibold",
            selected ? "text-amber-300" : "text-gray-200",
          ].join(" ")}
        >
          {voice.name}
        </span>
        <span
          className={[
            "text-[11px] shrink-0",
            voice.gender === "female"
              ? "text-pink-400/60"
              : "text-blue-400/60",
          ].join(" ")}
        >
          {voice.gender === "female" ? "♀" : "♂"}
        </span>
        <span className="text-[10px] text-gray-600">{voice.accent}</span>
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{voice.desc}</p>
    </div>

    {/* Preview button */}
    <button
      type="button"
      onClick={onPreview}
      title={playing ? "Stop" : "Preview voice"}
      className={[
        "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 z-10",
        playing
          ? "bg-amber-500/20 text-amber-400"
          : "text-gray-600 hover:text-amber-400 hover:bg-amber-500/10",
      ].join(" ")}
    >
      {playing ? (
        <WaveformIcon playing small />
      ) : (
        <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor">
          <path d="M2 1L10 6L2 11V1Z" />
        </svg>
      )}
    </button>
  </button>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const ElevenLabsVoicePicker: React.FC<ElevenLabsVoicePickerProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [customId, setCustomId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = VOICE_MAP.get(value);

  const handlePreview = useCallback(
    (e: React.MouseEvent, voice: CuratedVoice) => {
      e.stopPropagation();

      if (playingId === voice.voice_id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      audioRef.current?.pause();
      const audio = new Audio(voice.preview_url);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audioRef.current = audio;
      audio.play().catch(() => setPlayingId(null));
      setPlayingId(voice.voice_id);
    },
    [playingId],
  );

  const handleSelect = useCallback(
    (voiceId: string) => {
      onChange(voiceId);
      audioRef.current?.pause();
      setPlayingId(null);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleCustomSubmit = useCallback(() => {
    if (customId.trim()) {
      onChange(customId.trim());
      setCustomId("");
      setIsOpen(false);
    }
  }, [customId, onChange]);

  return (
    <>
      <style>{`
        @keyframes elVoiceWave {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1.4); }
        }
      `}</style>

      <div className="space-y-2">
        {/* Collapsed chip */}
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              audioRef.current?.pause();
              setPlayingId(null);
            }
            setIsOpen((o) => !o);
          }}
          className={[
            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all duration-150",
            isOpen
              ? "bg-amber-500/10 border-amber-500/50"
              : "bg-white/[0.04] border-white/10 hover:border-white/20 hover:bg-white/[0.06]",
          ].join(" ")}
        >
          <WaveformIcon playing={false} small />
          <div className="flex-1 min-w-0">
            {value ? (
              <>
                <div className="text-sm font-medium text-gray-200 truncate">
                  {selectedVoice?.name ?? "Custom Voice"}
                </div>
                <div className="text-[10px] text-gray-600 font-mono truncate">
                  {value}
                </div>
              </>
            ) : (
              <span className="text-sm text-gray-500">Select a voice…</span>
            )}
          </div>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={[
              "shrink-0 text-gray-500 transition-transform duration-200",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
          >
            <path
              d="M2 4L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Expanded panel */}
        {isOpen && (
          <div className="rounded-xl border border-white/10 bg-[#0e0f11] overflow-hidden shadow-2xl">
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">
                Select Voice
              </span>
            </div>

            {/* Voice list */}
            <div className="divide-y divide-white/[0.04]">
              {VOICES.map((voice) => (
                <VoiceCard
                  key={voice.voice_id}
                  voice={voice}
                  selected={voice.voice_id === value}
                  playing={playingId === voice.voice_id}
                  onSelect={() => handleSelect(voice.voice_id)}
                  onPreview={(e) => handlePreview(e, voice)}
                />
              ))}
            </div>

            {/* Custom ID fallback */}
            <div className="px-3 py-2.5 border-t border-white/[0.06]">
              <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">
                Or enter a custom voice ID
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                  placeholder="pNInz6obpgDQGcFmaJgB"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono placeholder-gray-700 outline-none focus:border-amber-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  disabled={!customId.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Use
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ElevenLabsVoicePicker;

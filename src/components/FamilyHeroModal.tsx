import React, { useRef, useState } from 'react';
import {
  X,
  Sparkles,
  RotateCcw,
  Save,
  Camera,
  Mic,
  Square as StopIcon,
  Play,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_FAMILY_HEROES,
  FamilyHeroConfig,
  PieceRole,
} from '../data/familyConfig';
import { soundFX } from '../utils/sound';

interface FamilyHeroModalProps {
  isOpen: boolean;
  heroes: Record<PieceRole, FamilyHeroConfig>;
  onClose: () => void;
  onSaveHeroes: (updated: Record<PieceRole, FamilyHeroConfig>) => void;
}

const ROLE_ORDER: PieceRole[] = ['k', 'q', 'n', 'b', 'r', 'p'];

export const FamilyHeroModal: React.FC<FamilyHeroModalProps> = ({
  isOpen,
  heroes,
  onClose,
  onSaveHeroes,
}) => {
  const [draft, setDraft] = useState<Record<PieceRole, FamilyHeroConfig>>(heroes);
  const [showPhotoComparison, setShowPhotoComparison] = useState(true);
  const [recordingRole, setRecordingRole] = useState<PieceRole | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  const handleFieldChange = (
    role: PieceRole,
    field: keyof FamilyHeroConfig,
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
      },
    }));
  };

  const startRecording = async (role: PieceRole) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setDraft((prev) => ({
            ...prev,
            [role]: {
              ...prev[role],
              customAudioDataUrl: base64,
            },
          }));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingRole(role);
    } catch {
      alert(
        'Mikrofon-Zugriff wurde nicht erlaubt oder ist auf diesem Gerät nicht verfügbar.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingRole) {
      mediaRecorderRef.current.stop();
      setRecordingRole(null);
    }
  };

  const deleteRecording = (role: PieceRole) => {
    setDraft((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        customAudioDataUrl: undefined,
      },
    }));
  };

  const handleReset = () => {
    setDraft(DEFAULT_FAMILY_HEROES);
  };

  const handleSave = () => {
    onSaveHeroes(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-gradient-to-b from-[#1e1333] via-[#130d21] to-[#0b0713] border-2 border-amber-500/50 shadow-[0_0_60px_rgba(245,158,11,0.3)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/25 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-dungeon text-xl sm:text-2xl font-bold text-amber-200 tracking-wide">
                Eure Familien-Helden-Gilde & Sprachstudio
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/70">
                Namen, Kampfsprüche, beide Cousinen-Skins & echte Mikrofon-Sprachaufnahmen eurer Familie!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPhotoComparison((v) => !v)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-900/60 hover:bg-purple-800/70 text-purple-200 border border-purple-400/40 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              {showPhotoComparison
                ? 'Original-Fotos ausblenden'
                : 'Original-Fotos zeigen'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-amber-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Pitch Concept Banner */}
          <div className="relative rounded-2xl overflow-hidden border border-amber-400/30 shadow-xl bg-black/40">
            <img
              src="/assets/pitch_banner.jpg"
              alt="Family Dungeon Chess Concept"
              className="w-full h-40 sm:h-52 object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0713] via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-black">
                  Alle 7 Familien-Charaktere inkl. beider Cousinen!
                </span>
                <h3 className="font-dungeon text-lg sm:text-xl font-bold text-white mt-1 drop-shadow">
                  König, Königin, Tochter, Tante, Cousin & beide Cousinen im Dungeon
                </h3>
              </div>
            </div>
          </div>

          {/* 6 Hero Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_ORDER.map((role) => {
              const hero = draft[role];
              const isRecordingThis = recordingRole === role;
              return (
                <div
                  key={role}
                  className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.06] border border-amber-500/25 transition"
                >
                  {/* 3D Miniature Avatar + Dual Skin Preview for Cousins */}
                  <div className="flex sm:flex-col gap-2 shrink-0 mx-auto sm:mx-0">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-gradient-to-b from-slate-800 to-slate-950 shadow-lg">
                      <img
                        src={hero.spritePath}
                        alt={hero.customName}
                        className="w-full h-full object-cover"
                      />
                      {showPhotoComparison && hero.photoReference && (
                        <img
                          src={hero.photoReference}
                          alt="Original"
                          title="Euer Originalfoto als Vorlage"
                          className="absolute bottom-1 right-1 w-10 h-10 rounded-lg object-cover border-2 border-amber-300 shadow-md"
                        />
                      )}
                      <div className="absolute top-1 left-1 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-bold text-amber-300 border border-amber-400/40">
                        {hero.chessName}
                      </div>
                    </div>

                    {/* Show 2nd Cousin Skin (Houndstooth Dress + Hijab) on the Pawn Card! */}
                    {role === 'p' && hero.secondarySpritePath && (
                      <div className="relative w-28 h-20 sm:w-32 sm:h-20 rounded-xl overflow-hidden border-2 border-purple-400/60 bg-slate-900 shadow-md flex items-center gap-2 p-1.5">
                        <img
                          src={hero.secondarySpritePath}
                          alt={hero.secondaryCustomName}
                          className="w-14 h-16 rounded-lg object-cover border border-purple-300"
                        />
                        <div className="text-[10px] leading-tight text-purple-200 font-bold">
                          <span className="text-amber-300 block">2. Skin aktiv:</span>
                          Hahnentritt & Kopftuch
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editable Fields */}
                  <div className="flex-1 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">
                          {hero.familyTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          {hero.superpower.icon} {hero.superpower.name}
                        </span>
                      </div>
                      <p className="text-xs text-amber-100/70 mt-0.5 leading-relaxed">
                        {hero.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-amber-200/70 mb-1">
                          Name / Spitzname:
                        </label>
                        <input
                          type="text"
                          value={hero.customName}
                          onChange={(e) =>
                            handleFieldChange(role, 'customName', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-amber-500/40 text-sm font-bold text-amber-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {role === 'p' ? (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-purple-200/70 mb-1">
                            2. Cousine Name:
                          </label>
                          <input
                            type="text"
                            value={hero.secondaryCustomName || ''}
                            onChange={(e) =>
                              handleFieldChange(
                                role,
                                'secondaryCustomName',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-purple-500/40 text-sm font-bold text-purple-100 focus:outline-none focus:border-purple-400"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-amber-200/70 mb-1">
                            Kampfspruch beim Schlagen:
                          </label>
                          <input
                            type="text"
                            value={hero.captureQuotes[0] || ''}
                            onChange={(e) => {
                              const updatedQuotes = [...hero.captureQuotes];
                              updatedQuotes[0] = e.target.value;
                              setDraft((prev) => ({
                                ...prev,
                                [role]: {
                                  ...prev[role],
                                  captureQuotes: updatedQuotes,
                                },
                              }));
                            }}
                            className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-purple-500/40 text-xs text-purple-100 focus:outline-none focus:border-purple-400"
                          />
                        </div>
                      )}
                    </div>

                    {/* Voice Line Recorder Studio */}
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {!isRecordingThis ? (
                        <button
                          type="button"
                          onClick={() => startRecording(role)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-300/40 transition"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>
                            {hero.customAudioDataUrl
                              ? 'Stimme neu aufnehmen'
                              : 'Echte Stimme aufnehmen'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 animate-pulse text-white border border-white transition"
                        >
                          <StopIcon className="w-3.5 h-3.5" />
                          <span>Aufnahme stoppen...</span>
                        </button>
                      )}

                      {hero.customAudioDataUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              soundFX.playCustomVoice(hero.customAudioDataUrl)
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/80 hover:bg-emerald-500 text-white transition"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Anhören</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecording(role)}
                            className="p-1.5 rounded-xl bg-white/10 hover:bg-red-600/60 text-amber-200 transition"
                            title="Aufnahme löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-amber-500/25 bg-black/60">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-amber-200/80 border border-white/10 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Standard wiederherstellen
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-amber-100 transition"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/25 transition"
            >
              <Save className="w-4 h-4" />
              Familien-Helden speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

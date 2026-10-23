import React, { useState } from 'react';
import { X, Sparkles, RotateCcw, Save, Camera } from 'lucide-react';
import {
  DEFAULT_FAMILY_HEROES,
  FamilyHeroConfig,
  PieceRole,
} from '../data/familyConfig';

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
                Eure Familien-Helden-Gilde
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/70">
                Hier könnt ihr die echten Vornamen, Spitznamen & Kampfsprüche eurer Familie jederzeit anpassen!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPhotoComparison((v) => !v)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-900/60 hover:bg-purple-800/70 text-purple-200 border border-purple-400/40 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              {showPhotoComparison ? 'Original-Fotos ausblenden' : 'Original-Fotos zeigen'}
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
              className="w-full h-44 sm:h-56 object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0713] via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-black">
                  3D Miniaturen aus euren Fotos
                </span>
                <h3 className="font-dungeon text-lg sm:text-xl font-bold text-white mt-1 drop-shadow">
                  König, Königin, Tochter, Tante, Cousin & Cousinen im Dungeon
                </h3>
              </div>
            </div>
          </div>

          {/* 6 Hero Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_ORDER.map((role) => {
              const hero = draft[role];
              return (
                <div
                  key={role}
                  className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.06] border border-amber-500/25 transition"
                >
                  {/* 3D Miniature Avatar + Optional Original Photo Badge */}
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 mx-auto sm:mx-0 rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-gradient-to-b from-slate-800 to-slate-950 shadow-lg">
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

                  {/* Editable Fields */}
                  <div className="flex-1 space-y-2.5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">
                        {hero.familyTitle} • {hero.dungeonClass}
                      </div>
                      <p className="text-xs text-amber-100/70 mt-0.5 leading-relaxed">
                        {hero.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-amber-200/70 mb-1">
                          Name / Spitzname im Spiel:
                        </label>
                        <input
                          type="text"
                          value={hero.customName}
                          onChange={(e) =>
                            handleFieldChange(role, 'customName', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-amber-500/40 text-sm font-bold text-amber-100 focus:outline-none focus:border-amber-400"
                          placeholder="z.B. Suhay / Papa..."
                        />
                      </div>

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

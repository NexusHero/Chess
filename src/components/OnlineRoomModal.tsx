import React, { useState } from 'react';
import {
  Wifi,
  Copy,
  Check,
  Share2,
  X,
  Users,
  Sparkles,
} from 'lucide-react';

interface OnlineRoomModalProps {
  isOpen: boolean;
  roomCode: string | null;
  isConnected: boolean;
  peerRole: 'host' | 'guest' | null;
  statusMessage: string;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onDisconnect: () => void;
  onSendEmoji: (emoji: string) => void;
  onClose: () => void;
}

const FAMILY_EMOJIS = ['👑', '⚔️', '😂', '🔥', '🦄', '😎', '❤️', '👏'];

export const OnlineRoomModal: React.FC<OnlineRoomModalProps> = ({
  isOpen,
  roomCode,
  isConnected,
  peerRole,
  statusMessage,
  onCreateRoom,
  onJoinRoom,
  onDisconnect,
  onSendEmoji,
  onClose,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = roomCode
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    : window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🏰⚔️ Komm in unser 3D Family Dungeon Chess! Klicke auf den Link oder gib den Raum-Code "${roomCode}" ein: ${shareUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#1a1130] via-[#120b22] to-[#0a0612] border-2 border-emerald-400/50 shadow-[0_0_60px_rgba(16,185,129,0.25)] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-dungeon text-xl font-bold text-emerald-200">
                Online Familien-Raum (Live P2P)
              </h2>
              <p className="text-xs text-emerald-100/70">
                Spielt von überall live gegeneinander – per Raum-Code oder WhatsApp-Link!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-amber-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="p-3.5 rounded-2xl bg-black/50 border border-white/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 animate-ping'
                  : roomCode
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-xs sm:text-sm font-bold text-amber-100">
              {statusMessage}
            </span>
          </div>
          {peerRole && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
              {peerRole === 'host'
                ? '☀️ Du spielst Team Gold'
                : '🌙 Du spielst Team Violett'}
            </span>
          )}
        </div>

        {/* Create or Join Section */}
        {!roomCode ? (
          <div className="space-y-4">
            <button
              onClick={onCreateRoom}
              className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Neuen Familien-Raum erstellen (Als Gastgeber)</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/15"></div>
              <span className="flex-shrink mx-3 text-xs text-amber-200/50 uppercase">
                oder bestehendem Raum beitreten
              </span>
              <div className="flex-grow border-t border-white/15"></div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="Raum-Code eingeben (z.B. BABA-42)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/60 border border-emerald-500/40 text-sm font-bold text-white uppercase tracking-wider focus:outline-none focus:border-emerald-400"
              />
              <button
                onClick={() => {
                  if (joinInput.trim()) onJoinRoom(joinInput.trim());
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white border border-purple-300/40 transition flex items-center gap-1.5"
              >
                <Users className="w-4 h-4" />
                <span>Beitreten</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Room Code Display & Share Buttons */}
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-400/40 text-center space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-emerald-300 font-bold">
                Euer Familien-Raum-Code:
              </div>
              <div className="font-dungeon text-3xl font-black tracking-widest text-white">
                {roomCode}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Link kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Einladungs-Link kopieren</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Per WhatsApp an Familie senden</span>
                </button>
              </div>
            </div>

            {/* Live Emoji Reaction Bar */}
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-amber-200/70 font-bold text-center">
                Live-Emoji übers Schachbrett schicken:
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {FAMILY_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => onSendEmoji(em)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xl flex items-center justify-center transition transform hover:scale-110"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={onDisconnect}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-500/40 transition"
              >
                Raum verlassen
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-black"
              >
                Zurück zum Brett
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

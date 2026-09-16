import React from 'react';
import { AVAILABLE_POWER_CARDS } from '../competitionData';
import { ActivePowerCardEffects, PowerCardState } from '../types';
import { Zap, Snowflake, EyeOff, Shield, ShieldCheck, History, Clock } from 'lucide-react';

interface PowerCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRound3Running: boolean;
  powerCardEffects: ActivePowerCardEffects;
  onApplyCard: (card: PowerCardState) => void;
}

export const PowerCardsModal: React.FC<PowerCardsModalProps> = ({
  isOpen,
  onClose,
  isRound3Running,
  powerCardEffects,
  onApplyCard
}) => {
  if (!isOpen) return null;

  const renderIcon = (id: string, className: string = 'w-5 h-5') => {
    switch (id) {
      case 'flashbang':
        return <EyeOff className={className} />;
      case 'freeze':
        return <Snowflake className={className} />;
      case 'shield':
        return <Shield className={className} />;
      case 'timewarp':
        return <Clock className={className} />;
      case 'turboboost':
        return <Zap className={className} />;
      default:
        return <Zap className={className} />;
    }
  };

  return (
    <div
      id="power-cards-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        id="power-cards-modal"
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
                Round 3 Power Cards
                {powerCardEffects.shieldActive && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 flex items-center gap-1 font-normal">
                    <ShieldCheck className="w-3 h-3 text-cyan-400" /> Shield Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                Execute tactical cards while the Round 3 competition timer is running.
              </p>
            </div>
          </div>
          <button
            id="power-cards-close-btn"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-xs px-2.5 py-1 rounded border border-neutral-800 bg-neutral-800/60 transition"
          >
            Close
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!isRound3Running ? (
            <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Power Cards can only be activated while the Round 3 countdown timer is actively running.
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AVAILABLE_POWER_CARDS.map((card) => {
              const isFreezeActive =
                card.cardId === 'freeze' &&
                powerCardEffects.freezeUntil != null &&
                powerCardEffects.freezeUntil > Date.now();

              return (
                <div
                  key={card.cardId}
                  id={`power-card-item-${card.cardId}`}
                  className={`p-4 rounded-lg border flex flex-col justify-between transition-all ${
                    card.isPositive
                      ? 'bg-neutral-950/50 border-emerald-900/40 hover:border-emerald-700/60'
                      : 'bg-neutral-950/50 border-rose-900/40 hover:border-rose-700/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-sm text-neutral-100">
                        <span
                          className={`p-1.5 rounded ${
                            card.isPositive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {renderIcon(card.cardId, 'w-4 h-4')}
                        </span>
                        {card.name}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                          card.isPositive
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950/60 text-rose-300 border-rose-800'
                        }`}
                      >
                        {card.isPositive ? 'Buff' : 'Disruption'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{card.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-neutral-500">
                      Cost: {card.costPoints} pts
                    </span>
                    <button
                      id={`activate-power-card-${card.cardId}`}
                      disabled={!isRound3Running || isFreezeActive}
                      onClick={() => onApplyCard(card)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        card.isPositive
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                      }`}
                    >
                      {card.cardId === 'shield' && powerCardEffects.shieldActive
                        ? 'Shield Deployed'
                        : isFreezeActive
                        ? 'Frozen'
                        : 'Deploy Card'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {powerCardEffects.history.length > 0 && (
            <div className="border-t border-neutral-800 pt-4 space-y-2">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                Power Card Deployment Log
              </div>
              <div className="bg-neutral-950 rounded-lg border border-neutral-800 p-3 max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono">
                {powerCardEffects.history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-neutral-300">
                    <span className="text-amber-400 font-semibold">[{h.cardName}]</span>
                    <span className="text-neutral-400 text-[11px]">{h.details}</span>
                    <span className="text-neutral-500 text-[10px]">{h.appliedAt.slice(11, 19)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between text-xs text-neutral-500">
          <span>All power card activations are logged to local audit results.</span>
        </div>
      </div>
    </div>
  );
};

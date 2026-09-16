import React from 'react';
import { TEAMS_LIST } from '../competitionData';
import { TeamId } from '../types';
import { Users, Check } from 'lucide-react';

interface TeamModalProps {
  isOpen: boolean;
  selectedTeam: TeamId | null;
  onSelectTeam: (team: TeamId) => void;
  onClose?: () => void;
  canClose: boolean;
}

export const TeamModal: React.FC<TeamModalProps> = ({
  isOpen,
  selectedTeam,
  onSelectTeam,
  onClose,
  canClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="team-selection-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        id="team-selection-modal"
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100 tracking-tight">
                {canClose ? 'Change Team Designation' : 'Select Competition Team'}
              </h2>
              <p className="text-xs text-neutral-400">
                Configure this PC terminal for one of the 21 participating teams.
              </p>
            </div>
          </div>
          {canClose && onClose && (
            <button
              id="team-modal-close-btn"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 text-xs px-2.5 py-1 rounded border border-neutral-800 bg-neutral-800/60 transition"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wider">
            Available Terminals (21 Teams)
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {TEAMS_LIST.map((team) => {
              const isSelected = selectedTeam === team;
              return (
                <button
                  key={team}
                  id={`select-team-btn-${team.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => onSelectTeam(team)}
                  className={`flex flex-col items-center justify-center py-3.5 px-2 rounded-lg border text-xs font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] text-neutral-500 uppercase tracking-tighter">Terminal</span>
                  <span className="text-sm font-semibold mt-0.5">{team.replace('Team ', '')}</span>
                  {isSelected && (
                    <span className="mt-1 text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between text-xs text-neutral-500">
          <span>Selection is persistently locked to this machine's local storage.</span>
          {selectedTeam && (
            <span className="text-neutral-300 font-mono">
              Current: <strong className="text-emerald-400">{selectedTeam}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

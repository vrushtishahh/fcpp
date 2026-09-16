import React from 'react';
import { SubmissionRecord, TeamId } from '../types';
import { exportResultsAsCSV, exportResultsAsJSON } from '../storage';
import { Trophy, Download, FileSpreadsheet, FileJson, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamId | null;
  submissions: SubmissionRecord[];
  onResetAll?: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  isOpen,
  onClose,
  team,
  submissions,
  onResetAll
}) => {
  if (!isOpen) return null;

  const totalScore = submissions.reduce((acc, s) => acc + s.score, 0);

  return (
    <div
      id="results-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        id="results-modal"
        className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
                Competition Results & Export
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-emerald-400 font-mono">
                  {team || 'No Team Assigned'}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Verified local submissions, completion timings, and export data.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="export-csv-btn"
              onClick={() => exportResultsAsCSV(submissions, team)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Export CSV
            </button>
            <button
              id="export-json-btn"
              onClick={() => exportResultsAsJSON(submissions, team)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium transition"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-400" />
              Export JSON
            </button>
            <button
              id="results-modal-close-btn"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 text-xs px-2.5 py-1.5 rounded border border-neutral-800 bg-neutral-800/60 transition ml-2"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                Total Score
              </span>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {totalScore} <span className="text-xs text-neutral-500 font-normal">pts</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                Submissions Logged
              </span>
              <div className="text-2xl font-bold text-neutral-200 font-mono mt-1">
                {submissions.length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                Assigned Terminal
              </span>
              <div className="text-2xl font-bold text-blue-400 font-mono mt-1">
                {team || '—'}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Recorded Submissions History
            </div>

            {submissions.length === 0 ? (
              <div className="p-8 text-center bg-neutral-950/60 rounded-lg border border-neutral-800/80 text-neutral-500 text-xs">
                No submissions have been finalized on this machine yet. Click "Start" and "Submit" in any round to record attempts.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-900/80 text-neutral-400 text-[11px] uppercase border-b border-neutral-800">
                    <tr>
                      <th className="py-2.5 px-3">Round</th>
                      <th className="py-2.5 px-3">Activity</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Attempts</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                    {submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-neutral-900/30">
                        <td className="py-2.5 px-3 font-semibold text-neutral-200">{s.roundTitle}</td>
                        <td className="py-2.5 px-3 text-neutral-400">{s.activityTitle}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === 'COMPLETED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : s.status === 'TIME_OVER'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
                            }`}
                          >
                            {s.status === 'COMPLETED' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">+{s.score}</td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">{s.attempts}</td>
                        <td className="py-2.5 px-3 text-[11px] text-neutral-500">
                          {s.submissionDatetime.slice(11, 19)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between text-xs text-neutral-500">
          <span>Results are stored strictly locally in browser memory for competition integrity.</span>
          {onResetAll && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all records for this PC?')) {
                  onResetAll();
                }
              }}
              className="text-red-400 hover:text-red-300 text-[11px] underline"
            >
              Reset Terminal Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

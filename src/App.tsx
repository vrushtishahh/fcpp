import React, { useState, useEffect, useRef, useMemo } from 'react';
import { runCCode, ExecutionResult } from './cCompiler';
import { ROUND_SPECS, TEAMS_LIST, AVAILABLE_POWER_CARDS } from './competitionData';
import {
  TeamId,
  RoundId,
  CompetitionState,
  SubmissionRecord,
  PowerCardState
} from './types';
import {
  loadCompetitionState,
  saveCompetitionState,
  getInitialState
} from './storage';
import { TeamModal } from './components/TeamModal';
import { PowerCardsModal } from './components/PowerCardsModal';
import { ResultsModal } from './components/ResultsModal';
import {
  Play,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Trophy,
  Zap,
  Snowflake,
  EyeOff,
  RotateCcw,
  Terminal,
  ShieldAlert,
  Code2,
  Flame,
  FileCode
} from 'lucide-react';

export default function App() {
  const [compState, setCompState] = useState<CompetitionState>(() => loadCompetitionState());
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(() => !compState.selectedTeam);
  const [isPowerCardsOpen, setIsPowerCardsOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);

  // Compiler execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stdout, setStdout] = useState<string>('');
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [lastExecutionTime, setLastExecutionTime] = useState<number | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  // Live timer tick trigger
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());

  const activeRound = ROUND_SPECS[compState.activeRoundId];
  const timerState = compState.timers[compState.activeRoundId];
  const currentCode = compState.editorCode[compState.activeRoundId];
  const currentStdin = compState.standardInput[compState.activeRoundId];

  // Persist state changes to localStorage
  useEffect(() => {
    saveCompetitionState(compState);
  }, [compState]);

  // High-precision countdown interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Compute remaining seconds accurately from deadline + time adjustments
  const remainingSeconds = useMemo(() => {
    if (!timerState.started) {
      return activeRound.durationMinutes * 60;
    }
    if (timerState.submitted) {
      return 0;
    }
    if (!timerState.endDatetime) {
      return 0;
    }

    const targetTime = new Date(timerState.endDatetime).getTime();
    const adjustMs = compState.activeRoundId === 'round3'
      ? compState.powerCardEffects.timeAdjustSeconds * 1000
      : 0;

    const diffMs = targetTime + adjustMs - currentTimeMs;
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [timerState, activeRound, currentTimeMs, compState.activeRoundId, compState.powerCardEffects.timeAdjustSeconds]);

  // Automatic Time-Over trigger
  useEffect(() => {
    if (
      timerState.started &&
      !timerState.submitted &&
      !timerState.timeOver &&
      remainingSeconds <= 0
    ) {
      setCompState((prev) => {
        const nextTimers = {
          ...prev.timers,
          [prev.activeRoundId]: {
            ...prev.timers[prev.activeRoundId],
            timeOver: true
          }
        };

        // Record a TIME_OVER submission if not already submitted
        const newSub: SubmissionRecord = {
          id: `sub_${Date.now()}`,
          team: prev.selectedTeam || 'Unassigned',
          roundId: prev.activeRoundId,
          roundTitle: ROUND_SPECS[prev.activeRoundId].roundTitle,
          activityTitle: ROUND_SPECS[prev.activeRoundId].activityTitle,
          startDatetime: prev.timers[prev.activeRoundId].startDatetime || new Date().toISOString(),
          submissionDatetime: new Date().toISOString(),
          durationSeconds: ROUND_SPECS[prev.activeRoundId].durationMinutes * 60,
          attempts: prev.attempts[prev.activeRoundId] || 0,
          score: 0,
          status: 'TIME_OVER',
          code: prev.editorCode[prev.activeRoundId],
          testResultsSummary: 'Timer reached 0:00 before final submission.'
        };

        return {
          ...prev,
          timers: nextTimers,
          submissions: [newSub, ...prev.submissions]
        };
      });
    }
  }, [remainingSeconds, timerState]);

  // Freeze countdown check
  const isKeyboardFrozen = useMemo(() => {
    if (compState.activeRoundId !== 'round3') return false;
    const until = compState.powerCardEffects.freezeUntil;
    return until != null && until > currentTimeMs;
  }, [compState.activeRoundId, compState.powerCardEffects.freezeUntil, currentTimeMs]);

  const freezeSecondsLeft = useMemo(() => {
    if (!isKeyboardFrozen || !compState.powerCardEffects.freezeUntil) return 0;
    return Math.max(0, Math.ceil((compState.powerCardEffects.freezeUntil - currentTimeMs) / 1000));
  }, [isKeyboardFrozen, compState.powerCardEffects.freezeUntil, currentTimeMs]);

  // Round Selector
  const handleSelectRound = (roundId: RoundId) => {
    setCompState((prev) => ({
      ...prev,
      activeRoundId: roundId
    }));
    setSubmitFeedback(null);
    setDiagnosticError(null);
  };

  // Start Timer
  const handleStartTimer = () => {
    if (timerState.started) return;
    const now = new Date();
    const end = new Date(now.getTime() + activeRound.durationMinutes * 60 * 1000);

    setCompState((prev) => ({
      ...prev,
      timers: {
        ...prev.timers,
        [prev.activeRoundId]: {
          ...prev.timers[prev.activeRoundId],
          started: true,
          startDatetime: now.toISOString(),
          endDatetime: end.toISOString(),
          timeOver: false
        }
      }
    }));
  };

  // Run Code (Does NOT stop timer)
  const handleRunCode = async () => {
    if (isRunning || isSubmitting) return;
    if (timerState.timeOver) return;

    setIsRunning(true);
    setStdout('Compiling and running in browser...\n');
    setDiagnosticError(null);

    try {
      const res: ExecutionResult = await runCCode(currentCode, currentStdin, 3000);
      setLastExecutionTime(res.durationMs);

      if (res.error) {
        setDiagnosticError(res.error);
        setStdout(res.output || '');
      } else {
        setStdout(res.output || '(No output produced)');
      }

      setCompState((prev) => ({
        ...prev,
        attempts: {
          ...prev.attempts,
          [prev.activeRoundId]: (prev.attempts[prev.activeRoundId] || 0) + 1
        }
      }));
    } catch (err: any) {
      setDiagnosticError(`Execution Caught:\n${err?.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Submit Code (Runs test suite, stops timer on success, records score)
  const handleSubmitCode = async () => {
    if (isSubmitting || isRunning) return;
    if (!timerState.started) {
      alert('Please click START to begin the round before submitting.');
      return;
    }
    if (timerState.timeOver) return;

    setIsSubmitting(true);
    setSubmitFeedback(null);
    setStdout('Running verification test suite for submission...\n');

    try {
      let passedCount = 0;
      const totalTests = activeRound.testCases.length;
      let failureDetails = '';

      for (let i = 0; i < totalTests; i++) {
        const test = activeRound.testCases[i];
        setStdout((prev) => prev + `Running Test Case ${i + 1}/${totalTests}... `);

        const res = await runCCode(currentCode, test.input, 2500);

        if (res.error) {
          setStdout((prev) => prev + `[FAILED - RUNTIME ERROR]\n`);
          failureDetails = `Test Case ${i + 1} Error: ${res.error}`;
          break;
        }

        const normalizedActual = (res.output || '').trim();
        const normalizedExpected = test.expectedOutput.trim();

        if (normalizedActual === normalizedExpected) {
          passedCount++;
          setStdout((prev) => prev + `[PASSED]\n`);
        } else {
          setStdout(
            (prev) =>
              prev +
              `[FAILED]\nExpected: "${normalizedExpected}"\nReceived: "${normalizedActual}"\n`
          );
          failureDetails = `Test Case ${i + 1} Output Mismatch.\nExpected: ${normalizedExpected}\nReceived: ${normalizedActual}`;
          break;
        }
      }

      const isAllPassed = passedCount === totalTests;
      const now = new Date();

      if (isAllPassed) {
        // Calculate score with optional speed bonus
        const elapsedSecs = Math.max(
          1,
          Math.floor((now.getTime() - new Date(timerState.startDatetime!).getTime()) / 1000)
        );

        let earnedScore = activeRound.maxPoints;
        // Round 2 speed factor: speed rewards earlier finishes
        if (compState.activeRoundId === 'round2') {
          const maxSecs = activeRound.durationMinutes * 60;
          const speedBonus = Math.max(0, Math.floor(((maxSecs - elapsedSecs) / maxSecs) * 30));
          earnedScore = 70 + speedBonus;
        }

        const newSubmission: SubmissionRecord = {
          id: `sub_${Date.now()}`,
          team: compState.selectedTeam || 'Team Unassigned',
          roundId: compState.activeRoundId,
          roundTitle: activeRound.roundTitle,
          activityTitle: activeRound.activityTitle,
          startDatetime: timerState.startDatetime || now.toISOString(),
          submissionDatetime: now.toISOString(),
          durationSeconds: elapsedSecs,
          attempts: (compState.attempts[compState.activeRoundId] || 0) + 1,
          score: earnedScore,
          status: 'COMPLETED',
          code: currentCode,
          testResultsSummary: `All ${totalTests} test cases passed successfully!`
        };

        setCompState((prev) => ({
          ...prev,
          timers: {
            ...prev.timers,
            [prev.activeRoundId]: {
              ...prev.timers[prev.activeRoundId],
              submitted: true,
              submissionDatetime: now.toISOString(),
              elapsedSeconds: elapsedSecs
            }
          },
          submissions: [newSubmission, ...prev.submissions]
        }));

        setSubmitFeedback({
          success: true,
          message: `Submission Accepted! +${earnedScore} Points awarded.`,
          details: `Solved in ${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s with ${newSubmission.attempts} attempts.`
        });
      } else {
        setSubmitFeedback({
          success: false,
          message: `Submission Rejected: Passed ${passedCount}/${totalTests} tests.`,
          details: failureDetails
        });

        setCompState((prev) => ({
          ...prev,
          attempts: {
            ...prev.attempts,
            [prev.activeRoundId]: (prev.attempts[prev.activeRoundId] || 0) + 1
          }
        }));
      }
    } catch (err: any) {
      setSubmitFeedback({
        success: false,
        message: 'Submission test execution encountered an error.',
        details: err?.message || String(err)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Power Card Application (Round 3 only)
  const handleApplyPowerCard = (card: PowerCardState) => {
    if (compState.activeRoundId !== 'round3' || !timerState.started || timerState.timeOver) {
      return;
    }

    const now = new Date();
    const effects = { ...compState.powerCardEffects };

    // Shield protection logic against negative cards
    if (!card.isPositive && effects.shieldActive) {
      effects.shieldActive = false;
      effects.history.push({
        cardId: card.cardId,
        cardName: 'Shield Deflection',
        appliedAt: now.toISOString(),
        details: `Shield deflected and absorbed incoming ${card.name}!`
      });
      setCompState((prev) => ({
        ...prev,
        powerCardEffects: effects
      }));
      alert(`Shield Protected! Negative power card "${card.name}" was blocked.`);
      return;
    }

    switch (card.cardId) {
      case 'shield':
        effects.shieldActive = true;
        effects.history.push({
          cardId: card.cardId,
          cardName: card.name,
          appliedAt: now.toISOString(),
          details: 'Shield raised. Next negative effect will be deflected.'
        });
        break;

      case 'freeze':
        effects.freezeUntil = Date.now() + 120 * 1000;
        effects.history.push({
          cardId: card.cardId,
          cardName: card.name,
          appliedAt: now.toISOString(),
          details: 'Keyboard locked for 120 seconds. Timer continues.'
        });
        break;

      case 'flashbang':
        effects.flashbangConstraint =
          'FLASHBANG CONSTRAINT: Arrays must be statically sized under 50 items. Avoid recursion.';
        effects.history.push({
          cardId: card.cardId,
          cardName: card.name,
          appliedAt: now.toISOString(),
          details: 'Active constraint modification deployed.'
        });
        break;

      case 'timewarp':
        effects.timeAdjustSeconds -= 300; // -5 minutes
        effects.history.push({
          cardId: card.cardId,
          cardName: card.name,
          appliedAt: now.toISOString(),
          details: 'Time Warp subtracted 5:00 from the countdown timer.'
        });
        break;

      case 'turboboost':
        effects.timeAdjustSeconds += 300; // +5 minutes
        effects.history.push({
          cardId: card.cardId,
          cardName: card.name,
          appliedAt: now.toISOString(),
          details: 'Turbo Boost added +5:00 to the countdown timer.'
        });
        break;
    }

    setCompState((prev) => ({
      ...prev,
      powerCardEffects: effects
    }));
  };

  // Reset starter code
  const handleResetCode = () => {
    if (window.confirm('Reset editor to initial problem starter code?')) {
      setCompState((prev) => ({
        ...prev,
        editorCode: {
          ...prev.editorCode,
          [prev.activeRoundId]: activeRound.starterCode
        }
      }));
    }
  };

  // Format MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Code editor textarea tab support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newCode = currentCode.substring(0, start) + '    ' + currentCode.substring(end);
      setCompState((prev) => ({
        ...prev,
        editorCode: {
          ...prev.editorCode,
          [prev.activeRoundId]: newCode
        }
      }));

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunCode();
    }
  };

  // Quick preset test loaders for the 4 core verification tests
  const loadTestPreset = (type: 'hello' | 'scanf' | 'invalid' | 'loop') => {
    if (timerState.started && !window.confirm('Load test snippet into editor? Current code will be replaced.')) {
      return;
    }

    let code = '';
    let input = '';
    if (type === 'hello') {
      code = `#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}\n`;
      input = '';
    } else if (type === 'scanf') {
      code = `#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d\\n", a + b);\n    }\n    return 0;\n}\n`;
      input = '10 20';
    } else if (type === 'invalid') {
      code = `#include <stdio.h>\n\nint main() {\n    int x = \n    syntax error\n    return 0;\n}\n`;
      input = '';
    } else if (type === 'loop') {
      code = `#include <stdio.h>\n\nint main() {\n    printf("Entering infinite loop...\\n");\n    while(1) {}\n    return 0;\n}\n`;
      input = '';
    }

    setCompState((prev) => ({
      ...prev,
      editorCode: {
        ...prev.editorCode,
        [prev.activeRoundId]: code
      },
      standardInput: {
        ...prev.standardInput,
        [prev.activeRoundId]: input
      }
    }));
  };

  const isEditorDisabled =
    timerState.timeOver || timerState.submitted || isKeyboardFrozen;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-neutral-800 selection:text-neutral-100">
      {/* Top Competition Bar */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur px-4 py-2.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
                Fastest Coder First
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                21 Terminals
              </span>
            </div>
            <div className="text-[11px] text-neutral-400">
              Offline Browser C Arena • Pure Local Engine
            </div>
          </div>
        </div>

        {/* Round Navigation Tabs */}
        <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800">
          {(['round1_a', 'round1_b', 'round2', 'round3'] as RoundId[]).map((rId) => {
            const r = ROUND_SPECS[rId];
            const isSelected = compState.activeRoundId === rId;
            const rTimer = compState.timers[rId];

            return (
              <button
                key={rId}
                id={`tab-round-${rId}`}
                onClick={() => handleSelectRound(rId)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                <span>{rId === 'round1_a' ? 'R1: Activity A' : rId === 'round1_b' ? 'R1: Activity B' : rId === 'round2' ? 'R2: Debug' : 'R3: Race'}</span>
                {rTimer.submitted ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                ) : rTimer.timeOver ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                ) : rTimer.started ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Action Controls & Team Selector */}
        <div className="flex items-center gap-2">
          {compState.activeRoundId === 'round3' && (
            <button
              id="power-cards-top-btn"
              onClick={() => setIsPowerCardsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-950/60 border border-amber-700/60 text-amber-300 hover:bg-amber-900/60 text-xs font-semibold transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Power Cards
              {compState.powerCardEffects.shieldActive && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </button>
          )}

          <button
            id="results-top-btn"
            onClick={() => setIsResultsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium transition"
          >
            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
            Results ({compState.submissions.length})
          </button>

          <button
            id="settings-team-btn"
            onClick={() => setIsTeamModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-emerald-400 text-xs font-mono font-semibold transition"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            {compState.selectedTeam || 'Set Team'}
          </button>
        </div>
      </header>

      {/* Main Countdown & Control Strip */}
      <div className="bg-neutral-900 border-b border-neutral-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider">
              Countdown
            </span>
            <div
              id="countdown-timer-display"
              className={`text-3xl font-mono font-bold tracking-tight px-3.5 py-1 rounded-lg border ${
                timerState.timeOver
                  ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                  : timerState.submitted
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : remainingSeconds < 120 && timerState.started
                  ? 'bg-rose-950/40 border-rose-800 text-rose-400 animate-pulse'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-100'
              }`}
            >
              {formatTimer(remainingSeconds)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!timerState.started ? (
              <button
                id="start-timer-btn"
                onClick={handleStartTimer}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-900/30"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                START TIMER
              </button>
            ) : timerState.submitted ? (
              <div className="px-3.5 py-1.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                SUBMITTED & LOCKED
              </div>
            ) : timerState.timeOver ? (
              <div className="px-3.5 py-1.5 rounded-md bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                TIME OVER — TERMINAL LOCKED
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-md bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                ROUND CLOCK RUNNING
              </div>
            )}
          </div>
        </div>

        {/* Quick Diagnostics & Test Snippets */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 font-mono hidden md:inline">
            Quick Compiler Tests:
          </span>
          <button
            onClick={() => loadTestPreset('hello')}
            className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 transition"
          >
            Hello World
          </button>
          <button
            onClick={() => loadTestPreset('scanf')}
            className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 transition"
          >
            scanf a+b
          </button>
          <button
            onClick={() => loadTestPreset('invalid')}
            className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 transition"
          >
            Invalid C
          </button>
          <button
            onClick={() => loadTestPreset('loop')}
            className="text-[10px] font-mono px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 transition"
          >
            Timeout Loop
          </button>
        </div>
      </div>

      {/* Disruption Alert Banners */}
      {isKeyboardFrozen && (
        <div className="bg-cyan-950/80 border-b border-cyan-800 px-6 py-2 flex items-center justify-between text-cyan-300 text-xs font-mono animate-pulse">
          <div className="flex items-center gap-2">
            <Snowflake className="w-4 h-4 text-cyan-400" />
            <span>
              KEYBOARD FROZEN BY POWER CARD: Typing is locked for {freezeSecondsLeft} seconds. Countdown timer continues!
            </span>
          </div>
        </div>
      )}

      {compState.activeRoundId === 'round3' && compState.powerCardEffects.flashbangConstraint && (
        <div className="bg-amber-950/80 border-b border-amber-800 px-6 py-2 flex items-center gap-2 text-amber-300 text-xs font-mono">
          <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{compState.powerCardEffects.flashbangConstraint}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Problem Spec & Instructions (5 Cols) */}
        <div className="lg:col-span-5 border-r border-neutral-800 bg-neutral-950/70 p-5 overflow-y-auto max-h-[calc(100vh-140px)] space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                {activeRound.roundTitle}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono border border-neutral-700">
                {activeRound.maxPoints} Points
              </span>
            </div>
            <h2 className="text-base font-bold text-neutral-100 mt-1">
              {activeRound.activityTitle}
            </h2>
            <div className="text-xs text-neutral-400 mt-0.5">
              Allocated Time: {activeRound.durationMinutes} Minutes
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Problem Statement
            </h3>
            <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed bg-neutral-900/60 p-3.5 rounded-lg border border-neutral-800">
              {activeRound.description}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Constraints
            </h3>
            <ul className="text-xs text-neutral-400 space-y-1 font-mono list-disc list-inside bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
              {activeRound.constraints.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Sample Input
              </span>
              <pre className="text-xs font-mono bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 text-neutral-200 overflow-x-auto">
                {activeRound.sampleInput}
              </pre>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Sample Output
              </span>
              <pre className="text-xs font-mono bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 text-emerald-400 overflow-x-auto">
                {activeRound.sampleOutput}
              </pre>
            </div>
          </div>

          {activeRound.explanation && (
            <div className="p-3 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300">Explanation: </span>
              {activeRound.explanation}
            </div>
          )}

          {/* Submission Feedback Alert */}
          {submitFeedback && (
            <div
              id="submission-feedback-alert"
              className={`p-3.5 rounded-lg border text-xs font-mono ${
                submitFeedback.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {submitFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                {submitFeedback.message}
              </div>
              {submitFeedback.details && (
                <pre className="mt-2 text-[11px] text-neutral-300 whitespace-pre-wrap bg-neutral-950/80 p-2 rounded border border-neutral-800">
                  {submitFeedback.details}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Code Editor & Execution Panel (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col bg-neutral-950 overflow-hidden max-h-[calc(100vh-140px)]">
          {/* Editor Action Bar */}
          <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-mono text-neutral-300 font-medium">
                solution.c <span className="text-neutral-500">(C11 Browser Runtime)</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="reset-starter-code-btn"
                onClick={handleResetCode}
                disabled={isEditorDisabled}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 transition disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Starter
              </button>
            </div>
          </div>

          {/* Code Textarea with Freeze Overlay */}
          <div className="relative flex-1 min-h-[340px] flex">
            {isKeyboardFrozen && (
              <div className="absolute inset-0 z-20 bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-cyan-300 font-mono text-center p-4">
                <Snowflake className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                <span className="text-sm font-bold uppercase tracking-wider">
                  Keyboard Frozen
                </span>
                <span className="text-xs text-neutral-400 mt-1">
                  Typing is locked for {freezeSecondsLeft} seconds.
                </span>
                <span className="text-[11px] text-neutral-500 mt-0.5">
                  The round countdown timer continues running!
                </span>
              </div>
            )}

            {timerState.timeOver && (
              <div className="absolute inset-0 z-20 bg-neutral-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-rose-400 font-mono text-center p-4">
                <AlertTriangle className="w-10 h-10 text-rose-500 mb-2" />
                <span className="text-sm font-bold uppercase tracking-wider">
                  TIME OVER
                </span>
                <span className="text-xs text-neutral-400 mt-1">
                  The countdown timer has reached zero. Code editor and execution are disabled.
                </span>
              </div>
            )}

            <textarea
              id="c-code-editor-textarea"
              value={currentCode}
              disabled={isEditorDisabled}
              onChange={(e) =>
                setCompState((prev) => ({
                  ...prev,
                  editorCode: {
                    ...prev.editorCode,
                    [prev.activeRoundId]: e.target.value
                  }
                }))
              }
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full h-full p-4 font-mono text-xs bg-neutral-950 text-neutral-200 resize-none outline-none border-none leading-relaxed selection:bg-neutral-800"
              placeholder="// Write standard C code here..."
            />
          </div>

          {/* Stdin & Controls Strip */}
          <div className="border-t border-neutral-800 bg-neutral-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                Standard Input (stdin)
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                Ctrl+Enter to Run Code
              </span>
            </div>
            <textarea
              id="stdin-input-textarea"
              rows={2}
              value={currentStdin}
              disabled={timerState.timeOver}
              onChange={(e) =>
                setCompState((prev) => ({
                  ...prev,
                  standardInput: {
                    ...prev.standardInput,
                    [prev.activeRoundId]: e.target.value
                  }
                }))
              }
              className="w-full p-2 text-xs font-mono bg-neutral-950 rounded border border-neutral-800 text-neutral-200 resize-none outline-none focus:border-neutral-700"
              placeholder="Provide standard input for testing..."
            />

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  id="run-code-btn"
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting || timerState.timeOver}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-40 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isRunning ? 'Running...' : 'RUN CODE'}
                </button>

                <button
                  id="submit-code-btn"
                  onClick={handleSubmitCode}
                  disabled={
                    isRunning ||
                    isSubmitting ||
                    !timerState.started ||
                    timerState.submitted ||
                    timerState.timeOver
                  }
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-40 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Verifying...' : 'SUBMIT CODE'}
                </button>
              </div>

              {lastExecutionTime != null && (
                <span className="text-[11px] font-mono text-neutral-500">
                  Execution: {lastExecutionTime}ms
                </span>
              )}
            </div>
          </div>

          {/* Terminal Output & Diagnostics View */}
          <div className="border-t border-neutral-800 bg-neutral-950 p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="font-semibold uppercase tracking-wider">Terminal Output / Diagnostics</span>
              {diagnosticError && (
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Error Detected
                </span>
              )}
            </div>

            {diagnosticError && (
              <pre
                id="terminal-diagnostic-error"
                className="p-2.5 rounded bg-rose-950/50 border border-rose-900/60 text-rose-300 text-[11px] whitespace-pre-wrap"
              >
                {diagnosticError}
              </pre>
            )}

            <pre
              id="terminal-stdout-output"
              className="text-neutral-300 whitespace-pre-wrap bg-neutral-900/50 p-2.5 rounded border border-neutral-800 min-h-[50px]"
            >
              {stdout || '(Program stdout will appear here after clicking Run Code)'}
            </pre>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TeamModal
        isOpen={isTeamModalOpen}
        selectedTeam={compState.selectedTeam}
        onSelectTeam={(team) => {
          setCompState((prev) => ({ ...prev, selectedTeam: team }));
          setIsTeamModalOpen(false);
        }}
        onClose={() => setIsTeamModalOpen(false)}
        canClose={Boolean(compState.selectedTeam)}
      />

      <PowerCardsModal
        isOpen={isPowerCardsOpen}
        onClose={() => setIsPowerCardsOpen(false)}
        isRound3Running={compState.activeRoundId === 'round3' && timerState.started && !timerState.timeOver}
        powerCardEffects={compState.powerCardEffects}
        onApplyCard={handleApplyPowerCard}
      />

      <ResultsModal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        team={compState.selectedTeam}
        submissions={compState.submissions}
        onResetAll={() => {
          const fresh = getInitialState();
          setCompState(fresh);
          saveCompetitionState(fresh);
          setIsResultsOpen(false);
          setIsTeamModalOpen(true);
        }}
      />
    </div>
  );
}

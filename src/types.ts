export type TeamId = string; // e.g. "Team 01" to "Team 21"

export type RoundId = 'round1_a' | 'round1_b' | 'round2' | 'round3';

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
  isHidden?: boolean;
}

export interface ProblemSpec {
  id: RoundId;
  roundTitle: string;
  activityTitle: string;
  durationMinutes: number;
  maxPoints: number;
  description: string;
  constraints: string[];
  sampleInput: string;
  sampleOutput: string;
  explanation?: string;
  starterCode: string;
  testCases: TestCase[];
}

export interface PowerCardState {
  cardId: 'flashbang' | 'freeze' | 'shield' | 'timewarp' | 'turboboost';
  name: string;
  description: string;
  icon: string;
  isPositive: boolean;
  costPoints: number;
}

export interface ActivePowerCardEffects {
  shieldActive: boolean;
  freezeUntil: number | null; // timestamp ms
  flashbangConstraint: string | null;
  timeAdjustSeconds: number; // accumulated warped/boosted seconds
  history: Array<{
    cardId: string;
    cardName: string;
    appliedAt: string;
    details: string;
  }>;
}

export interface SubmissionRecord {
  id: string;
  team: TeamId;
  roundId: RoundId;
  roundTitle: string;
  activityTitle: string;
  startDatetime: string;
  submissionDatetime: string;
  durationSeconds: number;
  attempts: number;
  score: number;
  status: 'COMPLETED' | 'TIME_OVER' | 'FAILED';
  code: string;
  testResultsSummary: string;
}

export interface RoundTimerState {
  roundId: RoundId;
  started: boolean;
  startDatetime: string | null; // ISO string
  endDatetime: string | null;   // ISO string (target deadline)
  submitted: boolean;
  submissionDatetime: string | null;
  timeOver: boolean;
  elapsedSeconds: number;
}

export interface CompetitionState {
  selectedTeam: TeamId | null;
  activeRoundId: RoundId;
  timers: Record<RoundId, RoundTimerState>;
  editorCode: Record<RoundId, string>;
  standardInput: Record<RoundId, string>;
  attempts: Record<RoundId, number>;
  submissions: SubmissionRecord[];
  powerCardEffects: ActivePowerCardEffects;
}

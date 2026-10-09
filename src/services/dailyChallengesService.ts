import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Card, HandGroups, CombinationRank } from '../core/hazari/types';
import { evaluate3CardGroup, evaluateExtraGroup } from '../core/hazari/evaluator';
import { ArrangementStrategy } from '../core/hazari/arranger';

export type ChallengeGoalType =
  | 'TROY_ARCHITECT'
  | 'DUAL_RUN'
  | 'COLOUR_RUN_TITAN'
  | 'FLUSH_DYNASTY'
  | 'BALANCED_TACTICIAN'
  | 'PAIR_FORTRESS'
  | 'HONOR_COMMANDER'
  | 'ANCHOR_GUARD'
  | 'ACE_HIGH_ROYAL';

export interface DailyArrangementChallenge {
  id: string;
  type: ChallengeGoalType;
  title: string;
  description: string;
  instruction: string;
  target: number;
  current: number;
  isCompleted: boolean;
  isClaimed: boolean;
  rewardXp: number;
  badge: string; // e.g. "TROY", "DUAL RUN", "FLUSH"
  icon: string;
}

export interface UserChallengeProfile {
  userId: string;
  totalXp: number;
  currentLevel: number;
  levelTitle: string;
  currentLevelXp: number;
  nextLevelXp: number;
  streakDays: number;
  lastActiveDate: string;
  dateKey: string;
  challenges: DailyArrangementChallenge[];
  completedCount: number;
  claimedCount: number;
  updatedAt: number;
}

const LEVEL_THRESHOLDS: { level: number; title: string; minXp: number; maxXp: number }[] = [
  { level: 1, title: 'Novice Arranger', minXp: 0, maxXp: 300 },
  { level: 2, title: 'Card Sorter', minXp: 300, maxXp: 700 },
  { level: 3, title: 'Pair Builder', minXp: 700, maxXp: 1200 },
  { level: 4, title: 'Run Specialist', minXp: 1200, maxXp: 1800 },
  { level: 5, title: 'Flush Architect', minXp: 1800, maxXp: 2500 },
  { level: 6, title: 'Trio Master', minXp: 2500, maxXp: 3400 },
  { level: 7, title: 'Tactical Strategist', minXp: 3400, maxXp: 4400 },
  { level: 8, title: 'EV Virtuoso', minXp: 4400, maxXp: 5600 },
  { level: 9, title: 'Hazari Champion', minXp: 5600, maxXp: 7000 },
  { level: 10, title: 'Grandmaster Arranger', minXp: 7000, maxXp: 8600 },
  { level: 11, title: 'Championship Elite', minXp: 8600, maxXp: 10500 },
  { level: 12, title: 'Hazari Immortal', minXp: 10500, maxXp: 15000 },
];

export function calculateLevelFromXp(totalXp: number) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = LEVEL_THRESHOLDS[i];
    if (totalXp >= t.minXp) {
      const currentLevelXp = totalXp - t.minXp;
      const nextLevelXp = t.maxXp - t.minXp;
      return {
        level: t.level,
        title: t.title,
        currentLevelXp,
        nextLevelXp,
      };
    }
  }
  return {
    level: 1,
    title: 'Novice Arranger',
    currentLevelXp: totalXp,
    nextLevelXp: 300,
  };
}

const CHALLENGE_POOL_TEMPLATES: Omit<
  DailyArrangementChallenge,
  'id' | 'current' | 'isCompleted' | 'isClaimed'
>[] = [
  {
    type: 'TROY_ARCHITECT',
    title: 'Royal Troy Architect',
    description: 'Construct an arrangement featuring a Troy (Three-of-a-Kind)',
    instruction: 'Place 3 cards of the exact same rank in Group 1, 2, or 3',
    target: 1,
    rewardXp: 400,
    badge: 'TROY',
    icon: 'Crown',
  },
  {
    type: 'DUAL_RUN',
    title: 'Dual Run Specialist',
    description: 'Arrange a hand containing at least two Runs across groups',
    instruction: 'Create two separate sequential 3-card Runs (Straight or Colour Run)',
    target: 2,
    rewardXp: 350,
    badge: 'DUAL RUN',
    icon: 'Sparkles',
  },
  {
    type: 'COLOUR_RUN_TITAN',
    title: 'Colour Run Titan',
    description: 'Lock in a Straight Flush (Colour Run) in Group 1 or 2',
    instruction: 'Arrange 3 consecutive cards of the identical suit in your top groups',
    target: 1,
    rewardXp: 450,
    badge: 'COLOUR RUN',
    icon: 'Flame',
  },
  {
    type: 'FLUSH_DYNASTY',
    title: 'Flush Dynasty',
    description: 'Form an arrangement with 2 or more Flush/Colour groups',
    instruction: 'Place same-suit cards into at least two distinct 3-card groups',
    target: 2,
    rewardXp: 320,
    badge: 'FLUSH',
    icon: 'Layers',
  },
  {
    type: 'BALANCED_TACTICIAN',
    title: 'Balanced EV Tactician',
    description: 'Submit an arrangement using Balanced EV with Pair or better across 3 groups',
    instruction: 'Select Balanced strategy and ensure Group 1, 2, and 3 have at least a Pair',
    target: 2,
    rewardXp: 280,
    badge: 'STRATEGY',
    icon: 'Brain',
  },
  {
    type: 'PAIR_FORTRESS',
    title: 'Double Pair Fortress',
    description: 'Lock in a hand containing at least 2 distinct Pairs',
    instruction: 'Place matching rank pairs in two of your 3-card groups',
    target: 3,
    rewardXp: 260,
    badge: 'PAIRS',
    icon: 'Shield',
  },
  {
    type: 'HONOR_COMMANDER',
    title: 'Honors Commander',
    description: 'Place 5 or more scoring honors in Group 1 and Group 2 combined',
    instruction: 'Pack your top two groups with Aces, Kings, Queens, Jacks, or 10s',
    target: 2,
    rewardXp: 320,
    badge: 'HONORS',
    icon: 'Target',
  },
  {
    type: 'ANCHOR_GUARD',
    title: 'Quad Anchor Guard',
    description: 'Arrange your 4th group (4-card anchor) with 30+ honor points',
    instruction: 'Place at least 3 high honors (A, K, Q, J, 10) in Group 4',
    target: 2,
    rewardXp: 300,
    badge: 'ANCHOR',
    icon: 'Zap',
  },
  {
    type: 'ACE_HIGH_ROYAL',
    title: 'Ace High Royal',
    description: 'Form Group 1 with an Ace-high Straight, Colour Run, or Ace Troy',
    instruction: 'Lead Group 1 with an Ace as the highest card in a Run or Troy',
    target: 1,
    rewardXp: 420,
    badge: 'ACE HIGH',
    icon: 'Award',
  },
];

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate 3 daily arrangement challenges deterministically seeded by date
export function generateDailyChallenges(dateKey: string): DailyArrangementChallenge[] {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }

  const pool = [...CHALLENGE_POOL_TEMPLATES];
  const selected: typeof CHALLENGE_POOL_TEMPLATES = [];
  let seed = Math.abs(hash) || 987654;

  while (selected.length < 3 && pool.length > 0) {
    seed = (seed * 9301 + 49297) % 233280;
    const index = Math.floor((seed / 233280) * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected.map((tpl, idx) => ({
    ...tpl,
    id: `dc_${dateKey}_${idx}_${tpl.type}`,
    current: 0,
    isCompleted: false,
    isClaimed: false,
  }));
}

// Test a submitted arrangement to determine which challenge goals were satisfied
export function testArrangementGoals(
  groups: HandGroups,
  strategy?: ArrangementStrategy
): ChallengeGoalType[] {
  const satisfied: ChallengeGoalType[] = [];
  if (!groups || !groups.group1 || !groups.group2 || !groups.group3 || !groups.group4) {
    return satisfied;
  }

  const eval1 = evaluate3CardGroup(groups.group1);
  const eval2 = evaluate3CardGroup(groups.group2);
  const eval3 = evaluate3CardGroup(groups.group3);
  const eval4 = evaluateExtraGroup(groups.group4);

  const evals = [eval1, eval2, eval3];

  // 1. TROY_ARCHITECT
  const hasTroy = evals.some((ev) => ev.category === CombinationRank.TROY);
  if (hasTroy) {
    satisfied.push('TROY_ARCHITECT');
  }

  // 2. DUAL_RUN
  const runCount = [eval1, eval2, eval3, eval4].filter(
    (ev) => ev.category === CombinationRank.RUN || ev.category === CombinationRank.COLOUR_RUN
  ).length;
  if (runCount >= 2) {
    satisfied.push('DUAL_RUN');
  }

  // 3. COLOUR_RUN_TITAN
  if (
    eval1.category === CombinationRank.COLOUR_RUN ||
    eval2.category === CombinationRank.COLOUR_RUN
  ) {
    satisfied.push('COLOUR_RUN_TITAN');
  }

  // 4. FLUSH_DYNASTY
  const flushCount = evals.filter(
    (ev) => ev.category === CombinationRank.COLOUR || ev.category === CombinationRank.COLOUR_RUN
  ).length;
  if (flushCount >= 2) {
    satisfied.push('FLUSH_DYNASTY');
  }

  // 5. BALANCED_TACTICIAN
  const allPairOrBetter = evals.every((ev) => ev.category >= CombinationRank.PAIR);
  if (allPairOrBetter && (strategy === 'balanced' || strategy === 'optimal_ev')) {
    satisfied.push('BALANCED_TACTICIAN');
  }

  // 6. PAIR_FORTRESS
  const pairCount = evals.filter((ev) => ev.category >= CombinationRank.PAIR).length;
  if (pairCount >= 2) {
    satisfied.push('PAIR_FORTRESS');
  }

  // 7. HONOR_COMMANDER
  const topHonors = [...groups.group1, ...groups.group2].filter((c) => c.points === 10).length;
  if (topHonors >= 5) {
    satisfied.push('HONOR_COMMANDER');
  }

  // 8. ANCHOR_GUARD
  const group4Points = groups.group4.reduce((sum, c) => sum + c.points, 0);
  if (group4Points >= 30) {
    satisfied.push('ANCHOR_GUARD');
  }

  // 9. ACE_HIGH_ROYAL
  const group1HasAce = groups.group1.some((c) => c.rank === 'A');
  if (group1HasAce && eval1.category >= CombinationRank.RUN) {
    satisfied.push('ACE_HIGH_ROYAL');
  }

  return satisfied;
}

// Get or initialize user's daily challenge document
export async function getOrInitDailyChallenges(userId: string): Promise<UserChallengeProfile> {
  const dateKey = getTodayDateKey();
  const docId = `challenges_${userId}_${dateKey}`;
  const docRef = doc(db, 'user_missions', docId);

  // Fallback storage key
  const storageKey = `hazari_challenges_${userId}_${dateKey}`;

  // Read stored total XP from local storage
  let storedTotalXp = 0;
  let storedStreak = 1;
  try {
    const rawXp = localStorage.getItem(`hazari_total_xp_${userId}`);
    if (rawXp) storedTotalXp = parseInt(rawXp, 10) || 0;
    const rawStreak = localStorage.getItem(`hazari_challenge_streak_${userId}`);
    if (rawStreak) storedStreak = parseInt(rawStreak, 10) || 1;
  } catch {}

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserChallengeProfile;
      if (data.dateKey === dateKey) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Firestore challenges read notice:', err);
  }

  // Check localStorage for today
  try {
    const local = localStorage.getItem(storageKey);
    if (local) {
      const parsed = JSON.parse(local) as UserChallengeProfile;
      if (parsed.dateKey === dateKey) {
        return parsed;
      }
    }
  } catch {}

  // Create new challenges for today
  const challenges = generateDailyChallenges(dateKey);
  const levelInfo = calculateLevelFromXp(storedTotalXp);

  const initialDoc: UserChallengeProfile = {
    userId,
    totalXp: storedTotalXp,
    currentLevel: levelInfo.level,
    levelTitle: levelInfo.title,
    currentLevelXp: levelInfo.currentLevelXp,
    nextLevelXp: levelInfo.nextLevelXp,
    streakDays: storedStreak,
    lastActiveDate: dateKey,
    dateKey,
    challenges,
    completedCount: 0,
    claimedCount: 0,
    updatedAt: Date.now(),
  };

  try {
    await setDoc(docRef, initialDoc, { merge: true });
  } catch (err) {
    console.warn('Firestore challenges save notice:', err);
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(initialDoc));
  } catch {}

  return initialDoc;
}

// Progress challenges when a player locks in an arrangement
export async function advanceArrangementGoals(
  userId: string,
  groups: HandGroups,
  strategy?: ArrangementStrategy
): Promise<{
  profile: UserChallengeProfile;
  completedAny: boolean;
  completedList: DailyArrangementChallenge[];
}> {
  const profile = await getOrInitDailyChallenges(userId);
  const matchedTypes = testArrangementGoals(groups, strategy);

  if (matchedTypes.length === 0) {
    return { profile, completedAny: false, completedList: [] };
  }

  let changed = false;
  const completedList: DailyArrangementChallenge[] = [];

  profile.challenges.forEach((ch) => {
    if (!ch.isCompleted && matchedTypes.includes(ch.type)) {
      ch.current = Math.min(ch.target, ch.current + 1);
      if (ch.current >= ch.target) {
        ch.isCompleted = true;
        completedList.push(ch);
      }
      changed = true;
    }
  });

  if (changed) {
    profile.completedCount = profile.challenges.filter((c) => c.isCompleted).length;
    profile.updatedAt = Date.now();

    const dateKey = profile.dateKey;
    const docId = `challenges_${userId}_${dateKey}`;
    try {
      await updateDoc(doc(db, 'user_missions', docId), {
        challenges: profile.challenges,
        completedCount: profile.completedCount,
        updatedAt: profile.updatedAt,
      });
    } catch {}

    try {
      localStorage.setItem(`hazari_challenges_${userId}_${dateKey}`, JSON.stringify(profile));
    } catch {}
  }

  return {
    profile,
    completedAny: completedList.length > 0,
    completedList,
  };
}

// Claim challenge bonus XP reward
export async function claimChallengeReward(
  userId: string,
  challengeId: string
): Promise<UserChallengeProfile> {
  const profile = await getOrInitDailyChallenges(userId);
  const target = profile.challenges.find((c) => c.id === challengeId);

  if (!target || !target.isCompleted || target.isClaimed) {
    return profile;
  }

  target.isClaimed = true;
  profile.claimedCount = profile.challenges.filter((c) => c.isClaimed).length;

  // Add bonus XP (with streak bonus e.g. +5% per streak day up to +25%)
  const streakMultiplier = 1 + Math.min(0.25, (profile.streakDays - 1) * 0.05);
  const earnedXp = Math.round(target.rewardXp * streakMultiplier);

  profile.totalXp += earnedXp;

  // Recalculate level
  const levelInfo = calculateLevelFromXp(profile.totalXp);
  profile.currentLevel = levelInfo.level;
  profile.levelTitle = levelInfo.title;
  profile.currentLevelXp = levelInfo.currentLevelXp;
  profile.nextLevelXp = levelInfo.nextLevelXp;
  profile.updatedAt = Date.now();

  const dateKey = profile.dateKey;
  const docId = `challenges_${userId}_${dateKey}`;

  try {
    await updateDoc(doc(db, 'user_missions', docId), {
      challenges: profile.challenges,
      claimedCount: profile.claimedCount,
      totalXp: profile.totalXp,
      currentLevel: profile.currentLevel,
      levelTitle: profile.levelTitle,
      currentLevelXp: profile.currentLevelXp,
      nextLevelXp: profile.nextLevelXp,
      updatedAt: profile.updatedAt,
    });
  } catch {}

  // Update user profile in Firestore
  try {
    await updateDoc(doc(db, 'users', userId), {
      totalXp: profile.totalXp,
      level: profile.currentLevel,
      streakDays: profile.streakDays,
    });
  } catch {}

  try {
    localStorage.setItem(`hazari_challenges_${userId}_${dateKey}`, JSON.stringify(profile));
    localStorage.setItem(`hazari_total_xp_${userId}`, profile.totalXp.toString());
  } catch {}

  return profile;
}

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export type MissionType =
  | 'WIN_ROUNDS'
  | 'SCORE_POINTS'
  | 'PLAY_MATCHES'
  | 'TRIO_MASTER'
  | 'HIGH_ROLLER'
  | 'AGENT_CHALLENGER'
  | 'LEAD_TRICK';

export interface DailyMission {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  target: number;
  current: number;
  isCompleted: boolean;
  isClaimed: boolean;
  rewardXp: number;
  rewardChips: number;
  icon: string;
}

export interface DailyMissionsDoc {
  userId: string;
  dateKey: string;
  missions: DailyMission[];
  claimedCount: number;
  updatedAt: number;
}

const MISSION_POOL_TEMPLATES: Omit<DailyMission, 'id' | 'current' | 'isCompleted' | 'isClaimed'>[] = [
  {
    type: 'WIN_ROUNDS',
    title: 'Round Dominator',
    description: 'Win 2 rounds with top score in running tables',
    target: 2,
    rewardXp: 150,
    rewardChips: 600,
    icon: 'Trophy',
  },
  {
    type: 'SCORE_POINTS',
    title: 'Point Accumulator',
    description: 'Score a cumulative 400+ points across your matches',
    target: 400,
    rewardXp: 200,
    rewardChips: 800,
    icon: 'Target',
  },
  {
    type: 'PLAY_MATCHES',
    title: 'Tournament Grinder',
    description: 'Play 2 complete Hazari 1000-point games',
    target: 2,
    rewardXp: 250,
    rewardChips: 1000,
    icon: 'Gamepad2',
  },
  {
    type: 'TRIO_MASTER',
    title: 'Royal Trio Hunter',
    description: 'Lock in a 13-card arrangement featuring a 3-of-a-kind Trio',
    target: 1,
    rewardXp: 180,
    rewardChips: 750,
    icon: 'Sparkles',
  },
  {
    type: 'HIGH_ROLLER',
    title: 'High Roller Strike',
    description: 'Win a round taking 90 or more points in a single deal',
    target: 1,
    rewardXp: 220,
    rewardChips: 900,
    icon: 'Zap',
  },
  {
    type: 'AGENT_CHALLENGER',
    title: 'Bot Buster',
    description: 'Defeat all 3 AI agents in a table and win the championship',
    target: 1,
    rewardXp: 300,
    rewardChips: 1200,
    icon: 'Shield',
  },
  {
    type: 'LEAD_TRICK',
    title: 'Trick Commander',
    description: 'Win 4 individual tricks in tricks play',
    target: 4,
    rewardXp: 160,
    rewardChips: 650,
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

// Generate 3 randomized missions seeded deterministically by (userId + dateKey)
export function generateRandomMissions(userId: string, dateKey: string): DailyMission[] {
  let hash = 0;
  const seedStr = `${userId}_${dateKey}`;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }

  // Shuffle pool using simple pseudo-random generator
  const pool = [...MISSION_POOL_TEMPLATES];
  const shuffled: typeof MISSION_POOL_TEMPLATES = [];
  let currentSeed = Math.abs(hash) || 1234567;

  while (pool.length > 0) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const index = Math.floor((currentSeed / 233280) * pool.length);
    shuffled.push(pool.splice(index, 1)[0]);
  }

  const selected = shuffled.slice(0, 3);
  return selected.map((tpl, idx) => ({
    ...tpl,
    id: `m_${dateKey}_${idx}_${tpl.type}`,
    current: 0,
    isCompleted: false,
    isClaimed: false,
  }));
}

export async function getOrInitDailyMissions(userId: string): Promise<DailyMissionsDoc> {
  const dateKey = getTodayDateKey();
  const docId = `${userId}_${dateKey}`;
  const docRef = doc(db, 'user_missions', docId);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DailyMissionsDoc;
    }

    // Initialize fresh 3 randomized missions for today
    const missions = generateRandomMissions(userId, dateKey);
    const newDoc: DailyMissionsDoc = {
      userId,
      dateKey,
      missions,
      claimedCount: 0,
      updatedAt: Date.now(),
    };

    await setDoc(docRef, newDoc);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`hazari_daily_missions_${userId}`, JSON.stringify(newDoc));
    }
    return newDoc;
  } catch (err) {
    console.warn('Daily missions Firestore read failed, falling back to local:', err);
    // Local storage fallback
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`hazari_daily_missions_${userId}`);
        if (cached) {
          const parsed = JSON.parse(cached) as DailyMissionsDoc;
          if (parsed.dateKey === dateKey) return parsed;
        }
      } catch {}
    }

    const localMissions = generateRandomMissions(userId, dateKey);
    const fallbackDoc: DailyMissionsDoc = {
      userId,
      dateKey,
      missions: localMissions,
      claimedCount: 0,
      updatedAt: Date.now(),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(`hazari_daily_missions_${userId}`, JSON.stringify(fallbackDoc));
    }
    return fallbackDoc;
  }
}

export async function claimMissionReward(userId: string, missionId: string): Promise<DailyMissionsDoc> {
  const dateKey = getTodayDateKey();
  const docId = `${userId}_${dateKey}`;
  const docRef = doc(db, 'user_missions', docId);

  const currentData = await getOrInitDailyMissions(userId);
  const updatedMissions = currentData.missions.map((m) => {
    if (m.id === missionId && m.isCompleted && !m.isClaimed) {
      return { ...m, isClaimed: true };
    }
    return m;
  });

  const claimedCount = updatedMissions.filter((m) => m.isClaimed).length;
  const updatedDoc: DailyMissionsDoc = {
    ...currentData,
    missions: updatedMissions,
    claimedCount,
    updatedAt: Date.now(),
  };

  try {
    await updateDoc(docRef, {
      missions: updatedMissions,
      claimedCount,
      updatedAt: Date.now(),
    });
  } catch {}

  if (typeof window !== 'undefined') {
    localStorage.setItem(`hazari_daily_missions_${userId}`, JSON.stringify(updatedDoc));
  }

  return updatedDoc;
}

export async function advanceMissionProgress(
  userId: string,
  eventType: MissionType,
  amount: number = 1
): Promise<DailyMissionsDoc> {
  const dateKey = getTodayDateKey();
  const docId = `${userId}_${dateKey}`;
  const docRef = doc(db, 'user_missions', docId);

  const currentData = await getOrInitDailyMissions(userId);
  let changed = false;

  const updatedMissions = currentData.missions.map((m) => {
    if (m.type === eventType && !m.isCompleted) {
      const nextVal = Math.min(m.target, m.current + amount);
      const isCompleted = nextVal >= m.target;
      changed = true;
      return {
        ...m,
        current: nextVal,
        isCompleted,
      };
    }
    return m;
  });

  if (!changed) return currentData;

  const updatedDoc: DailyMissionsDoc = {
    ...currentData,
    missions: updatedMissions,
    updatedAt: Date.now(),
  };

  try {
    await updateDoc(docRef, {
      missions: updatedMissions,
      updatedAt: Date.now(),
    });
  } catch {}

  if (typeof window !== 'undefined') {
    localStorage.setItem(`hazari_daily_missions_${userId}`, JSON.stringify(updatedDoc));
  }

  return updatedDoc;
}

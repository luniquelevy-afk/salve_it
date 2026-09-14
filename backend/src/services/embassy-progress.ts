// Progression entre entretiens (V1.3) : calcul déterministe, sans appel IA.
import { REPORT_DIMENSIONS, type ReportDimension, type VisaType } from './embassy-prompts.js';

export interface ProgressPoint {
  sessionId: string;
  completedAt: string;
  visaType: VisaType;
  scenarioLabel: string | null;
  overallScore: number;
  dimensions: Partial<Record<ReportDimension, number>>;
  inconsistencyTopics: string[];
}

const normalizeTopic = (topic: string) => topic.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

export function computeEmbassyProgress(points: ProgressPoint[]) {
  const sessions = [...points].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  if (sessions.length === 0) return { sessions, summary: null };

  const first = sessions[0]!;
  const latest = sessions.at(-1)!;
  const previous = sessions.length > 1 ? sessions.at(-2)! : null;

  const dimensions = REPORT_DIMENSIONS.map((key) => {
    const latestValue = latest.dimensions[key] ?? null;
    const previousValue = previous?.dimensions[key] ?? null;
    const firstValue = first.dimensions[key] ?? null;
    return {
      key,
      first: firstValue,
      previous: previousValue,
      latest: latestValue,
      deltaFromPrevious: latestValue !== null && previousValue !== null ? latestValue - previousValue : null,
      deltaFromFirst: latestValue !== null && firstValue !== null && sessions.length > 1 ? latestValue - firstValue : null,
    };
  });

  // Un même sujet d'incohérence dans au moins deux entretiens : point de discours à retravailler.
  const topicSessions = new Map<string, { label: string; count: number }>();
  for (const session of sessions) {
    for (const topic of new Set(session.inconsistencyTopics.map(normalizeTopic))) {
      const original = session.inconsistencyTopics.find((candidate) => normalizeTopic(candidate) === topic) ?? topic;
      const entry = topicSessions.get(topic) ?? { label: original, count: 0 };
      entry.count += 1;
      topicSessions.set(topic, entry);
    }
  }

  const rated = dimensions.filter((dimension) => dimension.latest !== null);
  const weakest = rated.length > 0 ? rated.reduce((min, dimension) => (dimension.latest! < min.latest! ? dimension : min)) : null;

  return {
    sessions,
    summary: {
      count: sessions.length,
      overall: {
        first: first.overallScore,
        previous: previous?.overallScore ?? null,
        latest: latest.overallScore,
        deltaFromPrevious: previous ? latest.overallScore - previous.overallScore : null,
        deltaFromFirst: sessions.length > 1 ? latest.overallScore - first.overallScore : null,
      },
      dimensions,
      weakestDimension: weakest ? { key: weakest.key, score: weakest.latest! } : null,
      recurringInconsistencies: [...topicSessions.values()].filter((entry) => entry.count >= 2).sort((a, b) => b.count - a.count).map((entry) => ({ topic: entry.label, sessions: entry.count })),
      latestInconsistencyTopics: latest.inconsistencyTopics,
    },
  };
}

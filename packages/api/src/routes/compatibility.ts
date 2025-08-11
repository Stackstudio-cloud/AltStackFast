import { Router } from 'express';
import { firestore } from '../server';
import { FieldValue } from '@google-cloud/firestore';
import { adminAuthMiddleware } from '../middleware/auth';
import { mockTools } from './tools';

const router = Router();

// Weighted overlap-based compatibility with category boost and optional verified integrations
function jaccard(setA: Set<string>, setB: Set<string>): number {
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const uni = new Set([...setA, ...setB]).size || 1;
  return inter / uni;
}

function normalizeList(list: any): Set<string> {
  return new Set(((list || []) as any[]).map((s) => String(s).toLowerCase()).filter(Boolean));
}

function scoreCompatibility(a: any, b: any): number {
  const catsA = normalizeList(a.category);
  const catsB = normalizeList(b.category);
  const intsA = normalizeList(a.integrations);
  const intsB = normalizeList(b.integrations);
  const vintsA = normalizeList(a.verified_integrations);
  const vintsB = normalizeList(b.verified_integrations);
  const frA = normalizeList(a.frameworks);
  const frB = normalizeList(b.frameworks);
  const langA = normalizeList(a.languages || a.supported_languages);
  const langB = normalizeList(b.languages || b.supported_languages);
  const limA = normalizeList(a.known_limitations);
  const limB = normalizeList(b.known_limitations);

  const integrationScore = jaccard(intsA, intsB);
  const categoryScore = jaccard(catsA, catsB);
  const verifiedScore = vintsA.size > 0 && vintsB.size > 0 ? jaccard(vintsA, vintsB) : 0;
  const frameworkScore = frA.size > 0 && frB.size > 0 ? jaccard(frA, frB) : 0;
  const languageScore = langA.size > 0 && langB.size > 0 ? jaccard(langA, langB) : 0;
  const categoryBoost = [...catsA].some((x) => catsB.has(x)) ? 0.05 : 0;
  const limitationPenalty = limA.size > 0 && limB.size > 0 ? jaccard(limA, limB) : 0;

  // Weighted combination
  let score =
    0.55 * integrationScore +
    0.2 * categoryScore +
    0.1 * verifiedScore +
    0.1 * frameworkScore +
    0.05 * languageScore -
    0.2 * limitationPenalty +
    categoryBoost;
  if (Number.isNaN(score)) score = 0;
  if (score > 1) score = 1;
  return Number(score.toFixed(3));
}

router.get('/', async (req, res) => {
  try {
    const toolId = String(req.query.tool_id || '');
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 5), 20));
    const persist = String(req.query.persist || '').toLowerCase() === 'true';
    if (!toolId) return res.status(400).json({ success: false, error: 'tool_id required' });

    let tools: any[] = [];
    if (firestore) {
      const snap = await firestore.collection('tools').get();
      tools = snap.docs.map((d) => d.data());
    } else {
      tools = mockTools;
    }
    const base = tools.find((t) => t.tool_id === toolId);
    if (!base) return res.status(404).json({ success: false, error: 'tool not found' });

    const scoredRaw = tools
      .filter((t) => t.tool_id !== toolId)
      .map((t) => ({ other: t, score: scoreCompatibility(base, t) }))
      .map((x) => {
        const popA = Number(base.popularity_score ?? 0) || 0;
        const popB = Number(x.other.popularity_score ?? 0) || 0;
        const avgPop = (popA + popB) / 2;
        const rankScore = Number((x.score * (1 + avgPop * 0.2)).toFixed(3));
        return { tool_id: x.other.tool_id, name: x.other.name, score: x.score, rankScore };
      })
      .sort((a, b) => b.rankScore - a.rankScore);

    const scored = scoredRaw.slice(0, limit);

    if (persist && firestore) {
      const batch = firestore.batch();
      for (const m of scored) {
        const ref = firestore.collection('tools').doc(toolId).collection('compatibility').doc(m.tool_id);
        batch.set(ref, { score: m.score, rank_score: m.rankScore, updated_at: new Date() }, { merge: true });
      }
      await batch.commit();
    }

    return res.json({ success: true, tool_id: toolId, matches: scored, count: scored.length });
  } catch (e) {
    return res.status(500).json({ success: false, error: (e as Error)?.message || 'failed' });
  }
});

export default router;

// Admin: recompute compatibilities for all tools and persist top matches per tool
router.post('/recompute-all', adminAuthMiddleware, async (req, res) => {
  try {
    if (!firestore) return res.status(500).json({ success: false, error: 'Firestore unavailable' });
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 10), 50));

    const snapshot = await firestore.collection('tools').get();
    const tools = snapshot.docs.map((d) => d.data());

    let totalWrites = 0;
    for (const base of tools) {
      const baseId = base.tool_id;
      const scored = tools
        .filter((t) => t.tool_id !== baseId)
        .map((t) => {
          const score = scoreCompatibility(base, t);
          const popA = Number(base.popularity_score ?? 0) || 0;
          const popB = Number(t.popularity_score ?? 0) || 0;
          const rankScore = Number((score * (1 + ((popA + popB) / 2) * 0.2)).toFixed(3));
          return { other: t, score, rankScore };
        })
        .sort((a, b) => b.rankScore - a.rankScore)
        .slice(0, limit);

      // Persist per base tool
      let batch = firestore.batch();
      let ops = 0;
      for (const m of scored) {
        const ref = firestore.collection('tools').doc(baseId).collection('compatibility').doc(m.other.tool_id);
        batch.set(ref, { score: m.score, rank_score: m.rankScore, updated_at: new Date(), name: m.other.name }, { merge: true });
        ops += 1; totalWrites += 1;
        if (ops >= 450) { await batch.commit(); batch = firestore.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();

      // Update summary on tool doc
      const topRank = scored[0]?.rankScore ?? 0;
      const countAbove = scored.filter((x) => x.rankScore >= 0.7).length;
      await firestore.collection('tools').doc(baseId).set({
        compatibility_summary: {
          top_rank_score: topRank,
          count_above_0_7: countAbove,
          last_computed_at: new Date(),
        }
      }, { merge: true });
    }

    return res.json({ success: true, toolsProcessed: tools.length, writes: totalWrites });
  } catch (e) {
    return res.status(500).json({ success: false, error: (e as Error)?.message || 'failed' });
  }
});



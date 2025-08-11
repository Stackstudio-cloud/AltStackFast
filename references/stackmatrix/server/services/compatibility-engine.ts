export interface ToolLike {
  id: string;
  name: string;
  categoryId?: string;
  frameworks?: string[];
  languages?: string[];
  features?: string[];
  integrations?: string[];
  maturityScore?: number;
}

export interface CompatibilityResult {
  toolOneId: string;
  toolTwoId: string;
  compatibilityScore: number; // 0-100
  notes: string;
  verifiedIntegration: number;
  integrationDifficulty: 'easy' | 'medium' | 'hard';
  setupSteps: string[];
  dependencies: string[];
}

export class CompatibilityEngine {
  calculateCompatibility(toolA: ToolLike, toolB: ToolLike): CompatibilityResult {
    let score = 50;
    const notes: string[] = [];
    const setupSteps: string[] = [];
    const dependencies: string[] = [];

    const categoryScore = this.calculateCategoryCompatibility(toolA, toolB);
    score += categoryScore * 0.25;
    if (categoryScore > 0) notes.push('Category synergy');

    const frameworkScore = this.calculateFrameworkCompatibility(toolA, toolB);
    score += frameworkScore * 0.2;
    const languageScore = this.calculateLanguageCompatibility(toolA, toolB);
    score += languageScore * 0.15;

    const integrationScore = this.calculateIntegrationCompatibility(toolA, toolB);
    score += integrationScore * 0.2;
    if (integrationScore > 0) setupSteps.push(`Configure integration for ${toolA.name} + ${toolB.name}`);

    const featureScore = this.calculateFeatureCompatibility(toolA, toolB);
    score += featureScore * 0.15;

    score += this.calculateMaturityAlignment(toolA, toolB) * 0.05;
    score = Math.max(0, Math.min(100, score));

    const difficulty = score >= 75 ? 'easy' : score >= 55 ? 'medium' : 'hard';

    return {
      toolOneId: toolA.id,
      toolTwoId: toolB.id,
      compatibilityScore: Math.round(score * 10) / 10,
      notes: notes.join('; '),
      verifiedIntegration: integrationScore > 30 ? 1 : 0,
      integrationDifficulty: difficulty,
      setupSteps,
      dependencies,
    };
  }

  private calculateCategoryCompatibility(a: ToolLike, b: ToolLike): number {
    if (a.categoryId && a.categoryId === b.categoryId) return 30;
    return 10;
  }
  private calculateFrameworkCompatibility(a: ToolLike, b: ToolLike): number {
    const A = new Set(a.frameworks || []); const B = new Set(b.frameworks || []);
    if (!A.size || !B.size) return 0;
    const inter = [...A].filter((x) => B.has(x)).length;
    const base = Math.max(A.size, B.size);
    return (inter / base) * 40;
  }
  private calculateLanguageCompatibility(a: ToolLike, b: ToolLike): number {
    const A = new Set(a.languages || []); const B = new Set(b.languages || []);
    if (!A.size || !B.size) return 0;
    const inter = [...A].filter((x) => B.has(x)).length;
    const base = Math.max(A.size, B.size);
    return (inter / base) * 30;
  }
  private calculateIntegrationCompatibility(a: ToolLike, b: ToolLike): number {
    const A = (a.integrations || []).map((x) => x.toLowerCase());
    const B = (b.integrations || []).map((x) => x.toLowerCase());
    if (!A.length || !B.length) return 0;
    if (A.some((i) => i.includes(b.name.toLowerCase())) || B.some((i) => i.includes(a.name.toLowerCase()))) return 50;
    const Aset = new Set(A); const inter = B.filter((x) => Aset.has(x)).length;
    const base = Math.max(A.length, B.length);
    return (inter / base) * 35;
  }
  private calculateFeatureCompatibility(a: ToolLike, b: ToolLike): number {
    const A = (a.features || []).map((x) => x.toLowerCase());
    const B = (b.features || []).map((x) => x.toLowerCase());
    if (!A.length || !B.length) return 0;
    const pairs = [ ['code generation','debug'], ['ui','backend'], ['hosting','database'] ];
    let score = 0;
    for (const [fa,fb] of pairs) {
      if (A.some((x)=>x.includes(fa)) && B.some((y)=>y.includes(fb))) score += 15;
    }
    const overlap = A.filter((x)=>B.some((y)=>y.includes(x))).length * 5;
    return Math.max(0, score - overlap);
  }
  private calculateMaturityAlignment(a: ToolLike, b: ToolLike): number {
    const ma = Number(a.maturityScore || 0), mb = Number(b.maturityScore || 0);
    return Math.max(0, 10 - Math.abs(ma - mb));
  }
}



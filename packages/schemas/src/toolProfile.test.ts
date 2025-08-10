import { describe, it, expect } from 'vitest';
import { toolProfileSchema } from './toolProfile';

describe('toolProfileSchema', () => {
  it('accepts a minimal valid profile', () => {
    const sample = {
      tool_id: 'replit',
      name: 'Replit',
      description: 'IDE',
      category: ['Cloud IDE'],
      last_updated: new Date().toISOString(),
      schema_version: '2025-08-04',
    };
    const parsed = toolProfileSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid maturity_score', () => {
    const bad = {
      tool_id: 't',
      name: 't',
      description: 'd',
      category: ['x'],
      last_updated: new Date().toISOString(),
      schema_version: '2025-08-04',
      maturity_score: 2,
    };
    const parsed = toolProfileSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});



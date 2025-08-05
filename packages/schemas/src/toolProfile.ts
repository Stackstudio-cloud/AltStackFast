import { z } from 'zod';

export const toolProfileSchema = z.object({
  tool_id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.array(z.string()),
  notable_strengths: z.array(z.string()).optional(),
  known_limitations: z.array(z.string()).optional(),
  output_types: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  license: z.string().nullable().optional(),
  maturity_score: z.number().min(0).max(1).nullable().optional(),
  last_updated: z.string().datetime(),
  schema_version: z.string(),
  requires_review: z.boolean().optional(),
});

export type ToolProfile = z.infer<typeof toolProfileSchema>; 
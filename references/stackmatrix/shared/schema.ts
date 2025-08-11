import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const toolCategories = pgTable("tool_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#FF4500"), // neon-orange default
});

export const tools = pgTable("tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id").notNull().references(() => toolCategories.id),
  url: text("url"),
  frameworks: jsonb("frameworks").$type<string[]>().default([]),
  languages: jsonb("languages").$type<string[]>().default([]),
  features: jsonb("features").$type<string[]>().default([]),
  integrations: jsonb("integrations").$type<string[]>().default([]),
  maturityScore: real("maturity_score").notNull().default(0),
  popularityScore: real("popularity_score").notNull().default(0),
  pricing: text("pricing"),
  notes: text("notes"),
  setupComplexity: text("setup_complexity").default("medium"),
  costTier: text("cost_tier").default("free"),
  performanceImpact: jsonb("performance_impact").$type<{ buildTime?: string; bundleSize?: string }>(),
  apiLastSync: timestamp("api_last_sync", { mode: 'date' }),
});

export const compatibilities = pgTable("compatibilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolOneId: varchar("tool_one_id").notNull().references(() => tools.id),
  toolTwoId: varchar("tool_two_id").notNull().references(() => tools.id),
  compatibilityScore: real("compatibility_score").notNull(),
  notes: text("notes"),
  verifiedIntegration: integer("verified_integration").notNull().default(0),
  integrationDifficulty: text("integration_difficulty").default("medium"),
  setupSteps: jsonb("setup_steps").$type<string[]>(),
  codeExample: text("code_example"),
  dependencies: jsonb("dependencies").$type<string[]>(),
});

export type Tool = typeof tools.$inferSelect;
export type Compatibility = typeof compatibilities.$inferSelect;



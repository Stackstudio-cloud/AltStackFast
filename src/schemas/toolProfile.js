"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolProfileSchema = void 0;
const zod_1 = require("zod");
exports.toolProfileSchema = zod_1.z.object({
    tool_id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    category: zod_1.z.array(zod_1.z.string()),
    notable_strengths: zod_1.z.array(zod_1.z.string()).optional(),
    known_limitations: zod_1.z.array(zod_1.z.string()).optional(),
    output_types: zod_1.z.array(zod_1.z.string()).optional(),
    integrations: zod_1.z.array(zod_1.z.string()).optional(),
    license: zod_1.z.string().nullable().optional(),
    maturity_score: zod_1.z.number().min(0).max(1).nullable().optional(),
    last_updated: zod_1.z.string().datetime(),
    schema_version: zod_1.z.string(),
    requires_review: zod_1.z.boolean().optional(),
});

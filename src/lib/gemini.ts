import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { toolProfileSchema } from '../schemas/toolProfile.js';

// Create a simplified JSON schema for Gemini API
const toolProfileJsonSchema = {
  type: "object",
  properties: {
    tool_id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    category: { type: "array", items: { type: "string" } },
    notable_strengths: { type: "array", items: { type: "string" } },
    known_limitations: { type: "array", items: { type: "string" } },
    output_types: { type: "array", items: { type: "string" } },
    integrations: { type: "array", items: { type: "string" } },
    license: { type: "string" },
    maturity_score: { type: "number", minimum: 0, maximum: 1 },
    last_updated: { type: "string" },
    schema_version: { type: "string" },
    requires_review: { type: "boolean" }
  },
  required: ["tool_id", "name", "description", "category", "last_updated", "schema_version"]
};

// The strict prompt template with guardrails.
const PROMPT_TEMPLATE = `
You are an expert software analyst. Your task is to analyze the text content from a tool's website and populate a structured JSON object based on the provided schema.

RULES:
1. Analyze the following text content carefully.
2. If you cannot find information for a specific field, set its value to null. DO NOT GUESS OR HALLUCINATE.
3. Your entire response must be ONLY the valid JSON object. Do not include any conversational text, markdown formatting, or any other characters.
4. For the tool_id field, use a lowercase, hyphenated version of the tool name.
5. For the last_updated field, use the current date in ISO format.
6. For the schema_version field, use "2025-08-04".

## Website Text Content:
---
{textContent}
---
`;

export async function callGeminiToAnalyze(textContent: string): Promise<any> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined.');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: PROMPT_TEMPLATE.replace('{textContent}', textContent) }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toolProfileJsonSchema,
      temperature: 0.1, // Low temperature for less creative, more factual responses
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();

  if (result.candidates && result.candidates.length > 0) {
    // The API returns the structured JSON as a string in the 'text' field.
    return JSON.parse(result.candidates[0].content.parts[0].text);
  } else {
    throw new Error("Invalid or empty response from Gemini API.");
  }
} 
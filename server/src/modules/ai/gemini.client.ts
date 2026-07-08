/**
 * @file gemini.client.ts
 * @description Thin wrapper around Google Gemini's generateContent API.
 * Uses Node 18+ native fetch — no extra package needed.
 */

import { envConfig } from '@/config/env.config';
import logger from '@/utils/logger';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function generateWithGemini(prompt: string): Promise<string | null> {
  const { geminiApiKey, geminiModel } = envConfig.ai;

  if (!geminiApiKey) {
    logger.warn('[gemini.client] No GEMINI_API_KEY set — skipping AI generation');
    return null;
  }

  try {
    const url = `${GEMINI_ENDPOINT}/${geminiModel}:generateContent?key=${geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 400,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('[gemini.client] Gemini API error', { status: response.status, errText });
      return null;
    }

    const data = (await response.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return typeof text === 'string' ? text.trim() : null;
  } catch (error) {
    logger.error('[gemini.client] Gemini request failed', { error });
    return null;
  }
}
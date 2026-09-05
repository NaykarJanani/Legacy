// ─────────────────────────────────────────────────────────────────────────────
// sarvamTranslate.js
// Sarvam AI Translation API
// Translates biography chapter text (English → Gujarati or Hindi)
// Docs: https://docs.sarvam.ai/api-reference-docs/endpoints/translate
// ─────────────────────────────────────────────────────────────────────────────
import { SarvamAIClient } from "sarvamai";


const client = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY,
});


// Sarvam translate has a ~1000 word limit per request
// For long chapters we split by paragraphs and translate each
const CHAR_LIMIT = 900;

async function translateChunk(text, sourceLang, targetLang) {
  const response = await client.text.translate({
    input: text,
    source_language_code: sourceLang,
    target_language_code: targetLang,
    speaker_gender: "Male",
    mode: "formal",
    model: "mayura:v1",
    enable_preprocessing: true,
  });
  return response.translated_text ?? text;
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export async function sarvamTranslate(text, sourceLang = 'en-IN', targetLang = 'gu-IN') {
  if (!text?.trim()) return text;

  // Split long text into chunks at paragraph boundaries
  if (text.length <= CHAR_LIMIT) {
    return translateChunk(text, sourceLang, targetLang);
  }

  const paragraphs = text.split(/\n\n+/);
  const chunks     = [];
  let   current    = '';

  for (const para of paragraphs) {
    if ((current + para).length > CHAR_LIMIT && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current) chunks.push(current.trim());

  const translated = [];
  for (const chunk of chunks) {
    const result = await translateChunk(chunk, sourceLang, targetLang);
    translated.push(result);
  }

  return translated.join('\n\n');
}
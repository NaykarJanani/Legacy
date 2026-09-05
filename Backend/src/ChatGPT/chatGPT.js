import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Sends a prompt to GPT-4o-mini.
 * If schema is provided, forces structured JSON output using OpenAI's
 * json_schema response_format — the response is guaranteed valid JSON
 * matching your schema, or an error is returned.
 *
 * @param {string} prompt   - The user prompt text
 * @param {object|null} schema - Optional JSON Schema object for structured output
 * @returns {object} Normalised response with all fields AIReqResModel expects
 */
export default async function createResponse(prompt, schema = null) {
  try {

    const messages = [{ role: 'user', content: prompt }];

    // Build request options — add response_format only when schema is given
    const requestOptions = {
      model: 'gpt-4o-mini',
      messages,
    };

    if (schema) {
      requestOptions.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'biography_response',
          strict: true,
          schema,
        },
      };
    }

    const resp = await client.chat.completions.create(requestOptions);
    console.log("\n================ GPT RAW RESPONSE ================\n");
console.log(resp.choices[0].message.content);
console.log("\n==================================================\n");

    const choice       = resp.choices[0];
    const rawContent   = choice?.message?.content ?? '';
    const finishReason = choice?.finish_reason   ?? 'unknown';

    // Parse JSON when schema was requested
    let jsonData  = null;
    let isValid   = false;
    const errors  = [];

    if (schema) {
      // finish_reason === 'content_filter' or 'length' means incomplete output
      if (finishReason !== 'stop') {
        errors.push(`Unexpected finish_reason: ${finishReason}`);
      } else {
        try {
          jsonData = JSON.parse(rawContent);
          console.log("\n================ PARSED JSON ================\n");
console.dir(jsonData, { depth: null });
console.log("\n=============================================\n");
          isValid  = true;
        } catch (parseErr) {
          errors.push(`JSON parse failed: ${parseErr.message}`);
        }
      }
    }

    return {
      gptId:   resp.id,
      usage:   resp.usage,           // { prompt_tokens, completion_tokens, total_tokens }
      status:  finishReason,         // 'stop' | 'length' | 'content_filter'
      type:    schema ? 'json' : 'text',
      model:   resp.model,
      content: rawContent,
      json:    jsonData,             // parsed object or null
      match:   isValid,              // true only when JSON parsed without error
      errors,                        // array of error strings, empty on success
    };

  } catch (err) {

    // Log full error server-side for debugging
    console.error('[chatGPT] OpenAI API error:', err?.message ?? err);

    // Return a safe error shape — never throw from here
    // AIReqResModel checks status === 'error' and throws before DB insert
    return {
      gptId:   null,
      usage:   null,
      status:  'error',
      type:    'error',
      model:   null,
      content: '',
      json:    null,
      match:   false,
      errors:  [err?.message ?? 'Unknown OpenAI error'],
    };

  }
}
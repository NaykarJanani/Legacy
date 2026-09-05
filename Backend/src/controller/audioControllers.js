import fs from "fs";
import OpenAI from "openai";
import apiResponse from "../utils/apiResponse.js";
import { audioModel } from "../models/audioModel.js";
import pool from "../config/db/db_config.js";
import { sarvamTranscribeFile } from "../sarvam/sarvamSTT.js";
import { sarvamTranslate }      from "../sarvam/sarvamTranslate.js";

const openai = new OpenAI({
  apiKey:     process.env.OPENAI_API_KEY,
  timeout:    20 * 60 * 1000,
  maxRetries: 2,
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPER — Whisper transcription
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeFile(filePath) {
  const MAX_ATTEMPTS = 3;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Whisper attempt ${attempt}/${MAX_ATTEMPTS}...`);
      const fileStream = fs.createReadStream(filePath);
      const whisperResponse = await openai.audio.transcriptions.create(
        {
          file:            fileStream,
          model:           "whisper-1",
          response_format: "verbose_json",
          prompt:          "This is a biographical interview in Gujarati, Hindi, and English. The speaker may switch between all three languages. Transcribe everything accurately including Gujarati script.",
        },
        {
          timeout: 10 * 60 * 1000,  // 10 min per attempt
        }
      );
      return {
        text:     whisperResponse.text,
        segments: whisperResponse.segments ?? [],
        duration: whisperResponse.duration ? Math.round(whisperResponse.duration) : null,
        full: {
          text:     whisperResponse.text,
          duration: whisperResponse.duration,
          language: whisperResponse.language,
        },
      };
    } catch (err) {
      lastError = err;
      console.log(`Attempt ${attempt} failed: ${err?.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const wait = attempt * 5000;  // 5s, 10s between retries
        console.log(`Waiting ${wait/1000}s before retry...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Q/A MODE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function buildMappingPrompt(transcript, questionSchema, category) {
  const questionList = questionSchema
    .map(q =>
      `[${q.session_id}|${q.sub_session_id}|${q.question_id}] ` +
      `${q.session_title} → ${q.sub_session_title}: ${q.question}`
    )
    .join("\n");

  const categoryContext = category === "school"
    ? "The subject is an educator, school founder, or educational institution leader in India."
    : category === "msme"
    ? "The subject is an entrepreneur or MSME business owner in India."
    : "The subject is an individual sharing their life story in India.";

  return `You are a senior biography researcher and multilingual interview analyst specializing in Indian biographical documentation.

SUBJECT CONTEXT:
${categoryContext}
This is a biographical interview for a life story book. Every answer — even partial, even indirect — is valuable for the biography.

LANGUAGE CONTEXT — CRITICAL:
The interview transcript is in a natural mix of Gujarati, Hindi, and English. This is completely normal for Indian interviews.
- You MUST understand and process Gujarati, Hindi, and English equally.
- NEVER skip or ignore content because it is in Gujarati or Hindi.
- Extract answers in the ORIGINAL language spoken — do not translate.
- Common patterns you will see:
  * Gujarati: "મારું નામ...", "હું...માં જન્મ્યો", "અમારી સ્કૂલ...", "મેં...કર્યું"
  * Hindi: "मेरा नाम...", "मैं...में पैदा हुआ", "हमने...", "मुझे..."
  * English mixed in: names, places, years, titles

BIOGRAPHY QUESTION BANK (${questionSchema.length} questions — you must attempt ALL):
${questionList}

INTERVIEW TRANSCRIPT:
"""
${transcript}
"""

YOUR TASK:
Read the ENTIRE transcript carefully. Then go through EVERY question in the question bank one by one and extract the most relevant portion of the transcript that answers it.

EXTRACTION RULES:
1. READ THE FULL TRANSCRIPT before starting to map — do not stop halfway.
2. For EVERY one of the ${questionSchema.length} questions, you must provide either an extracted answer or null.
3. Extract answers even if they are partial, indirect, brief, or in Gujarati or Hindi.
4. One spoken segment can answer multiple questions — use the same extracted text for different questions if relevant.
5. Names, places, years, relationships, emotions mentioned ANYWHERE are valuable — map them to the most relevant question.
6. Do NOT force irrelevant content — if truly nothing relates to a question, set extracted_answer to null.
7. Do NOT translate — keep extracted answers in original spoken language.
8. Do NOT invent content — only extract what is actually spoken.

CONFIDENCE SCORING:
- 85-100 (high): Question directly and clearly answered
- 60-84 (high): Question well answered with good detail
- 40-59 (medium): Question partially answered or indirectly addressed
- 20-39 (low): Very briefly mentioned, loosely related
- 1-19 (low): Barely related, very indirect mention
- 0 + null: Nothing in transcript relates to this question

DUPLICATE PREVENTION:
- Each question_id must appear EXACTLY ONCE in your output.
- If multiple transcript segments relate to one question, combine them into one extracted_answer.

Return ONLY a valid JSON array with exactly ${questionSchema.length} elements — one per question.
Each element must have exactly these fields:
{
  "session_id": <number>,
  "sub_session_id": <number>,
  "question_id": <number>,
  "question_text": <string>,
  "extracted_answer": <string or null>,
  "confidence_score": <number 0-100>,
  "confidence_label": <"high"|"medium"|"low">,
  "source_start_time": <string or null>,
  "source_end_time": <string or null>
}

FINAL CHECK before returning:
- Did you include all ${questionSchema.length} questions?
- Did you check the full transcript for each question?
- Did you extract Gujarati and Hindi content properly?
- Are there any duplicate question_ids? Remove them.`;
}

async function callGPTMapping(prompt) {
  const response = await openai.chat.completions.create({
    model:           "gpt-4o-mini",
    messages:        [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw    = response.choices[0]?.message?.content ?? "{}";
  let parsed   = JSON.parse(raw);
  if (Array.isArray(parsed))                              return parsed;
  if (parsed.mappings && Array.isArray(parsed.mappings)) return parsed.mappings;
  if (parsed.answers  && Array.isArray(parsed.answers))  return parsed.answers;
  const firstArray = Object.values(parsed).find(v => Array.isArray(v));
  return firstArray ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// STORY MODE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function buildStoryPrompt(transcript, category, language = "en") {

  const schoolChapters = [
    { number: 1, title: "Roots of the Founder",      focus: "Childhood, birthplace, family background, early values, grandparents, village life, upbringing" },
    { number: 2, title: "The Spark of Education",    focus: "Why education was chosen, inspiring incidents, social problems seen, emotional vision, calling" },
    { number: 3, title: "The Founding Journey",      focus: "How the school started, year established, first students, financial struggles, early supporters, first classroom" },
    { number: 4, title: "Educational Philosophy",    focus: "Beliefs about education, child development, values, discipline, creativity, parent role, what makes school meaningful" },
    { number: 5, title: "Building School Culture",   focus: "School traditions, staff values, student wellbeing, parent trust, diversity, team leadership" },
    { number: 6, title: "Challenges and Triumphs",   focus: "Obstacles faced, government or society challenges, failures, moments of breakthrough, resilience" },
    { number: 7, title: "Vision for the Future",     focus: "Dreams for students, society, institution, legacy, what success means, future plans" },
  ];

  const msmeChapters = [
    { number: 1, title: "Early Life and Roots",         focus: "Childhood, family, values, village or city upbringing, early memories, parents influence" },
    { number: 2, title: "The Entrepreneurial Spark",    focus: "First business idea, what inspired it, what problem was being solved, early ambitions" },
    { number: 3, title: "Building the Business",        focus: "How business started, first customers, team, products or services, early struggles" },
    { number: 4, title: "Challenges and Growth",        focus: "Obstacles, failures, financial pressure, competition, lessons learned, turning points" },
    { number: 5, title: "Leadership and Values",        focus: "Management style, team culture, business philosophy, what drives decisions" },
    { number: 6, title: "Impact and Legacy",            focus: "Community impact, awards, recognition, future vision, what success means, advice to others" },
  ];

  const chapters = category === "school" ? schoolChapters : msmeChapters;

  const chapterList = chapters
    .map(c => `Chapter ${c.number}: ${c.title}\nFocus areas: ${c.focus}`)
    .join("\n\n");

  return `You are a professional biography writer specializing in Indian life stories.

You have received a transcript of a recorded interview. Your job is to convert this transcript into a chapter-wise biography draft in a warm, first-person narrative style suitable for a published biography book.

SUBJECT CONTEXT:
This is a ${category === "school" ? "school founder or educator" : "entrepreneur or MSME business owner"} from India sharing their life story.

LANGUAGE NOTE:
The transcript may contain Gujarati, Hindi, and English mixed together. You must understand all three languages.
${language === "gu"
  ? "Write the entire biography draft in Gujarati (ગુજરાતી script). Use warm, literary Gujarati suitable for a published biography book."
  : language === "hi"
  ? "Write the entire biography draft in Hindi (Devanagari script). Use warm, literary Hindi suitable for a published biography book."
  : "Write the biography draft in clean, warm English regardless of which language was spoken in the transcript."
}
CHAPTERS TO WRITE:
${chapterList}

INTERVIEW TRANSCRIPT:
"""
${transcript}
"""

WRITING INSTRUCTIONS:
1. For each chapter write 2-4 paragraphs in warm first-person narrative style.
   Examples: "I was born in a small village...", "My father always believed...", "When I started the school..."
   STRICT BOUNDARY RULE: Each chapter must ONLY contain content relevant to its own focus areas listed above.
   Do NOT end a chapter by transitioning into the next chapter's topic.
   Do NOT write sentences like "This upbringing would later inspire me to..." at the end of Chapter 1 — that belongs in Chapter 2.
   Each chapter must end on its own topic, not as a bridge to the next.
2. Use ONLY content from the transcript — do not invent facts, names, dates, or events.
3. If the transcript has rich content for a chapter — write detailed paragraphs.
4. If the transcript has partial content for a chapter — write what is available and add this at the end of that chapter:
   [EDITOR: Please add more details about {chapter title}]
5. If the transcript has NO content for a chapter — set draft_content to exactly:
   [EDITOR: This chapter was not covered in the audio interview. Please interview the subject or add details manually.]
6. Maintain the person's authentic voice and emotion — pride, struggle, warmth, determination.
7. Do not use generic filler sentences. Every sentence must come from what was actually spoken.
8. Translate naturally — if someone said "મારા પિતા શિક્ષક હતા" write "My father was a teacher."

Return ONLY a valid JSON object in this exact format:
{
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "Roots of the Founder",
      "draft_content": "I was born in a small village called Dehloli...",
      "is_placeholder": false
    },
    {
      "chapter_number": 2,
      "chapter_title": "The Spark of Education",
      "draft_content": "[EDITOR: This chapter was not covered in the audio interview. Please interview the subject or add details manually.]",
      "is_placeholder": true
    }
  ]
}`;
}

async function callGPTStoryDraft(prompt) {
  const response = await openai.chat.completions.create({
    model:           "gpt-4o-mini",
    messages:        [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw    = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return parsed.chapters ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Run Whisper on all files in a session
// ─────────────────────────────────────────────────────────────────────────────
async function runTranscription(session) {
  const results = [];
  for (const transcript of session.transcripts) {
    if (transcript.status === "transcribed") {
      results.push({ transcript_id: transcript.transcript_id, text: transcript.transcript_text });
      continue;
    }
    if (!transcript.local_path || !fs.existsSync(transcript.local_path)) {
      await audioModel.markTranscriptFailed({
        transcript_id: transcript.transcript_id,
        error_message: `File not found at path: ${transcript.local_path}`,
      });
      results.push({ transcript_id: transcript.transcript_id, text: null, error: "file not found" });
      continue;
    }
    try {
      console.log("================================");
      console.log("Transcribing:", transcript.original_filename);
      console.log("Path:", transcript.local_path);
      console.log("================================");

       // Detect language from user's category to send the right hint to Sarvam
      // 'unknown' means auto-detect — Sarvam handles mixed Gujarati/Hindi/English well
      const langHint = 'unknown'; // or 'gu-IN' if you always want Gujarati-first

      const sarvamResult = await sarvamTranscribeFile(transcript.local_path, langHint);

      console.log("Sarvam STT Success — length:", sarvamResult.text?.length);

      await audioModel.saveTranscriptText({
        transcript_id:    transcript.transcript_id,
        transcript_text:  sarvamResult.text,
        whisper_response: sarvamResult.full,   // field name stays same — just stores provider data
        duration_seconds: sarvamResult.duration,
      });
      results.push({ transcript_id: transcript.transcript_id, text: sarvamResult.text });
    } catch (err) {
      console.log("Sarvam STT FAILED:", err?.message);
      await audioModel.markTranscriptFailed({
        transcript_id: transcript.transcript_id,
        error_message: err?.message ?? "Sarvam STT transcription failed",
      });
      results.push({ transcript_id: transcript.transcript_id, text: null, error: err?.message });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 1 — Upload audio files
// POST /api/audio/upload          (customer — user_id from JWT)
// POST /api/audio/upload/:user_id (admin — user_id from URL)
// ─────────────────────────────────────────────────────────────────────────────
export const uploadAudioFiles = async (req, res, next) => {
  try {
    const user_id = req.params.user_id ?? req.user.id;
    const { label, notes } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json(
        apiResponse(false, "At least one audio file is required", [], req.rrn)
      );
    }

    const audioSession = await audioModel.createAudioSession({
      user_id:     Number(user_id),
      uploaded_by: req.user.id,
      label:       label || null,
      total_files: files.length,
      notes:       notes || null,
    });

    const transcriptRows = [];
    for (let i = 0; i < files.length; i++) {
      const row = await audioModel.createTranscript({
        audio_session_id:  audioSession.audio_session_id,
        user_id:           Number(user_id),
        file_index:        i + 1,
        original_filename: files[i].originalname,
        local_path:        files[i].path,
      });
      transcriptRows.push(row);
    }

    return res.status(201).json(apiResponse(
      true,
      `${files.length} audio file(s) uploaded. Use /process/${audioSession.audio_session_id} to start transcription.`,
      {
        audio_session_id: audioSession.audio_session_id,
        total_files:      files.length,
        transcripts:      transcriptRows.map(t => ({
          transcript_id:     t.transcript_id,
          file_index:        t.file_index,
          original_filename: t.original_filename,
          status:            t.status,
        })),
      },
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 2 — Process audio session
// POST /api/audio/process/:audio_session_id
// Body: { mode: "qa" | "story" }   — default: "qa"
// Role: admin
// ─────────────────────────────────────────────────────────────────────────────
export const processAudioSession = async (req, res, next) => {
  try {
    const { audio_session_id } = req.params;
    const mode = req.body?.mode === "story" ? "story" : "qa";   // default qa

    const session = await audioModel.getSessionById(Number(audio_session_id));
    if (!session) {
      return res.status(404).json(
        apiResponse(false, "Audio session not found", [], req.rrn)
      );
    }

    if (session.status === "mapped" || session.status === "drafted") {
      return res.status(409).json(
        apiResponse(false, "This session has already been processed", [], req.rrn)
      );
    }

    // Fetch user category
    const userRes = await pool.query(
      `SELECT category FROM users WHERE user_id = $1`,
      [session.user_id]
    );
    const category = userRes.rows[0]?.category ?? "msme";

    // Mark processing
    await audioModel.updateSessionStatus({
      audio_session_id: Number(audio_session_id),
      status: "processing",
    });

    // ── Step A: Transcribe all files ──────────────────────────────────────────
    const transcriptionResults = await runTranscription(session);

    const combinedTranscript = transcriptionResults
      .filter(t => t.text)
      .map((t, i) => `[File ${i + 1}]\n${t.text}`)
      .join("\n\n---\n\n");

    if (!combinedTranscript.trim()) {
      await audioModel.updateSessionStatus({
        audio_session_id: Number(audio_session_id),
        status: "failed",
      });
      return res.status(422).json(apiResponse(
        false,
        "All audio files failed to transcribe. Check file formats and try again.",
        { transcription_results: transcriptionResults },
        req.rrn
      ));
    }

    // ── Step B: Branch by mode ────────────────────────────────────────────────
    if (mode === "story") {
      // ── STORY MODE ──────────────────────────────────────────────────────────
      const language    = req.body?.language ?? "en";   // "en" | "hi" | "gu"
      const storyPrompt = buildStoryPrompt(combinedTranscript, category, language);
      const chapters    = await callGPTStoryDraft(storyPrompt);

      // If language is Gujarati or Hindi, translate each chapter using Sarvam
      // GPT drafts in English first (better quality), then Sarvam translates
      if (language === 'gu' || language === 'hi') {
        const targetLang = language === 'gu' ? 'gu-IN' : 'hi-IN';
        console.log(`[Sarvam Translate] Translating ${chapters.length} chapters to ${targetLang}`);
        for (const chapter of chapters) {
          if (!chapter.is_placeholder && chapter.draft_content) {
            try {
              chapter.draft_content = await sarvamTranslate(
                chapter.draft_content,
                'en-IN',
                targetLang
              );
            } catch (translateErr) {
              console.error(`[Sarvam Translate] Chapter ${chapter.chapter_number} failed:`, translateErr.message);
              // Do not block — keep English draft if translation fails
            }
          }
        }
      }

      const draftsToSave = chapters.map(c => ({
        audio_session_id: Number(audio_session_id),
        user_id:          session.user_id,
        chapter_number:   c.chapter_number,
        chapter_title:    c.chapter_title,
        draft_content:    c.draft_content,
        is_placeholder:   c.is_placeholder ?? false,
      }));

      const savedDrafts = await audioModel.saveChapterDrafts(draftsToSave);

      const placeholderCount = savedDrafts.filter(d => d.is_placeholder).length;
      const contentCount     = savedDrafts.filter(d => !d.is_placeholder).length;

      await audioModel.updateSessionStatus({
        audio_session_id: Number(audio_session_id),
        status: "drafted",
      });

      return res.status(200).json(apiResponse(
        true,
        "Audio processed successfully. Chapter drafts are ready for editor review.",
        {
          audio_session_id:   Number(audio_session_id),
          mode:               "story",
          files_processed:    transcriptionResults.length,
          files_successful:   transcriptionResults.filter(t => t.text).length,
          files_failed:       transcriptionResults.filter(t => t.error).length,
          chapters_generated: savedDrafts.length,
          chapters_with_content:    contentCount,
          chapters_need_editor:     placeholderCount,
        },
        req.rrn
      ));

    } else {
      // ── Q/A MODE ─────────────────────────────────────────────────────────────
      const questionSchema = await audioModel.getQuestionSchemaForUser(session.user_id);
      if (!questionSchema.length) {
        return res.status(422).json(apiResponse(
          false,
          "No questions found for this user's category.",
          [],
          req.rrn
        ));
      }

      const mappingPrompt = buildMappingPrompt(combinedTranscript, questionSchema, category);
      const rawMappings   = await callGPTMapping(mappingPrompt);

      // Deduplicate — keep highest confidence per question_id
      const mappingMap = new Map();
      for (const m of rawMappings) {
        if (!m.question_id) continue;
        const existing = mappingMap.get(m.question_id);
        if (!existing || (m.confidence_score ?? 0) > (existing.confidence_score ?? 0)) {
          mappingMap.set(m.question_id, m);
        }
      }
      const gptMappings = Array.from(mappingMap.values());

      const mappingsToSave = gptMappings
        .filter(m => m.extracted_answer)
        .map(m => ({
          audio_session_id:  Number(audio_session_id),
          transcript_id:     transcriptionResults.find(t => t.text)?.transcript_id ?? null,
          user_id:           session.user_id,
          session_id:        m.session_id,
          sub_session_id:    m.sub_session_id,
          question_id:       m.question_id,
          question_text:     m.question_text,
          extracted_answer:  m.extracted_answer,
          confidence_score:  m.confidence_score  ?? 0,
          confidence_label:  m.confidence_label  ?? "low",
          source_start_time: m.source_start_time ?? null,
          source_end_time:   m.source_end_time   ?? null,
        }));

      const savedMappings = await audioModel.saveMappedAnswers(mappingsToSave);

      const answeredIds = new Set(gptMappings.filter(m => m.extracted_answer).map(m => m.question_id));
      const unanswered  = questionSchema.filter(q => !answeredIds.has(q.question_id));

      await audioModel.updateSessionStatus({
        audio_session_id: Number(audio_session_id),
        status: "mapped",
      });

      return res.status(200).json(apiResponse(
        true,
        "Audio processed successfully. Mapped answers are ready for editor review.",
        {
          audio_session_id:   Number(audio_session_id),
          mode:               "qa",
          files_processed:    transcriptionResults.length,
          files_successful:   transcriptionResults.filter(t => t.text).length,
          files_failed:       transcriptionResults.filter(t => t.error).length,
          answers_mapped:     savedMappings.length,
          confidence_summary: {
            high:   savedMappings.filter(m => m.confidence_label === "high").length,
            medium: savedMappings.filter(m => m.confidence_label === "medium").length,
            low:    savedMappings.filter(m => m.confidence_label === "low").length,
          },
          unanswered_count:     unanswered.length,
          unanswered_questions: unanswered.map(q => ({
            question_id:       q.question_id,
            session_title:     q.session_title,
            sub_session_title: q.sub_session_title,
            question:          q.question,
          })),
        },
        req.rrn
      ));
    }

  } catch (err) {
    try {
      await audioModel.updateSessionStatus({
        audio_session_id: Number(req.params.audio_session_id),
        status: "failed",
      });
    } catch (_) {}
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 3 — Get audio session status
// GET /api/audio/status          (customer)
// GET /api/audio/status/:user_id (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const getAudioStatus = async (req, res, next) => {
  try {
    const user_id  = req.params.user_id ?? req.user.id;
    const sessions = await audioModel.getSessionsByUser(Number(user_id));
    return res.status(200).json(apiResponse(
      true, "Audio sessions fetched", { sessions }, req.rrn
    ));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 4a — Get mapped answers (Q/A mode)
// GET /api/audio/mapped/:audio_session_id
// Role: admin, editor
// ─────────────────────────────────────────────────────────────────────────────
export const getMappedAnswers = async (req, res, next) => {
  try {
    const { audio_session_id } = req.params;
    const session = await audioModel.getSessionById(Number(audio_session_id));
    if (!session) {
      return res.status(404).json(apiResponse(false, "Audio session not found", [], req.rrn));
    }
    const mappings = await audioModel.getMappedAnswers(Number(audio_session_id));
    const grouped  = {};
    for (const m of mappings) {
      const key = m.session_title ?? `session_${m.session_id}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    const stats = {
      total:    mappings.length,
      pending:  mappings.filter(m => m.editor_status === "pending").length,
      approved: mappings.filter(m => m.editor_status === "approved").length,
      rejected: mappings.filter(m => m.editor_status === "rejected").length,
      high:     mappings.filter(m => m.confidence_label === "high").length,
      medium:   mappings.filter(m => m.confidence_label === "medium").length,
      low:      mappings.filter(m => m.confidence_label === "low").length,
    };
    return res.status(200).json(apiResponse(
      true, "Mapped answers fetched",
      { audio_session_id: Number(audio_session_id), session_status: session.status, user_id: session.user_id, stats, chapters: grouped },
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 4b — Get chapter drafts (Story mode)
// GET /api/audio/drafts/:audio_session_id
// Role: admin, editor
// ─────────────────────────────────────────────────────────────────────────────
export const getChapterDrafts = async (req, res, next) => {
  try {
    const { audio_session_id } = req.params;
    const session = await audioModel.getSessionById(Number(audio_session_id));
    if (!session) {
      return res.status(404).json(apiResponse(false, "Audio session not found", [], req.rrn));
    }
    const drafts = await audioModel.getChapterDrafts(Number(audio_session_id));
    const stats  = {
      total:       drafts.length,
      draft:       drafts.filter(d => d.status === "draft").length,
      in_review:   drafts.filter(d => d.status === "in_review").length,
      approved:    drafts.filter(d => d.status === "approved").length,
      placeholder: drafts.filter(d => d.is_placeholder).length,
    };
    return res.status(200).json(apiResponse(
      true, "Chapter drafts fetched",
      { audio_session_id: Number(audio_session_id), session_status: session.status, user_id: session.user_id, stats, drafts },
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 5a — Editor updates a mapped answer (Q/A mode)
// PUT /api/audio/answer/:mapped_answer_id
// Role: editor, admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateMappedAnswer = async (req, res, next) => {
  try {
    const { mapped_answer_id } = req.params;
    const { final_answer, editor_status, editor_notes } = req.body;
    const VALID = ["approved", "rejected", "pending"];
    if (editor_status && !VALID.includes(editor_status)) {
      return res.status(400).json(apiResponse(false, `editor_status must be one of: ${VALID.join(", ")}`, [], req.rrn));
    }
    const updated = await audioModel.updateMappedAnswer({
      mapped_answer_id: Number(mapped_answer_id),
      final_answer:     final_answer  ?? null,
      editor_status:    editor_status ?? null,
      editor_notes:     editor_notes  ?? null,
    });
    if (!updated) {
      return res.status(404).json(apiResponse(false, "Mapped answer not found", [], req.rrn));
    }
    return res.status(200).json(apiResponse(true, "Answer updated", { mapped_answer: updated }, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 5b — Editor updates a chapter draft (Story mode)
// PUT /api/audio/draft/:draft_id
// Role: editor, admin
// Body: { editor_content, status, editor_notes }
// status: "draft" | "in_review" | "approved"
// ─────────────────────────────────────────────────────────────────────────────
export const updateChapterDraft = async (req, res, next) => {
  try {
    const { draft_id } = req.params;
    const { editor_content, status, editor_notes } = req.body;
    const VALID = ["draft", "in_review", "approved"];
    if (status && !VALID.includes(status)) {
      return res.status(400).json(apiResponse(false, `status must be one of: ${VALID.join(", ")}`, [], req.rrn));
    }
    const updated = await audioModel.updateChapterDraft({
      draft_id:       Number(draft_id),
      editor_content: editor_content ?? null,
      status:         status         ?? null,
      editor_notes:   editor_notes   ?? null,
    });
    if (!updated) {
      return res.status(404).json(apiResponse(false, "Draft not found", [], req.rrn));
    }
    return res.status(200).json(apiResponse(true, "Draft updated", { draft: updated }, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 6a — Publish approved Q/A answers → customer_answer
// POST /api/audio/publish/:audio_session_id
// Role: admin, editor
// ─────────────────────────────────────────────────────────────────────────────
export const publishApprovedAnswers = async (req, res, next) => {
  try {
    const { audio_session_id } = req.params;
    const result = await audioModel.publishApprovedAnswers(Number(audio_session_id));
    return res.status(200).json(apiResponse(
      true,
      `${result.published_count} answer(s) published to biography pipeline.`,
      result,
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 6b — Approve all chapter drafts (Story mode)
// POST /api/audio/approve/:audio_session_id
// Role: admin, editor
// ─────────────────────────────────────────────────────────────────────────────
export const approveAllDrafts = async (req, res, next) => {
  try {
    const { audio_session_id } = req.params;
    const approved = await audioModel.approveAllDrafts(Number(audio_session_id));
    return res.status(200).json(apiResponse(
      true,
      `${approved.length} chapter draft(s) approved.`,
      { approved_count: approved.length },
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
};
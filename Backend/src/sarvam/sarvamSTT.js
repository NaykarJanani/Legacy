// ─────────────────────────────────────────────────────────────────────────────
// sarvamSTT.js
// REST API  → files under 30 sec (per-question short answers)
// Batch API → files over 30 sec  (bulk 50-60 min recordings)
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { SarvamAIClient } from "sarvamai";


const client = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY,
});

const BATCH_OUTPUT_DIR = "./sarvam_batch_outputs";

// ── Get audio duration via ffprobe ────────────────────────────────────────────
function getAudioDuration(filePath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf8" }
    );
    return parseFloat(output.trim());
  } catch {
    return 0;
  }
}

// ── BATCH API — for long audio files (30s to 60 min) ─────────────────────────
async function transcribeViaBatchAPI(filePath) {
  console.log(`[Sarvam Batch] Starting batch job for: ${path.basename(filePath)}`);

  if (!fs.existsSync(BATCH_OUTPUT_DIR)) {
    fs.mkdirSync(BATCH_OUTPUT_DIR, { recursive: true });
  }

  // Step 1: Create job
  const job = await client.speechToTextJob.createJob({
    model: "saaras:v3",
    mode: "transcribe",
    languageCode: "unknown",   // auto-detect — handles Gujarati/Hindi/English mix
    withDiarization: false,
  });

  console.log(`[Sarvam Batch] Job created. Uploading file...`);

  // Step 2: Upload file
  await job.uploadFiles([filePath]);

  // Step 3: Start job
  await job.start();
  console.log(`[Sarvam Batch] Job started. Waiting for completion...`);

  // Step 4: Wait for completion (polls internally)
  await job.waitUntilComplete();
  console.log(`[Sarvam Batch] Job complete. Fetching results...`);

  // Step 5: Get results
  const fileResults = await job.getFileResults();

  if (fileResults.failed.length > 0) {
    throw new Error(`Sarvam batch failed: ${fileResults.failed[0]?.error_message}`);
  }

  // Step 6: Download outputs to temp dir
  await job.downloadOutputs(BATCH_OUTPUT_DIR);

  // Step 7: Read the output JSON file Sarvam writes
  const outputFiles = fs.readdirSync(BATCH_OUTPUT_DIR).filter(f => f.endsWith(".json"));
  if (outputFiles.length === 0) {
    throw new Error("Sarvam batch output not found after download");
  }

  // Get the most recently written output file
  const latest = outputFiles
    .map(f => ({ f, t: fs.statSync(path.join(BATCH_OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0].f;

  const raw = fs.readFileSync(path.join(BATCH_OUTPUT_DIR, latest), "utf8");
  const parsed = JSON.parse(raw);

  // Clean up output file after reading
  try { fs.unlinkSync(path.join(BATCH_OUTPUT_DIR, latest)); } catch {}

  const transcript = parsed.transcript ?? parsed.text ?? "";
  console.log(`[Sarvam Batch] Done. Transcript length: ${transcript.length}`);
  return transcript;
}

// ── REST API — for short audio (under 30 sec, per-question answers) ───────────
async function transcribeViaRestAPI(filePath) {
  console.log(`[Sarvam REST] Transcribing: ${path.basename(filePath)}`);
  const audioFile = fs.createReadStream(filePath);
  const response = await client.speechToText.transcribe({
    file: audioFile,
    model: "saaras:v3",
    mode: "transcribe",
  });
  return response.transcript ?? "";
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function sarvamTranscribeFile(filePath, languageCode = "unknown") {
  const duration = getAudioDuration(filePath);
  console.log(`[Sarvam STT] File: ${path.basename(filePath)} | Duration: ${Math.round(duration)}s`);

  let text = "";

  if (duration > 30) {
    // Long file — use Batch API (supports up to 1 hour)
    text = await transcribeViaBatchAPI(filePath);
  } else {
    // Short file — use REST API (instant response)
    text = await transcribeViaRestAPI(filePath);
  }

  return {
    text:     text.trim(),
    segments: [],
    duration: Math.round(duration),
    full: {
      text,
      duration,
      provider: "sarvam",
      model:    "saaras:v3",
      method:   duration > 30 ? "batch" : "rest",
    },
  };
}
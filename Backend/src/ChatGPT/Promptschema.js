/**
 * promptSchema.js
 *
 * Builds the GPT prompt + JSON Schema for each biography chapter (serviceId).
 *
 * HOW IT WORKS:
 *   - serviceId  → POSITIONAL index of the chapter within a user's category
 *                  (see getServiceId() in CircleSubPointsPage.tsx — it's just
 *                  chapterIndex + 1, capped at 11, based on `session.seq ASC,
 *                  session_id ASC` order). It is NOT a fixed universal category —
 *                  serviceId 1 means something different for "school" vs "msme".
 *   - opinion    → the raw answer the user typed (or extracted from audio)
 *   - title      → the specific question being answered
 *   - title_desc → the sub-session label (e.g. "Family & Values → Early Family Memories")
 *
 * Each (category, serviceId) pair gets a tailored system instruction so GPT
 * understands the biographical context and returns consistently structured output.
 *
 * The returned JSON schema is passed to chatGPT.js which sends it as
 * response_format → json_schema, guaranteeing valid structured output.
 *
 * SERVICE ID REFERENCE — "school" category (verified against DB, session_id 219-229,
 * ordered by session_id since seq is currently NULL for all of them):
 *   1  → The Human Behind the Institution
 *   2  → Why This School Was Born
 *   3  → From Dream to Institution
 *   4  → The Soul of the School
 *   5  → Creating an Educational Ecosystem
 *   6  → Storms That Built the Institution
 *   7  → Lives That Became the Legacy
 *   8  → Preparing the Next Generation
 *   9  → The Invisible Contributors
 *   10 → The Legacy Chapter
 *   11 → Guiding the Institution Forward
 *   99 → General / Fallback (any unrecognised serviceId)
 *
 * NOTE: relying on session_id as the ordering tiebreaker is fragile — if a school's
 * sessions are ever re-inserted, deleted, or re-created, the order (and therefore
 * which serviceId each chapter gets) can silently shift. Recommend setting explicit
 * `seq` values (1-11) on these rows so the order is guaranteed regardless of insert order.
 *
 * Other categories (msme / temple / village) still use a generic placeholder chapter
 * set below — replace CHAPTER_CONTEXT.msme / .temple / .village the same way once
 * their real DB session titles are confirmed.
 *
 * CATEGORY-SPECIFIC TONE:
 *   msme    → entrepreneurial, business-focused language
 *   school  → educational, academic institution language
 *   temple  → spiritual, community service language
 *   village → grassroots, rural leadership language
 */

// ─── Chapter context map ─────────────────────────────────────────────────────
// Keyed by category, then by serviceId (1-11). Each entry defines:
//   chapterName  : human-readable chapter title used in the prompt (matches DB session.title)
//   tone         : style instruction for GPT
//   focusPoints  : what GPT should specifically extract and elaborate on

const SCHOOL_CHAPTER_CONTEXT = {
  1: {
    chapterName: 'The Human Behind the Institution',
    tone: 'warm, personal, and humanising',
    focusPoints: [
      'who the founder/educator is as a person, beyond their institutional role',
      'personal background, upbringing, and early influences',
      'personality traits, character, and everyday demeanor',
      'personal passions or interests outside the institution',
      'what people who know them personally would say about them',
    ],
  },
  2: {
    chapterName: 'Why This School Was Born',
    tone: 'reflective, purposeful, and inspiring',
    focusPoints: [
      'the specific moment, problem, or realisation that sparked the idea for the school',
      'the gap in education or community need that was observed',
      'the emotional or personal motivation behind starting the institution',
      'people or experiences that convinced the founder this was necessary',
      'the vision the founder held for what the school could become',
    ],
  },
  3: {
    chapterName: 'From Dream to Institution',
    tone: 'narrative-driven, determined, and detailed',
    focusPoints: [
      'the practical founding journey — first steps taken to make it real',
      'year established, first classroom, first students, first staff',
      'financial struggles, resource constraints, and how they were solved',
      'early supporters, co-founders, or backers who helped it begin',
      'key milestones between having the idea and the school actually opening',
    ],
  },
  4: {
    chapterName: 'The Soul of the School',
    tone: 'philosophical, sincere, and value-driven',
    focusPoints: [
      'the core values and educational philosophy that define the institution',
      'the culture and everyday spirit of the school',
      'what makes this school different from others, in the founder\'s own words',
      'guiding principles behind how students and staff are treated',
      'traditions, rituals, or symbols that embody the school\'s identity',
    ],
  },
  5: {
    chapterName: 'Creating an Educational Ecosystem',
    tone: 'systematic, holistic, and institution-building',
    focusPoints: [
      'how curriculum, teaching methods, or academic programs were built or evolved',
      'the team, teachers, and staff structure assembled around the institution',
      'infrastructure, facilities, and resources developed over time',
      'partnerships, collaborations, or community relationships built',
      'how the school grew from a single idea into a functioning ecosystem',
    ],
  },
  6: {
    chapterName: 'Storms That Built the Institution',
    tone: 'candid, resilient, and transformative',
    focusPoints: [
      'major obstacles, crises, or setbacks the institution faced',
      'financial, regulatory, social, or competitive pressures encountered',
      'how these challenges were confronted and overcome',
      'lessons learned from the most difficult periods',
      'how adversity shaped the institution\'s direction or the founder\'s resolve',
    ],
  },
  7: {
    chapterName: 'Lives That Became the Legacy',
    tone: 'proud, warm, and human-centered',
    focusPoints: [
      'specific students, alumni, or families whose lives were changed',
      'stories of transformation, achievement, or impact tied to real people',
      'testimonials or memories the founder holds about individuals they helped',
      'how the institution\'s impact is felt in the community through people',
      'what it means to the founder to see former students succeed',
    ],
  },
  8: {
    chapterName: 'Preparing the Next Generation',
    tone: 'forward-thinking, educational, and aspirational',
    focusPoints: [
      'how the school prepares students for the future — skills, values, mindset',
      'evolving approaches to education the institution has adopted or plans to',
      'what the founder believes today\'s students most need to succeed',
      'programs or initiatives aimed at future-readiness',
      'the founder\'s philosophy on the purpose of education itself',
    ],
  },
  9: {
    chapterName: 'The Invisible Contributors',
    tone: 'grateful, humble, and acknowledging',
    focusPoints: [
      'family members, staff, teachers, or supporters who worked behind the scenes',
      'sacrifices made by people who are rarely publicly credited',
      'specific individuals the founder wants to thank or recognise',
      'how the institution could not have succeeded without these people',
      'the founder\'s reflections on gratitude and shared credit',
    ],
  },
  10: {
    chapterName: 'The Legacy Chapter',
    tone: 'wise, generous, and legacy-minded',
    focusPoints: [
      'the key message the founder wants to leave for future generations',
      'what they most want to be remembered for',
      'advice for future educators or institution builders',
      'the personal and institutional legacy they hope endures',
      'final words of wisdom tied to their life\'s work',
    ],
  },
  11: {
    chapterName: 'Guiding the Institution Forward',
    tone: 'visionary, optimistic, and forward-looking',
    focusPoints: [
      'the founder\'s vision for the institution\'s future',
      'succession plans or how leadership continues beyond the founder',
      'goals and ambitions not yet accomplished',
      'changes the founder hopes to see in education or the community ahead',
      'how the institution is being positioned for long-term growth',
    ],
  },
};

// Generic placeholder set — used for categories whose real DB chapter titles
// haven't been confirmed yet (currently: msme, temple, village).
const DEFAULT_CHAPTER_CONTEXT = {
  1: {
    chapterName: 'Childhood & Early Life',
    tone: 'warm, nostalgic, and descriptive',
    focusPoints: [
      'birthplace and hometown description',
      'family background and household environment',
      'earliest memories and childhood experiences',
      'cultural and social setting of early years',
      'childhood personality traits and interests',
    ],
  },
  2: {
    chapterName: 'Family & Values',
    tone: 'heartfelt, respectful, and emotionally rich',
    focusPoints: [
      'family members and their roles in shaping the individual',
      'core values instilled by family',
      'family traditions, rituals, and cultural practices',
      'relationships with parents, siblings, and extended family',
      'how family shaped character and decisions',
    ],
  },
  3: {
    chapterName: 'Education & Inspiration',
    tone: 'thoughtful, intellectual, and inspiring',
    focusPoints: [
      'schools, colleges, and institutions attended',
      'subjects of interest and academic achievements',
      'teachers and mentors who had significant influence',
      'pivotal educational moments or turning points',
      'books, ideas, or experiences that sparked inspiration',
    ],
  },
  4: {
    chapterName: 'Purpose & Calling',
    tone: 'reflective, purposeful, and motivational',
    focusPoints: [
      'when and how the sense of purpose was discovered',
      'the calling or mission the individual feels driven by',
      'early signs of this purpose in childhood or youth',
      'how purpose influenced major life decisions',
      'what the individual believes they were meant to do',
    ],
  },
  5: {
    chapterName: 'Career & Founding Journey',
    tone: 'professional, ambitious, and narrative-driven',
    focusPoints: [
      'career beginnings and first professional steps',
      'founding story of the business, institution, or initiative',
      'key milestones, breakthroughs, and pivotal decisions',
      'team members, partners, and collaborators',
      'evolution of the professional journey over time',
    ],
  },
  6: {
    chapterName: 'Philosophy & Beliefs',
    tone: 'philosophical, introspective, and articulate',
    focusPoints: [
      'core life philosophy and guiding principles',
      'spiritual or religious beliefs and their influence',
      'views on leadership, people, and society',
      'how beliefs have been tested and refined over time',
      'quotes or sayings the individual lives by',
    ],
  },
  7: {
    chapterName: 'Challenges & Growth',
    tone: 'candid, resilient, and transformative',
    focusPoints: [
      'major obstacles, failures, and setbacks faced',
      'how challenges were confronted and overcome',
      'lessons learned from difficult periods',
      'how adversity shaped character and wisdom',
      'moments of doubt and how they were resolved',
    ],
  },
  8: {
    chapterName: 'Impact & Legacy',
    tone: 'proud, impactful, and community-focused',
    focusPoints: [
      'tangible impact on people, community, or industry',
      'lives changed or improved through the individual\'s work',
      'recognition, awards, and acknowledgements received',
      'projects, initiatives, or institutions built',
      'how the impact will endure beyond the individual',
    ],
  },
  9: {
    chapterName: 'Message & Legacy',
    tone: 'wise, generous, and legacy-minded',
    focusPoints: [
      'key message the individual wants to leave for future generations',
      'advice for young people starting their journey',
      'what the individual most wants to be remembered for',
      'personal legacy in family, community, and profession',
      'final words of wisdom or encouragement',
    ],
  },
  10: {
    chapterName: 'Vision for the Future',
    tone: 'forward-thinking, optimistic, and visionary',
    focusPoints: [
      'dreams and aspirations for the years ahead',
      'vision for the business, institution, or community',
      'changes the individual hopes to see in society',
      'goals yet to be accomplished',
      'legacy they are still building',
    ],
  },
  11: {
    chapterName: 'Family Sacrifice & Support',
    tone: 'grateful, emotional, and deeply personal',
    focusPoints: [
      'sacrifices made by family members to support the journey',
      'moments when family support was most crucial',
      'how the individual balances personal and professional life',
      'gratitude and acknowledgement of family\'s role',
      'impact of the journey on family relationships',
    ],
  },
};

// ─── Assemble per-category chapter maps ──────────────────────────────────────
// "school" uses the real DB-verified titles; other categories fall back to the
// generic placeholder set until their real DB titles are confirmed too.
const CHAPTER_CONTEXT = {
  school:  SCHOOL_CHAPTER_CONTEXT,
  msme:    DEFAULT_CHAPTER_CONTEXT,
  temple:  DEFAULT_CHAPTER_CONTEXT,
  village: DEFAULT_CHAPTER_CONTEXT,
};

// Fallback for any unrecognised serviceId
const FALLBACK_CONTEXT = {
  chapterName: 'Life Story',
  tone: 'warm, articulate, and biographical',
  focusPoints: [
    'key experiences and memories shared',
    'people and relationships mentioned',
    'values and beliefs expressed',
    'achievements and milestones noted',
    'emotions and personal reflections conveyed',
  ],
};

// ─── JSON Schema returned for all chapters ───────────────────────────────────
// This is the shape GPT must always return.
// The editor sees all these fields in the review panel.

const BIOGRAPHY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {

    narrative: {
      type: 'string',
      description:
        'A warm, flowing 1–2 paragraph biographical narrative written in third person. '
        + 'Turn the user\'s answer into a short story-style passage — do not just rephrase '
        + 'or restate it word-for-word, and do not invent details that were not present. '
        + 'Must be publish-ready prose suitable for a printed biography book.',
    },

    key_highlights: {
      type: 'array',
      description:
        'Array of 3–6 short, punchy highlight statements extracted from the answer. '
        + 'Each is a single sentence capturing a standout fact, achievement, or insight.',
      items: { type: 'string' },
    },

    quote: {
  type: 'string',
  description:
    'One direct quote from the user\'s answer, using their own words as closely as possible. '
    + 'If no clearly quotable line exists in the answer, return an empty string — '
    + 'do NOT fabricate or paraphrase a quote that sounds plausible but wasn\'t actually said.',
},

    chapter_title_suggestion: {
      type: 'string',
      description:
        'A creative, evocative title suggestion for this chapter section. '
        + '4–8 words. Should feel like a book chapter heading.',
    },

    timeline_events: {
      type: 'array',
      description:
        'Array of datable events or milestones extracted from the answer. '
        + 'Only include entries where a year, decade, or time reference is mentioned. '
        + 'Empty array if no time references exist.',
      items: {
        type: 'object',
        properties: {
          year:        { type: 'string', description: 'Year or approximate period, e.g. "1987" or "Late 1990s"' },
          event:       { type: 'string', description: 'Short description of the event or milestone' },
        },
        required: ['year', 'event'],
        additionalProperties: false,
      },
    },

    people_mentioned: {
      type: 'array',
      description:
        'Names of people the user mentioned — family members, mentors, colleagues, etc. '
        + 'Empty array if none mentioned.',
      items: {
        type: 'object',
        properties: {
          name:         { type: 'string', description: 'Full name or how they were referred to' },
          relationship: { type: 'string', description: 'e.g. "father", "mentor", "business partner", "teacher"' },
        },
        required: ['name', 'relationship'],
        additionalProperties: false,
      },
    },

    values_identified: {
      type: 'array',
      description:
        'Core values, principles, or character traits clearly expressed or implied in the answer. '
        + '2–5 single-word or short-phrase values. e.g. "resilience", "family first", "integrity".',
      items: { type: 'string' },
    },

    follow_up_questions: {
      type: 'array',
      description:
        'Array of 2–3 follow-up questions the editor could ask to deepen this chapter. '
        + 'Based on gaps or interesting threads in the answer.',
      items: { type: 'string' },
    },

    word_count_estimate: {
      type: 'number',
      description: 'Estimated word count of the generated narrative field.',
    },

    confidence_score: {
      type: 'number',
      description:
        'A 0–100 score indicating how much biographical detail was in the original answer. '
        + '100 = very detailed answer, rich content. 0 = almost no usable content.',
    },

  },
  required: [
    'narrative',
    'key_highlights',
    'quote',
    'chapter_title_suggestion',
    'timeline_events',
    'people_mentioned',
    'values_identified',
    'follow_up_questions',
    'word_count_estimate',
    'confidence_score',
  ],
  additionalProperties: false,
};

// ─── Category tone modifiers ──────────────────────────────────────────────────
// Appended to the system prompt based on user.category

const CATEGORY_TONE = {
  msme:
    'The subject is an entrepreneur or MSME business owner. '
    + 'Use business-appropriate language. Reference commercial milestones, industry context, '
    + 'and entrepreneurial spirit where relevant.',

  school:
    'The subject is associated with an educational institution (trustee, founder, principal, or educator). '
    + 'Use language that honours academic values, student development, and institutional legacy.',

  temple:
    'The subject is associated with a temple, religious institution, or spiritual community. '
    + 'Use respectful, spiritually sensitive language. Honour service, devotion, and community values.',

  village:
    'The subject is a rural leader, village representative, or grassroots community figure. '
    + 'Use accessible, grounded language that celebrates community service, local development, '
    + 'and the dignity of rural life.',
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * getPromptSchema
 *
 * @param {number|string} serviceId   - Chapter ID (1–11, or 99 for fallback)
 * @param {string}        opinion     - The user's raw answer text
 * @param {string}        title       - The question being answered (optional but improves output)
 * @param {string}        title_desc  - Sub-session label e.g. "Family & Values → Early Family Memories"
 * @param {string}        category    - User category: "msme" | "school" | "temple" | "village"
 * @returns {{ prompt: string, schema: object }}
 */
export default function getPromptSchema(
  serviceId,
  opinion,
  title = '',
  title_desc = '',
  category = 'msme'
) {
  const id          = Number(serviceId);
  const categoryMap = CHAPTER_CONTEXT[category] ?? DEFAULT_CHAPTER_CONTEXT;
  const context     = categoryMap[id] ?? FALLBACK_CONTEXT;
  const catTone     = CATEGORY_TONE[category] ?? CATEGORY_TONE.msme;

  // Build the system instruction
  const systemInstruction = [
    `You are a professional biography writer creating a dignified, publish-ready life story book.`,
    `You are currently working on the "${context.chapterName}" chapter.`,
    `Write in a ${context.tone} tone.`,
    ``,
    catTone,
    ``,
    `For this chapter, focus on extracting and expanding:`,
    ...context.focusPoints.map((p, i) => `  ${i + 1}. ${p}`),
    ``,
    `EXAMPLE — this shows a general PATTERN that applies to any question below, not just this specific topic:`,
    `Question: "Where were you born and raised?"`,
    `Answer: "I was born and raised in Ahmedabad."`,
    `Correct: "Born and raised in Ahmedabad,the individual carries the city as part of their story."`,
    `Wrong: "Born and raised in the vibrant city of Ahmedabad, known for its rich culture..." (invents details not in the answer)`,
    `The lesson here is general: whatever the actual question is below, if the answer is short and single-fact, keep your narrative short and single-fact too. Do not add flavor, description, or context the person didn't give — regardless of what topic the question is about.`,
    ``,
    `SECOND EXAMPLE — same pattern, different topic:`,
    `Question: "What subjects did you enjoy studying?"`,
    `Answer: "I liked mathematics."`,
    `Correct: "Mathematics was a subject the individual genuinely enjoyed."`,
    `Wrong: "Mathematics captivated the individual from an early age, sparking a lifelong curiosity about numbers, logic, and problem-solving that would go on to shape their analytical mindset." (invents interest/history not stated)`,
    ``,
   `IMPORTANT RULES:`,
`- Only use facts the person actually said. Do not add family background, personality traits, hobbies, or achievements they did not mention.`,
`- Do not describe the place, city, or institution with extra flavor (like "vibrant city" or "rich culture") unless the person described it that way themselves. Just use the place name plainly.`,
`- Match the narrative length to the answer length. A short answer (one sentence) should get a short narrative (one or two sentences). A detailed answer can get a longer narrative, up to 180 words. Never stretch a short answer into a long paragraph.`,
`- If the answer only covers one focus point from the list above, only write about that one. Do not invent content to cover the other focus points just because they're listed.`,
`- Rewrite in your own words. Do not copy the person's sentence structure.`,
`- Write in third person. If gender is unknown, use the person's name instead of he/she.`,
`- Only mention emotions or values if the person expressed them. Do not assume how they felt.`,
`- Do not infer character traits (resilience, empathy, perseverance, etc.) or future consequences ("this shaped how they would later..." / "this would go on to influence...") from a short or vague answer. If the person only names a difficulty without describing it, state that plainly — do not narrate the meaning or impact of that difficulty for them.`,
`- Write like a biography chapter, not an interview answer.`,
`- timeline_events and people_mentioned: only include what the person actually said. Leave empty if nothing was mentioned.`,
`- confidence_score should reflect how much real content was in the answer, not how good the writing sounds. A one-sentence answer should score below 40.`,
`- Be respectful and dignified at all times.`,
  ].join('\n');

  // Build the user message
  const contextBlock = [
    title_desc ? `Chapter section: ${title_desc}` : null,
    title      ? `Question asked: ${title}`        : null,
  ]
    .filter(Boolean)
    .join('\n');

  const userMessage = [
    contextBlock,
    contextBlock ? '' : null,
    `The person's answer:`,
    `"""`,
    opinion.trim(),
    `"""`,
    ``,
    `Using the answer above, produce the structured biography response.`,
  ]
    .filter(line => line !== null)
    .join('\n');

  const prompt = `${systemInstruction}\n\n${userMessage}`;

  return {
    prompt,
    schema: BIOGRAPHY_RESPONSE_SCHEMA,
  };
}
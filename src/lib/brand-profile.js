/**
 * The pillars a fit check is scored against.
 *
 * These are deterministic and shared across every check, which is what makes
 * two runs of the same idea comparable. Retrieval supplies evidence and
 * citations; this supplies the rubric.
 */
export const PILLARS = [
  {
    key: "mission",
    label: "Mission",
    field: "mission",
    kind: "text",
    prompt: "What does this brand exist to do?",
    help: "One or two sentences. The thing that would still be true if the product changed.",
  },
  {
    key: "values",
    label: "Values",
    field: "values",
    kind: "list",
    prompt: "What does it believe?",
    help: "One per line. Beliefs that would make you turn down work.",
  },
  {
    key: "tone",
    label: "Tone of voice",
    field: "tone",
    kind: "list",
    prompt: "How does it sound?",
    help: "One per line. e.g. 'Dry, never zany' or 'Plain words over jargon'.",
  },
  {
    key: "audience",
    label: "Audience",
    field: "audience",
    kind: "text",
    prompt: "Who is it talking to?",
    help: "Who they are, what they care about, and what they are sceptical of.",
  },
  {
    key: "dos_donts",
    label: "Do and don't",
    field: "dos",
    secondaryField: "donts",
    kind: "pair",
    prompt: "What is always on, and what is off limits?",
    help: "One per line. The don'ts do the most work in a fit check.",
  },
  {
    key: "visual",
    label: "Visual rules",
    field: "visual",
    kind: "list",
    prompt: "What does it look like?",
    help: "One per line. Colour, type, photography, logo treatment.",
  },
];

export function linesToArray(value) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);
}

export function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

/** Renders the profile as prose so it can be chunked and retrieved like any
 * other document, not just used as a rubric. */
export function profileToText(profile, brandName) {
  const section = (title, body) =>
    body && body.length ? `## ${title}\n${body}\n` : "";

  const list = (value) =>
    Array.isArray(value) && value.length
      ? value.map((item) => `- ${item}`).join("\n")
      : "";

  return [
    `# ${brandName} — brand profile\n`,
    section("Mission", profile.mission),
    section("Values", list(profile.values)),
    section("Tone of voice", list(profile.tone)),
    section("Audience", profile.audience),
    section("Always do", list(profile.dos)),
    section("Never do", list(profile.donts)),
    section("Visual rules", list(profile.visual)),
  ]
    .join("\n")
    .trim();
}

export function isProfileEmpty(profile) {
  if (!profile) return true;
  return (
    !profile.mission?.trim() &&
    !profile.audience?.trim() &&
    !profile.values?.length &&
    !profile.tone?.length &&
    !profile.dos?.length &&
    !profile.donts?.length &&
    !profile.visual?.length
  );
}

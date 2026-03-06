export type StoryboardLayer = "background" | "midground" | "foreground";

export interface StoryboardBeat {
  id: string;
  start: number;
  end: number;
  layer: StoryboardLayer;
  role: string;
  type: string;
  content: string;
  layout: string;
  motion: string;
  physics: string;
  notes?: string;
}

export interface StoryboardV2 {
  vibe: string;
  colorPalette: string[];
  timeline: StoryboardBeat[];
}

function parseTimeRange(
  value: string,
  fallbackStart: number,
  fallbackEnd: number
): { start: number; end: number } {
  const range = value.trim();
  const match = range.match(
    /([0-9]+(?:\.[0-9]+)?)\s*[\u2013-]\s*([0-9]+(?:\.[0-9]+)?)/
  );
  if (!match) {
    return { start: fallbackStart, end: fallbackEnd };
  }
  const start = parseFloat(match[1]);
  const end = parseFloat(match[2]);
  if (!isFinite(start) || !isFinite(end)) {
    return { start: fallbackStart, end: fallbackEnd };
  }
  return { start, end };
}

export function parseStoryboardTimelineEntry(
  entry: string,
  index: number
): StoryboardBeat {
  const segments = entry.split("|");
  const fields: Record<string, string> = {};

  for (const rawSegment of segments) {
    const segment = rawSegment.trim();
    if (!segment) {
      continue;
    }

    const parts = segment.split(":");
    if (parts.length < 2) {
      continue;
    }

    const key = parts[0].trim().toLowerCase();
    const value = parts.slice(1).join(":").trim();
    if (!key) {
      continue;
    }

    fields[key] = value;
  }

  const fallbackStart = index;
  const fallbackEnd = index + 1;
  const timeField = fields["t"] || fields["time"] || "";
  const time = timeField
    ? parseTimeRange(timeField, fallbackStart, fallbackEnd)
    : { start: fallbackStart, end: fallbackEnd };

  const rawLayer = (fields["layer"] || "").toLowerCase();
  const layer: StoryboardLayer =
    rawLayer === "background" ||
    rawLayer === "midground" ||
    rawLayer === "foreground"
      ? (rawLayer as StoryboardLayer)
      : "foreground";

  const role = fields["role"] || "";
  const type = fields["type"] || "";
  const content = fields["content"] || entry.trim();
  const layout = fields["layout"] || "";
  const motion = fields["motion"] || "";
  const physics = fields["physics"] || "";
  const notes = fields["notes"];

  const id =
    fields["id"] && fields["id"].length > 0 ? fields["id"] : `beat-${index}`;

  return {
    id,
    start: time.start,
    end: time.end,
    layer,
    role,
    type,
    content,
    layout,
    motion,
    physics,
    notes: notes && notes.length > 0 ? notes : undefined,
  };
}

export function parseStoryboardTimelineToBeats(
  timeline: string[]
): StoryboardBeat[] {
  if (!Array.isArray(timeline)) {
    return [];
  }

  const beats: StoryboardBeat[] = [];

  for (let i = 0; i < timeline.length; i += 1) {
    const entry = timeline[i];
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    beats.push(parseStoryboardTimelineEntry(trimmed, i));
  }

  return beats;
}

export function normalizeStoryboardBeats(raw: unknown): StoryboardBeat[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const beats: StoryboardBeat[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      continue;
    }

    const obj = item as Record<string, unknown>;

    const idValue =
      typeof obj.id === "string" && obj.id.length > 0 ? obj.id : `beat-${i}`;
    const startValue =
      typeof obj.start === "number" && isFinite(obj.start as number)
        ? (obj.start as number)
        : i;
    const endValue =
      typeof obj.end === "number" && isFinite(obj.end as number)
        ? (obj.end as number)
        : startValue;

    const rawLayer =
      typeof obj.layer === "string" ? obj.layer.toLowerCase() : "";
    const layer: StoryboardLayer =
      rawLayer === "background" ||
      rawLayer === "midground" ||
      rawLayer === "foreground"
        ? (rawLayer as StoryboardLayer)
        : "foreground";

    const role = typeof obj.role === "string" ? obj.role : "";
    const type = typeof obj.type === "string" ? obj.type : "";
    const content = typeof obj.content === "string" ? obj.content : "";
    const layout = typeof obj.layout === "string" ? obj.layout : "";
    const motion = typeof obj.motion === "string" ? obj.motion : "";
    const physics = typeof obj.physics === "string" ? obj.physics : "";
    const notes = typeof obj.notes === "string" ? obj.notes : undefined;

    beats.push({
      id: idValue,
      start: startValue,
      end: endValue,
      layer,
      role,
      type,
      content,
      layout,
      motion,
      physics,
      notes,
    });
  }

  return beats;
}

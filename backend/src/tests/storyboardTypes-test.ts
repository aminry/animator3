import {
  parseStoryboardTimelineEntry,
  parseStoryboardTimelineToBeats,
  normalizeStoryboardBeats,
} from "../storyboardTypes";
import { normalizeStoryboard } from "../directorAgent";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testParseStoryboardTimelineEntry(): void {
  const entry =
    "t:0-0.8 | layer:background | role:base-background | type:shape(rectangle) | content:dark navy background panel | layout:full-frame background | motion:opacity:0 → 100 | physics:weight:heavy, easing:ease-in | notes:sets moody base";

  const beat = parseStoryboardTimelineEntry(entry, 0);

  expect(beat.id === "beat-0", "Expected default id beat-0");
  expect(beat.start === 0, `Expected start=0, got ${beat.start}`);
  expect(beat.end === 0.8, `Expected end=0.8, got ${beat.end}`);
  expect(beat.layer === "background", `Expected layer=background, got ${beat.layer}`);
  expect(
    beat.role === "base-background",
    `Expected role=base-background, got ${beat.role}`
  );
  expect(
    beat.type === "shape(rectangle)",
    `Expected type=shape(rectangle), got ${beat.type}`
  );
  expect(
    beat.content.includes("dark navy background"),
    `Expected content to include descriptive text, got ${beat.content}`
  );
}

function testParseStoryboardTimelineToBeats(): void {
  const timeline = [
    "t:0-1 | layer:background | role:base | type:shape(rectangle) | content:bg | layout:full | motion:none | physics:none",
    "t:1-2 | layer:foreground | role:title | type:text(single-line) | content:title text | layout:top | motion:fade | physics:light",
  ];

  const beats = parseStoryboardTimelineToBeats(timeline);

  expect(beats.length === 2, `Expected 2 beats, got ${beats.length}`);
  expect(beats[0].start === 0 && beats[0].end === 1, "First beat time range incorrect");
  expect(beats[1].start === 1 && beats[1].end === 2, "Second beat time range incorrect");
}

function testNormalizeStoryboardBeats(): void {
  const raw = [
    {
      start: 0,
      end: 1,
      layer: "background",
      role: "base",
      type: "shape(rectangle)",
      content: "bg",
      layout: "full",
      motion: "none",
      physics: "none",
    },
    {
      id: "custom-id",
      start: 1,
      end: 2,
      layer: "foreground",
      role: "title",
      type: "text(single-line)",
      content: "Title",
      layout: "top",
      motion: "fade",
      physics: "light",
      notes: "important",
    },
  ];

  const beats = normalizeStoryboardBeats(raw);

  expect(beats.length === 2, `Expected 2 beats, got ${beats.length}`);
  expect(beats[0].id === "beat-0", `Expected synthesized id beat-0, got ${beats[0].id}`);
  expect(beats[1].id === "custom-id", `Expected to preserve explicit id, got ${beats[1].id}`);
  expect(beats[1].notes === "important", "Expected notes to be preserved");
}

function testNormalizeStoryboardFromLegacyTimeline(): void {
  const payload: any = {
    Vibe: "Test vibe",
    ColorPalette: ["#000000", "#ffffff"],
    Timeline: [
      "t:0-1 | layer:background | role:base | type:shape(rectangle) | content:bg | layout:full | motion:none | physics:none",
      "t:1-2 | layer:foreground | role:title | type:text(single-line) | content:title | layout:top | motion:fade | physics:light",
    ],
  };

  const storyboard = normalizeStoryboard(payload);

  expect(storyboard.vibe === "Test vibe", "Expected normalized vibe from Vibe");
  expect(
    storyboard.colorPalette.length === 2,
    `Expected 2 colors, got ${storyboard.colorPalette.length}`
  );
  expect(
    storyboard.timeline.length === 2,
    `Expected 2 timeline entries, got ${storyboard.timeline.length}`
  );
  expect(Array.isArray(storyboard.beats), "Expected beats array to be present");
  expect(
    (storyboard.beats?.length ?? 0) === storyboard.timeline.length,
    "Expected beats length to match timeline length"
  );
}

async function run(): Promise<void> {
  console.log("\n🎬 Running storyboardTypes unit tests...\n");

  try {
    testParseStoryboardTimelineEntry();
    console.log("✓ parseStoryboardTimelineEntry parses DSL correctly");

    testParseStoryboardTimelineToBeats();
    console.log("✓ parseStoryboardTimelineToBeats builds beats array");

    testNormalizeStoryboardBeats();
    console.log("✓ normalizeStoryboardBeats normalizes raw beat objects");

    testNormalizeStoryboardFromLegacyTimeline();
    console.log("✓ normalizeStoryboard builds beats from legacy Timeline strings");

    console.log("\n✅ storyboardTypes unit tests passed");
  } catch (error) {
    console.error("\n❌ storyboardTypes unit tests failed:", error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Unexpected error while running storyboardTypes unit tests:", error);
  process.exitCode = 1;
});

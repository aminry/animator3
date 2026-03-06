# Spatial Reasoning Improvements

This document outlines strategies for improving the system's ability to handle layout, positioning, and visual composition.

## Problem Statement

LLMs struggle with precise spatial reasoning:
- **Coordinate calculation**: Difficult to compute exact positions in pixels
- **Overlap detection**: Cannot visualize whether elements collide
- **Visual hierarchy**: Text-based models lack intuition for composition
- **On-canvas validation**: No way to verify elements are within bounds

**Result**: Poor layouts with overlapping elements, awkward spacing, elements positioned off-canvas.

## Solution 1: Layout Constraint Solver

### Concept

Instead of specifying exact coordinates, LLM specifies **constraints** and a solver computes positions.

### Constraint Types

**Positioning constraints**:
- `center-aligned`: Element centered horizontally or vertically
- `left-aligned`, `right-aligned`, `top-aligned`, `bottom-aligned`
- `relative-to(element, offset)`: Position relative to another element

**Spacing constraints**:
- `no-overlaps`: Ensure no elements collide
- `margin(pixels)`: Minimum spacing between elements
- `padding(pixels)`: Internal spacing within containers

**Size constraints**:
- `fit-content`: Size based on content
- `max-width`, `max-height`: Constrain maximum size
- `aspect-ratio`: Maintain proportions

**Composition constraints**:
- `grid(rows, cols)`: Arrange in grid layout
- `stack(direction, spacing)`: Stack elements with spacing
- `distribute(axis, spacing)`: Evenly distribute along axis

### Example Usage

**Instead of**:
```typescript
const text = {
  id: 'title',
  x: 512,  // Hard to calculate center
  y: 300,
  width: 400,
  height: 60
};
```

**Use constraints**:
```typescript
const text = {
  id: 'title',
  constraints: {
    horizontal: 'center',
    vertical: 'top',
    margin: { top: 100 },
    width: 400,
    height: 60
  }
};
```

**Solver computes**:
```typescript
// Solver output
const text = {
  id: 'title',
  x: 412,  // (1024 - 400) / 2
  y: 100,
  width: 400,
  height: 60
};
```

### Implementation

**Option 1: Cassowary constraint solver** (JavaScript port)
- Industry-standard algorithm (used in iOS Auto Layout)
- Handles complex constraint systems
- npm package: `cassowary` or `kiwi.js`

**Option 2: Custom grid system**
- Simpler, more predictable
- Define grid cells, snap elements to cells
- Easier for LLM to reason about

**Recommendation**: Start with custom grid system, upgrade to Cassowary if needed

### Custom Grid System Example

```typescript
// Define canvas grid
const grid = {
  columns: 12,
  rows: 8,
  canvasWidth: 1024,
  canvasHeight: 768,
  gutter: 20
};

// LLM specifies grid positions
const layout = [
  { id: 'title', grid: { col: 2, row: 1, colSpan: 8, rowSpan: 1 } },
  { id: 'logo', grid: { col: 5, row: 3, colSpan: 2, rowSpan: 2 } },
  { id: 'description', grid: { col: 2, row: 5, colSpan: 8, rowSpan: 2 } }
];

// Compute pixel positions
function gridToPixels(gridSpec, grid) {
  const colWidth = (grid.canvasWidth - (grid.columns + 1) * grid.gutter) / grid.columns;
  const rowHeight = (grid.canvasHeight - (grid.rows + 1) * grid.gutter) / grid.rows;
  
  return {
    x: grid.gutter + (gridSpec.col - 1) * (colWidth + grid.gutter),
    y: grid.gutter + (gridSpec.row - 1) * (rowHeight + grid.gutter),
    width: gridSpec.colSpan * colWidth + (gridSpec.colSpan - 1) * grid.gutter,
    height: gridSpec.rowSpan * rowHeight + (gridSpec.rowSpan - 1) * grid.gutter
  };
}
```

### Benefits

- **LLM-friendly**: Easier to reason about "column 2-10" than "x: 157"
- **Automatic spacing**: No overlap calculations needed
- **Consistent layouts**: Grid enforces visual harmony
- **Responsive**: Can adapt to different canvas sizes

## Solution 2: Visual Preview Generation

### Concept

After ScenePlan is created, **render a wireframe preview** before generating code. Show this preview to the vision model for validation.

### Preview Format

**Simple SVG wireframe**:
- Boxes for each element
- Labels showing element IDs
- Color-coded by layer (background/midground/foreground)
- Show canvas bounds

### Example Preview

```svg
<svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
  <!-- Canvas bounds -->
  <rect width="1024" height="768" fill="#f0f0f0" stroke="#333" stroke-width="2"/>
  
  <!-- Background layer -->
  <rect x="0" y="0" width="1024" height="768" fill="#e3f2fd" opacity="0.3"/>
  <text x="10" y="20" font-size="12">background</text>
  
  <!-- Midground elements -->
  <rect x="412" y="100" width="200" height="200" fill="#81c784" opacity="0.5" stroke="#2e7d32"/>
  <text x="422" y="120" font-size="12">logo</text>
  
  <rect x="200" y="350" width="624" height="60" fill="#64b5f6" opacity="0.5" stroke="#1976d2"/>
  <text x="210" y="370" font-size="12">title</text>
  
  <!-- Foreground elements -->
  <rect x="200" y="450" width="624" height="100" fill="#ffb74d" opacity="0.5" stroke="#f57c00"/>
  <text x="210" y="470" font-size="12">description</text>
</svg>
```

### Validation Process

1. **Generate preview**: Convert ScenePlan to SVG wireframe
2. **Send to vision model**: Include preview image with Animator prompt
3. **Vision model validates**:
   - Are elements positioned appropriately?
   - Any overlaps or spacing issues?
   - Is composition balanced?
   - Are all elements within canvas bounds?
4. **Proceed or revise**: If valid, generate code; if issues, revise ScenePlan

### Implementation

**File**: `backend/src/previewGenerator.ts`

```typescript
export function generateWireframePreview(scenePlan: ScenePlan): string {
  // Convert ScenePlan to SVG
  // Return SVG as string or base64-encoded image
}

export async function validateLayoutVisually(
  scenePlan: ScenePlan,
  visionModel: LLMClient
): Promise<{ valid: boolean; issues: string[] }> {
  const preview = generateWireframePreview(scenePlan);
  const base64Image = svgToBase64(preview);
  
  const response = await visionModel.chat([
    { 
      role: 'user', 
      content: [
        { type: 'text', text: 'Validate this animation layout. Check for overlaps, spacing issues, and composition problems.' },
        { type: 'image_url', image_url: { url: `data:image/svg+xml;base64,${base64Image}` } }
      ]
    }
  ]);
  
  // Parse response for validation results
  return parseValidationResponse(response);
}
```

### Benefits

- **Catch layout issues early**: Before expensive code generation
- **Visual validation**: Vision model sees what text model cannot
- **Fast iteration**: SVG generation is cheap, can iterate quickly
- **Debugging aid**: Developers can view wireframes to understand ScenePlan

## Solution 3: Composition Guides (Not Templates)

### Purpose

Provide **flexible guidelines** for good composition without rigid templates.

### Grid Systems

**Rule of Thirds**:
- Divide canvas into 3x3 grid
- Place important elements at intersection points
- Guideline (not rule): "Consider placing focal elements at grid intersections"

**Golden Ratio**:
- Use 1.618 ratio for proportions
- Aesthetic balance in layouts

### Safe Zones

**Text readability**:
- Ensure sufficient contrast with background
- Minimum font sizes for legibility
- Avoid placing text too close to edges

**Margin guidelines**:
- Recommend minimum 5% margin from canvas edges
- Prevents elements from feeling cramped

### Depth Layers

**Three-layer system**:
- **Background**: Static or subtle motion, sets mood
- **Midground**: Main content, focal elements
- **Foreground**: Overlays, accents, foreground elements

**Guidelines for vision model**:
```
When designing layout, consider depth:
- Background: Full canvas, sets atmosphere
- Midground: 60-80% of canvas, main content
- Foreground: Accents and overlays, 20-40% coverage

This creates visual hierarchy and depth.
```

### Composition Principles (For System Prompt)

```typescript
const COMPOSITION_GUIDELINES = `
When designing layouts, consider these principles:

BALANCE: Distribute visual weight evenly
- Symmetrical: Mirror elements across center
- Asymmetrical: Balance different-sized elements

HIERARCHY: Guide viewer's eye
- Larger elements = more important
- Central position = focal point
- Motion draws attention

SPACING: Give elements room to breathe
- Minimum 5% margins from edges
- Consistent spacing between related elements
- Use whitespace intentionally

ALIGNMENT: Create visual order
- Align elements to grid or each other
- Consistent alignment creates cohesion

These are GUIDELINES, not rigid rules. Use creative judgment.
`;
```

### Integration with Vision Model

**System prompt addition**:
```typescript
const SCENE_PLANNER_SYSTEM_PROMPT = `
${BASE_PROMPT}

${COMPOSITION_GUIDELINES}

When planning layouts:
1. Use grid-based positioning for consistency
2. Apply composition principles creatively
3. Ensure visual hierarchy is clear
4. Leave appropriate spacing and margins

Design with visual reasoning, not just coordinate calculation.
`;
```

### Key Difference from Templates

**Templates** (old approach):
```
product-demo mode:
- Product must be centered at (512, 384)
- Title must be at top, (200, 100)
- Description below title, (200, 180)
```

**Guidelines** (new approach):
```
Consider:
- Focal elements near canvas center or rule-of-thirds intersections
- Text positioned for readability with margins
- Visual hierarchy through size and position

Apply these principles to YOUR creative vision.
```

## Implementation Checklist

### Phase 1: Grid System
- [ ] Define grid specification (columns, rows, gutters)
- [ ] Implement grid-to-pixels converter
- [ ] Update ScenePlanner prompt to use grid positions
- [ ] Test with sample layouts

### Phase 2: Visual Preview
- [ ] Implement SVG wireframe generator
- [ ] Create preview validation function
- [ ] Integrate with pipeline (after ScenePlan, before code gen)
- [ ] Test with InternVL3_5

### Phase 3: Composition Guidelines
- [ ] Write composition guidelines for system prompt
- [ ] Update ScenePlanner prompt with guidelines
- [ ] Test that vision model applies guidelines creatively
- [ ] Measure improvement in layout quality

## Success Metrics

- **Overlap rate**: <5% of animations have overlapping elements
- **Off-canvas rate**: <1% of animations have elements outside bounds
- **Composition quality**: Rated 7+ / 10 by human evaluators
- **Spacing consistency**: Margin and padding violations <10%

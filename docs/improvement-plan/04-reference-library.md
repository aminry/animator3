# Reference Animation Library

This document outlines the strategy for curating, organizing, and utilizing a reference animation library to guide creative generation.

## Purpose

The reference library serves three key functions:

1. **Few-shot learning**: Provide visual examples for agents to learn patterns
2. **Style guidance**: Show high-quality composition, timing, and motion techniques
3. **Inspiration**: Offer creative ideas without prescriptive templates

**Key principle**: References inspire creativity, they don't constrain it.

## Sources for Curation

### Free and Open-Source

#### 1. LottieFiles Community
- **URL**: https://lottiefiles.com
- **Size**: 100,000+ free animations
- **Quality**: Variable (community-contributed)
- **Search**: Tag-based, category filtering
- **License**: Free for personal/commercial use (verify per animation)
- **Best for**: Wide variety, quick initial collection

#### 2. CodePen
- **URL**: https://codepen.io/search/pens?q=lottie
- **Quality**: High (curated by design community)
- **Best for**: Creative, experimental animations
- **Note**: May need to extract Lottie JSON from pens

#### 3. GitHub Repositories
- **Search**: "lottie animations", "lottie collection"
- **Examples**:
  - `airbnb/lottie-web` (samples)
  - Community curated collections
- **Best for**: Technical quality, clean code

#### 4. Dribbble
- **URL**: https://dribbble.com/tags/lottie
- **Quality**: Very high (professional designers)
- **Note**: Mostly previews - may need to recreate or find source files
- **Best for**: Inspiration, quality benchmarks

#### 5. Motion Design School
- **URL**: https://motiondesign.school
- **Free tutorials with example files
- **Best for**: Learning motion principles

### Paid and Premium

#### 1. LottieFiles Pro
- **URL**: https://lottiefiles.com/pro
- **Cost**: Subscription-based (~$15-50/month)
- **Quality**: Curated, professional
- **License**: Commercial use included
- **Best for**: High-quality, reliable sources

#### 2. Envato Elements
- **URL**: https://elements.envato.com/lottie
- **Cost**: ~$16.50/month subscription
- **Size**: Thousands of animations
- **License**: Commercial use with subscription
- **Best for**: Diverse professional content

#### 3. Motion Array
- **URL**: https://motionarray.com
- **Cost**: Subscription-based
- **Quality**: Professional motion graphics
- **Best for**: Advanced motion techniques

#### 4. UI8
- **URL**: https://ui8.net/categories/lottie
- **Cost**: Individual purchases or subscription
- **Quality**: Premium, high-end design
- **Best for**: Cutting-edge design patterns

## Curation Process

### Manual Curation (Recommended for Initial Set)

**Goal**: 50-100 high-quality, diverse animations

**Process**:

1. **Search by quality criteria**
   - Visual appeal: Professional polish, aesthetic coherence
   - Technical quality: Clean layer structure, efficient animation
   - Motion richness: Complex timing, multiple animated properties
   - Diversity: Variety in styles, subjects, techniques

2. **Download and test**
   - Download Lottie JSON files
   - Test in Lottie renderer (verify compatibility)
   - Check file size and complexity
   - Ensure no corrupted or broken animations

3. **Annotate with metadata** (see schema below)
   - Describe what the animation shows
   - Tag with relevant keywords
   - Rate complexity and quality
   - Extract technical details

4. **Generate preview frames**
   - Render 3-5 key frames as PNG images
   - Use for visual indexing and similarity search
   - Store alongside Lottie JSON

5. **Manual review**
   - Ensure quality meets standards
   - Check diversity of collection
   - Remove duplicates or low-quality entries

**Time estimate**: 1-2 weeks for 50-100 animations

### Automated Augmentation (Scale to 500+)

**Goal**: Expand library using manual set as seed

**Process**:

1. **Use manual set as quality baseline**
   - Extract patterns from high-quality set
   - Define complexity thresholds

2. **Programmatic search**
   - Use LottieFiles API to search programmatically
   - Filter by tags, complexity metrics
   - Auto-download candidates

3. **Auto-filter by complexity**
   ```javascript
   // Example metrics
   const isComplex = (lottie) => {
     return lottie.layers.length >= 5 &&
            lottie.op >= 60 && // Duration (frames)
            countAnimatedProperties(lottie) >= 10;
   };
   ```

4. **Human review for final selection**
   - Review auto-selected animations
   - Accept or reject based on quality
   - Annotate accepted animations

**Time estimate**: Ongoing, ~100 animations/week with automation

## Quality Criteria

### Visual Appeal
- **Composition**: Balanced, aesthetically pleasing layouts
- **Color harmony**: Coherent color palettes
- **Professional polish**: Clean, refined appearance
- **Style coherence**: Consistent design language within animation

### Motion Richness
- **Multiple properties**: Position, scale, rotation, opacity, path
- **Complex timing**: Easing variations, staggered animations
- **Motion variety**: Different movement patterns, not repetitive
- **Follow-through**: Natural, physics-informed motion

### Technical Quality
- **Clean structure**: Logical layer hierarchy
- **Efficient**: Not overly complex (performance)
- **No errors**: Renders without issues
- **Well-organized**: Named layers, grouped elements

### Diversity
- **Style variety**: Minimal, bold, playful, corporate, abstract
- **Subject variety**: Characters, UI elements, infographics, abstract shapes
- **Technique variety**: Different animation techniques and approaches
- **Complexity range**: Simple to complex (for different use cases)

### Relevance
- **Use case alignment**: Applicable to system's animation scenarios
- **Inspirational value**: Provides useful patterns to learn from

## Metadata Annotation Schema

```json
{
  "id": "unique-identifier",
  "title": "Bouncing Ball with Trails",
  "description": "A colorful ball bouncing with motion trails, demonstrating physics-based animation and particle effects",
  "source": "LottieFiles",
  "url": "https://lottiefiles.com/12345",
  "tags": ["physics", "colorful", "playful", "particle-effects", "bouncing"],
  "style": "playful",
  "complexity": "medium",
  "duration_seconds": 3.5,
  "layer_count": 12,
  "properties_animated": ["position", "scale", "opacity", "rotation"],
  "dominant_colors": ["#FF6B6B", "#4ECDC4", "#FFE66D"],
  "motion_patterns": ["bounce", "fade", "trail"],
  "quality_score": 8.5,
  "use_cases": ["loading-animation", "playful-interaction", "game-ui"],
  "technical_notes": "Uses shape layers with trim paths for trails"
}
```

**Field descriptions**:
- `id`: Unique identifier (generated)
- `title`: Human-readable name
- `description`: What the animation shows and key techniques
- `source`: Where it was curated from
- `url`: Original source URL
- `tags`: Searchable keywords (10-20 per animation)
- `style`: High-level aesthetic category
- `complexity`: simple/medium/complex
- `duration_seconds`: Animation length
- `layer_count`: Number of layers (complexity metric)
- `properties_animated`: Which properties are animated
- `dominant_colors`: Hex codes for main colors
- `motion_patterns`: Named motion techniques used
- `quality_score`: 1-10 rating
- `use_cases`: Scenarios where this reference is useful
- `technical_notes`: Implementation details

## Storage Format

### Directory Structure

```
/backend/reference-library/
  /animations/           # Original Lottie JSON files
    00001.json
    00002.json
    ...
  /frames/              # Rendered preview frames
    00001/
      frame-0.png
      frame-1.png
      frame-2.png
    00002/
      frame-0.png
      ...
  /metadata/            # JSON annotations
    00001.json
    00002.json
    ...
  /embeddings/          # Vector embeddings for search
    image-embeddings.npy
    text-embeddings.npy
    index.json
  index.json           # Master index of all animations
```

### File Naming Convention
- Use zero-padded IDs: `00001`, `00002`, etc.
- Consistent naming across folders
- Keep Lottie JSON filenames simple (reference by ID)

## Embedding Generation

### Purpose
Enable semantic search to find relevant reference animations for any user prompt.

### Image Embeddings (CLIP)

**Model**: OpenAI CLIP or open alternative (e.g., `openai/clip-vit-base-patch32`)

**Process**:
1. Load preview frames for each animation
2. Encode frames using CLIP vision encoder
3. Average embeddings across frames (or use key frame)
4. Store as numpy array

**Code example**:
```python
from transformers import CLIPProcessor, CLIPModel
import torch

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def generate_image_embedding(image_path):
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embeddings = model.get_image_features(**inputs)
    return embeddings.numpy()
```

### Text Embeddings (CLIP)

**Process**:
1. Concatenate metadata: `title + description + tags`
2. Encode using CLIP text encoder
3. Store alongside image embeddings

**Code example**:
```python
def generate_text_embedding(metadata):
    text = f"{metadata['title']} {metadata['description']} {' '.join(metadata['tags'])}"
    inputs = processor(text=[text], return_tensors="pt", padding=True)
    with torch.no_grad():
        embeddings = model.get_text_features(**inputs)
    return embeddings.numpy()
```

### Storage

**Option 1: Simple NumPy arrays**
- Store embeddings as `.npy` files
- Fast for small libraries (<1000 animations)
- Easy to implement

**Option 2: Vector database**
- Use Qdrant, Weaviate, or Milvus
- Better for large libraries (1000+ animations)
- Built-in similarity search

**Recommendation**: Start with NumPy, migrate to vector DB if scaling beyond 500 animations

## Retrieval System

### Search Flow

1. **User prompt received**
   ```
   "Create a playful loading animation with bouncing elements"
   ```

2. **Generate query embedding**
   ```python
   query_embedding = generate_text_embedding(user_prompt)
   ```

3. **Find top-k similar animations**
   ```python
   from sklearn.metrics.pairwise import cosine_similarity
   
   similarities = cosine_similarity(query_embedding, all_embeddings)
   top_k_indices = similarities.argsort()[-3:][::-1]  # Top 3
   ```

4. **Retrieve reference animations**
   ```python
   references = [animation_library[i] for i in top_k_indices]
   ```

5. **Return preview frames + metadata**
   - Send frames to vision model (InternVL3_5)
   - Include metadata for context

### Search Parameters

- **Top-k**: Retrieve 2-3 most similar animations
- **Similarity threshold**: Filter out results below 0.5 similarity
- **Diversity**: Optionally ensure returned animations are diverse (not all similar to each other)

## Integration with System

### Director Agent

**How it uses references**:
1. User prompt → Find similar animations
2. Include reference frames in Director's context:
   ```typescript
   const messages = [
     { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
     { 
       role: 'user', 
       content: [
         { type: 'text', text: userPrompt },
         { type: 'text', text: 'Here are similar reference animations for inspiration:' },
         { type: 'image_url', image_url: { url: ref1Frame0 } },
         { type: 'image_url', image_url: { url: ref2Frame0 } },
       ]
     }
   ];
   ```
3. Director sees visual examples and learns patterns
4. Director creates vision inspired by (not copying) references

### ScenePlanner Agent

**How it uses references**:
1. After Director creates vision, find relevant layout examples
2. Show ScenePlanner composition examples
3. ScenePlanner learns spatial arrangement patterns

### Animator Agent

**Optional**: Show code structure examples from references
- Extract common patterns from reference Lottie JSON
- Guide code generation structure

## Maintenance and Updates

### Regular Updates
- Add new high-quality animations monthly
- Remove outdated or low-performing references
- Re-generate embeddings when updating collection

### Quality Monitoring
- Track which references are most frequently retrieved
- Identify gaps in coverage (prompts with poor matches)
- Prioritize curation in under-represented areas

### Version Control
- Version the reference library (v1.0, v1.1, etc.)
- Track changes to collection over time
- Enable rollback if new additions reduce quality

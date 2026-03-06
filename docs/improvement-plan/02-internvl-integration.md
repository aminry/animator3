# InternVL3_5 Integration via Ollama

This document outlines how to integrate the InternVL3_5 vision-language model using Ollama for local inference.

## What is InternVL3_5

- **Type**: Open-source vision-language model
- **Capabilities**: Image understanding, visual reasoning, multimodal chat
- **Advantages**: 
  - Strong visual understanding comparable to proprietary models
  - Can be hosted locally (no API costs)
  - No data privacy concerns
  - Full control over inference

## How to Set Up Ollama

### Installation

1. Download Ollama from [ollama.ai](https://ollama.ai)
2. Install for your platform (macOS, Linux, Windows)
3. Verify installation: `ollama --version`

### Model Download

```bash
ollama pull internvl3.5
```

This downloads the InternVL3_5 model to your local machine.

### Running the Server

```bash
ollama serve
```

- Server runs on `http://localhost:11434` by default
- API format is OpenAI-compatible
- Supports streaming and batch requests

### Testing the Model

```bash
ollama run internvl3.5
```

Interact with the model to verify it's working.

## Code Changes Needed

### 1. Create OllamaClient Class

**File**: `backend/src/ollamaClient.ts` (new file)

```typescript
class OllamaClient implements LLMClient {
  private baseUrl: string;
  private model: string;

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    // Implement OpenAI-compatible API calls
    // Support vision: include base64 images in message content
  }

  async streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
    // Implement streaming for real-time responses
  }
}
```

**Key features**:
- Implement `LLMClient` interface for compatibility
- Support vision inputs (base64-encoded images in messages)
- Handle multimodal content (text + images)
- Fallback handling if Ollama unavailable

### 2. Update Environment Variables

**File**: `backend/.env`

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=internvl3.5
VISION_MODEL_ENABLED=true
```

### 3. Modify Agent Constructors

**Files to update**:
- `directorAgent.ts`
- `scenePlannerAgent.ts`
- `criticAgent.ts`
- `orchestrator.ts`

**Changes**:
```typescript
// Before
const llmClient = new GroqClient(apiKey, model);

// After
const llmClient = process.env.VISION_MODEL_ENABLED 
  ? new OllamaClient(baseUrl, model)
  : new GroqClient(apiKey, model);
```

### 4. Add Vision Support to Prompts

Update system prompts to leverage visual capabilities:

```typescript
// Include image previews in messages
const messages = [
  { role: 'system', content: systemPrompt },
  { 
    role: 'user', 
    content: [
      { type: 'text', text: userPrompt },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${imageData}` } }
    ]
  }
];
```

## Agent-Specific Configuration

### Director Agent
**Purpose**: Create high-level creative vision with visual understanding

**Vision usage**:
- Receive 2-3 reference animation previews (similar to user prompt)
- Understand visual composition and style from examples
- Generate vision that incorporates learned visual patterns

**Input**: User prompt + reference animation frames (base64 images)

### ScenePlanner Agent
**Purpose**: Design spatial layouts with visual reasoning

**Vision usage**:
- Review layout wireframe preview before finalizing
- Validate object positioning visually
- Learn from reference layout examples

**Input**: Director vision + layout examples + wireframe preview

### Animator Agent
**Options**:
1. **Keep text model** (code generation doesn't require vision)
2. **Use vision for validation** (preview generated code as image before execution)

**Recommendation**: Keep text model for now, consider vision in Phase 2

### Critic Agent
**Purpose**: Evaluate rendered frames with visual understanding

**Vision usage**:
- Analyze rendered animation frames
- Assess composition, motion quality, visual appeal
- Provide detailed visual critique

**Input**: Rendered animation frames (base64 images)

## Performance Considerations

### Hardware Requirements

**Minimum**:
- CPU: Modern multi-core processor
- RAM: 16GB+
- GPU: Optional but recommended

**Recommended**:
- GPU: NVIDIA with 12GB+ VRAM (RTX 3060+, RTX 4070+, A4000+)
- RAM: 32GB+
- Storage: 20GB+ for model weights

### Inference Speed

- **Without GPU**: 5-15 seconds per inference (acceptable for creative tasks)
- **With GPU**: 1-3 seconds per inference
- **Trade-off**: Slower than API calls (200-500ms) but zero cost

### Optimization Strategies

1. **Batch Processing**: Generate multiple candidates in parallel
2. **Caching**: Cache embeddings for reference library
3. **Selective Vision**: Use vision only where needed (Director, Critic)
4. **Fallback**: If Ollama slow/unavailable, fall back to Groq API

### Cost Analysis

- **Ollama (local)**: $0 per request, upfront hardware cost
- **Groq API**: ~$0.10-0.50 per animation (text-only)
- **GPT-4V API**: ~$1-5 per animation (with vision)

**Recommendation**: Use Ollama for development and small-scale production; evaluate API for high-volume scenarios

## Integration Testing

### Test Plan

1. **Unit tests**: OllamaClient API compatibility
2. **Agent tests**: Director, ScenePlanner, Critic with vision inputs
3. **End-to-end**: Full animation generation pipeline
4. **Performance**: Measure latency with/without GPU

### Success Metrics

- Ollama client successfully communicates with server
- Vision inputs properly formatted and processed
- Agents produce higher-quality outputs with visual understanding
- System remains stable with fallback mechanisms

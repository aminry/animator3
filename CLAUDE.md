# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MotionGen V3** is an AI-powered Lottie animation generator. A user provides a text prompt; a multi-agent LangGraph pipeline produces MotionScript (TypeScript), sandboxes it, renders frames with Puppeteer, and iterates based on a visual critic until the animation is accepted.

Two workspaces:
- `backend/` — Node.js TypeScript SDK + AI agent pipeline (package name `@motiongen/sdk`)
- `frontend/` — Next.js 16 app that proxies to the backend services

---

## Commands

### Backend (`cd backend/`)

```bash
npm run build              # Compile TypeScript → dist/
npm run dev                # Watch mode compilation
npm run test:build         # Build + run golden tests (generates output/*.json)
npm test                   # Run visual tests only (requires prior build)
npm run test:update        # Rebuild golden test baselines (UPDATE_GOLDEN=1)

# Individual e2e tests (each does tsc first):
npm run test:sandbox-e2e
npm run test:renderer-e2e
npm run test:animator-e2e
npm run test:critic-e2e
npm run test:orchestrator-e2e
npm run test:orchestrator-critical-flows
npm run test:asset-processor-e2e
npm run test:all-e2e       # Run all e2e tests sequentially

# Start microservices:
npm run start:sandbox      # Port from SANDBOX_PORT env (default see sandboxServer.ts)
npm run start:renderer     # Renderer service
npm run start:orchestrator # Orchestrator HTTP server → http://localhost:7100/orchestrate

npm run serve              # Serve viewer.html at http://localhost:8080
```

### Frontend (`cd frontend/`)

```bash
npm run dev    # Next.js dev server
npm run build  # Production build
npm run lint   # ESLint
```

### Environment (backend/.env)

Required:
- `GROQ_API_KEY` — Groq API key (used by `GroqLLMClient`)

Optional:
- `MOTIONGEN_DEBUG=1` or `MOTIONGEN_ORCHESTRATOR_DEBUG=1` — enable `debugLog()` output
- `ORCHESTRATOR_PORT` — HTTP port for orchestrator server (default: 7100)
- `MOTIONGEN_GROQ_DEFAULT_MODEL` — override the default Groq model
- `MOTIONGEN_GROQ_MODEL_<LOGICAL_NAME>` — per-agent model override

Frontend uses `MOTIONGEN_ORCHESTRATOR_URL` (default: `http://localhost:7100`) to reach the backend.

---

## Architecture

### Backend SDK Core (`backend/src/`)

Low-level Lottie builder, no DOM/LLM dependencies:

| File | Purpose |
|------|---------|
| `types.ts` | Raw Lottie JSON type definitions |
| `Animation.ts` | Root animation container (`Animation.create(w,h,dur,fps)`) |
| `Layer.ts` | `ShapeLayer`, `SolidLayer`, `TextLayer`, `ImageLayer`, `NullLayer` |
| `Property.ts` | Animatable properties with keyframe support |
| `shapes.ts` | `ShapeBuilder` — creates rect, circle, ellipse, star, polygon |
| `physics.ts` | Spring physics engine — `generateKeyframes()` |
| `easing.ts` | Cubic Bezier easing utilities and named easings |
| `motionscript.ts` | **High-level MotionScript API** (`Stage`, `MotionElement`, `MotionGroup`) — the interface the LLM writes to |

### AI Agent Pipeline (`backend/src/`)

Built on **LangGraph** (`@langchain/langgraph`). The graph runs sequentially with conditional retry loops:

```
promptClassifier → director → scenePlanner → animator → sandbox
                                                           ↓ (error → animator, up to 5x)
                                                        renderer → critic
                                                                     ↓ (REJECT → sceneRefinement → animator, up to 5x)
                                                                    END
```

| Agent/Node | File | Role |
|-----------|------|------|
| `PromptClassifierAgent` | `promptClassifierAgent.ts` | Classifies prompt into `AnimationMode` + target duration |
| `DirectorAgent` | `directorAgent.ts` | Creates storyboard JSON (vibe, colorPalette, timeline) |
| `ScenePlannerAgent` | `scenePlannerAgent.ts` | Produces structured `ScenePlan` (objects, keyframes) |
| `AnimatorAgent` | `animatorAgent.ts` | Generates MotionScript TypeScript from storyboard + scene plan |
| Sandbox | `sandboxRunner.ts` / `sandbox-worker.ts` | Forks a child process, transpiles TS → JS with `ts.transpileModule`, runs in `vm2` sandbox, returns Lottie JSON |
| Renderer | `renderer.ts` / `browserRenderer.ts` | Uses Puppeteer to render Lottie frames as base64 PNGs |
| `CriticAgent` | `criticAgent.ts` | Multimodal LLM: evaluates rendered frames, returns PASS/REJECT + structured issues |
| `SceneRefinementAgent` | `sceneRefinementAgent.ts` | Refines `ScenePlan` based on critic feedback before retry |

**Orchestrator wiring:** `orchestrator.ts` defines `StudioState` (LangGraph `Annotation.Root`), `createStudioNodes()`, and `createStudioGraph()`. The singleton `studioGraph` is exported and used by `orchestratorServer.ts`.

**LLM Client:** `groqClient.ts` implements `LLMClient` interface against Groq's OpenAI-compatible API. All agents accept any `LLMClient`, making the LLM provider swappable.

### HTTP Services

- **Orchestrator server** (`orchestratorServer.ts`): `POST /orchestrate` — accepts `{ prompt, assets[] }`, runs the full graph, returns `StudioSummary`
- **Sandbox server** (`sandboxServer.ts`): exposes sandbox execution as an HTTP service
- **Renderer server** (`rendererServer.ts`): exposes frame rendering as an HTTP service

### Frontend (`frontend/`)

Next.js 16 app router with three API routes that proxy to backend services:
- `app/api/orchestrate/route.ts` → `http://localhost:7100/orchestrate`
- `app/api/build-lottie/route.ts` → sandbox service
- `app/api/render-frames/route.ts` → renderer service

State managed with **Zustand** (`src/store/studioStore.ts`). The main page (`app/page.tsx`) provides a code editor + build flow using MotionScript directly.

### MotionScript API (what the LLM writes)

The LLM is given a minimal interface definition (inlined in `orchestrator.ts` as `SDK_INTERFACE_DEFINITION`) and must only use:

```typescript
import { Motion } from "@motiongen/sdk";
const stage = Motion.Stage.create(width, height, durationSeconds, fps);
const el = stage.addShape('circle', { fillColor: [r,g,b], radius: 50 });
el.animate({ props: { position: { from: [x1,y1], to: [x2,y2] } }, easing: 'easeOut' });
export default stage.toJSON();
```

### Debug Output

When `MOTIONGEN_DEBUG=1`, debug files are written to `backend/debug/`:
- `lottie-latest.json`, `scene-plan-latest.json`, `storyboard-latest.json`, etc.
- `motionscript-latest.ts` — the last generated MotionScript code

### Golden Tests

`backend/golden_tests/` contains reference Lottie JSON files. `npm run test:build` compares generated output against these. Run with `UPDATE_GOLDEN=1` to update baselines.

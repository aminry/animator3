import { optimize } from 'svgo';
import * as cheerio from 'cheerio';
import type { LLMClient } from './directorAgent';

export const ASSET_PROCESSOR_MODEL = 'GPT OSS 20B';

export interface SvgGroupDescription {
  id: string;
  childCount: number;
}

export interface SvgSemanticTag {
  id: string;
  labels: string[];
  description?: string;
}

export interface ProcessSvgForLlmOptions {
  userPrompt?: string;
}

export interface ProcessSvgForLlmResult {
  safeSvg: string;
  groups: SvgGroupDescription[];
  tags: SvgSemanticTag[];
}

export const ASSET_PROCESSOR_SYSTEM_PROMPT = `You analyze SVG layer structure for motion graphics.

Given a list of SVG group identifiers and basic structural information, assign semantic tags describing what each group represents.

Output strict JSON with the following shape:
{
  "groups": [
    {
      "id": "string",
      "labels": ["string"],
      "description": "optional string"
    }
  ]
}

Constraints:
- Only reference group ids that are provided.
- Use short, lowercase labels such as "logo", "background", "foreground", "wheel", "icon", "text".
- If you are unsure about a group, include it with an empty labels array.`;

export function sanitizeSvg(svgString: string): string {
  const optimized = optimize(svgString, { plugins: [] });

  const $ = cheerio.load(optimized.data, { xmlMode: true });

  $('script').remove();

  $('*').each((_index: number, element: any) => {
    const attribs = (element && (element as any).attribs) || undefined;
    if (!attribs) {
      return;
    }

    Object.keys(attribs).forEach(name => {
      if (name.toLowerCase().startsWith('on')) {
        $(element).removeAttr(name);
      }
    });
  });

  const result = $.root().html();
  return result ?? optimized.data;
}

export interface ExtractedSvgStructure {
  groups: SvgGroupDescription[];
  structureLines: string[];
}

export function extractSvgStructure(svgString: string): ExtractedSvgStructure {
  const $ = cheerio.load(svgString, { xmlMode: true });
  const groups: SvgGroupDescription[] = [];
  const structureLines: string[] = [];

  $('g').each((_index: number, element: any) => {
    const id = $(element).attr('id') || '';
    if (!id) {
      return;
    }
    const childCount = $(element).children().length;
    groups.push({ id, childCount });
    structureLines.push(`Group ID: "${id}", Children: ${childCount}`);
  });

  return { groups, structureLines };
}

export function buildAssetProcessorUserPrompt(structureLines: string[], options?: ProcessSvgForLlmOptions): string {
  const lines: string[] = [];

  if (options && options.userPrompt) {
    lines.push(`User prompt: ${options.userPrompt}`);
    lines.push('');
  }

  lines.push('SVG group structure:');
  structureLines.forEach(line => {
    lines.push(line);
  });

  lines.push('');
  lines.push('Return JSON using the required format.');

  return lines.join('\n');
}

export function normalizeSvgSemanticTags(raw: unknown): SvgSemanticTag[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid asset tags payload: expected an object');
  }

  const obj = raw as { groups?: unknown };
  const rawGroups = Array.isArray(obj.groups) ? obj.groups : [];
  const tags: SvgSemanticTag[] = [];

  for (const item of rawGroups) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const itemObj = item as Record<string, unknown>;
    const idValue = typeof itemObj.id === 'string' ? itemObj.id.trim() : '';
    if (!idValue) {
      continue;
    }

    const labelsRaw = Array.isArray(itemObj.labels) ? itemObj.labels : [];
    const labels = labelsRaw
      .filter(label => typeof label === 'string')
      .map(label => (label as string).trim())
      .filter(label => label.length > 0);

    let description: string | undefined;
    if (typeof itemObj.description === 'string') {
      const desc = itemObj.description.trim();
      if (desc) {
        description = desc;
      }
    }

    tags.push({ id: idValue, labels, description });
  }

  return tags;
}

export async function processSvgForLlm(
  svgString: string,
  client: LLMClient,
  options?: ProcessSvgForLlmOptions
): Promise<ProcessSvgForLlmResult> {
  const safeSvg = sanitizeSvg(svgString);
  const { groups, structureLines } = extractSvgStructure(safeSvg);

  if (!groups.length) {
    return {
      safeSvg,
      groups,
      tags: []
    };
  }

  const userPrompt = buildAssetProcessorUserPrompt(structureLines, options);
  const response = await client.generate({
    model: ASSET_PROCESSOR_MODEL,
    systemPrompt: ASSET_PROCESSOR_SYSTEM_PROMPT,
    userPrompt,
    jsonMode: true
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    throw new Error('AssetProcessor expected JSON response from LLM client');
  }

  const tags = normalizeSvgSemanticTags(parsed);

  return {
    safeSvg,
    groups,
    tags
  };
}

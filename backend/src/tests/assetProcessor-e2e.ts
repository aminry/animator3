import { processSvgForLlm } from '../assetProcessor';
import type { LLMClient } from '../directorAgent';

const dummyClient: LLMClient = {
  async generate() {
    return JSON.stringify({
      groups: [
        { id: 'wheel', labels: ['wheel'], description: 'Wheel group' },
        { id: 'logo', labels: ['logo'], description: 'Logo group' }
      ]
    });
  }
};

async function run() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert('x')</script>
  <g id="wheel"><circle cx="10" cy="10" r="5" /></g>
  <g id="logo" onclick="hack()"><rect x="0" y="0" width="20" height="20" /></g>
</svg>`;

  const result = await processSvgForLlm(svg, dummyClient);

  if (result.safeSvg.includes('<script')) {
    throw new Error('Expected script elements to be removed from sanitized SVG');
  }

  if (result.safeSvg.includes('onclick=')) {
    throw new Error('Expected event handler attributes to be removed from sanitized SVG');
  }

  if (result.groups.length === 0) {
    throw new Error('Expected at least one SVG group to be detected');
  }

  const hasWheelGroup = result.groups.some(group => group.id === 'wheel');
  if (!hasWheelGroup) {
    throw new Error('Expected group with id "wheel" to be detected');
  }

  if (result.tags.length === 0) {
    throw new Error('Expected at least one semantic tag from LLM');
  }

  const wheelTag = result.tags.find(tag => tag.id === 'wheel');
  if (!wheelTag || wheelTag.labels.length === 0) {
    throw new Error('Expected semantic labels for group "wheel"');
  }

  console.log('✓ Asset Processor SVG sanitization and tagging passed');
}

run().catch(error => {
  console.error('❌ Asset Processor SVG test failed:', error);
  process.exitCode = 1;
});

import manifest from '../fixtures/performance-lab-manifest.v1.json' with { type: 'json' };

const VERSION_COUNTS = {
  'two-version': 2,
  'three-version': 3,
  'eight-version': 8,
};

function deterministicText(seed, length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let state = seed >>> 0;
  let value = '';
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    value += alphabet[state % alphabet.length];
  }
  return value;
}

function nestedValue(depth, leaf) {
  let value = leaf;
  for (let index = depth; index > 0; index -= 1) value = { [`level${index}`]: value };
  return value;
}

function keyedLines(versionIndex, count) {
  const lines = Array.from({ length: count }, (_, index) => ({
    sku: `SKU-${String(index).padStart(4, '0')}`,
    quantity: index + versionIndex,
    active: index % 2 === 0,
  }));
  if (versionIndex % 2 === 1) lines.reverse();
  if (versionIndex > 0 && count < 1024) {
    lines.push({ sku: 'ADDED-ALL', quantity: versionIndex });
    const removedIndex = lines.findIndex((line) => line.sku === 'SKU-0001');
    lines.splice(removedIndex, 1);
  }
  return lines;
}

function dataFor(caseId, versionIndex, seed) {
  switch (caseId) {
    case 'empty':
      return {};
    case 'null-missing-undefined':
      return versionIndex === 0
        ? { nullValue: null, undefinedValue: undefined, stable: false }
        : { nullValue: null, missingInBase: `v${versionIndex}`, stable: false };
    case 'text-10240':
      return { longText: deterministicText(seed + versionIndex, 10240) };
    case 'depth-20':
      return { deep: nestedValue(20, `leaf-${versionIndex}`) };
    case 'wide-1000':
      return Object.fromEntries(
        Array.from({ length: 1000 }, (_, index) => [
          `field${String(index).padStart(4, '0')}`,
          index + versionIndex,
        ]),
      );
    case 'keyed-presence':
      return { lines: keyedLines(versionIndex, 4) };
    case 'large-keyed-1024':
      return { lines: keyedLines(versionIndex, 1024) };
    default:
      throw new Error(`Unknown Performance Lab case: ${caseId}`);
  }
}

export function validateKeyedIdentities(versions, arrayPath = 'lines', identityField = 'sku') {
  for (const version of versions) {
    const items = version.data[arrayPath];
    if (!Array.isArray(items)) continue;
    const seen = new Set();
    items.forEach((item, index) => {
      const identity = item?.[identityField];
      if (typeof identity !== 'string' || identity.trim() === '') {
        throw new Error(
          `Missing or blank keyed identity at ${arrayPath}[${index}] in ${version.id}: ${identityField}`,
        );
      }
      if (seen.has(identity)) {
        throw new Error(
          `Duplicate keyed identity ${identity} at ${arrayPath}[${index}] in ${version.id}: ${identityField}`,
        );
      }
      seen.add(identity);
    });
  }
}

export function createScenario(caseId, profile, seed = manifest.seed) {
  if (!manifest.cases.includes(caseId)) throw new Error(`Unknown case: ${caseId}`);
  const count = VERSION_COUNTS[profile];
  if (!count) throw new Error(`Unknown version profile: ${profile}`);
  const versions = Array.from({ length: count }, (_, index) => ({
    id: `v${index + 1}`,
    label: `Version ${index + 1}`,
    data: dataFor(caseId, index, seed),
  }));
  const keyed = caseId.includes('keyed');
  if (keyed) validateKeyedIdentities(versions);
  return {
    id: `${caseId}--${profile}`,
    caseId,
    profile,
    seed,
    versions,
    config: keyed
      ? { arrayItemKeyFields: { lines: 'sku' }, expandAll: caseId === 'keyed-presence' }
      : {},
    expected: {
      versionColumns: count,
      tablePresent: true,
      keyed,
      semantic: caseId === 'empty' ? 'empty' : 'populated',
      textIncludes: caseId === 'keyed-presence' ? ['lines[SKU-0000]', 'Added', 'Removed'] : [],
    },
  };
}

export function createCatalog(seed = manifest.seed) {
  return manifest.cases.flatMap((caseId) =>
    manifest.profiles.map((profile) => createScenario(caseId, profile, seed)),
  );
}

export function verifySemanticOracle(observation, expected) {
  if (!observation?.tablePresent) throw new Error('Semantic oracle expected a comparison table');
  if (observation.versionColumns !== expected.versionColumns) {
    throw new Error(
      `Semantic oracle expected ${expected.versionColumns} version columns, got ${observation.versionColumns}`,
    );
  }
  if (expected.semantic === 'populated' && observation.rowCount < 1) {
    throw new Error('Semantic oracle expected at least one rendered row');
  }
  for (const expectedText of expected.textIncludes) {
    if (!observation.text.includes(expectedText)) {
      throw new Error(`Semantic oracle expected rendered text: ${expectedText}`);
    }
  }
  return true;
}

export { manifest as performanceLabManifest };

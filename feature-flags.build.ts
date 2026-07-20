import featureFlags from './feature-flags.json';

export type BuildMode = 'PACKAGED' | 'DESKTOP' | 'MOBILE';

type FlagSets = Record<BuildMode, Record<string, boolean>>;

export function resolveBuildMode(env: Record<string, string | undefined> = process.env): BuildMode {
  if (env.IS_PACKAGED === 'true' || env.PLATFORM === 'packaged') return 'PACKAGED';
  if (env.PLATFORM === 'android') return 'MOBILE';
  return 'DESKTOP';
}

export function flagConstName(flag: string): string {
  return `__FF_${flag.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}__`;
}

export function buildFeatureDefines(mode: BuildMode): Record<string, string | boolean> {
  const sets = featureFlags as FlagSets;
  const activeFlags: Record<string, boolean> = sets[mode] ?? {};

  const allFlagNames = new Set<string>();
  for (const set of Object.values(sets)) {
    for (const name of Object.keys(set)) allFlagNames.add(name);
  }

  const defines: Record<string, string | boolean> = {
    __IS_PACKAGED__: mode === 'PACKAGED',
    __IS_DESKTOP__: mode === 'DESKTOP',
    __IS_ANDROID__: mode === 'MOBILE',
    __FEATURE_FLAGS__: JSON.stringify(featureFlags),
    __ACTIVE_FEATURE_FLAGS__: JSON.stringify(activeFlags),
  };

  for (const name of allFlagNames) {
    defines[flagConstName(name)] = JSON.stringify(activeFlags[name]);
  }

  return defines;
}

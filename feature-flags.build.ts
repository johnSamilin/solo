import featureFlags from './feature-flags.json';

export type BuildMode = 'PACKAGED' | 'DESKTOP' | 'MOBILE';

type FlagSets = Record<BuildMode, Record<string, boolean | string>>;

export function resolveBuildMode(env: Record<string, string | undefined> = process.env): BuildMode {
  if (env.IS_PACKAGED === 'true' || env.PLATFORM === 'packaged') return 'PACKAGED';
  if (env.PLATFORM === 'android') return 'MOBILE';
  return 'DESKTOP';
}

export function flagConstName(flag: string): string {
  return `__FF_${flag.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}__`;
}

export function buildFeatureDefines(mode: BuildMode, env: Record<string, string | undefined> = process.env): Record<string, string | boolean> {
  const sets = featureFlags as FlagSets;
  const activeFlags: Record<string, boolean | string> = { ...(sets[mode] ?? {}) };
  if (mode === 'DESKTOP' && env.SOLO_EXTENDED_SEARCH !== undefined) {
    if (!['true', 'false'].includes(env.SOLO_EXTENDED_SEARCH)) {
      throw new Error('SOLO_EXTENDED_SEARCH must be true or false');
    }
    activeFlags['extended-search'] = env.SOLO_EXTENDED_SEARCH === 'true';
  }

  const allFlagNames = new Set<string>();
  for (const set of Object.values(sets)) {
    for (const name of Object.keys(set)) allFlagNames.add(name);
  }

  const defines: Record<string, string | boolean> = {
    __IS_PACKAGED__: mode === 'PACKAGED',
    __IS_DESKTOP__: mode === 'DESKTOP',
    __IS_ANDROID__: mode === 'MOBILE',
    __FEATURE_FLAGS__: JSON.stringify({ ...sets, [mode]: activeFlags }),
    __ACTIVE_FEATURE_FLAGS__: JSON.stringify(activeFlags),
  };

  for (const name of allFlagNames) {
    defines[flagConstName(name)] = JSON.stringify(activeFlags[name]);
  }

  return defines;
}

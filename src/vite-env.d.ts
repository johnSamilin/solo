/// <reference types="vite/client" />

declare const __IS_PACKAGED__: boolean;
declare const __IS_DESKTOP__: boolean;
declare const __IS_ANDROID__: boolean;

type FeatureFlagMode = 'PACKAGED' | 'DESKTOP' | 'MOBILE';

type FeatureFlagSet = Record<string, boolean>;

declare const __FEATURE_FLAGS__: Record<FeatureFlagMode, FeatureFlagSet>;

declare const __ACTIVE_FEATURE_FLAGS__: FeatureFlagSet;

declare const __FF_EXTENDED_SEARCH__: boolean;

declare const __FF_DEEP_LINKING__: boolean;

declare const __FF_DEFAULT_THEME__: string;

// Minimal ambient typings for the URLPattern API (not yet in lib.dom for all TS versions).
// Only the surface used by the deep-link parser is declared.
interface URLPatternInit {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  baseURL?: string;
}

interface URLPatternComponentResult {
  input: string;
  groups: Record<string, string | undefined>;
}

interface URLPatternResult {
  inputs: (string | URLPatternInit)[];
  protocol: URLPatternComponentResult;
  username: URLPatternComponentResult;
  password: URLPatternComponentResult;
  hostname: URLPatternComponentResult;
  port: URLPatternComponentResult;
  pathname: URLPatternComponentResult;
  search: URLPatternComponentResult;
  hash: URLPatternComponentResult;
}

declare class URLPattern {
  constructor(init?: URLPatternInit | string, baseURL?: string);
  test(input?: URLPatternInit | string, baseURL?: string): boolean;
  exec(input?: URLPatternInit | string, baseURL?: string): URLPatternResult | null;
}

interface Window {
  URLPattern?: typeof URLPattern;
}

declare module 'virtual:solo-content' {
  import type { FileNode } from './types';
  /** Static note tree generated from the --content folder at build time. */
  export const structure: FileNode[];
  /** Lazily loads a note's HTML content by its relative path. */
  export function loadContent(relativePath: string): Promise<string | null>;
}
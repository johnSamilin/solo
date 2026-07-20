/// <reference types="vite/client" />

declare const __IS_PACKAGED__: boolean;
declare const __IS_DESKTOP__: boolean;
declare const __IS_ANDROID__: boolean;

type FeatureFlagMode = 'PACKAGED' | 'DESKTOP' | 'MOBILE';

type FeatureFlagSet = Record<string, boolean>;

declare const __FEATURE_FLAGS__: Record<FeatureFlagMode, FeatureFlagSet>;

declare const __ACTIVE_FEATURE_FLAGS__: FeatureFlagSet;

declare const __FF_EXTENDED_SEARCH__: boolean;
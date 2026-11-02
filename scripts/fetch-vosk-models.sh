#!/usr/bin/env bash
#
# Downloads the Vosk Russian "small" model and the libvosk shared library.
#
#   - Android (Vosk AAR): the standard Vosk model zip in `assets/model-ru.zip`.
#   - Desktop (native Vosk via koffi FFI): the same model, extracted into
#     `native-clients/electron/models/`, plus `libvosk` in
#     `native-clients/electron/libvosk/`.
#
# The models are ~46 MB each and are NOT committed to the repository — run this
# script once after a fresh checkout.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODEL_URLS=(
  "https://huggingface.co/rhasspy/vosk-models/resolve/main/ru/vosk-model-small-ru-0.22.zip"
  "https://raw.githubusercontent.com/kercre123/vosk-models/main/vosk-model-small-ru-0.22.zip"
  "https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip"
)

download() {
  local out="$1"
  shift
  local url
  for url in "$@"; do
    echo "  trying: $url"
    if curl -L --fail --silent --show-error --connect-timeout 20 --retry 2 "$url" -o "$out"; then
      echo "  ok"
      return 0
    fi
    echo "  failed, trying next mirror..."
  done
  echo "ERROR: all mirrors failed for $out" >&2
  return 1
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── 1. Standard Vosk model (shared by Android and Desktop) ──
MODEL_ZIP="$TMP/vosk-model-small-ru-0.22.zip"
echo "==> Downloading vosk-model-small-ru-0.22.zip"
download "$MODEL_ZIP" "${MODEL_URLS[@]}" || exit 1

# Android: bundle the zip in assets (unpacked at runtime by TranscriptionManager).
ANDROID_DST="$PROJECT_ROOT/native-clients/android/app/src/main/assets/model-ru.zip"
mkdir -p "$(dirname "$ANDROID_DST")"
cp "$MODEL_ZIP" "$ANDROID_DST"
echo "  Android -> $ANDROID_DST"

# Desktop: extract the model for the native vosk loader.
DESKTOP_MODEL_DIR="$PROJECT_ROOT/native-clients/electron/models/vosk-model-small-ru-0.22"
rm -rf "$DESKTOP_MODEL_DIR"
mkdir -p "$DESKTOP_MODEL_DIR"
unzip -q "$MODEL_ZIP" -d "$DESKTOP_MODEL_DIR"
# Flatten a single top-level directory if the archive wraps everything in one.
CONTENT=("$DESKTOP_MODEL_DIR"/*)
if [ "${#CONTENT[@]}" -eq 1 ] && [ -d "${CONTENT[0]}" ]; then
  mv "${CONTENT[0]}"/* "$DESKTOP_MODEL_DIR/"
  rmdir "${CONTENT[0]}"
fi
echo "  Desktop -> $DESKTOP_MODEL_DIR"

# ── 2. libvosk shared library (from the `vosk` npm package tarball) ──
# The `vosk` npm package bundles libvosk for every platform, so we pull it from
# the npm registry (reliable) rather than the GitHub releases, and extract only
# the binary for the current OS.
VOSK_NPM_VER="0.3.39"
case "$(uname -s)" in
  Darwin) LIBVOSK_FILE="libvosk.dylib" ;;
  Linux)  LIBVOSK_FILE="libvosk.so" ;;
  *) echo "Unsupported OS for libvosk download: $(uname -s)" >&2; exit 1 ;;
esac
LIBVOSK_TGZ_URL="https://registry.npmjs.org/vosk/-/vosk-$VOSK_NPM_VER.tgz"
LIBVOSK_TGZ="$TMP/vosk-$VOSK_NPM_VER.tgz"
echo "==> Downloading vosk npm package (for $LIBVOSK_FILE)"
download "$LIBVOSK_TGZ" "$LIBVOSK_TGZ_URL" || exit 1

LIBVOSK_DIR="$PROJECT_ROOT/native-clients/electron/libvosk"
mkdir -p "$LIBVOSK_DIR"
mkdir -p "$TMP/vosk-extract"
tar xzf "$LIBVOSK_TGZ" -C "$TMP/vosk-extract"
find "$TMP/vosk-extract" -name "$LIBVOSK_FILE" -exec cp {} "$LIBVOSK_DIR/$LIBVOSK_FILE" \;
echo "  Desktop libvosk -> $LIBVOSK_DIR/$LIBVOSK_FILE"

echo ""
echo "Done."
echo "  Android model:   $ANDROID_DST"
echo "  Desktop model:   $DESKTOP_MODEL_DIR"
echo "  Desktop libvosk: $LIBVOSK_DIR/$LIBVOSK_FILE"

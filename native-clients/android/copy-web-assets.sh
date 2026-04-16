#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ANDROID_ASSETS="$SCRIPT_DIR/app/src/main/assets/solo"

echo "Copying web assets to Android..."
rm -rf "$ANDROID_ASSETS"
mkdir -p "$ANDROID_ASSETS"
cp -R "$PROJECT_ROOT/dist/"* "$ANDROID_ASSETS/"

TYPEWRITER_SRC="$PROJECT_ROOT/public/typewriter.mp3"
TYPEWRITER_DST="$SCRIPT_DIR/app/src/main/assets/typewriter.mp3"
if [ -f "$TYPEWRITER_SRC" ]; then
    cp "$TYPEWRITER_SRC" "$TYPEWRITER_DST"
    echo "Copied typewriter.mp3"
fi

TYPEWRITER1_SRC="$PROJECT_ROOT/public/typewriter-1.mp3"
TYPEWRITER1_DST="$SCRIPT_DIR/app/src/main/assets/typewriter-1.mp3"
if [ -f "$TYPEWRITER1_SRC" ]; then
    cp "$TYPEWRITER1_SRC" "$TYPEWRITER1_DST"
    echo "Copied typewriter-1.mp3"
fi

echo "Done! Web assets copied to $ANDROID_ASSETS"

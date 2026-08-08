#!/bin/sh

# Create webfiles from sources at compile time (works without npm/node.js)
#
# Usage: build.sh [DEST_PARENT] [TARGET_FILE] [EXTRA_COPY_DIR]
#   DEST_PARENT     parent dir of the generated webui/ (default: repo root)
#   TARGET_FILE     build only this file (index.html|styles.css|app.js); default: all
#   EXTRA_COPY_DIR  also copy TARGET_FILE into EXTRA_COPY_DIR/webui/

set -eu

echo "### Starting WebUI build ###"

# Resolve the script's own directory portably.
script_dir=$(cd -- "$(dirname -- "$0")" && pwd -P)
src="$script_dir/../../webui-src"

dest_parent="${1:-}"
target="${2:-}"
extra_copy_dir="${3:-}"

if [ -z "$dest_parent" ]; then
  publicdest="$script_dir/../../webui"
else
  publicdest="$dest_parent/webui"
fi

# Full rebuild (no specific target): remove any existing output first.
if [ -z "$target" ] && [ -d "$publicdest" ]; then
  echo "removing existing $publicdest"
  rm -rf -- "$publicdest"
fi

mkdir -p -- "$publicdest"

if [ -z "$target" ] || [ "$target" = "index.html" ]; then
  echo "copying html file"
  cp -- "$src/index.html" "$publicdest/"
fi

if [ -z "$target" ] || [ "$target" = "styles.css" ]; then
  echo "copying css file"
  cp -- "$src/styles.css" "$publicdest/"
fi

if [ -z "$target" ] || [ "$target" = "app.js" ]; then
  echo "building app.js:"
  echo "- copying template.js ..."
  cp -- "$src/make-src/template.js" "$publicdest/app.js"

  js_root="$src/app"
  find "$js_root" -type f -name '*.js' | LC_ALL=C sort | while IFS= read -r filename; do
    fname="${filename#"$js_root/"}"
    fname="${fname%.*}"
    case "$fname" in
    */*)
      section="${fname%%/*}/*"
      if [ "$section" != "${last_section:-}" ]; then
        echo "- adding $section ..."
        last_section="$section"
      fi
      ;;
    *)
      echo "- adding $fname ..."
      last_section=
      ;;
    esac
    {
      printf 'require.register("%s", function(exports, require, module) {\n' "$fname"
      cat -- "$filename"
      printf '\n});\n'
    } >>"$publicdest/app.js"
  done
fi

echo "copying assets folder"
cp -R -- "$src/assets/." "$publicdest/"

if [ -n "$target" ] && [ -n "$extra_copy_dir" ]; then
  mkdir -p -- "$extra_copy_dir/webui"
  echo "copying $target to $extra_copy_dir/webui/$target"
  cp -- "$publicdest/$target" "$extra_copy_dir/webui/$target"
fi

echo "### WebUI build complete ###"

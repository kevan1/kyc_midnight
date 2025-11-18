#!/bin/bash
# Fix macOS quarantine issues with native bindings
# This removes the quarantine attribute from all native bindings

echo "🔧 Fixing native bindings quarantine issues..."

# Find and fix all .node files
find node_modules -name "*.node" -type f 2>/dev/null | while read -r file; do
  if xattr -l "$file" 2>/dev/null | grep -q "com.apple.quarantine"; then
    echo "  Fixing: $file"
    xattr -d com.apple.quarantine "$file" 2>/dev/null || true
  fi
done

echo "✓ Native bindings fixed"

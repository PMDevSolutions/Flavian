#!/bin/bash
# Benchmark Results Saver
# Automatically saves benchmark results with timestamps
# Exit 0 (always - informational)

# Read JSON input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process if this was a benchmarking/profiling command
if [[ ! "$COMMAND" =~ (lighthouse|artillery|ab|wrk|node --prof|phpunit.*--coverage|benchmark|profile|perf) ]]; then
    exit 0
fi

# Create reports directory
REPORTS_DIR=".claude/reports/performance-benchmarker"
mkdir -p "$REPORTS_DIR"

# Look for benchmark/profiling output files
BENCHMARK_FILES=()

# Lighthouse reports
[[ -f "lighthouse-report.html" ]] && BENCHMARK_FILES+=(lighthouse-report.html)
[[ -f "lighthouse-report.json" ]] && BENCHMARK_FILES+=(lighthouse-report.json)

# Artillery reports
[[ -f "artillery-report.json" ]] && BENCHMARK_FILES+=(artillery-report.json)
[[ -f "artillery.json" ]] && BENCHMARK_FILES+=(artillery.json)

# Node.js profiling
[[ -f "isolate-*.log" ]] && BENCHMARK_FILES+=(isolate-*.log)
[[ -d ".clinic" ]] && BENCHMARK_FILES+=(.clinic)

# Generic benchmark outputs
[[ -f "benchmark.json" ]] && BENCHMARK_FILES+=(benchmark.json)
[[ -f "benchmark-results.json" ]] && BENCHMARK_FILES+=(benchmark-results.json)
[[ -f "performance.json" ]] && BENCHMARK_FILES+=(performance.json)

# PHP profiling
[[ -f "cachegrind.out.*" ]] && BENCHMARK_FILES+=(cachegrind.out.*)
[[ -f "xdebug.*.xt" ]] && BENCHMARK_FILES+=(xdebug.*.xt)

# Remove duplicates
BENCHMARK_FILES=($(echo "${BENCHMARK_FILES[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

if [ ${#BENCHMARK_FILES[@]} -eq 0 ]; then
    # No specific files found, but save command output if available
    echo "ℹ️  No benchmark output files detected" >&2
    echo "   Command: $COMMAND" >&2
    exit 0
fi

# Save benchmarks with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BENCHMARK_DIR="$REPORTS_DIR/benchmark_$TIMESTAMP"
mkdir -p "$BENCHMARK_DIR"

# Copy benchmark files
COPIED=0
for file in "${BENCHMARK_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        cp "$file" "$BENCHMARK_DIR/" 2>/dev/null && ((COPIED++))
    elif [[ -d "$file" ]]; then
        cp -r "$file" "$BENCHMARK_DIR/" 2>/dev/null && ((COPIED++))
    fi
done

if [ $COPIED -gt 0 ]; then
    echo "✅ Benchmark results saved to: $BENCHMARK_DIR" >&2
    echo "   Files saved: ${BENCHMARK_FILES[@]}" >&2

    # Create a summary file
    cat > "$BENCHMARK_DIR/summary.txt" <<EOF
Performance Benchmark Report
============================
Timestamp: $(date)
Command: $COMMAND
Files: ${BENCHMARK_FILES[@]}
EOF

    # Try to extract key metrics if available
    if [ -f "lighthouse-report.json" ]; then
        echo "" >> "$BENCHMARK_DIR/summary.txt"
        echo "Lighthouse Metrics:" >> "$BENCHMARK_DIR/summary.txt"
        jq -r '.categories | to_entries[] | "  \(.key): \(.value.score * 100)%"' "lighthouse-report.json" >> "$BENCHMARK_DIR/summary.txt" 2>/dev/null || true
    fi

else
    echo "⚠️  Failed to copy benchmark files" >&2
fi

exit 0

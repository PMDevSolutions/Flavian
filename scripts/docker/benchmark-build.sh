#!/bin/bash
# Docker Build Benchmark Script
# Measures build time improvements from layer caching and multi-stage builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

RESULTS_FILE="docker-benchmark-results.txt"

print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check Docker
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop first."
    exit 1
fi

print_header "Docker Build Optimization Benchmark"
echo ""
echo "This benchmark measures the effectiveness of:"
echo "  - Multi-stage Docker builds"
echo "  - Layer caching with BuildKit"
echo "  - .dockerignore optimization"
echo ""
echo "The benchmark will run 3 tests:"
echo "  1. Clean build (no cache) - baseline"
echo "  2. Rebuild with cache (no code changes)"
echo "  3. Incremental build (simulated code change)"
echo ""

read -p "Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    print_warning "Benchmark cancelled."
    exit 0
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1

# Test 1: Clean build (baseline)
print_header "Test 1/3: Clean Build (no cache)"
echo "Removing existing images and build cache..."
docker-compose down --rmi local 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

clean_start=$(date +%s)
docker-compose build --no-cache --progress=plain wordpress 2>&1 | tee /tmp/clean-build.log | tail -30
clean_end=$(date +%s)
clean_duration=$((clean_end - clean_start))
print_success "Clean build completed in ${clean_duration} seconds"

# Test 2: Rebuild with full cache (no changes)
print_header "Test 2/3: Cached Build (no changes)"
cached_start=$(date +%s)
docker-compose build --progress=plain wordpress 2>&1 | tee /tmp/cached-build.log | tail -30
cached_end=$(date +%s)
cached_duration=$((cached_end - cached_start))
print_success "Cached build completed in ${cached_duration} seconds"

# Test 3: Incremental build (simulate code change)
print_header "Test 3/3: Incremental Build (simulated change)"
# Touch a file to invalidate only later layers
touch .dockerignore
incremental_start=$(date +%s)
docker-compose build --progress=plain wordpress 2>&1 | tee /tmp/incremental-build.log | tail -30
incremental_end=$(date +%s)
incremental_duration=$((incremental_end - incremental_start))
print_success "Incremental build completed in ${incremental_duration} seconds"

# Calculate improvements
cache_improvement=0
incremental_improvement=0

if [ $clean_duration -gt 0 ]; then
    cache_improvement=$(( (clean_duration - cached_duration) * 100 / clean_duration ))
    incremental_improvement=$(( (clean_duration - incremental_duration) * 100 / clean_duration ))
fi

# Get image size
image_size=$(docker images flavian-wordpress:latest --format "{{.Size}}" 2>/dev/null || echo "N/A")

# Results
print_header "Benchmark Results"
echo ""
echo "Build Times:"
echo "  Clean build (baseline):     ${clean_duration}s"
echo "  Cached build (no changes):  ${cached_duration}s"
echo "  Incremental build:          ${incremental_duration}s"
echo ""
echo "Improvements over clean build:"
echo "  Cache improvement:          ${cache_improvement}%"
echo "  Incremental improvement:    ${incremental_improvement}%"
echo ""
echo "Image size: ${image_size}"
echo ""

# Acceptance criteria check
if [ $cache_improvement -ge 30 ]; then
    print_success "PASSED: Build time reduced by ${cache_improvement}% (target: 30%)"
else
    print_warning "FAILED: Build time reduced by ${cache_improvement}% (target: 30%)"
fi

# Check for multi-stage build
if grep -q "FROM.*AS" Dockerfile 2>/dev/null; then
    print_success "PASSED: Multi-stage build implemented"
else
    print_error "FAILED: Multi-stage build not found in Dockerfile"
fi

# Check for .dockerignore
if [ -f ".dockerignore" ]; then
    ignore_lines=$(wc -l < .dockerignore)
    print_success "PASSED: .dockerignore configured (${ignore_lines} rules)"
else
    print_error "FAILED: .dockerignore not found"
fi

# Save results
{
    echo ""
    echo "=========================================="
    echo "Docker Build Benchmark - $(date)"
    echo "=========================================="
    echo ""
    echo "Build Times:"
    echo "  Clean build:      ${clean_duration}s"
    echo "  Cached build:     ${cached_duration}s"
    echo "  Incremental:      ${incremental_duration}s"
    echo ""
    echo "Improvements:"
    echo "  Cache:            ${cache_improvement}%"
    echo "  Incremental:      ${incremental_improvement}%"
    echo ""
    echo "Image size:         ${image_size}"
    echo ""
    echo "Acceptance Criteria:"
    [ $cache_improvement -ge 30 ] && echo "  [PASS] Build time reduced by 30%+" || echo "  [FAIL] Build time reduction below 30%"
    grep -q "FROM.*AS" Dockerfile 2>/dev/null && echo "  [PASS] Multi-stage build" || echo "  [FAIL] Multi-stage build"
    [ -f ".dockerignore" ] && echo "  [PASS] .dockerignore configured" || echo "  [FAIL] .dockerignore missing"
    echo ""
} >> "$RESULTS_FILE"

echo ""
print_success "Results saved to: $RESULTS_FILE"
echo ""

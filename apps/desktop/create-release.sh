#!/usr/bin/env bash
set -euo pipefail

# Interactive release script for onpoint desktop app
# Usage: ./create-release.sh [--patch|--minor|--major] [--publish] [--merge]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PACKAGE_JSON="$SCRIPT_DIR/package.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
BUMP_TYPE=""
AUTO_PUBLISH=false
AUTO_MERGE=false

for arg in "$@"; do
  case $arg in
    --patch) BUMP_TYPE="patch" ;;
    --minor) BUMP_TYPE="minor" ;;
    --major) BUMP_TYPE="major" ;;
    --publish) AUTO_PUBLISH=true ;;
    --merge) AUTO_MERGE=true ;;
    --help|-h)
      echo "Usage: ./create-release.sh [--patch|--minor|--major] [--publish] [--merge]"
      echo ""
      echo "Options:"
      echo "  --patch     Bump patch version (x.y.Z)"
      echo "  --minor     Bump minor version (x.Y.0)"
      echo "  --major     Bump major version (X.0.0)"
      echo "  --publish   Auto-publish the release (skip draft)"
      echo "  --merge     Auto-merge the version bump PR after release"
      echo "  --help      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      exit 1
      ;;
  esac
done

# --- Prerequisites ---

echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) is not installed. Install it: https://cli.github.com${NC}"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo -e "${RED}Error: Not authenticated with GitHub CLI. Run: gh auth login${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is not installed. Install it: brew install jq${NC}"
  exit 1
fi

cd "$REPO_ROOT"

if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error: Working directory is not clean. Commit or stash your changes first.${NC}"
  git status --short
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
echo -e "${GREEN}Prerequisites OK${NC} (branch: $CURRENT_BRANCH)"

# --- Current Version ---

CURRENT_VERSION=$(jq -r '.version' "$PACKAGE_JSON")
echo ""
echo -e "Current version: ${YELLOW}v${CURRENT_VERSION}${NC}"

# Parse semver
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# --- Version Bump ---

if [ -z "$BUMP_TYPE" ]; then
  NEXT_PATCH="$MAJOR.$MINOR.$((PATCH + 1))"
  NEXT_MINOR="$MAJOR.$((MINOR + 1)).0"
  NEXT_MAJOR="$((MAJOR + 1)).0.0"

  echo ""
  echo "Select version bump:"
  echo -e "  1) patch  → ${GREEN}v${NEXT_PATCH}${NC}"
  echo -e "  2) minor  → ${GREEN}v${NEXT_MINOR}${NC}"
  echo -e "  3) major  → ${GREEN}v${NEXT_MAJOR}${NC}"
  echo "  4) custom"
  echo ""
  read -rp "Choice [1]: " CHOICE
  CHOICE=${CHOICE:-1}

  case $CHOICE in
    1) BUMP_TYPE="patch" ;;
    2) BUMP_TYPE="minor" ;;
    3) BUMP_TYPE="major" ;;
    4)
      read -rp "Enter custom version (without 'v' prefix): " CUSTOM_VERSION
      if [[ ! "$CUSTOM_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
        echo -e "${RED}Invalid version format. Expected: x.y.z or x.y.z-prerelease${NC}"
        exit 1
      fi
      NEW_VERSION="$CUSTOM_VERSION"
      ;;
    *)
      echo -e "${RED}Invalid choice${NC}"
      exit 1
      ;;
  esac
fi

if [ -z "${NEW_VERSION:-}" ]; then
  case $BUMP_TYPE in
    patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  esac
fi

TAG_NAME="v${NEW_VERSION}"

echo ""
echo -e "New version: ${GREEN}${TAG_NAME}${NC}"

# --- Check if tag already exists ---

if git rev-parse "$TAG_NAME" &> /dev/null; then
  echo -e "${YELLOW}Warning: Tag $TAG_NAME already exists.${NC}"
  read -rp "Delete and recreate? [y/N]: " CONFIRM
  if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    git tag -d "$TAG_NAME"
    git push origin ":refs/tags/$TAG_NAME" 2>/dev/null || true
    gh release delete "$TAG_NAME" --yes 2>/dev/null || true
    echo -e "${GREEN}Deleted existing tag and release.${NC}"
  else
    echo "Aborted."
    exit 1
  fi
fi

# --- Confirm ---

echo ""
read -rp "Proceed with release ${TAG_NAME}? [Y/n]: " CONFIRM
CONFIRM=${CONFIRM:-Y}
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# --- Update version in package.json ---

echo ""
echo -e "${BLUE}Updating version in package.json...${NC}"
jq --arg v "$NEW_VERSION" '.version = $v' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"
mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

# --- Commit and tag ---

echo -e "${BLUE}Committing version bump...${NC}"
git add "$PACKAGE_JSON"
git commit -m "chore(release): v${NEW_VERSION}"

echo -e "${BLUE}Creating tag ${TAG_NAME}...${NC}"
git tag "$TAG_NAME"

echo -e "${BLUE}Pushing to remote...${NC}"
git push origin "$CURRENT_BRANCH"
git push origin "$TAG_NAME"

echo ""
echo -e "${GREEN}Tag ${TAG_NAME} pushed. Release workflow triggered.${NC}"

# --- Watch the workflow ---

echo ""
echo -e "${BLUE}Watching release workflow...${NC}"
echo "(Press Ctrl+C to stop watching — the workflow will continue running)"
echo ""

# Wait briefly for the workflow to be picked up
sleep 3

RUN_ID=$(gh run list --workflow=release-desktop.yml --limit=1 --json databaseId --jq '.[0].databaseId')

if [ -n "$RUN_ID" ]; then
  gh run watch "$RUN_ID" --exit-status || true

  # Check final status
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '.conclusion')

  if [ "$STATUS" = "success" ]; then
    echo ""
    echo -e "${GREEN}Release workflow completed successfully!${NC}"

    # Get the draft release URL
    RELEASE_URL=$(gh release view "$TAG_NAME" --json url --jq '.url' 2>/dev/null || echo "")

    if [ -n "$RELEASE_URL" ]; then
      if [ "$AUTO_PUBLISH" = true ]; then
        echo -e "${BLUE}Publishing release...${NC}"
        gh release edit "$TAG_NAME" --draft=false
        echo -e "${GREEN}Release published: ${RELEASE_URL}${NC}"
      else
        echo -e "${YELLOW}Draft release created: ${RELEASE_URL}${NC}"
        echo "Run 'gh release edit ${TAG_NAME} --draft=false' to publish."
      fi
    fi
  else
    echo ""
    echo -e "${RED}Release workflow failed (status: ${STATUS}).${NC}"
    echo "Check the run: gh run view $RUN_ID --web"
    exit 1
  fi
else
  echo -e "${YELLOW}Could not find the workflow run. Check GitHub Actions manually.${NC}"
  echo "Run: gh run list --workflow=release-desktop.yml"
fi

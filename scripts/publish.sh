#!/bin/bash

# Aegis SDK Publishing Script
# This script automates the safe publishing of @aegis/sdk to NPM

set -e  # Exit on error

echo "🚀 Aegis SDK Publishing Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the aegis-sdk directory"
    exit 1
fi

# Check if logged in to NPM
echo "📝 Checking NPM authentication..."
if ! npm whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to NPM${NC}"
    echo "Please run: npm login"
    exit 1
fi

NPM_USER=$(npm whoami)
echo -e "${GREEN}✓ Logged in as: $NPM_USER${NC}"
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"
echo ""

# Ask for version bump type
echo "Select version bump:"
echo "1) patch (0.1.0 -> 0.1.1)"
echo "2) minor (0.1.0 -> 0.2.0)"
echo "3) major (0.1.0 -> 1.0.0)"
echo "4) custom"
echo "5) skip (use current version)"
read -p "Enter choice (1-5): " VERSION_CHOICE

case $VERSION_CHOICE in
    1)
        npm version patch --no-git-tag-version
        ;;
    2)
        npm version minor --no-git-tag-version
        ;;
    3)
        npm version major --no-git-tag-version
        ;;
    4)
        read -p "Enter custom version (e.g., 0.1.0-beta.1): " CUSTOM_VERSION
        npm version $CUSTOM_VERSION --no-git-tag-version
        ;;
    5)
        echo "Keeping current version: $CURRENT_VERSION"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Version: $NEW_VERSION${NC}"
echo ""

# Run checks
echo "🔍 Running pre-publish checks..."
echo ""

# 1. Type check
echo "1️⃣  Type checking..."
if npm run type-check; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
fi
echo ""

# 2. Linting
echo "2️⃣  Linting..."
if npm run lint; then
    echo -e "${GREEN}✓ Lint passed${NC}"
else
    echo -e "${RED}❌ Lint failed${NC}"
    exit 1
fi
echo ""

# 3. Build
echo "3️⃣  Building..."
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# 4. Tests
echo "4️⃣  Running tests..."
if npm test; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi
echo ""

# 5. Security audit
echo "5️⃣  Security audit..."
if npm audit --audit-level=moderate; then
    echo -e "${GREEN}✓ No security issues${NC}"
else
    echo -e "${YELLOW}⚠️  Security vulnerabilities found${NC}"
    read -p "Continue anyway? (y/N): " CONTINUE_AUDIT
    if [ "$CONTINUE_AUDIT" != "y" ]; then
        exit 1
    fi
fi
echo ""

# 6. Dry run
echo "6️⃣  Dry run..."
echo "Files that will be published:"
npm publish --dry-run
echo ""

# Final confirmation
echo "================================"
echo "📦 Ready to publish @aegis/sdk@$NEW_VERSION"
echo "================================"
echo ""
echo "Please confirm:"
echo "- Version: $NEW_VERSION"
echo "- All checks passed"
echo "- README and CHANGELOG are up to date"
echo ""
read -p "Publish to NPM? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Publish cancelled"
    exit 0
fi

# Publish
echo ""
echo "📤 Publishing to NPM..."
if npm publish --access public; then
    echo -e "${GREEN}✅ Successfully published @aegis/sdk@$NEW_VERSION${NC}"
else
    echo -e "${RED}❌ Publish failed${NC}"
    exit 1
fi

# Post-publish steps
echo ""
echo "📋 Post-publish checklist:"
echo ""
echo "✓ Published to NPM"
echo "□ Commit version bump:"
echo "    git add package.json"
echo "    git commit -m 'Release v$NEW_VERSION'"
echo "□ Create and push tag:"
echo "    git tag v$NEW_VERSION"
echo "    git push origin main --tags"
echo "□ Create GitHub release"
echo "□ Update documentation"
echo ""
echo "🎉 Done!"

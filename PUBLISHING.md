# Publishing @aegis/sdk to NPM

This guide covers how to publish the Aegis SDK to NPM.

## Prerequisites

### 1. NPM Account Setup

If you don't have an NPM account:

```bash
# Create account at https://www.npmjs.com/signup
# Or via CLI:
npm adduser
```

If you already have an account:

```bash
# Login to NPM
npm login
```

**For Scoped Packages (@aegis/sdk):**
- Requires an NPM organization called "aegis"
- Create at: https://www.npmjs.com/org/create
- Or publish as public scoped package (free)

### 2. Two-Factor Authentication (Recommended)

Enable 2FA for publishing:

```bash
npm profile enable-2fa auth-and-writes
```

## Pre-Publishing Checklist

Run through this checklist before every publish:

### ✅ 1. Update Version

```bash
# For patches (0.1.0 -> 0.1.1)
npm version patch

# For minor releases (0.1.0 -> 0.2.0)
npm version minor

# For major releases (0.1.0 -> 1.0.0)
npm version major
```

Or manually update `package.json`:
```json
{
  "version": "0.1.0"
}
```

### ✅ 2. Build the Package

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk
npm run build
```

**Verify build output:**
```bash
ls -la dist/
# Should see:
# - index.js (ESM)
# - index.cjs (CommonJS)
# - index.d.ts (TypeScript definitions)
# - agents/ directory
```

### ✅ 3. Run Tests

```bash
npm test
```

Make sure all tests pass before publishing!

### ✅ 4. Type Check

```bash
npm run type-check
```

### ✅ 5. Lint Code

```bash
npm run lint
```

### ✅ 6. Test Locally First

Before publishing to NPM, test the package locally:

```bash
# In the SDK directory
npm pack
# This creates aegis-sdk-0.1.0.tgz

# In another project
npm install /Users/ryankaelle/dev/aegis/aegis-sdk/aegis-sdk-0.1.0.tgz

# Test the installation
node -e "const aegis = require('@aegis/sdk'); console.log(aegis.VERSION);"
```

### ✅ 7. Update Documentation

- [ ] README.md is up to date
- [ ] CHANGELOG.md includes new changes
- [ ] Examples are working

### ✅ 8. Verify package.json

Check these fields:
- `name`: `@aegis/sdk`
- `version`: Updated correctly
- `description`: Accurate
- `repository`: Correct GitHub URL
- `keywords`: Relevant for discoverability
- `license`: MIT (or your chosen license)
- `files`: Only includes what should be published

### ✅ 9. Check What Will Be Published

```bash
npm publish --dry-run
```

This shows exactly what files will be included in the package.

## Publishing to NPM

### Option 1: Standard Publish (Public Package)

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk

# Publish to NPM
npm publish --access public
```

**Note:** For scoped packages (`@aegis/sdk`), you must use `--access public` unless you have a paid NPM org.

### Option 2: Publish with Tag (Recommended for Testing)

For pre-releases or testing:

```bash
# Publish as beta
npm publish --tag beta --access public

# Users install with:
npm install @aegis/sdk@beta
```

### Option 3: Automated Publishing with CI/CD

For production, automate with GitHub Actions (see below).

## Post-Publishing

### 1. Verify the Package

```bash
# View package on NPM
npm view @aegis/sdk

# Install in a test project
npm install @aegis/sdk

# Check version
npm view @aegis/sdk version
```

### 2. Test Installation

Create a test project:

```bash
mkdir test-aegis-sdk
cd test-aegis-sdk
npm init -y
npm install @aegis/sdk

# Test import
node -e "import('@aegis/sdk').then(m => console.log('Version:', m.VERSION))"
```

### 3. Update Documentation

Update your main README or docs site with the new version:

```markdown
## Installation

\`\`\`bash
npm install @aegis/sdk
\`\`\`

Latest version: 0.1.0
```

### 4. Create Git Tag

```bash
git add .
git commit -m "Release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

### 5. Create GitHub Release

Go to: https://github.com/aegis/aegis-sdk/releases/new

- Tag: v0.1.0
- Title: Release v0.1.0
- Description: Changelog for this release

## Version Management Strategy

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

### Pre-1.0.0 Versions

For early development:
- `0.1.0` - Initial public release
- `0.2.0` - New features
- `0.2.1` - Bug fixes
- `1.0.0` - First stable release

### Pre-release Tags

```bash
# Alpha release
npm version 0.1.0-alpha.0
npm publish --tag alpha --access public

# Beta release
npm version 0.1.0-beta.0
npm publish --tag beta --access public

# Release candidate
npm version 0.1.0-rc.0
npm publish --tag rc --access public
```

## Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build package
        run: npm run build

      - name: Publish to NPM
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup:**
1. Create NPM automation token: https://www.npmjs.com/settings/~/tokens
2. Add to GitHub secrets: Settings → Secrets → New repository secret
3. Name: `NPM_TOKEN`
4. Value: Your NPM token

**Usage:**
```bash
# Create and push tag
git tag v0.1.0
git push origin v0.1.0

# GitHub Actions will automatically publish to NPM
```

## Unpublishing (Emergency Only)

If you need to unpublish (discouraged):

```bash
# Unpublish specific version (within 72 hours)
npm unpublish @aegis/sdk@0.1.0

# Deprecate version (preferred)
npm deprecate @aegis/sdk@0.1.0 "Use version 0.1.1 instead"
```

**Note:** NPM has strict unpublish policies. Only unpublish within 72 hours of publishing, and only if absolutely necessary (security issue, major bug).

## Common Issues & Solutions

### Issue: "You must verify your email to publish"

**Solution:**
```bash
npm profile get
# Verify email in NPM settings
```

### Issue: "You do not have permission to publish @aegis/sdk"

**Solution:**
- Create NPM organization: https://www.npmjs.com/org/create
- Or change package name to something without `@`

### Issue: "Package name too similar to existing package"

**Solution:**
- Choose a more unique name
- Or use scoped package: `@yourcompany/sdk`

### Issue: "Cannot publish over existing version"

**Solution:**
```bash
# Update version first
npm version patch
npm publish --access public
```

### Issue: "401 Unauthorized"

**Solution:**
```bash
# Re-login to NPM
npm logout
npm login
```

## Best Practices

### 1. Always Test Before Publishing

```bash
npm run build && npm test && npm run type-check
```

### 2. Use prepublishOnly Script

Already configured in `package.json`:
```json
{
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

This automatically builds before publishing.

### 3. Maintain a CHANGELOG

Keep `CHANGELOG.md` updated:

```markdown
# Changelog

## [0.1.0] - 2025-12-02

### Added
- Initial release
- Vault management functions
- Transaction execution
- Guardian API integration

### Changed
- N/A

### Fixed
- N/A
```

### 4. Use .npmignore or package.json "files"

Already configured in `package.json`:
```json
{
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

This ensures only necessary files are published.

### 5. Semantic Versioning

Follow semver strictly:
- Breaking change → major version
- New feature → minor version
- Bug fix → patch version

### 6. Security Scanning

Before publishing:
```bash
npm audit
npm audit fix
```

### 7. Keep Dependencies Updated

```bash
npm outdated
npm update
```

## Quick Reference

### First-Time Publish

```bash
# 1. Login to NPM
npm login

# 2. Build and test
npm run build
npm test

# 3. Publish
npm publish --access public
```

### Subsequent Publishes

```bash
# 1. Update version
npm version patch

# 2. Build and test
npm run build
npm test

# 3. Publish
npm publish --access public

# 4. Push to git
git push origin main --tags
```

## Support

- NPM Documentation: https://docs.npmjs.com/
- Semantic Versioning: https://semver.org/
- NPM Package Best Practices: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry

## Checklist Summary

Before every publish:

- [ ] Version updated in package.json
- [ ] Code built (`npm run build`)
- [ ] Tests passing (`npm test`)
- [ ] Types checking (`npm run type-check`)
- [ ] Linting passing (`npm run lint`)
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Dry run looks good (`npm publish --dry-run`)
- [ ] Logged in to NPM (`npm whoami`)
- [ ] Ready to publish! (`npm publish --access public`)

# Quick Start: Publishing to NPM

## 🚀 First Time Publishing

### Step 1: NPM Account Setup (One-Time)

```bash
# If you don't have an NPM account, create one
npm adduser

# If you already have an account, login
npm login
```

**For @aegis/sdk scoped package:**
- Go to https://www.npmjs.com/org/create
- Create organization named "aegis" (or change package name)

### Step 2: Verify You're Ready

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk

# Check you're logged in
npm whoami

# Build the package
npm run build

# Run tests
npm test
```

### Step 3: Publish!

**Option A: Using the automated script (Recommended)**

```bash
./scripts/publish.sh
```

This script will:
- ✓ Check NPM authentication
- ✓ Let you choose version bump
- ✓ Run type checking
- ✓ Run linting
- ✓ Build the package
- ✓ Run tests
- ✓ Security audit
- ✓ Show dry run
- ✓ Publish to NPM

**Option B: Manual publishing**

```bash
# Update version (choose one)
npm version patch          # 0.1.0 -> 0.1.1
npm version minor          # 0.1.0 -> 0.2.0
npm version major          # 0.1.0 -> 1.0.0

# Build and test
npm run build
npm test

# Publish
npm publish --access public
```

### Step 4: Verify Publication

```bash
# Check it's live on NPM
npm view @aegis/sdk

# Test installation in another project
npm install @aegis/sdk
```

### Step 5: Git Tag

```bash
# Commit the version bump
git add package.json
git commit -m "Release v0.1.0"

# Create tag
git tag v0.1.0

# Push to GitHub
git push origin main --tags
```

## 🔄 Subsequent Publishes

For future releases:

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk

# Use the automated script
./scripts/publish.sh

# Or manual:
npm version patch
npm run build && npm test
npm publish --access public
git push origin main --tags
```

## 📝 Pre-Publish Checklist

Before each publish, ensure:

- [ ] All code changes committed
- [ ] Tests passing (`npm test`)
- [ ] README.md updated
- [ ] CHANGELOG.md updated (if exists)
- [ ] Breaking changes documented
- [ ] Version number appropriate

## 🏷️ Version Guidelines

**Semantic Versioning (semver):**

- **0.1.0 → 0.1.1**: Patch (bug fixes)
- **0.1.0 → 0.2.0**: Minor (new features, backwards compatible)
- **0.1.0 → 1.0.0**: Major (breaking changes)

**Pre-release versions:**

```bash
# Beta release
npm version 0.1.0-beta.0
npm publish --tag beta --access public

# Users install with:
npm install @aegis/sdk@beta
```

## ⚠️ Important Notes

### Scoped Packages (@aegis/sdk)

You MUST use `--access public` when publishing:

```bash
npm publish --access public
```

Without this flag, NPM will try to publish as private (requires paid org).

### First Publication

The first time you publish a scoped package, you may need:

1. NPM organization "aegis" created
2. Or change package name in `package.json` to unscoped:
   ```json
   {
     "name": "aegis-sdk"
   }
   ```

### Can't Unpublish After 72 Hours

NPM doesn't allow unpublishing after 72 hours. Only publish when you're sure!

To deprecate instead:
```bash
npm deprecate @aegis/sdk@0.1.0 "Please use version 0.1.1"
```

## 🔧 Troubleshooting

### "You do not have permission to publish"

**Solution 1:** Create NPM organization
- Go to https://www.npmjs.com/org/create
- Create org named "aegis"

**Solution 2:** Change to unscoped package
```json
{
  "name": "aegis-sdk"
}
```

### "Cannot publish over existing version"

You need to bump the version:
```bash
npm version patch
```

### "401 Unauthorized"

Re-login to NPM:
```bash
npm logout
npm login
```

### "You must verify your email"

1. Go to https://www.npmjs.com/settings
2. Verify your email address
3. Try publishing again

## 🤖 Automated Publishing (Optional)

For production projects, set up GitHub Actions:

1. Create NPM automation token: https://www.npmjs.com/settings/~/tokens
2. Add to GitHub secrets as `NPM_TOKEN`
3. See `PUBLISHING.md` for full GitHub Actions workflow

Then just push a tag:
```bash
git tag v0.1.0
git push origin v0.1.0
# GitHub automatically publishes to NPM
```

## 📚 Full Documentation

For detailed information, see:
- [PUBLISHING.md](./PUBLISHING.md) - Complete publishing guide
- [README.md](./README.md) - SDK documentation

## 🆘 Need Help?

- NPM docs: https://docs.npmjs.com/
- Aegis issues: https://github.com/aegis/aegis-sdk/issues

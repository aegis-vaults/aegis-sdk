# Fix: Publishing @aegis-vaults/sdk to NPM

## ✅ What I Fixed

1. Updated package name from `@aegis/sdk` → `@aegis-vaults/sdk` (matches your GitHub org)
2. Updated repository URLs to match `github.com/aegis-vaults/aegis-sdk`

## 🚀 Next Steps: Choose One Option

### Option 1: Create NPM Organization (Recommended)

This keeps the scoped package name `@aegis-vaults/sdk`.

**Steps:**

1. **Create the NPM organization:**
   - Go to: https://www.npmjs.com/org/create
   - Organization name: `aegis-vaults`
   - Choose "Free" plan (for public packages)
   - Complete the setup

2. **Publish the package:**
   ```bash
   cd /Users/ryankaelle/dev/aegis/aegis-sdk
   npm publish --access public
   ```

3. **Verify it worked:**
   ```bash
   npm view @aegis-vaults/sdk
   ```

**Users will install with:**
```bash
npm install @aegis-vaults/sdk
```

**Import in code:**
```typescript
import { AegisClient } from '@aegis-vaults/sdk';
```

---

### Option 2: Use Unscoped Package Name (Quick Alternative)

If you can't create the org or want to publish immediately, use an unscoped name.

**Steps:**

1. **Update package.json:**
   ```bash
   # Edit package.json and change:
   # "name": "@aegis-vaults/sdk"
   # to:
   # "name": "aegis-solana-sdk"
   ```
   
   Or use any available name like:
   - `aegis-solana-sdk`
   - `aegis-vault-sdk`
   - `solana-aegis-sdk`

2. **Publish (no --access flag needed):**
   ```bash
   npm publish
   ```

**Users will install with:**
```bash
npm install aegis-solana-sdk
```

**Import in code:**
```typescript
import { AegisClient } from 'aegis-solana-sdk';
```

---

## 📋 Pre-Publish Checklist

Before publishing, make sure:

- [x] Package name updated in package.json
- [ ] Version is correct (currently 0.2.0)
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Type check passes: `npm run type-check`
- [ ] You're logged into npm: `npm whoami` (should show your username)
- [ ] NPM organization created (if using Option 1)

## 🔍 Verify Before Publishing

```bash
# Check you're logged in
npm whoami

# Build and test
npm run build
npm test
npm run type-check

# Check what will be published
npm pack --dry-run
```

## 🎯 Recommended: Use Option 1

Since your GitHub organization is `aegis-vaults`, I recommend:

1. Create NPM org: `aegis-vaults` (matches GitHub)
2. Keep package name: `@aegis-vaults/sdk`
3. Publish with: `npm publish --access public`

This keeps everything consistent and branded!

## ⚠️ Important Notes

- **Scoped packages require `--access public`** for free/public publishing
- **First publish** may require creating the organization
- **You can't unpublish** after 72 hours, so make sure everything is correct
- **Version must be unique** - if 0.2.0 already exists, bump it first

## 🐛 Troubleshooting

### "404 Not Found" error
- The organization doesn't exist yet → Create it at https://www.npmjs.com/org/create
- Or use Option 2 (unscoped package)

### "You do not have permission"
- Make sure you're the owner/admin of the npm organization
- Or use an unscoped package name

### "Cannot publish over existing version"
- Bump the version: `npm version patch` (0.2.0 → 0.2.1)
- Or use a different version number




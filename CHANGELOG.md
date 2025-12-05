# Changelog

All notable changes to the Aegis SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-12-03

### Breaking Changes

⚠️ **IMPORTANT**: This release contains breaking changes to method signatures. You must update your code when upgrading from v0.3.0.

#### Updated Method Signatures

All vault management methods now require `vaultNonce` parameter to match the protocol's updated instruction signatures:

- `addToWhitelist(vault, vaultNonce, address)` - previously `addToWhitelist(vault, address)`
- `removeFromWhitelist(vault, vaultNonce, address)` - previously `removeFromWhitelist(vault, address)`
- `pauseVault(vault, vaultNonce)` - previously `pauseVault(vault)`
- `resumeVault(vault, vaultNonce)` - previously `resumeVault(vault)`
- `approveOverride(vault, vaultNonce, overrideNonce)` - previously `approveOverride(vault, nonce)`

**Migration Example:**

```typescript
// OLD (v0.3.0) - No longer works
await client.addToWhitelist(vaultAddress, recipientAddress);
await client.pauseVault(vaultAddress);

// NEW (v0.4.0) - Correct usage
await client.addToWhitelist(vaultAddress, vaultNonce, recipientAddress);
await client.pauseVault(vaultAddress, vaultNonce);
```

### Added

- **New Method**: `updateAgentSigner(vault, vaultNonce, newAgentSigner)` - Allows vault owners to rotate the AI agent's signing key for security
- **Type Updates**: Added `vaultNonce` field to `VaultConfig` type
- **Type Updates**: Enhanced `GuardianVault` type with new fields:
  - `agentSigner: string` - AI agent public key
  - `userId?: string` - Optional user ID link
  - `tier: 'PERSONAL' | 'TEAM' | 'ENTERPRISE'` - Vault tier
  - `feeBasisPoints: number` - Protocol fee
  - `paused: boolean` - Vault pause status
  - `vaultNonce: string` - Vault nonce for PDA derivation
- **Documentation**: Added comprehensive documentation links to README
  - https://docs.aegis-vaults.xyz
  - https://github.com/aegis-vaults/aegis-docs

### Changed

- **Protocol Sync**: All SDK methods now aligned with protocol instruction signatures
- **Type Safety**: Improved type definitions to match Guardian Prisma schema
- **AI Integrations**: Updated OpenAI agent integration to use new method signatures

### Removed

- Cleaned up empty directories: `src/query/`, `src/transactions/`, `src/vault/`, `src/events/`

### Fixed

- Fixed `getVault()` method to properly parse `vaultNonce` field from on-chain account data
- Fixed TypeScript compilation errors in agent integrations

## [0.3.0] - 2025-11-28

Initial stable release of the Aegis SDK with core functionality:

- Vault creation and management
- Policy-based transaction execution
- Override request system
- Guardian API integration
- AI framework integrations (OpenAI, LangChain, Anthropic)
- Comprehensive error handling
- Utility functions for PDA derivation and amount conversion

---

For detailed upgrade guides and migration assistance, see our [documentation](https://docs.aegis-vaults.xyz).

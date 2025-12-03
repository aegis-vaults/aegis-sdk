# Testing the Aegis Override Flow

This guide walks through testing the complete override transaction flow from blocked transaction to approval.

## Prerequisites

- Vault with funds: `3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja`
- Agent secret: `e7WOIpiYxY6p+3bhVGU73P5yLria3fK63aS75VkoHMIIrVFm2rYQy/5j1G207ff5QXmgS4T1qcMuMaN0vV1BRA==`
- Vault owner wallet: `HVc1LQjdJJbGkZqkwA8kD2sJrYEoGAY2cT8ztSZr2f7c`
- Destination address: `HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA` (already whitelisted)

## Step 1: Check Current Vault State

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk && \
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';

async function main() {
  const connection = new Connection(DEVNET_RPC);
  const vaultPubkey = new PublicKey('3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja');
  const accountInfo = await connection.getAccountInfo(vaultPubkey);
  
  const data = accountInfo.data;
  const dailyLimit = data.readBigUInt64LE(72);
  const dailySpent = data.readBigUInt64LE(80);
  const remaining = dailyLimit - dailySpent;
  
  console.log('Daily Limit:', Number(dailyLimit) / 1e9, 'SOL');
  console.log('Daily Spent:', Number(dailySpent) / 1e9, 'SOL');
  console.log('Remaining:', Number(remaining) / 1e9, 'SOL');
}

main();
"
```

**Expected:** You should see the remaining daily limit (e.g., 0.19 SOL remaining after the 0.01 SOL test transaction).

## Step 2: Attempt Transaction That Exceeds Daily Limit

Try to send more than the remaining daily limit:

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk && \
VAULT_ADDRESS="3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja" \
AGENT_SECRET="e7WOIpiYxY6p+3bhVGU73P5yLria3fK63aS75VkoHMIIrVFm2rYQy/5j1G207ff5QXmgS4T1qcMuMaN0vV1BRA==" \
AMOUNT="0.25" \
DESTINATION="HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA" \
npx tsx examples/send-sol.ts
```

**Expected:** Transaction should be blocked with message "Amount exceeds remaining daily limit!"

## Step 3: Generate Override Request Blink URL

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk && \
VAULT_ADDRESS="3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja" \
AGENT_SECRET="e7WOIpiYxY6p+3bhVGU73P5yLria3fK63aS75VkoHMIIrVFm2rYQy/5j1G207ff5QXmgS4T1qcMuMaN0vV1BRA==" \
AMOUNT="0.25" \
DESTINATION="HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA" \
npx tsx examples/request-override.ts
```

**Expected:** You'll get a Blink URL like:
```
https://dial.to/?action=solana-action:https://aegis-guardian-production.up.railway.app/api/blinks/override?vault=3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja&destination=HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA&amount=250000000&reason=exceeded_daily_limit
```

## Step 4: Test Blink Actions Endpoint (GET)

Test the metadata endpoint:

```bash
curl "https://aegis-guardian-production.up.railway.app/api/blinks/override?vault=3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja&destination=HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA&amount=250000000&reason=exceeded_daily_limit" \
  -H "Accept: application/json"
```

**Expected:** JSON response with action metadata:
```json
{
  "type": "action",
  "icon": "https://aegis-vaults.xyz/aegis-icon.png",
  "title": "Aegis Override Request",
  "description": "Approve override for 0.2500 SOL transfer. Reason: exceeded daily limit",
  "label": "Approve Override",
  "links": {
    "actions": [...]
  }
}
```

## Step 5: Test Blink Actions Endpoint (POST)

Test the transaction building endpoint:

```bash
curl -X POST "https://aegis-guardian-production.up.railway.app/api/blinks/override?vault=3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja&destination=HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA&amount=250000000&reason=exceeded_daily_limit" \
  -H "Content-Type: application/json" \
  -d '{"account": "HVc1LQjdJJbGkZqkwA8kD2sJrYEoGAY2cT8ztSZr2f7c"}'
```

**Expected:** JSON response with base64-encoded transaction:
```json
{
  "type": "transaction",
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAED...",
  "message": "Approve override for 0.2500 SOL to HMrBkPPn..."
}
```

## Step 6: Approve Override via Wallet

1. **Open the Blink URL in a Solana wallet** (Phantom, Backpack, etc.):
   - Copy the Blink URL from Step 3
   - Open it in a browser with a Solana wallet extension installed
   - Or use a mobile wallet that supports Solana Actions

2. **Review the override request:**
   - You should see transaction details
   - Amount: 0.25 SOL
   - Destination: HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA
   - Reason: Exceeded daily limit

3. **Sign the approval transaction:**
   - The wallet will show a transaction to sign
   - This creates the override on-chain
   - Confirm and sign with your vault owner wallet (`HVc1LQjdJJbGkZqkwA8kD2sJrYEoGAY2cT8ztSZr2f7c`)

## Step 7: Verify Override Created On-Chain

After signing, check that the override was created:

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk && \
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';

async function main() {
  const connection = new Connection(DEVNET_RPC);
  const vaultPubkey = new PublicKey('3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja');
  
  // Get vault to read override_nonce
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  const data = vaultAccount.data;
  const overrideNonceOffset = 8 + 32 + 32 + 8 + 8 + 8 + 640 + 1 + 1 + 2 + 50 + 1 + 1;
  const overrideNonce = data.readBigUInt64LE(overrideNonceOffset);
  
  // Derive pending override PDA
  const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
  const BN = require('bn.js');
  const [pendingOverridePda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('override'),
      vaultPubkey.toBuffer(),
      new BN(overrideNonce.toString()).toArrayLike(Buffer, 'le', 8),
    ],
    AEGIS_PROGRAM_ID
  );
  
  console.log('Pending Override PDA:', pendingOverridePda.toBase58());
  
  const overrideAccount = await connection.getAccountInfo(pendingOverridePda);
  if (overrideAccount) {
    console.log('✅ Override exists on-chain!');
    console.log('Account size:', overrideAccount.data.length, 'bytes');
  } else {
    console.log('❌ Override not found on-chain yet');
  }
}

main();
"
```

## Step 8: Execute Approved Override

Once the override is approved, the agent can execute it. However, we need to implement `execute_approved_override` in the SDK first. For now, you can verify the override was created and check it in the frontend.

## Step 9: Check Frontend Transaction History

1. Go to https://aegis-vaults.xyz/transactions
2. You should see:
   - The original blocked transaction attempt (if recorded)
   - The override approval transaction
   - Any subsequent executed transactions

## Troubleshooting

### Blink URL doesn't work
- Check that Railway has deployed the latest code
- Verify the Guardian URL is correct: `https://aegis-guardian-production.up.railway.app`
- Check browser console for CORS errors

### Transaction not appearing in frontend
- Make sure you're authenticated (wallet connected)
- Check that `myTransactions=true` is set in the API call
- Verify the transaction was recorded via POST `/api/transactions`

### Override not found on-chain
- Wait a few seconds after signing (block confirmation time)
- Check the transaction signature on Solscan
- Verify the override_nonce matches what's in the vault account


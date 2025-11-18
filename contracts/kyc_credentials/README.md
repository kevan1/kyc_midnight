# kyc_credentials

A Midnight Network application created with `create-mn-app`.

## Getting Started

### Prerequisites

- Node.js 22+ installed
- Docker installed (for proof server)

### Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup and deploy**:

   ```bash
   npm run setup
   ```

   This will:

   - Compile your Compact contract
   - Build TypeScript to JavaScript
   - Deploy contract to the testnet

3. **Interact with your contract**:
   ```bash
   npm run cli
   ```

### Available Scripts

- `npm run setup` - Compile, build, and deploy contract
- `npm run compile` - Compile Compact contract
- `npm run build` - Build TypeScript
- `npm run deploy` - Deploy contract to testnet
- `npm run cli` - Interactive CLI for contract
- `npm run check-balance` - Check wallet balance
- `npm run reset` - Reset all compiled/built files
- `npm run clean` - Clean build artifacts

### Environment Variables

Copy `.env.example` to `.env` and configure:

- `WALLET_SEED` - Your 64-character wallet seed (auto-generated)
- `MIDNIGHT_NETWORK` - Network to use (testnet)
- `PROOF_SERVER_URL` - Proof server URL
- `CONTRACT_NAME` - Contract name

### Project Structure

```
kyc_credentials/
├── contracts/
│   ├── kyc-credentials.compact # Compact KYC credential contract
│   └── managed/                 # Compiled artifacts
├── src/
│   ├── deploy.ts             # Deployment script
│   ├── cli.ts                # Interactive CLI
│   ├── providers/            # Shared providers
│   └── utils/                # Utility functions
├── .env                      # Environment config (keep private!)
├── deployment.json           # Deployment info
└── package.json
```

### Getting Testnet Tokens

1. Run `npm run deploy` to see your wallet address
2. Visit [https://midnight.network/test-faucet](https://midnight.network/test-faucet)
3. Enter your address to receive test tokens

### Learn More

- [Midnight Documentation](https://docs.midnight.network)
- [Compact Language Guide](https://docs.midnight.network/compact)
- [Tutorial Series](https://docs.midnight.network/tutorials)

## Contract Overview

This project now scaffolds a **KYC credential management** contract. The Compact
module exposes placeholder circuits for:

- Registering identity credentials (hashed commitment + metadata reference)
- Issuing age credentials backed by zero-knowledge proofs
- Recording country residency proofs
- Tracking human/liveness verification
- Recording revocation intents from the issuer

All ledger entries are stored as opaque strings so that only hashed or
commitment values ever reach the public state. Replace the placeholder logic
with full per-wallet registries and proof verification once the end-to-end flow
is defined.

Happy coding! 🌙
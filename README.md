# KYC Platform

A privacy-preserving Know Your Customer (KYC) verification platform built on the Midnight Network. This platform enables users to verify their identity, age, and human status using zero-knowledge proofs, ensuring privacy while meeting compliance requirements.

## Features

### 🔐 Privacy-Preserving Verification
- **Zero-Knowledge Proofs (ZKPs)**: All sensitive data (age, country, CAPTCHA results) are verified using ZK proofs without exposing the actual values
- **On-Chain Commitments**: Credentials are stored as cryptographic commitments on the Midnight blockchain
- **Selective Disclosure**: Users can prove specific attributes (e.g., "I am over 18") without revealing exact values

### 📋 Verification Types

1. **Identity Verification**
   - Full name and document type verification
   - Country verification (stored as commitment for privacy)
   - Issues both Identity and Country credentials on-chain

2. **Age Verification**
   - Supports both "Under 18" and "Over 18" verification
   - Age bracket stored as commitment (not actual age)
   - ZK proof generated for Over18 users to prove age >= 18

3. **Human Verification**
   - CAPTCHA verification
   - Liveness check via camera
   - CAPTCHA result stored as commitment for privacy

### 🎨 Modern UI/UX
- Dark theme with glassmorphism design
- Animated backgrounds and smooth transitions
- Responsive design for all devices
- Type-specific color schemes for each credential type

## Tech Stack

- **Framework**: Next.js 16.0.0
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI
- **State Management**: Zustand
- **Blockchain**: Midnight Network
- **Wallet Integration**: Midnight Wallet SDK

## Getting Started

### Prerequisites

- Node.js >= 20.9.0
- pnpm >= 9.0.0
- Midnight Wallet extension installed in your browser

### Installation

1. Clone the repository:
```bash
git clone https://github.com/blockchainUni/kyc_platform.git
cd kyc_platform
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
Create a `.env.local` file with the following variables:
```env
NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER=https://lace-dev.proof-pub.stg.midnight.tools
NEXT_PUBLIC_ASSET_APP_URL=http://localhost:3001
ASSET_APP_ORIGIN=http://localhost:3002
```

4. Deploy the Midnight contract:
```bash
cd contracts/kyc_credentials
pnpm install
pnpm run deploy
```

5. Update the contract address in your environment variables or configuration files.

6. Run the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
kyc_platform/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── kyc/          # KYC-related API endpoints
│   ├── credentials/       # Credential viewing pages
│   ├── verify/           # Verification pages
│   └── page.tsx          # Homepage
├── components/            # React components
│   └── ui/               # Reusable UI components
├── contracts/             # Midnight contract code
│   └── kyc_credentials/  # KYC credentials contract
├── lib/                   # Utility functions
│   ├── blockchain-utils.ts    # Blockchain interaction utilities
│   ├── zk-proof-utils.ts      # ZK proof generation and verification
│   ├── store.ts               # Zustand state management
│   └── proof-store.ts         # Server-side proof storage
└── public/                # Static assets
```

## API Endpoints

### `/api/kyc/status`
Fetches on-chain KYC status for a given wallet address.

**Request:**
```json
{
  "wallet": "0xmn_shield-addr_..."
}
```

**Response:**
```json
{
  "identity": "Verified",
  "age": "Verified",
  "human": "Verified",
  "country": "Verified",
  "allComplete": true,
  "credentials": [...]
}
```

### `/api/kyc/verify-proof`
Verifies ZK proofs for age, country, or CAPTCHA without revealing private values.

**Request:**
```json
{
  "wallet": "0xmn_shield-addr_...",
  "commitment": "0x...",
  "proofType": "age" | "country" | "captcha"
}
```

**Response:**
```json
{
  "verified": true,
  "isAdult": true,  // or isFrance, or captchaPassed
  "commitment": "0x...",
  "proofReference": "0x..."
}
```

### `/api/kyc/store-proof`
Stores ZK proofs server-side for later verification.

## Verification Flow

1. **Identity Verification** (`/verify/identity`)
   - User enters full name, country, and document type
   - Issues Identity credential on-chain
   - Issues Country credential on-chain (with commitment)
   - Generates and stores Country ZK proof

2. **Human Verification** (`/verify/human`)
   - User completes CAPTCHA challenge
   - User performs liveness check via camera
   - Issues Human credential on-chain
   - Generates and stores CAPTCHA ZK proof

3. **Age Verification** (`/verify/age`)
   - User selects age range (Under 18 or Over 18)
   - Issues Age credential on-chain
   - Generates ZK proof for Over18 users only

## Privacy Features

### Zero-Knowledge Proofs
- **Age Proof**: Proves `age >= 18` without revealing actual age
- **Country Proof**: Proves `country == France` without revealing actual country
- **CAPTCHA Proof**: Proves `captchaPassed == true` without revealing CAPTCHA result

### On-Chain Storage
- Only commitments (hashes) are stored on-chain
- Actual values (age, country, CAPTCHA result) are never exposed
- Proofs are stored server-side and can be verified without revealing private data

## Integration with Asset Tokenization Apps

This KYC platform integrates with asset tokenization applications running on ports 3001 and 3002. After completing verification, users are redirected back to the asset app with verification status in URL parameters.

**Redirect URL Format:**
```
http://localhost:3001/project/1/buy?kyc=verified&isAdult=true&midnightWallet=0xmn_...&subjectHash=0x...
```

## Contract Deployment

The KYC credentials contract is deployed on the Midnight Network. To deploy:

```bash
cd contracts/kyc_credentials
pnpm run deploy
```

The contract supports:
- Identity credential registration
- Age credential issuance (with commitments)
- Country credential issuance (with commitments)
- Human verification recording (with commitments)
- Credential revocation

## Development

### Running Tests
```bash
pnpm test
```

### Building for Production
```bash
pnpm build
pnpm start
```

### Linting
```bash
pnpm lint
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on the GitHub repository.

## Acknowledgments

- Built with [Midnight Network](https://midnight.network/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

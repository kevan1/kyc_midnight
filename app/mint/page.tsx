/**
 * Mint Property Tokens Page
 * Uses Mesh SDK and Lace wallet to mint property tokens
 */

import { MintPropertyToken } from '@/components/mint-property-token';

export default function MintPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Mint Property Tokens</h1>
        <p className="text-gray-600 mb-8">
          Connect your Lace wallet and mint property tokens using Mesh SDK.
          All types are validated against the plutus.json blueprint.
        </p>
        <MintPropertyToken />
      </div>
    </div>
  );
}


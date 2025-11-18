/**
 * React component for minting property tokens
 * Uses Mesh SDK and Lace wallet
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { connectWallet } from '@/lib/lace-wallet';
import { mintPropertyToken, getAvailableProperties, type PropertyToken } from '@/lib/mint-property-token';

export function MintPropertyToken() {
  const [properties] = useState<PropertyToken[]>(getAvailableProperties());
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    txHash?: string;
    error?: string;
  } | null>(null);

  const handleMint = async () => {
    if (!selectedProperty) {
      setResult({ success: false, error: 'Please select a property' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Connect to wallet
      const walletSession = await connectWallet();
      console.log('Wallet connected:', walletSession.address);

      // Mint token
      const mintResult = await mintPropertyToken(selectedProperty, walletSession);

      setResult({
        success: true,
        txHash: mintResult.txHash,
      });
    } catch (error: any) {
      console.error('Mint error:', error);
      setResult({
        success: false,
        error: error.message || 'Failed to mint token',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Mint Property Token</CardTitle>
        <CardDescription>
          Mint property tokens using Mesh SDK and Lace wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Property
          </label>
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={loading}
          >
            <option value="">-- Select Property --</option>
            {properties.map((property) => (
              <option key={property.property_id} value={property.property_id}>
                {property.name} (ID: {property.property_id})
              </option>
            ))}
          </select>
        </div>

        {selectedProperty && (
          <div className="p-4 bg-gray-50 rounded-md">
            <h3 className="font-semibold mb-2">Property Details</h3>
            {(() => {
              const property = properties.find((p) => p.property_id === selectedProperty);
              return property ? (
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {property.name}</p>
                  <p><strong>Policy ID:</strong> {property.policy_id}</p>
                  <p><strong>Asset Name:</strong> {Buffer.from(property.asset_name_hex, 'hex').toString('utf-8')}</p>
                </div>
              ) : null;
            })()}
          </div>
        )}

        <Button
          onClick={handleMint}
          disabled={!selectedProperty || loading}
          className="w-full"
        >
          {loading ? 'Minting...' : 'Mint Token'}
        </Button>

        {result && (
          <div className={`p-4 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
            {result.success ? (
              <div>
                <p className="font-semibold text-green-800">✅ Token Minted Successfully!</p>
                {result.txHash && (
                  <p className="text-sm text-green-700 mt-2">
                    Transaction Hash: <code className="bg-white px-2 py-1 rounded">{result.txHash}</code>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="font-semibold text-red-800">❌ Mint Failed</p>
                {result.error && (
                  <p className="text-sm text-red-700 mt-2">{result.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/**
 * API route for minting property tokens
 * POST /api/mint
 */

import { NextRequest, NextResponse } from 'next/server';
import { mintPropertyToken, getAvailableProperties, getPropertyById } from '@/lib/mint-property-token';

export async function GET(request: NextRequest) {
  try {
    const properties = getAvailableProperties();
    return NextResponse.json({ properties });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get properties' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Verify property exists
    const property = getPropertyById(propertyId);
    if (!property) {
      return NextResponse.json(
        { error: `Property ${propertyId} not found` },
        { status: 404 }
      );
    }

    // Note: In a real implementation, you'd need to handle wallet connection
    // For now, this is a placeholder that shows the structure
    // The actual minting should happen in the frontend with wallet access

    return NextResponse.json({
      message: 'Minting should be done from the frontend with wallet access',
      propertyId,
      property,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process mint request' },
      { status: 500 }
    );
  }
}


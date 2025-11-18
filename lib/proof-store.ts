/**
 * Server-side proof store for ZK proofs
 * Uses file-based storage (JSON) for persistence across server restarts
 * Supports multiple users (keyed by subject hash derived from wallet address)
 */

import type { AgeProof, CountryProof, CaptchaProof } from "./zk-proof-utils"
import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// File-based proof store (keyed by subject hash)
// Each wallet address gets a unique subjectKey, supporting multiple users
const PROOF_STORE_DIR = path.join(process.cwd(), "data")
const PROOF_STORE_FILE = path.join(PROOF_STORE_DIR, "proofs.json")

type AnyProof = AgeProof | CountryProof | CaptchaProof

interface StoredProof {
  proof: AnyProof
  expiresAt?: string // ISO timestamp
}

interface ProofStoreData {
  [subjectKey: string]: StoredProof
}

// Ensure data directory exists
async function ensureDataDir(): Promise<void> {
  if (!existsSync(PROOF_STORE_DIR)) {
    await mkdir(PROOF_STORE_DIR, { recursive: true })
  }
}

// Load proofs from file
async function loadProofs(): Promise<ProofStoreData> {
  try {
    if (!existsSync(PROOF_STORE_FILE)) {
      return {}
    }
    const content = await readFile(PROOF_STORE_FILE, "utf-8")
    const parsed = JSON.parse(content) as ProofStoreData
    return parsed || {}
  } catch (error) {
    console.warn("[proof-store] Failed to load proofs from file", error)
    return {}
  }
}

// Save proofs to file
async function saveProofs(proofs: ProofStoreData): Promise<void> {
  try {
    await ensureDataDir()
    await writeFile(PROOF_STORE_FILE, JSON.stringify(proofs, null, 2), "utf-8")
  } catch (error) {
    console.error("[proof-store] Failed to save proofs to file", error)
    throw error
  }
}

/**
 * Store a proof server-side (supports Age, Country, and Captcha proofs)
 * This allows the API route to retrieve it for verification
 * Supports multiple users - each wallet address gets a unique subjectKey
 * 
 * @param subjectKey - Subject key (e.g., "0x123..." for age, "0x123...:country" for country, "0x123...:captcha" for captcha)
 * @param proof - The proof to store (AgeProof, CountryProof, or CaptchaProof)
 */
export async function storeProof(subjectKey: string, proof: AnyProof): Promise<void> {
  const proofs = await loadProofs()
  
  // Add expiration timestamp (1 year from now for credentials)
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  
  proofs[subjectKey] = {
    proof,
    expiresAt,
  }
  
  await saveProofs(proofs)
  const proofType = subjectKey.includes(":country") ? "country" : subjectKey.includes(":captcha") ? "captcha" : "age"
  console.log(`[proof-store] Stored ${proofType} proof for subject: ${subjectKey.substring(0, 16)}...`)
}

/**
 * Retrieve a proof by subject key
 * Supports multiple users - each wallet address has its own proof
 * Supports different proof types via key suffix (e.g., ":country", ":captcha")
 * 
 * @param subjectKey - Subject key (e.g., "0x123..." for age, "0x123...:country" for country, "0x123...:captcha" for captcha)
 * @returns The stored proof or null if not found/expired
 */
export async function getProof(subjectKey: string): Promise<AnyProof | null> {
  const proofs = await loadProofs()
  const stored = proofs[subjectKey]
  
  if (!stored) {
    return null
  }
  
  // Check if proof has expired
  if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
    // Remove expired proof
    delete proofs[subjectKey]
    await saveProofs(proofs)
    return null
  }
  
  return stored.proof
}

/**
 * Remove a proof (e.g., on revocation)
 * Supports multiple users - removes only the specified user's proof
 */
export async function removeProof(subjectKey: string): Promise<void> {
  const proofs = await loadProofs()
  if (proofs[subjectKey]) {
    delete proofs[subjectKey]
    await saveProofs(proofs)
    console.log(`[proof-store] Removed proof for subject: ${subjectKey.substring(0, 16)}...`)
  }
}

/**
 * Get all proofs (for debugging/admin purposes)
 * Returns proofs for all users
 */
export async function getAllProofs(): Promise<Array<{ subjectKey: string; proof: AnyProof }>> {
  const proofs = await loadProofs()
  const now = new Date()
  
  // Filter out expired proofs and return valid ones
  const valid: Array<{ subjectKey: string; proof: AnyProof }> = []
  const toRemove: string[] = []
  
  for (const [subjectKey, stored] of Object.entries(proofs)) {
    if (stored.expiresAt && new Date(stored.expiresAt) < now) {
      toRemove.push(subjectKey)
    } else {
      valid.push({ subjectKey, proof: stored.proof })
    }
  }
  
  // Clean up expired proofs
  if (toRemove.length > 0) {
    for (const key of toRemove) {
      delete proofs[key]
    }
    await saveProofs(proofs)
  }
  
  return valid
}


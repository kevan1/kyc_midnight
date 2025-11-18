import "dotenv/config";
import path from "path";
import fs from "fs";
import { WebSocket } from "ws";
import * as Rx from "rxjs";
import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import {
  NetworkId,
  setNetworkId,
  getZswapNetworkId,
  getLedgerNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { createBalancedTx } from "@midnight-ntwrk/midnight-js-types";
import { Transaction, nativeToken } from "@midnight-ntwrk/ledger";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import chalk from "chalk";
import { MidnightProviders, type NetworkConfig } from "./providers/midnight-providers.js";
import { EnvironmentManager } from "./utils/environment.js";

// Ensure WebSocket is available when running in Node.js
// @ts-ignore
globalThis.WebSocket = WebSocket;

const DEFAULT_CONTRACT_NAME = "kyc-credentials";
const DEFAULT_PRIVATE_STATE_ID = "kycCredentialState";

export interface RegisterIdentityParams {
  identityRecordsState: string;
  identityMetadataState: string;
  identityIssuerState: string;
}

export interface IssueAgeCredentialParams {
  ageCommitmentsState: string;
  ageProofRefsState: string;
  ageBracketRefsState: string;
  ageIssuersState: string;
}

export interface IssueCountryCredentialParams {
  countryCommitmentsState: string;
  countryProofRefsState: string;
  countryIssuersState: string;
}

export interface RecordHumanVerificationParams {
  humanCommitmentsState: string;
  humanProofRefsState: string;
  humanIssuersState: string;
}

export interface RevokeLastCredentialParams {
  revocationReasonsState: string;
  revocationIssuersState: string;
}

export interface KycClientOptions {
  contractName?: string;
  deploymentPath?: string;
  walletSeed?: string;
  privateStateId?: string;
  networkConfig?: NetworkConfig;
  autoWaitForFunds?: boolean;
}

export interface TransactionSummary {
  txId: string;
  blockHeight: number;
}

export interface LedgerSnapshot {
  identityCommitment: string;
  identityMetadataRef: string;
  ageCommitment: string;
  ageProofRef: string;
  ageBracketRef: string;
  countryCommitment: string;
  countryProofRef: string;
  humanCommitment: string;
  humanProofRef: string;
  lastIssuer: string;
  revocationReason: string;
}

export class KycCredentialClient {
  private readonly options: Required<KycClientOptions>;
  private wallet?: any;
  private providers?: ReturnType<typeof MidnightProviders.create>;
  private contractModule?: any;
  private deployedContract?: any;
  private walletSynced = false;

  private constructor(options: Required<KycClientOptions>) {
    this.options = options;
  }

  static async create(options: KycClientOptions = {}): Promise<KycCredentialClient> {
    const resolvedOptions: Required<KycClientOptions> = {
      contractName: options.contractName ?? process.env.CONTRACT_NAME ?? DEFAULT_CONTRACT_NAME,
      deploymentPath: options.deploymentPath ?? path.join(process.cwd(), "deployment.json"),
      walletSeed: options.walletSeed ?? process.env.WALLET_SEED ?? "",
      privateStateId: options.privateStateId ?? DEFAULT_PRIVATE_STATE_ID,
      networkConfig: options.networkConfig ?? EnvironmentManager.getNetworkConfig(),
      autoWaitForFunds: options.autoWaitForFunds ?? false,
    };

    if (!resolvedOptions.walletSeed) {
      throw new Error("WALLET_SEED must be provided via options or environment");
    }

    if (!process.env.WALLET_SEED) {
      process.env.WALLET_SEED = resolvedOptions.walletSeed;
    }
    EnvironmentManager.validateEnvironment();

    const client = new KycCredentialClient(resolvedOptions);
    await client.initialize();
    return client;
  }

  private async initialize(): Promise<void> {
    setNetworkId(NetworkId.TestNet);

    const deployment = this.loadDeploymentInfo();
    const wallet = await this.buildWallet();
    this.wallet = wallet;

    await this.ensureWalletSynced(wallet, this.options.autoWaitForFunds);

    const walletProvider = await this.createWalletProvider(wallet);

    const providers = MidnightProviders.create({
      contractName: this.options.contractName,
      walletProvider,
      networkConfig: this.options.networkConfig,
      privateStateStoreName: `${this.options.contractName}-state-client`,
    });
    this.providers = providers;

    // Dynamically load compiled contract module
    const contractModulePath = path.join(
      process.cwd(),
      "contracts",
      "managed",
      this.options.contractName,
      "contract",
      "index.cjs"
    );
    this.contractModule = await import(contractModulePath);

    const contractInstance = new this.contractModule.Contract({});

    this.deployedContract = await findDeployedContract(providers, {
      contractAddress: deployment.contractAddress,
      contract: contractInstance,
      privateStateId: this.options.privateStateId,
      initialPrivateState: {},
    });
  }

  private loadDeploymentInfo(): { contractAddress: string } {
    if (!fs.existsSync(this.options.deploymentPath)) {
      throw new Error(
        `deployment.json not found at ${this.options.deploymentPath}. Deploy the contract first.`
      );
    }

    const deploymentRaw = fs.readFileSync(this.options.deploymentPath, "utf-8");
    return JSON.parse(deploymentRaw);
  }

  private async buildWallet(): Promise<any> {
    console.log(chalk.gray("🔐 Building wallet from seed"));
    const wallet = await WalletBuilder.buildFromSeed(
      this.options.networkConfig.indexer,
      this.options.networkConfig.indexerWS,
      this.options.networkConfig.proofServer,
      this.options.networkConfig.node,
      this.options.walletSeed,
      getZswapNetworkId(),
      "info"
    );
    wallet.start();
    return wallet;
  }

  private async ensureWalletSynced(wallet: any, waitForFunds: boolean): Promise<void> {
    if (this.walletSynced) {
      return;
    }

    const state = (await Rx.firstValueFrom(wallet.state() as Rx.Observable<any>)) as any;
    const balance = state.balances?.[nativeToken()] ?? 0n;

    if (balance === 0n) {
      console.log(chalk.yellow("⚠️  Wallet balance is 0 tDUST."));
      if (!waitForFunds) {
        console.log(
          chalk.yellow(
            "   Set autoWaitForFunds=true when creating the client if you want to wait for faucet funding."
          )
        );
      }
    }

    await Rx.firstValueFrom(
      (wallet.state() as Rx.Observable<any>).pipe(
        Rx.tap((s: any) => {
            if (s.syncProgress) {
              console.log(
                chalk.gray(
                  `⏳ Syncing wallet: synced=${s.syncProgress.synced} sourceGap=${s.syncProgress.lag.sourceGap}`
                )
              );
            }
          }),
        Rx.filter((s: any) => s.syncProgress?.synced === true)
      )
    );

    this.walletSynced = true;
  }

  private async createWalletProvider(wallet: any) {
    const walletState = (await Rx.firstValueFrom(wallet.state() as Rx.Observable<any>)) as any;

    return {
      coinPublicKey: walletState.coinPublicKey,
      encryptionPublicKey: walletState.encryptionPublicKey,
      balanceTx(tx: any, newCoins: any) {
        return wallet
          .balanceTransaction(
            ZswapTransaction.deserialize(
              tx.serialize(getLedgerNetworkId()),
              getZswapNetworkId()
            ),
            newCoins
          )
          .then((balancedTx: any) => wallet.proveTransaction(balancedTx))
          .then((zswapTx: any) =>
            Transaction.deserialize(
              zswapTx.serialize(getZswapNetworkId()),
              getLedgerNetworkId()
            )
          )
          .then(createBalancedTx);
      },
      submitTx(tx: any) {
        return wallet.submitTransaction(tx);
      },
    };
  }

  private ensureConnected(): void {
    if (!this.deployedContract || !this.providers) {
      throw new Error("Client is not connected. Call KycCredentialClient.create() first.");
    }
  }

  async registerIdentity(params: RegisterIdentityParams): Promise<TransactionSummary> {
    this.ensureConnected();
    const tx = await this.deployedContract.callTx.registerIdentity(
      params.identityRecordsState,
      params.identityMetadataState,
      params.identityIssuerState
    );
    return this.summariseTx(tx);
  }

  async issueAgeCredential(params: IssueAgeCredentialParams): Promise<TransactionSummary> {
    this.ensureConnected();
    const tx = await this.deployedContract.callTx.issueAgeCredential(
      params.ageCommitmentsState,
      params.ageProofRefsState,
      params.ageBracketRefsState,
      params.ageIssuersState
    );
    return this.summariseTx(tx);
  }

  async issueCountryCredential(params: IssueCountryCredentialParams): Promise<TransactionSummary> {
    this.ensureConnected();
    const tx = await this.deployedContract.callTx.issueCountryCredential(
      params.countryCommitmentsState,
      params.countryProofRefsState,
      params.countryIssuersState
    );
    return this.summariseTx(tx);
  }

  async recordHumanVerification(params: RecordHumanVerificationParams): Promise<TransactionSummary> {
    this.ensureConnected();
    const tx = await this.deployedContract.callTx.recordHumanVerification(
      params.humanCommitmentsState,
      params.humanProofRefsState,
      params.humanIssuersState
    );
    return this.summariseTx(tx);
  }

  async revokeLastCredential(params: RevokeLastCredentialParams): Promise<TransactionSummary> {
    this.ensureConnected();
    const tx = await this.deployedContract.callTx.revokeLastCredential(
      params.revocationReasonsState,
      params.revocationIssuersState
    );
    return this.summariseTx(tx);
  }

  async getLedgerSnapshot(): Promise<LedgerSnapshot | null> {
    this.ensureConnected();
    const providers = this.providers!;
    const deployment = this.loadDeploymentInfo();

    const state = await providers.publicDataProvider.queryContractState(
      deployment.contractAddress
    );
    if (!state) {
      return null;
    }

    const ledger = this.contractModule.ledger(state.data) as LedgerSnapshot;
    return ledger;
  }

  async disconnect(): Promise<void> {
    if (this.wallet) {
      if (typeof this.wallet.close === "function") {
        await this.wallet.close();
      }
      this.wallet = undefined;
    }
  }

  private summariseTx(tx: any): TransactionSummary {
    return {
      txId: tx?.public?.txId ?? "",
      blockHeight: tx?.public?.blockHeight ?? 0,
    };
  }
}

/**
 * The `defineAgent` primitive. Authors describe what their agent fetches and
 * computes; the SDK handles preflight, attestation submission, and runtime
 * wiring. The same agent definition works under any host (Node daemon,
 * Cloudflare Worker, Phala CVM, etc.) — the host just calls `agent.attest()`
 * on its own schedule.
 */
import type { Address, Hex } from "viem";
import {
  preflight,
  submitAttestation,
  submitAttestationWithRule,
  type ChainContext,
} from "./chain.js";
import { log } from "./logger.js";

/**
 * Run result for plain (non-rule-bound) agents — the author computes the
 * final value off-chain and posts it directly.
 */
export interface AgentRunPlain {
  value: bigint | number;
  inputHash: Hex;
  context?: Record<string, unknown>;
}

/**
 * Run result for rule-bound (verifiable) agents — the author returns only
 * the raw input vector; the bound onchain rule contract computes the
 * final value deterministically. The SDK never computes the final value
 * off-chain in this path.
 */
export interface AgentRunRaw {
  rawInputs: Array<bigint | number>;
  context?: Record<string, unknown>;
}

export type AgentRunResult = AgentRunPlain | AgentRunRaw;

export interface AgentConfig {
  /** Human-readable identifier, e.g. "warsaw-resi". */
  name: string;
  /** Cron schedule (used by runtime adapters that respect it). */
  schedule: string;
  /** The feed this agent attests to. */
  feedId: Hex;
  /** Registry contract address. */
  registryAddress: Address;
  /** Attestation contract address. */
  attestationAddress: Address;
  /** Methodology CID (canonical reference). */
  methodologyCid: string;
  /**
   * Optional bound rule contract. When set, `run` must return `{ rawInputs }`
   * (an `AgentRunRaw`) — the SDK forwards raw inputs to `attestWithRule`
   * and the rule contract computes the final value onchain. When omitted,
   * `run` returns `{ value, inputHash }` as a plain agent.
   */
  rule?: Address;
  /** Author's compute function. Fetches + computes (or fetches raw). */
  run: () => Promise<AgentRunResult>;
}

export interface RuntimeContext {
  /** Private key for signing. */
  privateKey: Hex;
  /** RPC endpoint URL. */
  rpcUrl: string;
  /** Optional chain id override (defaults to whatever the RPC reports). */
  chainId?: number;
}

export class Agent {
  constructor(public readonly config: AgentConfig) {}

  /** Runs the agent's compute function and returns the result without attesting. */
  async dryRun(): Promise<AgentRunResult> {
    log.info("agent: dry run starting", { name: this.config.name, rule: this.config.rule });
    const result = await this.config.run();
    if ("rawInputs" in result) {
      log.info("agent: dry run result · raw", {
        name: this.config.name,
        n: result.rawInputs.length,
        ...result.context,
      });
    } else {
      log.info("agent: dry run result · value", {
        name: this.config.name,
        value: result.value.toString(),
        inputHash: result.inputHash,
        ...result.context,
      });
    }
    return result;
  }

  /** Full attest: preflight + run + submit. */
  async attest(runtime: RuntimeContext): Promise<{ txHash: Hex; value?: bigint | number; inputHash?: Hex; rawInputs?: Array<bigint | number> }> {
    const chainCtx: ChainContext = {
      rpcUrl: runtime.rpcUrl,
      privateKey: runtime.privateKey,
      registryAddress: this.config.registryAddress,
      attestationAddress: this.config.attestationAddress,
      feedId: this.config.feedId,
      methodologyCid: this.config.methodologyCid,
      chainId: runtime.chainId,
    };

    await preflight(chainCtx);
    const result = await this.config.run();

    // Rule-bound path — forward rawInputs to attestWithRule. The rule
    // contract computes the final value onchain; we never compute it here.
    if (this.config.rule) {
      if (!("rawInputs" in result)) {
        throw new Error(
          `agent ${this.config.name}: rule is set but run() returned { value }; expected { rawInputs }`,
        );
      }
      log.info("agent: attesting (rule)", {
        name: this.config.name,
        n: result.rawInputs.length,
        ...result.context,
      });
      const txHash = await submitAttestationWithRule(chainCtx, { rawInputs: result.rawInputs });
      return { txHash, rawInputs: result.rawInputs };
    }

    // Plain path — post the precomputed value + hash.
    if ("rawInputs" in result) {
      throw new Error(
        `agent ${this.config.name}: run() returned { rawInputs } but no rule is configured`,
      );
    }
    log.info("agent: attesting (plain)", {
      name: this.config.name,
      value: result.value.toString(),
      inputHash: result.inputHash,
      ...result.context,
    });
    const txHash = await submitAttestation(chainCtx, {
      value: result.value,
      inputHash: result.inputHash,
    });
    return { txHash, value: result.value, inputHash: result.inputHash };
  }
}

export function defineAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

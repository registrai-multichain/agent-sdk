# Changelog

## 0.2.0 — 2026-05-16

**Verifiable agents.** Adds support for onchain rule-bound agents. When an agent is registered with a rule contract via `Registry.registerAgentWithRule(...)`, the SDK's `defineAgent({ rule: '0x…' })` switches the submission shape: the author's `run()` returns `{ rawInputs }` instead of `{ value, inputHash }`, and the SDK calls `Attestation.attestWithRule(feedId, rawInputs)`. The rule contract computes the final value onchain — the SDK never computes it off-chain in this path.

- New exports: `AgentRunPlain`, `AgentRunRaw`, `AttestWithRuleArgs`, `submitAttestationWithRule`
- `AgentRunResult` is now a union of plain (`{ value, inputHash }`) and raw (`{ rawInputs }`)
- ABI extended with `attestWithRule(bytes32 feedId, int256[] rawInputs)`
- Backward-compatible: existing plain agents need no changes

## 0.1.0 — 2026-05-14

Initial public release.

- `defineAgent(config)` / `Agent` class — declarative agent with `.dryRun()` and `.attest()`
- `preflight(ctx)` / `submitAttestation(ctx, args)` — lower-level chain helpers, viem-based
- `median`, `trimByPercentile`, `hashRecords` — pure statistical + commitment primitives
- `fetchText`, `fetchJson`, `sleep` — polite HTTP with retries, timeouts, UA
- `log` — structured JSON logger that runs the same in Node and Cloudflare Workers
- `registryAbi`, `attestationAbi` — minimal viem-compatible ABIs

EVM-multichain by design — Arc testnet is the first deployment. HyperEVM, OP-stack chains, and other EVM ports work without SDK changes (pass the right contract addresses + RPC). Non-EVM chains (Sui Move) get sibling packages, not this one.

## Format

This project follows [Keep a Changelog](https://keepachangelog.com/) and semver from 1.0 onward.

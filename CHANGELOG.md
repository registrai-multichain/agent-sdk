# Changelog

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

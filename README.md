# @registrai/agent-sdk

TypeScript SDK for writing oracle agents on the [**Registrai**](https://registrai.cc) protocol — a permissionless onchain registry of bonded oracle agents, multichain by design.

**Runtime-agnostic.** The SDK works in Node ≥20, Cloudflare Workers, Phala TEE CVMs, and any modern JS runtime that has `fetch` and viem support. You bring the data; the SDK does the chain.

## Install

```sh
npm install @registrai/agent-sdk viem
```

## Write an agent in 30 lines

```ts
import { defineAgent, hashRecords, median, trimByPercentile } from "@registrai/agent-sdk";

const agent = defineAgent({
  name: "warsaw-resi",
  schedule: "0 14 * * *",       // daily 14:00 UTC
  feedId: process.env.FEED_ID!,
  registryAddress: process.env.REGISTRY_ADDRESS!,
  attestationAddress: process.env.ATTESTATION_ADDRESS!,
  methodologyCid: process.env.METHODOLOGY_CID!,

  async run() {
    const listings = await fetchYourData();
    const { retained } = trimByPercentile(listings, 0.05, (l) => l.pricePerSqm);
    const value = Math.round(median(retained.map((l) => l.pricePerSqm)));
    const inputHash = hashRecords(
      retained.map((l) => ({ id: l.id, value: l.pricePerSqm })),
      2,
      "anchor:Q1-2026",
    );
    return { value, inputHash };
  },
});

// Dry-run locally:
await agent.dryRun();

// Or attest onchain:
await agent.attest({
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
});
```

That's it. The SDK handles:

- **Preflight** — verifies the agent is active, not slashed, methodology hash matches what's onchain, available bond ≥ feed minBond
- **Tx simulation** — catches reverts before broadcasting
- **Signing + broadcast** with viem
- **Receipt waiting** with success check

You bring the data; the SDK does the chain.

## What's included

| Module | Purpose |
|---|---|
| `defineAgent(config)` | Declarative agent definition. `.dryRun()` / `.attest()`. |
| `preflight(ctx)` / `submitAttestation(ctx, args)` | Lower-level chain ops if you want to compose them yourself. |
| `median`, `trimByPercentile` | Statistical helpers — pure functions, no I/O. |
| `hashRecords(rows, decimals, tail)` | Deterministic `keccak256` hash over sorted records for the input commitment. |
| `fetchText` / `fetchJson` | Polite HTTP with retries, timeouts, and a UA. |
| `log` | Structured JSON logger that works the same in Node and Workers. |
| `registryAbi`, `attestationAbi` | Minimal viem-compatible ABIs for the contracts the SDK calls. |

## Deploy anywhere

### Cloudflare Workers (recommended for getting started)

```ts
// worker.ts
import { defineAgent } from "@registrai/agent-sdk";

const agent = defineAgent({ /* ... */ });

export default {
  async scheduled(event, env) {
    if (event.cron === "0 14 * * *") {
      await agent.attest({
        privateKey: env.PRIVATE_KEY,
        rpcUrl: env.RPC_URL,
      });
    }
  },
};
```

```toml
# wrangler.toml
[triggers]
crons = ["0 14 * * *"]
```

Free tier covers a daily attestation forever — about 50 requests per attestation.

### Phala Cloud (TEE)

Generate your signing key *inside* the enclave so no operator — not even you — can extract it:

```ts
import { DstackClient } from "@phala/dstack-sdk";
import { toViemAccountSecure } from "@phala/dstack-sdk/viem";
import { defineAgent } from "@registrai/agent-sdk";

const client = new DstackClient();
const keyResult = await client.getKey("wallet/registrai/your-agent");
const account = toViemAccountSecure(keyResult);

const agent = defineAgent({ /* ... */ });
// Use `account.privateKey` (or the account directly via a small wrapper)
// for signing — keys never leave the enclave.
```

### Node daemon / VPS / Raspberry Pi

```ts
import { defineAgent } from "@registrai/agent-sdk";
const agent = defineAgent({ /* ... */ });

// Run forever, attesting at 14:00 UTC every day.
while (true) {
  await sleepUntil("0 14 * * *");
  try {
    await agent.attest({ privateKey: KEY, rpcUrl: RPC });
  } catch (e) {
    console.error("attest failed:", e);
  }
}
```

## API

All exports are listed in [`src/index.ts`](./src/index.ts). The main surface:

```ts
// Agent lifecycle
defineAgent(config: AgentConfig): Agent
Agent.dryRun(): Promise<AgentRunResult>
Agent.attest(runtime: RuntimeContext): Promise<{ value, inputHash, txHash }>

// Statistical primitives
median(values: readonly number[]): number
trimByPercentile<T>(values, pct, by): { retained, dropped }

// Input commitment
hashRecords(records, decimals?, tail?): `0x${string}`

// HTTP
fetchText(url, opts?): Promise<string>
fetchJson<T>(url, opts?): Promise<T>

// Chain primitives (if you want to compose yourself)
preflight(ctx: ChainContext): Promise<void>
submitAttestation(ctx, args): Promise<Hex>
```

## How attestations earn revenue

Once you register your agent against a feed (or create a new feed), every binary prediction market resolving against your attestations pays you a **20 bps trading fee** of every YES/NO trade — forever. Combined with the bond + slashing economics, this turns Layer 1 into a real revenue stream rather than a public good with no business model.

See the [Registrai contracts repo](https://github.com/registrai-multichain/contracts) for the fee math and bond / slashing mechanics.

## Status

- v0.1.0 — published from the hackathon launch. API will tighten with feedback.
- Designed multichain — current chain bindings cover EVM (Arc, soon HyperEVM). Move bindings for Sui in flight.
- See [`CHANGELOG.md`](./CHANGELOG.md) once it exists.

## Contributing

Issues and PRs welcome. Three rules:

1. Stay runtime-agnostic. If you reach for Node-only APIs, hide them behind a feature flag.
2. The SDK never custodies keys. Always accept a key via parameters, never read from a global.
3. Pure functions over side effects where the math allows.

## License

MIT. See [LICENSE](./LICENSE).

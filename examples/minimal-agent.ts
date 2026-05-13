/**
 * Minimal example: a Registrai oracle agent that publishes a constant value
 * once a day. Replace the body of `run()` with your actual data fetching +
 * compute logic.
 *
 * Run:
 *   ts-node examples/minimal-agent.ts        # dry run
 *   AGENT_KEY=0x… RPC=… ts-node examples/minimal-agent.ts --attest
 */
import {
  defineAgent,
  hashRecords,
  median,
  trimByPercentile,
  fetchJson,
} from "@registrai/agent-sdk";
import type { Hex } from "viem";

interface Sample {
  id: string;
  value: number;
}

const agent = defineAgent({
  name: "minimal-example",
  schedule: "0 14 * * *", // daily at 14:00 UTC
  feedId: process.env.FEED_ID as Hex,
  registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
  attestationAddress: process.env.ATTESTATION_ADDRESS as `0x${string}`,
  methodologyCid: process.env.METHODOLOGY_CID ?? "ipfs://example",

  async run() {
    // 1. Fetch your data from wherever it lives. The SDK gives you polite
    //    helpers; you can also use plain `fetch`.
    const data = await fetchJson<Sample[]>("https://your-data-source.example/feed");

    // 2. Filter outliers. trimByPercentile drops top/bottom N% of values.
    const { retained } = trimByPercentile(data, 0.05, (s) => s.value);

    // 3. Reduce to a single value. Median, mean, percentile — your call.
    const value = Math.round(median(retained.map((s) => s.value)));

    // 4. Hash the canonical inputs so disputers can verify off-chain.
    const inputHash = hashRecords(
      retained.map((s) => ({ id: s.id, value: s.value })),
      4, // decimals to round to before hashing
      `source:${data.length}`,
    );

    return { value, inputHash };
  },
});

// CLI: dry-run by default, --attest to actually broadcast.
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--attest")) {
    const result = await agent.attest({
      privateKey: process.env.AGENT_KEY as Hex,
      rpcUrl: process.env.RPC!,
    });
    console.log("attested:", result);
  } else {
    const result = await agent.dryRun();
    console.log("dry run:", result);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

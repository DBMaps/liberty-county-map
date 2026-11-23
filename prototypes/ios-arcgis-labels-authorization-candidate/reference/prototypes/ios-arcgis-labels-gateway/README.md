# Gridly Satellite Labels mock gateway

This standalone Node prototype exercises the proposed labels authorization and tile handling in one process. It uses ephemeral P-256 keys, synthetic verifier records, an injected UTC clock, and a bundled synthetic PNG. Calling the gateway functions directly avoids a listener, network client, provider account, or dependency installation.

From the repository root, use Node 24 to run the suite and the local workload measurements.

```sh
node --test prototypes/ios-arcgis-labels-gateway/gateway.test.mjs
node --expose-gc prototypes/ios-arcgis-labels-gateway/gateway.bench.mjs
```

The benchmark measures signature verification and quota reservation separately, four concurrent provider calls, renewal over 30 simulated minutes, heap use across repeated requests and UTC rollover, and rapid cancellation. It measures this Node process and the bundled fixture. Heap measurements are point-in-time observations after forced garbage collection.

The [contract](contract.md) specifies the simulated trust boundaries, request format, and requirements for a later production design. The PNG is a copy of the existing native prototype fixture and depicts synthetic data.

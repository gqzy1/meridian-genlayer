# MERIDIAN

MERIDIAN is a spatial workbench for checking what an official technical standard says at a specified point in time. Pin an RFC claim and its sources to the globe. An Intelligent Contract selects the applicable publication, obtains independent GenLayer validator judgments and records the verdict, the cited text and an evidence fingerprint.

Start with HTTP semantics. A standard can change its section numbers and supersede earlier guidance. MERIDIAN checks the successor's official `Obsoletes` field and publication month before it considers its wording.

## Why GenLayer

The StudioNet contract owns source selection, verdict and evidence commitment. Its leader and validators independently fetch the RFC Editor publications and interpret the same section. The custom equivalence check requires agreement on the fetched revisions, selected publication and section, verdict and anchored quotation. A UI, wallet or API server has no method for writing a verdict directly. The client waits for successful execution, finality and a matching finalized-state read before it displays a completed adjudication.

## Use MERIDIAN

1. Open the globe to browse finalized claims. Connect an EIP-6963 wallet such as MetaMask or OKX to publish or adjudicate.
2. Pin a location and enter a specific statement about an official RFC. Use an official plain-text URL such as `https://www.rfc-editor.org/rfc/rfc7231.txt` and criteria such as `As of 2014-06; section 4.2.1; GET is explicitly defined as safe.`.
3. To compare with a successor, enter its RFC Editor plain-text URL and use e.g. `As of 2022-06; sections 4.2.1 / 9.2.1; GET is explicitly defined as safe.`.
4. Open the claim and submit an adjudication. After finality, its dossier shows the verdict, cited excerpt if available, and a digest of the evidence. Check the transaction in the explorer. The animated stages illustrate progress.

## Network

| Setting | Value |
| --- | --- |
| Network | GenLayer Stable StudioNet, chain ID `61999` |
| RPC | [StudioNet RPC](https://studio.genlayer.com/api) |
| Contract call value | `0 GEN`. StudioNet quotes protocol fees separately from the call value. |
| Contract address | Pending deployment |
| Contract source | [MeridianAdjudicator](contracts/meridian_adjudicator.py) |

## Build and verify

```sh
cd frontend
npm ci
npm run build
npm run dev
```

Run the contract checks from the repository root.

```sh
python -m unittest discover -s tests -v
genvm-lint check contracts/meridian_adjudicator.py --json
```

For the source-parser test, set `MERIDIAN_RFC_SOURCES` to a directory containing the RFC Editor's `rfc7231.txt` and `rfc9110.txt`. Before deploying, the zero address in the frontend disables chain reads and writes. See the [protocol specification](MERIDIAN_SPEC.md) for the evidence rules and test cases.

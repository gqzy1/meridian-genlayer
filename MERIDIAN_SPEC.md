# MERIDIAN protocol specification

## Publication cutoff

Use `As of YYYY-MM; section N.N; statement` for one publication and `As of YYYY-MM; sections N.N / N.N; statement` for an original RFC and a direct successor. The RFC Editor pathname must be the canonical HTTPS plain-text URL. The contract matches the document header's RFC number against the URL and parses its publication month. A successor must explicitly list the primary RFC in its `Obsoletes` header and have a later publication month. When a supplied pair cannot be established, the result is `INCONCLUSIVE`. Valid pairs select the original before the successor's publication month and the successor from that month onward.

The comparison covers one direct successor and has month granularity. The source is read when the transaction runs. Each source fingerprint commits to the fetched text after UTF-8 decoding and newline normalization. It does not establish a historical byte-for-byte archive.

## Independent observation and evidence

1. The leader fetches the official documents and extracts the specified numbered section. The contract applies consistent document and section size limits.
2. An evaluator classifies the claim against that section. `VERIFIED` and `REFUTED` require a unique verbatim excerpt of 20–232 characters from the section after whitespace normalization. Inadequate evidence can yield `INCONCLUSIVE`.
3. Validators independently fetch the documents, select the applicable publication, re-check the leader's quotation at the given offset and evaluate the claim. The equivalence check binds both source observations, cutoff, selected RFC, verdict and reason. For a conclusive result, independently selected excerpts must cite the same text span, allowing one anchored excerpt to contain the other.
4. A successful round stores its canonical result and a SHA-256 evidence commitment. The claim's current summary shows the selected RFC, section, cutoff and any fallback reason. A failed execution leaves the previous record and counters intact.

The verdict is a judgment about the cited evidence. Geographic coordinates are user-assigned for browsing. The contract does not score probabilities. The `confidence` field is retained at zero for client compatibility. The five-node visualization represents UI stages. Validator votes and identities, where exposed, belong to the actual transaction receipt.

## Public contract

| Method | Return |
| --- | --- |
| `submit_claim(title, category, region_label, lat_e4, lng_e4, criteria, primary_url, secondary_url="")` | Claim ID |
| `adjudicate_claim(claim_id)` | Updated claim |
| `get_claim(claim_id)` | Claim |
| `list_claims()` | Claims in registration order |
| `get_stats()` | Claim and adjudication counts |

Claims begin in `ACTIVE`. Any wallet can request a review, and each successful review adds an evidence round. The front end reads current claim fields. Historical evidence is retained in contract storage. The registry is limited to 128 claims and eight rounds per claim to keep whole-registry reads and state growth bounded. This is an open StudioNet registry. Those limits can be reached by public writes. Client finality and validator errors remain visible and may need a retry.

## StudioNet acceptance cases

Deployment address is pending. The table specifies inputs and expected results. It contains no transaction evidence.

All cases use [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231.txt) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.txt) as an explicit pair.

| Registration | Geographic pin | Criteria | Expected state |
| --- | --- | --- | --- |
| MRD-001 | Zurich, CH (`473769, 85417`) | As of 2022-06; sections 4.2.1 / 9.2.1; The specification defines GET as a safe method. | `VERIFIED`, RFC 9110 §9.2.1 |
| MRD-002 | San Francisco, US (`377749, -1224194`) | As of 2022-06; sections 4.2.1 / 9.2.1; The specification defines POST as a safe method. | `REFUTED`, RFC 9110 §9.2.1 |
| MRD-003 | Tokyo, JP (`356762, 1396503`) | As of 2022-05; sections 4.2.1 / 9.2.1; The specification defines GET as a safe method. | `ACTIVE` after registration. A review should select RFC 7231 §4.2.1. |
| MRD-004 | Singapore, SG (`13521, 1038198`) | As of 2022-06; sections 4.2.1 / 9.2.1; The section specifies HTTPS certificate expiration policy. | `INCONCLUSIVE`, RFC 9110 §9.2.1 |

For each registered or adjudicated case, check `FINALIZED`, majority agreement, explicit successful contract execution and the resulting finalized record. Before the Tokyo claim is reviewed, `get_stats()` should report four claims, three adjudications and one of each state. The Tokyo case exercises a historic cutoff and the wallet-to-verdict flow from the browser.

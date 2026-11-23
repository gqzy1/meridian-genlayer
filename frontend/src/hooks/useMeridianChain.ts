import { useCallback, useEffect, useRef, useState } from "react";
import { abi, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";
import {
  MERIDIAN_CONTRACT_ADDRESS,
  MERIDIAN_DEPLOYED,
  MERIDIAN_NETWORK,
  type ClaimCategory,
  type ClaimRecord,
  type ClaimStats,
  type ClaimStatus,
  type TxLifecyclePhase,
} from "../config/meridian";
import type { ShockwaveSignal } from "../components/globe/MeridianGlobe";
import { crystalAudio } from "../utils/crystalAudio";
import type { EIP1193Provider } from "./useMultiWallet";

export interface SubmitClaimPayload {
  title: string;
  category: ClaimCategory;
  regionLabel: string;
  lat: number;
  lng: number;
  criteria: string;
  primaryUrl: string;
  secondaryUrl: string;
}

export interface TxFeedbackState {
  phase: TxLifecyclePhase;
  txHash: string | null;
  error: string | null;
  targetClaimId: string | null;
}

const DEPLOYMENT_PENDING = "The MERIDIAN deployment address has not been configured.";

interface UseMeridianChainParams {
  account: `0x${string}` | null;
  provider: EIP1193Provider | null;
  ensureStudioNet: () => Promise<boolean>;
}

// Convert GenLayer calldata Maps / BigInts safely into plain JSON-friendly values
function unwrapGenLayerValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    value.forEach((v, k) => {
      obj[String(k)] = unwrapGenLayerValue(v);
    });
    return obj;
  }
  if (Array.isArray(value)) {
    return value.map(unwrapGenLayerValue);
  }
  if (value && typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = unwrapGenLayerValue(v);
    }
    return obj;
  }
  return value;
}

function toSafeStatus(raw: unknown): ClaimStatus {
  const s = String(raw ?? "ACTIVE").toUpperCase();
  if (s === "VERIFIED" || s === "REFUTED" || s === "INCONCLUSIVE") return s;
  return "ACTIVE";
}

function normalizeClaim(raw: unknown): ClaimRecord {
  const rec = (unwrapGenLayerValue(raw) ?? {}) as Record<string, unknown>;
  return {
    claim_id: String(rec.claim_id ?? ""),
    title: String(rec.title ?? ""),
    category: String(rec.category ?? "PUBLIC_FACT"),
    region_label: String(rec.region_label ?? "Global"),
    lat_e4: Number(rec.lat_e4 ?? 0),
    lng_e4: Number(rec.lng_e4 ?? 0),
    criteria: String(rec.criteria ?? ""),
    primary_url: String(rec.primary_url ?? ""),
    secondary_url: String(rec.secondary_url ?? ""),
    status: toSafeStatus(rec.status),
    confidence: Number(rec.confidence ?? 0),
    summary: String(rec.summary ?? ""),
    evidence_excerpt: String(rec.evidence_excerpt ?? ""),
    primary_status: String(rec.primary_status ?? "PENDING"),
    secondary_status: String(rec.secondary_status ?? "NONE"),
    submitter: String(rec.submitter ?? ""),
    last_adjudicator: String(rec.last_adjudicator ?? ""),
    adjudications: Number(rec.adjudications ?? 0),
  };
}

function normalizeStats(raw: unknown, claims: ClaimRecord[]): ClaimStats {
  const rec = (unwrapGenLayerValue(raw) ?? {}) as Record<string, unknown>;
  if (typeof rec.total_claims === "number") {
    return {
      total_claims: Number(rec.total_claims ?? 0),
      total_adjudications: Number(rec.total_adjudications ?? 0),
      active: Number(rec.active ?? 0),
      verified: Number(rec.verified ?? 0),
      refuted: Number(rec.refuted ?? 0),
      inconclusive: Number(rec.inconclusive ?? 0),
    };
  }
  return {
    total_claims: claims.length,
    total_adjudications: claims.reduce((sum, c) => sum + c.adjudications, 0),
    active: claims.filter((c) => c.status === "ACTIVE").length,
    verified: claims.filter((c) => c.status === "VERIFIED").length,
    refuted: claims.filter((c) => c.status === "REFUTED").length,
    inconclusive: claims.filter((c) => c.status === "INCONCLUSIVE").length,
  };
}

function finalizedResult(receipt: unknown): unknown {
  const rec = (unwrapGenLayerValue(receipt) ?? {}) as Record<string, unknown>;
  const status = rec.statusName ?? rec.status_name ?? rec.status;
  if (status !== "FINALIZED" && String(status) !== "7") {
    throw new Error("Transaction has not reached FINALIZED.");
  }
  if (String(rec.resultName ?? rec.result_name ?? "") !== "MAJORITY_AGREE") {
    throw new Error("Finalized transaction lacks majority agreement.");
  }
  const consensus = rec.consensus_data as Record<string, unknown> | undefined;
  const receipts = consensus?.leader_receipt;
  const leaders = (Array.isArray(receipts) ? receipts : receipts ? [receipts] : []) as Record<string, unknown>[];
  const leader = [...leaders].reverse().find((item) => item.mode === "leader")
    ?? (leaders.length === 1 && !leaders[0].mode ? leaders[0] : undefined);
  const execution = String(leader?.execution_result ?? rec.txExecutionResultName ?? "").toUpperCase();
  if (execution !== "SUCCESS" && execution !== "FINISHED_WITH_RETURN") {
    const diagnostics = leader?.genvm_result as { error_description?: string; stderr?: string } | undefined;
    const reported = [diagnostics?.error_description, diagnostics?.stderr]
      .find((message) => message && /(?:EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR):/.test(message));
    throw new Error(reported ?? "Finalized transaction lacks explicit successful execution.");
  }
  const result = leader?.result;
  const encoded = typeof result === "string" ? result : (result as { raw?: string } | undefined)?.raw;
  if (!encoded) throw new Error("Finalized receipt is missing its contract return value.");
  const bytes = Uint8Array.from(atob(encoded), (digit) => digit.charCodeAt(0));
  if (bytes[0] !== 0) throw new Error("Finalized receipt did not return successfully.");
  return unwrapGenLayerValue(abi.calldata.decode(bytes.slice(1)));
}

function formatReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const match = raw.match(/(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR):\s*([^\n}]+)/);
  if (match) {
    return `${match[1]}: ${match[2].trim()}`;
  }
  if (raw.length > 220) {
    return `${raw.slice(0, 220)}...`;
  }
  return raw;
}

export function useMeridianChain({
  account,
  provider,
  ensureStudioNet,
}: UseMeridianChainParams) {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [stats, setStats] = useState<ClaimStats>({
    total_claims: 0,
    total_adjudications: 0,
    active: 0,
    verified: 0,
    refuted: 0,
    inconclusive: 0,
  });
  const [rpcStatus, setRpcStatus] = useState<"syncing" | "live" | "offline">("syncing");
  const [readError, setReadError] = useState<string | null>(null);

  const [adjudicatingClaimId, setAdjudicatingClaimId] = useState<string | null>(null);
  const [adjudicationStage, setAdjudicationStage] = useState<number>(0);
  const [shockwaveSignal, setShockwaveSignal] = useState<ShockwaveSignal | null>(null);

  const [txFeedback, setTxFeedback] = useState<TxFeedbackState>({
    phase: "IDLE",
    txHash: null,
    error: null,
    targetClaimId: null,
  });

  const stageTimerRef = useRef<number | null>(null);
  const shockSeqRef = useRef<number>(1);

  const clearStageTimer = useCallback(() => {
    if (stageTimerRef.current !== null) {
      window.clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  const createReadOnlyClient = useCallback(() => {
    return createClient({
      chain: studionet,
      endpoint: MERIDIAN_NETWORK.rpcUrl,
    });
  }, []);

  const createWriteClient = useCallback(async () => {
    if (!account || !provider) {
      throw new Error("Please connect a wallet before sending a transaction.");
    }
    const client = createClient({
      chain: studionet,
      endpoint: MERIDIAN_NETWORK.rpcUrl,
      account,
      // Pass selected EIP-6963 provider so multi-wallet setups route to the chosen wallet
      ...({ provider } as Record<string, unknown>),
    });
    const initFn = (
      client as unknown as { initializeConsensusSmartContract?: () => Promise<void> }
    ).initializeConsensusSmartContract;
    if (typeof initFn === "function") {
      try {
        await initFn.call(client);
      } catch {
        // Proceed if already initialized by SDK
      }
    }
    return client;
  }, [account, provider]);

  const refreshClaims = useCallback(async (): Promise<ClaimRecord[]> => {
    if (!MERIDIAN_DEPLOYED) {
      setRpcStatus("offline");
      setReadError(DEPLOYMENT_PENDING);
      return [];
    }
    setRpcStatus((prev) => (prev === "live" ? "live" : "syncing"));
    try {
      const client = createReadOnlyClient();
      const [rawList, rawStats] = await Promise.all([
        client.readContract({
          address: MERIDIAN_CONTRACT_ADDRESS,
          functionName: "list_claims",
          args: [],
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        }),
        client.readContract({
          address: MERIDIAN_CONTRACT_ADDRESS,
          functionName: "get_stats",
          args: [],
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        }),
      ]);

      const listRaw = Array.isArray(rawList) ? rawList : [];
      const normalized = listRaw.map(normalizeClaim);
      setClaims(normalized);
      setStats(normalizeStats(rawStats, normalized));
      setRpcStatus("live");
      setReadError(null);
      return normalized;
    } catch (err: unknown) {
      setRpcStatus("offline");
      setReadError(formatReadableError(err));
      return [];
    }
  }, [createReadOnlyClient]);

  useEffect(() => {
    void refreshClaims();
    const poll = window.setInterval(() => {
      void refreshClaims();
    }, 30000);
    return () => {
      window.clearInterval(poll);
      clearStageTimer();
    };
  }, [refreshClaims, clearStageTimer]);

  const submitClaim = useCallback(
    async (payload: SubmitClaimPayload): Promise<string | null> => {
      setTxFeedback({
        phase: "SWITCHING_NETWORK",
        txHash: null,
        error: null,
        targetClaimId: null,
      });

      if (!MERIDIAN_DEPLOYED) {
        setTxFeedback((previous) => ({ ...previous, phase: "FAILED", error: DEPLOYMENT_PENDING }));
        return null;
      }

      const okNetwork = await ensureStudioNet();
      if (!okNetwork) {
        setTxFeedback({
          phase: "FAILED",
          txHash: null,
          error: "Wallet must be on GenLayer StudioNet (Chain ID 61999).",
          targetClaimId: null,
        });
        return null;
      }

      try {
        const client = await createWriteClient();
        setTxFeedback({
          phase: "AWAITING_SIGNATURE",
          txHash: null,
          error: null,
          targetClaimId: null,
        });

        const latE4 = Math.round(payload.lat * 10000);
        const lngE4 = Math.round(payload.lng * 10000);

        const txHash = await client.writeContract({
          address: MERIDIAN_CONTRACT_ADDRESS,
          functionName: "submit_claim",
          args: [
            payload.title.trim(),
            payload.category,
            payload.regionLabel.trim(),
            latE4,
            lngE4,
            payload.criteria.trim(),
            payload.primaryUrl.trim(),
            payload.secondaryUrl.trim(),
          ],
          value: BigInt(0),
        });

        setTxFeedback({
          phase: "SUBMITTED",
          txHash: String(txHash),
          error: null,
          targetClaimId: null,
        });

        await client.waitForTransactionReceipt({
          hash: txHash,
          status: TransactionStatus.FINALIZED,
          retries: 100,
          interval: 2500,
        });

        const result = finalizedResult(await createReadOnlyClient().getTransaction({ hash: txHash }));
        if (typeof result !== "string" || !/^MRD-\d+$/.test(result)) {
          throw new Error("Finalized receipt did not identify the submitted claim.");
        }
        const newestId = result;
        const record = normalizeClaim(await createReadOnlyClient().readContract({
          address: MERIDIAN_CONTRACT_ADDRESS, functionName: "get_claim", args: [newestId],
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        }));
        if (record.claim_id !== newestId || record.submitter.toLowerCase() !== account?.toLowerCase()
            || record.title !== payload.title.trim() || record.criteria !== payload.criteria.trim()
            || record.primary_url !== payload.primaryUrl.trim() || record.secondary_url !== payload.secondaryUrl.trim()
            || record.lat_e4 !== latE4 || record.lng_e4 !== lngE4) {
          throw new Error("Finalized claim does not match the submitted record.");
        }
        await refreshClaims();

        setTxFeedback({
          phase: "FINALIZED",
          txHash: String(txHash),
          error: null,
          targetClaimId: newestId,
        });
        crystalAudio.playBeaconSelect();
        return newestId;
      } catch (err: unknown) {
        setTxFeedback((prev) => ({
          phase: "FAILED",
          txHash: prev.txHash,
          error: formatReadableError(err),
          targetClaimId: null,
        }));
        return null;
      }
    },
    [account, ensureStudioNet, createWriteClient, createReadOnlyClient, refreshClaims]
  );

  const adjudicateClaim = useCallback(
    async (claimId: string): Promise<ClaimRecord | null> => {
      clearStageTimer();
      setTxFeedback({
        phase: "SWITCHING_NETWORK",
        txHash: null,
        error: null,
        targetClaimId: claimId,
      });

      if (!MERIDIAN_DEPLOYED) {
        setTxFeedback((previous) => ({ ...previous, phase: "FAILED", error: DEPLOYMENT_PENDING }));
        return null;
      }

      const okNetwork = await ensureStudioNet();
      if (!okNetwork) {
        setTxFeedback({
          phase: "FAILED",
          txHash: null,
          error: "Wallet must be on GenLayer StudioNet (Chain ID 61999).",
          targetClaimId: claimId,
        });
        return null;
      }

      try {
        const client = await createWriteClient();
        setTxFeedback({
          phase: "AWAITING_SIGNATURE",
          txHash: null,
          error: null,
          targetClaimId: claimId,
        });

        const txHash = await client.writeContract({
          address: MERIDIAN_CONTRACT_ADDRESS,
          functionName: "adjudicate_claim",
          args: [claimId],
          value: BigInt(0),
        });

        // Ignite the 5-beam globe animation + V1-V5 consensus arc
        setAdjudicatingClaimId(claimId);
        setAdjudicationStage(1);
        crystalAudio.playValidatorPulse(0);

        setTxFeedback({
          phase: "FETCHING_WEB",
          txHash: String(txHash),
          error: null,
          targetClaimId: claimId,
        });

        let currentStep = 1;
        stageTimerRef.current = window.setInterval(() => {
          currentStep = Math.min(4, currentStep + 1);
          setAdjudicationStage(currentStep);
          crystalAudio.playValidatorPulse(currentStep - 1);
          if (currentStep >= 3) {
            setTxFeedback((prev) =>
              prev.phase === "FETCHING_WEB"
                ? { ...prev, phase: "VALIDATORS_VOTING" }
                : prev
            );
          }
        }, 3200);

        await client.waitForTransactionReceipt({
          hash: txHash,
          status: TransactionStatus.FINALIZED,
          retries: 140,
          interval: 3000,
        });

        clearStageTimer();

        const settled = normalizeClaim(finalizedResult(await createReadOnlyClient().getTransaction({ hash: txHash })));
        const updatedClaim = normalizeClaim(await createReadOnlyClient().readContract({
          address: MERIDIAN_CONTRACT_ADDRESS, functionName: "get_claim", args: [claimId],
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        }));
        const sameRound = settled.adjudications === updatedClaim.adjudications;
        if (settled.claim_id !== claimId || updatedClaim.claim_id !== claimId
            || settled.status === "ACTIVE" || updatedClaim.status === "ACTIVE"
            || settled.adjudications < 1 || settled.adjudications > updatedClaim.adjudications
            || (sameRound && (settled.status !== updatedClaim.status
              || settled.summary !== updatedClaim.summary || settled.evidence_excerpt !== updatedClaim.evidence_excerpt))
            || settled.last_adjudicator.toLowerCase() !== account?.toLowerCase()) {
          throw new Error("Finalized claim does not match this adjudication receipt.");
        }
        await refreshClaims();
        setAdjudicationStage(5);
        crystalAudio.playValidatorPulse(4);

        setTxFeedback({
          phase: "FINALIZED",
          txHash: String(txHash),
          error: null,
          targetClaimId: claimId,
        });

        if (updatedClaim) {
          shockSeqRef.current += 1;
          setShockwaveSignal({
            claimId,
            status: updatedClaim.status,
            seq: shockSeqRef.current,
          });
        }

        window.setTimeout(() => {
          setAdjudicatingClaimId(null);
          setAdjudicationStage(0);
        }, 1600);

        return updatedClaim;
      } catch (err: unknown) {
        clearStageTimer();
        setAdjudicatingClaimId(null);
        setAdjudicationStage(0);
        setTxFeedback((prev) => ({
          phase: "FAILED",
          txHash: prev.txHash,
          error: formatReadableError(err),
          targetClaimId: claimId,
        }));
        return null;
      }
    },
    [account, clearStageTimer, ensureStudioNet, createWriteClient, createReadOnlyClient, refreshClaims]
  );

  const resetTxFeedback = useCallback(() => {
    setTxFeedback({
      phase: "IDLE",
      txHash: null,
      error: null,
      targetClaimId: null,
    });
  }, []);

  return {
    claims,
    stats,
    rpcStatus,
    readError,
    adjudicatingClaimId,
    adjudicationStage,
    shockwaveSignal,
    txFeedback,
    refreshClaims,
    submitClaim,
    adjudicateClaim,
    resetTxFeedback,
  };
}

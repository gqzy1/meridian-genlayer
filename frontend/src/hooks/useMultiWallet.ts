import { useCallback, useEffect, useRef, useState } from "react";
import { MERIDIAN_NETWORK } from "../config/meridian";

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isOkxWallet?: boolean;
  isBitKeep?: boolean;
  isCoinbaseWallet?: boolean;
}

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DiscoveredWallet {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

interface EIP6963AnnounceEvent extends Event {
  detail: DiscoveredWallet;
}

const STORAGE_WALLET_KEY = "meridian.lastWalletRdns";

function parseChainId(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    return raw.startsWith("0x") ? parseInt(raw, 16) : parseInt(raw, 10);
  }
  return null;
}

function getLegacyInjectedName(p: EIP1193Provider): string {
  if (p.isRabby) return "Rabby Wallet";
  if (p.isOkxWallet) return "OKX Wallet";
  if (p.isBitKeep) return "Bitget Wallet";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isMetaMask) return "MetaMask";
  return "Browser Wallet";
}

export function useMultiWallet() {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<DiscoveredWallet | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const activeProviderRef = useRef<EIP1193Provider | null>(null);

  // Discover all injected wallets via EIP-6963 with legacy window.ethereum fallback
  useEffect(() => {
    if (typeof window === "undefined") return;

    const map = new Map<string, DiscoveredWallet>();

    const handleAnnounce = (event: Event) => {
      const customEvent = event as EIP6963AnnounceEvent;
      if (!customEvent.detail?.info || !customEvent.detail?.provider) return;
      const key = customEvent.detail.info.rdns || customEvent.detail.info.uuid;
      if (!map.has(key)) {
        map.set(key, customEvent.detail);
        setWallets(Array.from(map.values()));
      }
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Legacy fallback if no EIP-6963 wallet announces within 350ms
    const fallbackTimer = window.setTimeout(() => {
      const legacy = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (map.size === 0 && legacy) {
        const fallbackWallet: DiscoveredWallet = {
          info: {
            uuid: "legacy-injected",
            name: getLegacyInjectedName(legacy),
            icon: "",
            rdns: "legacy.injected.wallet",
          },
          provider: legacy,
        };
        map.set(fallbackWallet.info.rdns, fallbackWallet);
        setWallets([fallbackWallet]);
      }
    }, 350);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("eip6963:announceProvider", handleAnnounce);
    };
  }, []);

  // Silent session restore if user previously authorized a wallet
  useEffect(() => {
    if (wallets.length === 0 || activeWallet) return;
    const savedRdns = window.localStorage.getItem(STORAGE_WALLET_KEY);
    if (!savedRdns) return;

    const match = wallets.find((w) => w.info.rdns === savedRdns);
    if (!match) return;

    void (async () => {
      try {
        const accounts = (await match.provider.request({
          method: "eth_accounts",
        })) as string[];
        if (accounts && accounts.length > 0) {
          const cidRaw = await match.provider.request({ method: "eth_chainId" });
          setActiveWallet(match);
          activeProviderRef.current = match.provider;
          setAccount(accounts[0] as `0x${string}`);
          setChainId(parseChainId(cidRaw));
        }
      } catch {
        // Ignore silent restore errors
      }
    })();
  }, [wallets, activeWallet]);

  // Subscribe to account & network changes on the connected wallet
  useEffect(() => {
    const provider = activeWallet?.provider;
    if (!provider?.on) return;

    const handleAccountsChanged = (rawAccounts: unknown) => {
      const list = Array.isArray(rawAccounts) ? (rawAccounts as string[]) : [];
      if (list.length === 0) {
        setAccount(null);
        setActiveWallet(null);
        activeProviderRef.current = null;
        window.localStorage.removeItem(STORAGE_WALLET_KEY);
      } else {
        setAccount(list[0] as `0x${string}`);
      }
    };

    const handleChainChanged = (rawChainId: unknown) => {
      setChainId(parseChainId(rawChainId));
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [activeWallet]);

  const ensureStudioNet = useCallback(
    async (targetProvider?: EIP1193Provider): Promise<boolean> => {
      const provider = targetProvider ?? activeProviderRef.current;
      if (!provider) return false;

      const currentHex = await provider.request({ method: "eth_chainId" });
      const currentId = parseChainId(currentHex);
      if (currentId === MERIDIAN_NETWORK.chainId) {
        setChainId(MERIDIAN_NETWORK.chainId);
        return true;
      }

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: MERIDIAN_NETWORK.chainIdHex }],
        });
        setChainId(MERIDIAN_NETWORK.chainId);
        return true;
      } catch (switchErr: unknown) {
        const code = (switchErr as { code?: number })?.code;
        // 4902 = chain not yet added in wallet
        if (code === 4902) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: MERIDIAN_NETWORK.chainIdHex,
                  chainName: MERIDIAN_NETWORK.chainName,
                  rpcUrls: [MERIDIAN_NETWORK.rpcUrl],
                  nativeCurrency: MERIDIAN_NETWORK.nativeCurrency,
                  blockExplorerUrls: [MERIDIAN_NETWORK.explorerUrl],
                },
              ],
            });
            setChainId(MERIDIAN_NETWORK.chainId);
            return true;
          } catch (addErr: unknown) {
            const msg =
              addErr instanceof Error
                ? addErr.message
                : "Failed to add GenLayer StudioNet (61999) to wallet.";
            setWalletError(msg);
            return false;
          }
        }
        const msg =
          switchErr instanceof Error
            ? switchErr.message
            : "Please switch your wallet to GenLayer StudioNet (61999).";
        setWalletError(msg);
        return false;
      }
    },
    []
  );

  const connectWallet = useCallback(
    async (wallet: DiscoveredWallet): Promise<boolean> => {
      setConnecting(true);
      setWalletError(null);
      try {
        const accounts = (await wallet.provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (!accounts || accounts.length === 0) {
          throw new Error("No wallet account authorized.");
        }

        activeProviderRef.current = wallet.provider;
        setActiveWallet(wallet);
        setAccount(accounts[0] as `0x${string}`);
        window.localStorage.setItem(STORAGE_WALLET_KEY, wallet.info.rdns);

        const cidRaw = await wallet.provider.request({ method: "eth_chainId" });
        const parsedCid = parseChainId(cidRaw);
        setChainId(parsedCid);

        // Prompt StudioNet switch smoothly upon connect
        if (parsedCid !== MERIDIAN_NETWORK.chainId) {
          await ensureStudioNet(wallet.provider);
        }
        return true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Wallet connection rejected.";
        setWalletError(msg);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [ensureStudioNet]
  );

  const disconnectWallet = useCallback(() => {
    setActiveWallet(null);
    setAccount(null);
    setChainId(null);
    setWalletError(null);
    activeProviderRef.current = null;
    window.localStorage.removeItem(STORAGE_WALLET_KEY);
  }, []);

  const isCorrectNetwork = chainId === MERIDIAN_NETWORK.chainId;

  return {
    wallets,
    activeWallet,
    provider: activeWallet?.provider ?? null,
    account,
    chainId,
    isConnected: Boolean(account && activeWallet),
    isCorrectNetwork,
    connecting,
    walletError,
    clearWalletError: () => setWalletError(null),
    connectWallet,
    disconnectWallet,
    ensureStudioNet,
  };
}

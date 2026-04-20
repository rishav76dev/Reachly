import {
  getAddress,
  getNetworkDetails,
  isConnected as freighterIsConnected,
  requestAccess,
} from "@stellar/freighter-api";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { networkPassphrase } from "@/lib/campaigns";

type StellarWalletContextValue = {
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isSupportedNetwork: boolean;
  expectedNetwork: string;
  networkIssueMessage: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
};

const DEFAULT_EXPECTED_NETWORK =
  (import.meta.env.VITE_STELLAR_NETWORK as string | undefined)?.trim().toLowerCase() ||
  "testnet";
const DEFAULT_EXPECTED_NETWORK_PASSPHRASE = networkPassphrase.trim().toLowerCase();
const MAINNET_NETWORK_PASSPHRASE = "public global stellar network ; september 2015";

const StellarWalletContext = createContext<StellarWalletContextValue | null>(null);

function normalizeNetworkName(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeNetworkPassphrase(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function formatExpectedNetworkLabel(value: string): string {
  return value.toLowerCase() === "testnet" ? "Test Net" : value;
}

function getNetworkIssueMessage(network: string | null, networkPassphrase: string | null): string | null {
  const normalizedNetwork = normalizeNetworkName(network);
  const normalizedPassphrase = normalizeNetworkPassphrase(networkPassphrase);

  if (!normalizedNetwork && !normalizedPassphrase) {
    return "Freighter did not report a Stellar network. If you are using another wallet, Reachly requires Freighter on Stellar Test Net.";
  }

  if (
    normalizedNetwork === DEFAULT_EXPECTED_NETWORK ||
    normalizedPassphrase === DEFAULT_EXPECTED_NETWORK_PASSPHRASE
  ) {
    return null;
  }

  if (
    normalizedNetwork === "public" ||
    normalizedNetwork.includes("main") ||
    normalizedPassphrase === MAINNET_NETWORK_PASSPHRASE
  ) {
    return "Freighter is on Stellar Main Net. Switch it to Test Net in Freighter.";
  }

  return `Freighter is on ${network ?? "an unsupported Stellar network"}. Switch it to ${formatExpectedNetworkLabel(DEFAULT_EXPECTED_NETWORK)} in Freighter.`;
}

function shortenAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const connection = await freighterIsConnected();

      if (connection.error || !connection.isConnected) {
        setAddress(null);
        setNetwork(null);
        setNetworkPassphrase(null);
        return;
      }

      const [addressResult, networkResult] = await Promise.all([
        getAddress(),
        getNetworkDetails(),
      ]);

      if (addressResult.error) {
        throw new Error(addressResult.error.message);
      }

      if (networkResult.error) {
        throw new Error(networkResult.error.message);
      }

      setAddress(addressResult.address || null);
      setNetwork(networkResult.network || null);
      setNetworkPassphrase(networkResult.networkPassphrase || null);
      setError(null);
    } catch (refreshError) {
      setAddress(null);
      setNetwork(null);
      setNetworkPassphrase(null);
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const access = await requestAccess();

      if (access.error) {
        throw new Error(access.error.message);
      }

      const [addressResult, networkResult] = await Promise.all([
        getAddress(),
        getNetworkDetails(),
      ]);

      if (addressResult.error) {
        throw new Error(addressResult.error.message);
      }

      if (networkResult.error) {
        throw new Error(networkResult.error.message);
      }

      setAddress(addressResult.address || null);
      setNetwork(networkResult.network || null);
      setNetworkPassphrase(networkResult.networkPassphrase || null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : String(connectError));
      throw connectError;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    setNetworkPassphrase(null);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const normalizedNetwork = normalizeNetworkName(network);
  const normalizedPassphrase = normalizeNetworkPassphrase(networkPassphrase);
  const isConnected = Boolean(address);
  const isSupportedNetwork =
    !isConnected ||
    normalizedPassphrase === DEFAULT_EXPECTED_NETWORK_PASSPHRASE ||
    normalizedNetwork === DEFAULT_EXPECTED_NETWORK ||
    normalizedNetwork.includes(DEFAULT_EXPECTED_NETWORK);
  const networkIssueMessage = getNetworkIssueMessage(network, networkPassphrase);

  const value = useMemo<StellarWalletContextValue>(
    () => ({
      address,
      network,
      networkPassphrase,
      isConnected,
      isConnecting,
      isSupportedNetwork,
      expectedNetwork: DEFAULT_EXPECTED_NETWORK,
      networkIssueMessage,
      error,
      connect,
      disconnect,
      refresh,
    }),
    [
      address,
      connect,
      disconnect,
      error,
      isConnected,
      isConnecting,
      isSupportedNetwork,
      network,
      networkIssueMessage,
      networkPassphrase,
      refresh,
    ],
  );

  return <StellarWalletContext.Provider value={value}>{children}</StellarWalletContext.Provider>;
}

export function useStellarWallet() {
  const context = useContext(StellarWalletContext);

  if (!context) {
    throw new Error("useStellarWallet must be used inside StellarWalletProvider");
  }

  return {
    ...context,
    displayAddress: context.address ? shortenAddress(context.address) : null,
  };
}

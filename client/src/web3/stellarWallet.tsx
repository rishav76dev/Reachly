import {
  getAddress,
  getNetworkDetails,
  isConnected as freighterIsConnected,
  requestAccess,
} from "@stellar/freighter-api";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type StellarWalletContextValue = {
  address: string | null;
  network: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isSupportedNetwork: boolean;
  expectedNetwork: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
};

const DEFAULT_EXPECTED_NETWORK =
  (import.meta.env.VITE_STELLAR_NETWORK as string | undefined)?.trim().toLowerCase() ||
  "testnet";

const StellarWalletContext = createContext<StellarWalletContextValue | null>(null);

function normalizeNetworkName(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function shortenAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const connection = await freighterIsConnected();

      if (connection.error || !connection.isConnected) {
        setAddress(null);
        setNetwork(null);
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
      setError(null);
    } catch (refreshError) {
      setAddress(null);
      setNetwork(null);
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
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const normalizedNetwork = normalizeNetworkName(network);
  const isConnected = Boolean(address);
  const isSupportedNetwork =
    !isConnected ||
    normalizedNetwork.length === 0 ||
    normalizedNetwork.includes(DEFAULT_EXPECTED_NETWORK);

  const value = useMemo<StellarWalletContextValue>(
    () => ({
      address,
      network,
      isConnected,
      isConnecting,
      isSupportedNetwork,
      expectedNetwork: DEFAULT_EXPECTED_NETWORK,
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

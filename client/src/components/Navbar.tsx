import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useStellarWallet } from "@/web3/stellarWallet";

function AsteriskLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line
        x1="11"
        y1="1"
        x2="11"
        y2="21"
        stroke="#0a0a0a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="11"
        x2="21"
        y2="11"
        stroke="#0a0a0a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="3.93"
        y1="3.93"
        x2="18.07"
        y2="18.07"
        stroke="#0a0a0a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="18.07"
        y1="3.93"
        x2="3.93"
        y2="18.07"
        stroke="#0a0a0a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const {
    connect,
    disconnect,
    displayAddress,
    isConnected,
    isConnecting,
    isSupportedNetwork,
    network,
    expectedNetwork,
  } = useStellarWallet();

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 18);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`pill-nav-wrapper${isScrolled ? " is-scrolled" : ""}`}>
      <nav className="pill-nav">
        {/* Logo */}
        <Link to="/" className="pill-nav-logo">
          <AsteriskLogo />
          Reachlypaign
        </Link>

        {/* Nav links */}
        <ul className="pill-nav-links">
          <li>
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Dashboard
            </NavLink>
          </li>
          <li>
            <Link to="/#features">Features</Link>
          </li>
          <li>
            <Link to="/#docs">Docs</Link>
          </li>
        </ul>

        {/* Actions */}
        <div className="pill-nav-actions">
          <Link to="/dashboard" className="pill-nav-cta">
            Launch App
          </Link>
          {!isConnected ? (
            <button
              type="button"
              className="wallet-nav-button"
              onClick={() => void connect()}
              disabled={isConnecting}
              title="Connect with Freighter"
            >
              {isConnecting ? "Connecting..." : "Connect Stellar Wallet"}
            </button>
          ) : !isSupportedNetwork ? (
            <button
              type="button"
              className="wallet-nav-button wallet-nav-button-alert"
              title={`Switch your Freighter wallet to Stellar ${expectedNetwork}. Current: ${network ?? "unknown"}`}
            >
              Wrong Network
            </button>
          ) : (
            <button
              type="button"
              className="wallet-nav-button wallet-nav-button-connected"
              onClick={disconnect}
              title="Disconnect"
            >
              <span className="wallet-nav-status-dot" aria-hidden="true" />
              <span className="wallet-nav-address">{displayAddress}</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

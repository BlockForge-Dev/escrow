import React, { useState } from 'react';
import { ShieldCheck, Wallet, Settings, Network } from 'lucide-react';
import type { NetworkType } from '../types';
import { DEFAULT_MODULE_ADDRESS } from '../config';

interface NavbarProps {
  account: string | null;
  network: NetworkType;
  setNetwork: (n: NetworkType) => void;
  moduleAddress: string;
  setModuleAddress: (addr: string) => void;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  network,
  setNetwork,
  moduleAddress,
  setModuleAddress,
  onConnectWallet,
  onDisconnectWallet,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const shortenAddress = (addr: string) =>
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <nav className="glass-card" style={{ padding: '16px 24px', marginBottom: '24px', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BlockForge Escrow
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              Trustless Aptos Milestone Escrows
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Network Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Network size={16} color="#06b6d4" />
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as NetworkType)}
              style={{
                background: 'transparent',
                color: 'white',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="testnet" style={{ background: '#0f172a' }}>Aptos Testnet</option>
              <option value="mainnet" style={{ background: '#0f172a' }}>Aptos Mainnet</option>
              <option value="devnet" style={{ background: '#0f172a' }}>Aptos Devnet</option>
              <option value="local" style={{ background: '#0f172a' }}>Localnet (8080)</option>
            </select>
          </div>

          {/* Module Settings Toggle */}
          <button
            className="btn-secondary"
            onClick={() => setShowSettings(!showSettings)}
            title="Module Settings"
            style={{ padding: '8px 12px' }}
          >
            <Settings size={16} />
          </button>

          {/* Connect / Account Button */}
          {account ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="badge badge-client" style={{ padding: '8px 14px', fontSize: '13px' }}>
                <Wallet size={14} />
                {shortenAddress(account)}
              </div>
              <button className="btn-secondary" onClick={onDisconnectWallet} style={{ padding: '8px 12px', fontSize: '13px' }}>
                Disconnect
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={onConnectWallet}>
              <Wallet size={18} />
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Module Address Settings Bar */}
      {showSettings && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '120px' }}>Module Address:</label>
          <input
            type="text"
            className="input-field"
            value={moduleAddress}
            onChange={(e) => setModuleAddress(e.target.value)}
            placeholder="0x..."
          />
          <button
            className="btn-secondary"
            onClick={() => setModuleAddress(DEFAULT_MODULE_ADDRESS)}
            style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
          >
            Reset Default
          </button>
        </div>
      )}
    </nav>
  );
};

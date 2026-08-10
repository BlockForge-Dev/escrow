import React, { useState } from 'react';
import { Wallet, X, Key, ShieldCheck } from 'lucide-react';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (address: string, privateKey?: string) => void;
  wallets: any[];
  onConnectExtensionWallet: (walletName: string) => Promise<void>;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  wallets,
  onConnectExtensionWallet,
}) => {
  const [customAddress, setCustomAddress] = useState('');
  const [customPrivateKey, setCustomPrivateKey] = useState('');
  const [activeTab, setActiveTab] = useState<'extension' | 'custom'>('extension');

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAddress.trim().startsWith('0x')) return;
    onSelectAccount(customAddress.trim(), customPrivateKey.trim() || undefined);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} color="var(--accent-primary)" />
            Connect Aptos Wallet
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px' }}>
          <button
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'extension' ? 'var(--accent-primary)' : 'transparent',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('extension')}
          >
            Browser Extension
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'custom' ? 'var(--accent-primary)' : 'transparent',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('custom')}
          >
            Simulated / Key Account
          </button>
        </div>

        {activeTab === 'extension' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {wallets && wallets.length > 0 ? (
              wallets.map((w: any) => (
                <button
                  key={w.name}
                  className="btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '14px', width: '100%' }}
                  onClick={async () => {
                    await onConnectExtensionWallet(w.name);
                    onClose();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {w.icon && <img src={w.icon} alt={w.name} width={24} height={24} style={{ borderRadius: '6px' }} />}
                    <span>{w.name}</span>
                  </div>
                  <ShieldCheck size={16} color="var(--accent-emerald)" />
                </button>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                <p>No browser wallet extensions detected.</p>
                <p style={{ fontSize: '12px' }}>You can use Petra or Martian, or switch to the <strong>Simulated / Key Account</strong> tab to interact using an address or secret key on testnet/devnet.</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Account Address (0x...)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="0x2b2c1988fb1d3688b16d480b7eff6a3d62133a789de1d34f81a5aea7e5fdac05"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                <Key size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Private Key (Optional for signing)
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="ed25519 private key hex string"
                value={customPrivateKey}
                onChange={(e) => setCustomPrivateKey(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
              Use Account
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

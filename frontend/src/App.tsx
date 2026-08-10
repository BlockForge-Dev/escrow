import React, { useState, useEffect, useCallback } from 'react';
import { Aptos, AptosConfig, Network as AptosNetwork, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Navbar } from './components/Navbar';
import { CreateEscrowModal } from './components/CreateEscrowModal';
import { EscrowCard } from './components/EscrowCard';
import { WalletConnectModal } from './components/WalletConnectModal';
import type { EscrowItem, EscrowResource, NetworkType, EscrowRole } from './types';
import { DEFAULT_MODULE_ADDRESS, NETWORK_NODE_URLS } from './config';
import { Plus, RefreshCw, Layers, ShieldCheck, AlertCircle, Info, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const { account: walletAccount, wallets, connect, disconnect, signAndSubmitTransaction } = useWallet();

  const [network, setNetwork] = useState<NetworkType>('testnet');
  const [moduleAddress, setModuleAddress] = useState<string>(DEFAULT_MODULE_ADDRESS);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [privateKeyHex, setPrivateKeyHex] = useState<string | null>(null);

  const [escrows, setEscrows] = useState<EscrowItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'client' | 'freelancer' | 'arbitrator'>('all');

  // Address lookup list for scanning escrows
  const [searchAddresses, setSearchAddresses] = useState<string[]>([]);

  // Update connected account when wallet changes
  useEffect(() => {
    if (walletAccount?.address) {
      const addrStr = walletAccount.address.toString();
      setCurrentAccount(addrStr);
      if (!searchAddresses.includes(addrStr)) {
        setSearchAddresses((prev) => [...prev, addrStr]);
      }
    }
  }, [walletAccount]);

  // Sync module address into search list
  useEffect(() => {
    if (moduleAddress && !searchAddresses.includes(moduleAddress)) {
      setSearchAddresses((prev) => [...prev, moduleAddress]);
    }
  }, [moduleAddress]);

  // Aptos SDK Instance
  const getAptosClient = useCallback(() => {
    let sdkNetwork = AptosNetwork.TESTNET;
    if (network === 'mainnet') sdkNetwork = AptosNetwork.MAINNET;
    if (network === 'devnet') sdkNetwork = AptosNetwork.DEVNET;
    if (network === 'local') sdkNetwork = AptosNetwork.LOCAL;

    const config = new AptosConfig({
      network: sdkNetwork,
      fullnode: NETWORK_NODE_URLS[network],
    });
    return new Aptos(config);
  }, [network]);

  // Fetch Escrow Resource at a given address
  const fetchEscrows = useCallback(async () => {
    setIsLoading(true);
    const aptos = getAptosClient();
    const fetched: EscrowItem[] = [];

    const addressesToQuery = Array.from(new Set([
      moduleAddress,
      ...(currentAccount ? [currentAccount] : []),
      ...searchAddresses
    ])).filter(Boolean);

    for (const addr of addressesToQuery) {
      try {
        const resourceType = `${moduleAddress}::escrow::Escrow` as `${string}::${string}::${string}`;
        const resource = await aptos.getAccountResource<EscrowResource>({
          accountAddress: addr,
          resourceType,
        });

        if (resource) {
          let role: EscrowRole = 'guest';
          const normalizedCurr = currentAccount?.toLowerCase();
          if (normalizedCurr === resource.client.toLowerCase()) role = 'client';
          else if (normalizedCurr === resource.freelancer.toLowerCase()) role = 'freelancer';
          else if (normalizedCurr === resource.arbitrator.toLowerCase()) role = 'arbitrator';

          fetched.push({
            address: addr,
            resource,
            role,
          });
        }
      } catch (err) {
        // Resource doesn't exist at this address, skip silently
      }
    }

    setEscrows(fetched);
    setIsLoading(false);
  }, [getAptosClient, moduleAddress, currentAccount, searchAddresses]);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  // Helper to submit transaction via Wallet Extension or Private Key
  const submitTx = async (entryFunction: string, functionArguments: any[]) => {
    const aptos = getAptosClient();

    if (walletAccount && signAndSubmitTransaction) {
      const response = await signAndSubmitTransaction({
        data: {
          function: `${moduleAddress}::escrow::${entryFunction}` as `${string}::${string}::${string}`,
          functionArguments,
        },
      });
      await aptos.waitForTransaction({ transactionHash: response.hash });
      return response.hash;
    } else if (privateKeyHex && currentAccount) {
      const privateKey = new Ed25519PrivateKey(privateKeyHex);
      const accountObj = Account.fromPrivateKey({ privateKey });
      
      const transaction = await aptos.transaction.build.simple({
        sender: accountObj.accountAddress,
        data: {
          function: `${moduleAddress}::escrow::${entryFunction}` as `${string}::${string}::${string}`,
          functionArguments,
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: accountObj,
        transaction,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
      return pendingTx.hash;
    } else {
      throw new Error('No active wallet or private key available to sign transaction.');
    }
  };

  // Handlers for contract interactions
  const handleCreateEscrow = async (data: {
    freelancer: string;
    arbitrator: string;
    milestones: number[];
    deadlineSeconds: number;
  }) => {
    if (!currentAccount) {
      setIsWalletModalOpen(true);
      return;
    }

    setStatusMessage({ type: 'info', msg: 'Submitting create_escrow transaction to blockchain...' });
    try {
      const hash = await submitTx('create_escrow', [
        data.freelancer,
        data.arbitrator,
        data.milestones,
        data.deadlineSeconds,
      ]);

      setStatusMessage({ type: 'success', msg: `Escrow created successfully! Tx: ${hash.substring(0, 10)}...` });
      
      if (!searchAddresses.includes(currentAccount)) {
        setSearchAddresses((prev) => [...prev, currentAccount]);
      }
      await fetchEscrows();
    } catch (err: any) {
      setStatusMessage({ type: 'error', msg: err?.message || 'Failed to create escrow.' });
      throw err;
    }
  };

  const handleApproveMilestone = async (escrowAddr: string) => {
    setActionLoading(escrowAddr);
    setStatusMessage({ type: 'info', msg: 'Approving milestone payment...' });
    try {
      const hash = await submitTx('approve_milestone', [escrowAddr]);
      setStatusMessage({ type: 'success', msg: `Milestone approved! Funds released. Tx: ${hash.substring(0, 10)}...` });
      await fetchEscrows();
    } catch (err: any) {
      setStatusMessage({ type: 'error', msg: err?.message || 'Failed to approve milestone.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRaiseDispute = async (escrowAddr: string) => {
    setActionLoading(escrowAddr);
    setStatusMessage({ type: 'info', msg: 'Raising dispute on escrow...' });
    try {
      const hash = await submitTx('raise_dispute', [escrowAddr]);
      setStatusMessage({ type: 'success', msg: `Dispute raised successfully. Tx: ${hash.substring(0, 10)}...` });
      await fetchEscrows();
    } catch (err: any) {
      setStatusMessage({ type: 'error', msg: err?.message || 'Failed to raise dispute.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveDispute = async (escrowAddr: string, clientAmount: number, freelancerAmount: number) => {
    setActionLoading(escrowAddr);
    setStatusMessage({ type: 'info', msg: 'Submitting dispute resolution...' });
    try {
      const hash = await submitTx('resolve_dispute', [
        escrowAddr,
        clientAmount,
        freelancerAmount,
      ]);
      setStatusMessage({ type: 'success', msg: `Dispute resolved and funds distributed! Tx: ${hash.substring(0, 10)}...` });
      await fetchEscrows();
    } catch (err: any) {
      setStatusMessage({ type: 'error', msg: err?.message || 'Failed to resolve dispute.' });
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (escrowAddr: string) => {
    setActionLoading(escrowAddr);
    setStatusMessage({ type: 'info', msg: 'Requesting full refund...' });
    try {
      const hash = await submitTx('refund', [escrowAddr]);
      setStatusMessage({ type: 'success', msg: `Refund executed successfully! Tx: ${hash.substring(0, 10)}...` });
      await fetchEscrows();
    } catch (err: any) {
      setStatusMessage({ type: 'error', msg: err?.message || 'Failed to execute refund.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter escrows based on tab
  const filteredEscrows = escrows.filter((item) => {
    if (activeFilter === 'client') return item.role === 'client';
    if (activeFilter === 'freelancer') return item.role === 'freelancer';
    if (activeFilter === 'arbitrator') return item.role === 'arbitrator';
    return true;
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      
      {/* Navbar */}
      <Navbar
        account={currentAccount}
        network={network}
        setNetwork={setNetwork}
        moduleAddress={moduleAddress}
        setModuleAddress={setModuleAddress}
        onConnectWallet={() => setIsWalletModalOpen(true)}
        onDisconnectWallet={() => {
          disconnect();
          setCurrentAccount(null);
          setPrivateKeyHex(null);
        }}
      />

      {/* Status Alert Banner */}
      {statusMessage && (
        <div style={{
          background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : statusMessage.type === 'error' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : statusMessage.type === 'error' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
          color: statusMessage.type === 'success' ? '#34d399' : statusMessage.type === 'error' ? '#f87171' : '#818cf8',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {statusMessage.type === 'error' ? <AlertCircle size={18} /> : statusMessage.type === 'success' ? <ShieldCheck size={18} /> : <Info size={18} />}
            <span>{statusMessage.msg}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}>✕</button>
        </div>
      )}

      {/* Hero Header */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
            <Sparkles size={14} /> Milestone Escrow Protocol
          </div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>
            Escrow Dashboard
          </h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '14px', maxWidth: '600px' }}>
            Lock funds securely on Aptos Move, release milestone payouts incrementally, and resolve disputes with multi-party governance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={fetchEscrows}
            disabled={isLoading}
            style={{ padding: '12px 18px' }}
          >
            <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (!currentAccount) {
                setIsWalletModalOpen(true);
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            style={{ padding: '12px 22px' }}
          >
            <Plus size={18} />
            Create Escrow
          </button>
        </div>
      </div>

      {/* Quick Search & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(17, 24, 39, 0.7)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
              color: activeFilter === 'all' ? 'white' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveFilter('all')}
          >
            All Escrows ({escrows.length})
          </button>
          <button
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeFilter === 'client' ? 'var(--accent-primary)' : 'transparent',
              color: activeFilter === 'client' ? 'white' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveFilter('client')}
          >
            Client ({escrows.filter(e => e.role === 'client').length})
          </button>
          <button
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeFilter === 'freelancer' ? 'var(--accent-primary)' : 'transparent',
              color: activeFilter === 'freelancer' ? 'white' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveFilter('freelancer')}
          >
            Freelancer ({escrows.filter(e => e.role === 'freelancer').length})
          </button>
          <button
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeFilter === 'arbitrator' ? 'var(--accent-primary)' : 'transparent',
              color: activeFilter === 'arbitrator' ? 'white' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveFilter('arbitrator')}
          >
            Arbitrator ({escrows.filter(e => e.role === 'arbitrator').length})
          </button>
        </div>

        {/* Address lookup input */}
        <div style={{ display: 'flex', gap: '8px', width: '320px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search address (0x...)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val.startsWith('0x') && !searchAddresses.includes(val)) {
                  setSearchAddresses((prev) => [...prev, val]);
                }
              }
            }}
          />
        </div>
      </div>

      {/* Escrow List Grid */}
      {isLoading ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin" style={{ marginBottom: '12px', color: 'var(--accent-primary)' }} />
          <p style={{ margin: 0 }}>Fetching active escrows from Aptos blockchain...</p>
        </div>
      ) : filteredEscrows.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '20px' }}>
          {filteredEscrows.map((item) => (
            <EscrowCard
              key={item.address}
              escrow={item}
              currentAccount={currentAccount}
              onApproveMilestone={handleApproveMilestone}
              onRaiseDispute={handleRaiseDispute}
              onResolveDispute={handleResolveDispute}
              onRefund={handleRefund}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Layers size={40} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'white' }}>No Escrows Found</h3>
          <p style={{ margin: 0, fontSize: '14px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            No active escrow resources found at the queried addresses. Create a new escrow or enter an account address above.
          </p>
          <button
            className="btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{ marginTop: '20px' }}
          >
            <Plus size={16} /> Create First Escrow
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateEscrowModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateEscrow}
        isSubmitting={isLoading}
      />

      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onSelectAccount={(addr, pk) => {
          setCurrentAccount(addr);
          if (pk) setPrivateKeyHex(pk);
          if (!searchAddresses.includes(addr)) {
            setSearchAddresses((prev) => [...prev, addr]);
          }
        }}
        wallets={(wallets as any[]) || []}
        onConnectExtensionWallet={async (name) => {
          await connect(name);
        }}
      />
    </div>
  );
};

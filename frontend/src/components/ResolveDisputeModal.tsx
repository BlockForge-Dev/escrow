import React, { useState } from 'react';
import { Scale, AlertCircle, X } from 'lucide-react';
import { OCTA } from '../config';

interface ResolveDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  escrowAddress: string;
  totalRemainingOctas: number;
  onResolve: (clientOctas: number, freelancerOctas: number) => Promise<void>;
  isSubmitting: boolean;
}

export const ResolveDisputeModal: React.FC<ResolveDisputeModalProps> = ({
  isOpen,
  onClose,
  totalRemainingOctas,
  onResolve,
  isSubmitting,
}) => {
  const totalRemainingApt = totalRemainingOctas / OCTA;

  const [clientApt, setClientApt] = useState<string>((totalRemainingApt / 2).toFixed(4));
  const [freelancerApt, setFreelancerApt] = useState<string>((totalRemainingApt / 2).toFixed(4));
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clientVal = parseFloat(clientApt) || 0;
    const freelancerVal = parseFloat(freelancerApt) || 0;

    const clientOctas = Math.round(clientVal * OCTA);
    const freelancerOctas = Math.round(freelancerVal * OCTA);

    if (clientOctas + freelancerOctas !== totalRemainingOctas) {
      setError(`Split total must equal total remaining funds (${totalRemainingApt} APT). Current split total: ${(clientVal + freelancerVal).toFixed(4)} APT.`);
      return;
    }

    try {
      await onResolve(clientOctas, freelancerOctas);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to resolve dispute.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={20} color="var(--accent-amber)" />
            Arbitrate & Resolve Dispute
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#fbbf24' }}>
          Total Locked Funds to Distribute: <strong>{totalRemainingApt} APT</strong>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#f87171',
            padding: '12px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Amount to Client (APT)
            </label>
            <input
              type="number"
              step="0.0001"
              className="input-field"
              value={clientApt}
              onChange={(e) => setClientApt(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Amount to Freelancer (APT)
            </label>
            <input
              type="number"
              step="0.0001"
              className="input-field"
              value={freelancerApt}
              onChange={(e) => setFreelancerApt(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

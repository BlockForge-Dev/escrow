import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Lock, AlertCircle, X } from 'lucide-react';
import { OCTA } from '../config';

interface CreateEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    freelancer: string;
    arbitrator: string;
    milestones: number[];
    deadlineSeconds: number;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export const CreateEscrowModal: React.FC<CreateEscrowModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [freelancer, setFreelancer] = useState('');
  const [arbitrator, setArbitrator] = useState('');
  const [milestoneInputs, setMilestoneInputs] = useState<string[]>(['100', '200']);
  const [deadlineDays, setDeadlineDays] = useState<string>('7');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddMilestone = () => {
    setMilestoneInputs([...milestoneInputs, '100']);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestoneInputs.length <= 1) return;
    setMilestoneInputs(milestoneInputs.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, val: string) => {
    const updated = [...milestoneInputs];
    updated[index] = val;
    setMilestoneInputs(updated);
  };

  const totalApt = milestoneInputs.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!freelancer.trim().startsWith('0x')) {
      setError('Please enter a valid freelancer address starting with 0x.');
      return;
    }
    if (!arbitrator.trim().startsWith('0x')) {
      setError('Please enter a valid arbitrator address starting with 0x.');
      return;
    }

    const parsedMilestones = milestoneInputs.map((val) => Math.floor((parseFloat(val) || 0) * OCTA));
    if (parsedMilestones.some((m) => m <= 0)) {
      setError('All milestone amounts must be greater than 0 APT.');
      return;
    }

    const days = parseFloat(deadlineDays);
    if (isNaN(days) || days <= 0) {
      setError('Please specify a valid deadline in days.');
      return;
    }

    const deadlineTimestampSecs = Math.floor(Date.now() / 1000) + Math.floor(days * 86400);

    try {
      await onSubmit({
        freelancer: freelancer.trim(),
        arbitrator: arbitrator.trim(),
        milestones: parsedMilestones,
        deadlineSeconds: deadlineTimestampSecs,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit transaction.');
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
      <div className="glass-card" style={{ width: '100%', maxWidth: '540px', padding: '24px', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} color="var(--accent-primary)" />
            Create Milestone Escrow
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
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
          
          {/* Freelancer Address */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Freelancer Address
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="0x..."
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              required
            />
          </div>

          {/* Arbitrator Address */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Arbitrator Address
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="0x..."
              value={arbitrator}
              onChange={(e) => setArbitrator(e.target.value)}
              required
            />
          </div>

          {/* Dynamic Milestones */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Milestones (Amounts in APT)
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAddMilestone}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                <Plus size={14} /> Add Milestone
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
              {milestoneInputs.map((val, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '80px' }}>
                    Milestone {idx + 1}:
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="100"
                    value={val}
                    onChange={(e) => handleMilestoneChange(idx, e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>APT</span>
                  {milestoneInputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(idx)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)', textAlign: 'right' }}>
              Total Lock Amount: {totalApt.toFixed(4)} APT
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Deadline (Days from now)
            </label>
            <input
              type="number"
              className="input-field"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              min="0.1"
              step="0.5"
              required
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Locking Funds...' : 'Lock Funds & Create Escrow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

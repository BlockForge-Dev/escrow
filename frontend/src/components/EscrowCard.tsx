import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, RotateCcw, Scale, Clock, User, UserCheck, Shield } from 'lucide-react';
import type { EscrowItem } from '../types';
import { OCTA } from '../config';
import { ResolveDisputeModal } from './ResolveDisputeModal';

interface EscrowCardProps {
  escrow: EscrowItem;
  currentAccount: string | null;
  onApproveMilestone: (escrowAddr: string) => Promise<void>;
  onRaiseDispute: (escrowAddr: string) => Promise<void>;
  onResolveDispute: (escrowAddr: string, clientAmount: number, freelancerAmount: number) => Promise<void>;
  onRefund: (escrowAddr: string) => Promise<void>;
  actionLoading: string | null;
}

export const EscrowCard: React.FC<EscrowCardProps> = ({
  escrow,
  currentAccount,
  onApproveMilestone,
  onRaiseDispute,
  onResolveDispute,
  onRefund,
  actionLoading,
}) => {
  const [showResolveModal, setShowResolveModal] = useState(false);

  const { address, resource, role } = escrow;
  const { client, freelancer, arbitrator, milestones, next_milestone, total_locked, deadline, disputed, funds } = resource;

  const totalLockedApt = (parseInt(total_locked, 10) || 0) / OCTA;
  const remainingFundsOctas = parseInt(funds?.value || '0', 10);
  const remainingFundsApt = remainingFundsOctas / OCTA;

  const nextMilestoneIdx = parseInt(next_milestone, 10) || 0;
  const numMilestones = milestones.length;

  const deadlineTimestampSecs = parseInt(deadline, 10) || 0;
  const deadlineDate = new Date(deadlineTimestampSecs * 1000);
  const isExpired = Date.now() / 1000 >= deadlineTimestampSecs;

  const isClient = currentAccount?.toLowerCase() === client.toLowerCase();
  const isFreelancer = currentAccount?.toLowerCase() === freelancer.toLowerCase();
  const isArbitrator = currentAccount?.toLowerCase() === arbitrator.toLowerCase();

  const shorten = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const currentMilestoneAmountApt = nextMilestoneIdx < numMilestones
    ? (parseInt(milestones[nextMilestoneIdx], 10) || 0) / OCTA
    : 0;

  const canRefund = isClient && !disputed && isExpired && nextMilestoneIdx === 0;

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Escrow Address:</span>
          <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{shorten(address)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {disputed ? (
            <span className="badge badge-disputed">
              <ShieldAlert size={14} /> Disputed
            </span>
          ) : (
            <span className="badge badge-active">
              <CheckCircle2 size={14} /> Active
            </span>
          )}

          {role === 'client' && <span className="badge badge-client"><User size={12} /> Client</span>}
          {role === 'freelancer' && <span className="badge badge-freelancer"><UserCheck size={12} /> Freelancer</span>}
          {role === 'arbitrator' && <span className="badge badge-arbitrator"><Shield size={12} /> Arbitrator</span>}
        </div>
      </div>

      {/* Financials & Deadline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '12px' }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Total Locked</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{totalLockedApt.toFixed(4)} APT</span>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Remaining</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{remainingFundsApt.toFixed(4)} APT</span>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Deadline</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isExpired ? '#f87171' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <Clock size={14} />
            {deadlineDate.toLocaleDateString()} {deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Participants */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <div>Client: <span style={{ color: 'white', fontFamily: 'monospace' }}>{shorten(client)}</span></div>
        <div>Freelancer: <span style={{ color: 'white', fontFamily: 'monospace' }}>{shorten(freelancer)}</span></div>
        <div>Arbitrator: <span style={{ color: 'white', fontFamily: 'monospace' }}>{shorten(arbitrator)}</span></div>
      </div>

      {/* Milestones Progress */}
      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: 'var(--text-muted)' }}>
          <span>Milestone Progress</span>
          <span>{nextMilestoneIdx} / {numMilestones} Approved</span>
        </div>
        
        {/* Progress Bar */}
        <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(nextMilestoneIdx / numMilestones) * 100}%`,
            background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {nextMilestoneIdx < numMilestones && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-cyan)' }}>
            Next Payout: <strong>{currentMilestoneAmountApt.toFixed(4)} APT</strong>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
        
        {/* Client Approve Milestone Button */}
        {isClient && !disputed && nextMilestoneIdx < numMilestones && (
          <button
            className="btn-success"
            onClick={() => onApproveMilestone(address)}
            disabled={actionLoading === address}
          >
            <CheckCircle2 size={16} />
            {actionLoading === address ? 'Approving...' : `Approve Milestone ${nextMilestoneIdx + 1} (${currentMilestoneAmountApt} APT)`}
          </button>
        )}

        {/* Client or Freelancer Raise Dispute */}
        {(isClient || isFreelancer) && !disputed && (
          <button
            className="btn-danger"
            onClick={() => onRaiseDispute(address)}
            disabled={actionLoading === address}
          >
            <ShieldAlert size={16} />
            {actionLoading === address ? 'Raising...' : 'Raise Dispute'}
          </button>
        )}

        {/* Arbitrator Resolve Dispute */}
        {isArbitrator && disputed && (
          <button
            className="btn-primary"
            onClick={() => setShowResolveModal(true)}
            disabled={actionLoading === address}
          >
            <Scale size={16} />
            Resolve Dispute
          </button>
        )}

        {/* Client Refund */}
        {canRefund && (
          <button
            className="btn-secondary"
            onClick={() => onRefund(address)}
            disabled={actionLoading === address}
            style={{ color: '#f87171', borderColor: 'rgba(244, 63, 94, 0.3)' }}
          >
            <RotateCcw size={16} />
            {actionLoading === address ? 'Refunding...' : 'Request Full Refund'}
          </button>
        )}
      </div>

      {/* Resolve Dispute Modal */}
      <ResolveDisputeModal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        escrowAddress={address}
        totalRemainingOctas={remainingFundsOctas}
        onResolve={(clientOctas, freelancerOctas) => onResolveDispute(address, clientOctas, freelancerOctas)}
        isSubmitting={actionLoading === address}
      />
    </div>
  );
};

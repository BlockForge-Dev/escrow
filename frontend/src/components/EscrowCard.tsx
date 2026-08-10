import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, RotateCcw, Scale, Clock, User, UserCheck, Shield, Timer } from 'lucide-react';
import type { EscrowItem } from '../types';
import { OCTA } from '../config';
import { ResolveDisputeModal } from './ResolveDisputeModal';

interface EscrowCardProps {
  escrow: EscrowItem;
  currentAccount: string | null;
  onApproveMilestone: (clientAddr: string, escrowId: number) => Promise<void>;
  onRaiseDispute: (clientAddr: string, escrowId: number) => Promise<void>;
  onResolveDispute: (clientAddr: string, escrowId: number, clientAmount: number, freelancerAmount: number) => Promise<void>;
  onClaimTimeoutResolution: (clientAddr: string, escrowId: number) => Promise<void>;
  onRefund: (clientAddr: string, escrowId: number) => Promise<void>;
  actionLoading: string | null;
}

export const EscrowCard: React.FC<EscrowCardProps> = ({
  escrow,
  currentAccount,
  onApproveMilestone,
  onRaiseDispute,
  onResolveDispute,
  onClaimTimeoutResolution,
  onRefund,
  actionLoading,
}) => {
  const [showResolveModal, setShowResolveModal] = useState(false);

  const { address, escrowId, resource, role } = escrow;
  const { client, freelancer, arbitrator, milestones, next_milestone, total_locked, deadline, disputed, dispute_deadline, funds } = resource;

  const totalLockedApt = (parseInt(total_locked, 10) || 0) / OCTA;
  const remainingFundsOctas = parseInt(funds?.value || '0', 10);
  const remainingFundsApt = remainingFundsOctas / OCTA;

  const nextMilestoneIdx = parseInt(next_milestone, 10) || 0;
  const numMilestones = milestones.length;

  const deadlineTimestampSecs = parseInt(deadline, 10) || 0;
  const deadlineDate = new Date(deadlineTimestampSecs * 1000);
  const isExpired = Date.now() / 1000 >= deadlineTimestampSecs;

  const disputeDeadlineSecs = parseInt(dispute_deadline, 10) || 0;
  const isDisputeTimedOut = disputed && (Date.now() / 1000 >= disputeDeadlineSecs);

  const isClient = currentAccount?.toLowerCase() === client.toLowerCase();
  const isFreelancer = currentAccount?.toLowerCase() === freelancer.toLowerCase();
  const isArbitrator = currentAccount?.toLowerCase() === arbitrator.toLowerCase();

  const shorten = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const currentMilestoneAmountApt = nextMilestoneIdx < numMilestones
    ? (parseInt(milestones[nextMilestoneIdx], 10) || 0) / OCTA
    : 0;

  const canRefund = isClient && !disputed && isExpired;
  const canClaimTimeout = (isClient || isFreelancer) && isDisputeTimedOut;

  const cardKey = `${address}-${escrowId}`;

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-client" style={{ background: 'rgba(99, 102, 241, 0.2)', fontSize: '13px' }}>
            Escrow #{escrowId}
          </span>
          <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{shorten(address)}</span>
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
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
            {disputed ? 'Dispute Timeout' : 'Deadline'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: (disputed ? isDisputeTimedOut : isExpired) ? '#f87171' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <Clock size={14} />
            {disputed
              ? new Date(disputeDeadlineSecs * 1000).toLocaleDateString()
              : deadlineDate.toLocaleDateString()}
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
            onClick={() => onApproveMilestone(address, escrowId)}
            disabled={actionLoading === cardKey}
          >
            <CheckCircle2 size={16} />
            {actionLoading === cardKey ? 'Approving...' : `Approve Milestone ${nextMilestoneIdx + 1} (${currentMilestoneAmountApt} APT)`}
          </button>
        )}

        {/* Client or Freelancer Raise Dispute */}
        {(isClient || isFreelancer) && !disputed && (
          <button
            className="btn-danger"
            onClick={() => onRaiseDispute(address, escrowId)}
            disabled={actionLoading === cardKey}
          >
            <ShieldAlert size={16} />
            {actionLoading === cardKey ? 'Raising...' : 'Raise Dispute'}
          </button>
        )}

        {/* Arbitrator Resolve Dispute */}
        {isArbitrator && disputed && (
          <button
            className="btn-primary"
            onClick={() => setShowResolveModal(true)}
            disabled={actionLoading === cardKey}
          >
            <Scale size={16} />
            Resolve Dispute
          </button>
        )}

        {/* Claim Dispute Timeout (50/50 Auto-Resolution) */}
        {canClaimTimeout && (
          <button
            className="btn-primary"
            onClick={() => onClaimTimeoutResolution(address, escrowId)}
            disabled={actionLoading === cardKey}
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
          >
            <Timer size={16} />
            {actionLoading === cardKey ? 'Resolving Timeout...' : 'Auto-Resolve Timeout (50/50 Split)'}
          </button>
        )}

        {/* Client Flexible Refund */}
        {canRefund && (
          <button
            className="btn-secondary"
            onClick={() => onRefund(address, escrowId)}
            disabled={actionLoading === cardKey}
            style={{ color: '#f87171', borderColor: 'rgba(244, 63, 94, 0.3)' }}
          >
            <RotateCcw size={16} />
            {actionLoading === cardKey ? 'Refunding...' : `Refund Unapproved (${remainingFundsApt.toFixed(2)} APT)`}
          </button>
        )}
      </div>

      {/* Resolve Dispute Modal */}
      <ResolveDisputeModal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        escrowAddress={address}
        totalRemainingOctas={remainingFundsOctas}
        onResolve={(clientOctas, freelancerOctas) => onResolveDispute(address, escrowId, clientOctas, freelancerOctas)}
        isSubmitting={actionLoading === cardKey}
      />
    </div>
  );
};

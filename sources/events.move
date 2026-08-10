module escrow_addr::events {
    use aptos_framework::event;

    #[event]
    struct EscrowCreated has drop, store {
        client: address,
        freelancer: address,
        arbitrator: address,
        total_locked: u64,
        deadline: u64,
    }

    #[event]
    struct MilestoneApproved has drop, store {
        escrow_addr: address,
        milestone_index: u64,
        amount: u64,
        freelancer: address,
    }

    #[event]
    struct DisputeRaised has drop, store {
        escrow_addr: address,
        raised_by: address,
    }

    #[event]
    struct DisputeResolved has drop, store {
        escrow_addr: address,
        arbitrator: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    }

    #[event]
    struct EscrowRefunded has drop, store {
        escrow_addr: address,
        client: address,
        amount: u64,
    }

    public fun emit_escrow_created(
        client: address,
        freelancer: address,
        arbitrator: address,
        total_locked: u64,
        deadline: u64,
    ) {
        event::emit(EscrowCreated {
            client,
            freelancer,
            arbitrator,
            total_locked,
            deadline,
        });
    }

    public fun emit_milestone_approved(
        escrow_addr: address,
        milestone_index: u64,
        amount: u64,
        freelancer: address,
    ) {
        event::emit(MilestoneApproved {
            escrow_addr,
            milestone_index,
            amount,
            freelancer,
        });
    }

    public fun emit_dispute_raised(escrow_addr: address, raised_by: address) {
        event::emit(DisputeRaised {
            escrow_addr,
            raised_by,
        });
    }

    public fun emit_dispute_resolved(
        escrow_addr: address,
        arbitrator: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    ) {
        event::emit(DisputeResolved {
            escrow_addr,
            arbitrator,
            amount_to_client,
            amount_to_freelancer,
        });
    }

    public fun emit_escrow_refunded(escrow_addr: address, client: address, amount: u64) {
        event::emit(EscrowRefunded {
            escrow_addr,
            client,
            amount,
        });
    }
}

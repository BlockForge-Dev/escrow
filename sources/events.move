module escrow_addr::events {
    use aptos_framework::event;

    #[event]
    struct EscrowCreated has drop, store {
        client: address,
        escrow_id: u64,
        freelancer: address,
        arbitrator: address,
        total_locked: u64,
        deadline: u64,
    }

    #[event]
    struct MilestoneApproved has drop, store {
        client_addr: address,
        escrow_id: u64,
        milestone_index: u64,
        amount: u64,
        freelancer: address,
    }

    #[event]
    struct DisputeRaised has drop, store {
        client_addr: address,
        escrow_id: u64,
        raised_by: address,
        dispute_deadline: u64,
    }

    #[event]
    struct DisputeResolved has drop, store {
        client_addr: address,
        escrow_id: u64,
        arbitrator: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    }

    #[event]
    struct TimeoutResolved has drop, store {
        client_addr: address,
        escrow_id: u64,
        caller: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    }

    #[event]
    struct EscrowRefunded has drop, store {
        client_addr: address,
        escrow_id: u64,
        client: address,
        amount: u64,
    }

    public fun emit_escrow_created(
        client: address,
        escrow_id: u64,
        freelancer: address,
        arbitrator: address,
        total_locked: u64,
        deadline: u64,
    ) {
        event::emit(EscrowCreated {
            client,
            escrow_id,
            freelancer,
            arbitrator,
            total_locked,
            deadline,
        });
    }

    public fun emit_milestone_approved(
        client_addr: address,
        escrow_id: u64,
        milestone_index: u64,
        amount: u64,
        freelancer: address,
    ) {
        event::emit(MilestoneApproved {
            client_addr,
            escrow_id,
            milestone_index,
            amount,
            freelancer,
        });
    }

    public fun emit_dispute_raised(
        client_addr: address,
        escrow_id: u64,
        raised_by: address,
        dispute_deadline: u64,
    ) {
        event::emit(DisputeRaised {
            client_addr,
            escrow_id,
            raised_by,
            dispute_deadline,
        });
    }

    public fun emit_dispute_resolved(
        client_addr: address,
        escrow_id: u64,
        arbitrator: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    ) {
        event::emit(DisputeResolved {
            client_addr,
            escrow_id,
            arbitrator,
            amount_to_client,
            amount_to_freelancer,
        });
    }

    public fun emit_timeout_resolved(
        client_addr: address,
        escrow_id: u64,
        caller: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    ) {
        event::emit(TimeoutResolved {
            client_addr,
            escrow_id,
            caller,
            amount_to_client,
            amount_to_freelancer,
        });
    }

    public fun emit_escrow_refunded(
        client_addr: address,
        escrow_id: u64,
        client: address,
        amount: u64,
    ) {
        event::emit(EscrowRefunded {
            client_addr,
            escrow_id,
            client,
            amount,
        });
    }
}

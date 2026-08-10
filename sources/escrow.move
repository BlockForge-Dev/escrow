module escrow_addr::escrow {
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use std::vector;
    use std::signer;

    use escrow_addr::events;

    /// Error codes
    const EEMPTY_MILESTONES: u64 = 1;
    const EINVALID_DEADLINE: u64 = 2;
    const EINVALID_FREELANCER: u64 = 3;
    const EESCROW_ALREADY_EXISTS: u64 = 4;
    const EZERO_AMOUNT: u64 = 5;
    const EESCROW_NOT_FOUND: u64 = 6;
    const ENOT_AUTHORIZED: u64 = 7;
    const EDISPUTED: u64 = 8;
    const EALREADY_DISPUTED: u64 = 9;
    const EALL_MILESTONES_APPROVED: u64 = 10;
    const EINVALID_DISPUTE_SPLIT: u64 = 11;
    const EDEADLINE_NOT_REACHED: u64 = 12;
    const EMILESTONES_ALREADY_APPROVED: u64 = 13;
    const ENOT_DISPUTED: u64 = 14;
    const EDISPUTE_TIMEOUT_NOT_REACHED: u64 = 15;

    /// 7 days dispute timeout duration in seconds
    const DEFAULT_DISPUTE_DURATION: u64 = 604800;

    struct Escrow has store {
        id: u64,
        client: address,
        freelancer: address,
        arbitrator: address,
        milestones: vector<u64>,        // amounts for each milestone
        next_milestone: u64,            // index of next milestone to be approved
        total_locked: u64,
        deadline: u64,                  // unix timestamp after which refund is possible
        disputed: bool,
        dispute_deadline: u64,          // timestamp after which auto-resolution timeout can be claimed
        funds: Coin<AptosCoin>,
    }

    struct EscrowStore has key {
        escrows: Table<u64, Escrow>,
        next_escrow_id: u64,
    }

    public fun get_total(milestones: &vector<u64>): u64 {
        let total = 0u64;
        let len = vector::length(milestones);
        let i = 0;
        while (i < len) {
            total = total + *vector::borrow(milestones, i);
            i = i + 1;
        };
        total
    }

    public entry fun create_escrow(
        client: &signer,
        freelancer: address,
        arbitrator: address,
        milestones: vector<u64>,
        deadline: u64,
    ) acquires EscrowStore {
        let client_addr = signer::address_of(client);
        
        assert!(!vector::is_empty(&milestones), EEMPTY_MILESTONES);
        assert!(client_addr != freelancer, EINVALID_FREELANCER);

        let now = timestamp::now_seconds();
        assert!(deadline > now, EINVALID_DEADLINE);

        let total_locked = get_total(&milestones);
        assert!(total_locked > 0, EZERO_AMOUNT);

        if (!exists<EscrowStore>(client_addr)) {
            move_to(client, EscrowStore {
                escrows: table::new(),
                next_escrow_id: 1,
            });
        };

        let store = borrow_global_mut<EscrowStore>(client_addr);
        let escrow_id = store.next_escrow_id;
        store.next_escrow_id = escrow_id + 1;

        let funds = coin::withdraw<AptosCoin>(client, total_locked);

        let escrow = Escrow {
            id: escrow_id,
            client: client_addr,
            freelancer,
            arbitrator,
            milestones,
            next_milestone: 0,
            total_locked,
            deadline,
            disputed: false,
            dispute_deadline: 0,
            funds,
        };

        table::add(&mut store.escrows, escrow_id, escrow);

        events::emit_escrow_created(
            client_addr,
            escrow_id,
            freelancer,
            arbitrator,
            total_locked,
            deadline,
        );
    }

    public entry fun approve_milestone(
        client: &signer,
        client_addr: address,
        escrow_id: u64,
    ) acquires EscrowStore {
        assert!(exists<EscrowStore>(client_addr), EESCROW_NOT_FOUND);
        let store = borrow_global_mut<EscrowStore>(client_addr);
        assert!(table::contains(&store.escrows, escrow_id), EESCROW_NOT_FOUND);

        let escrow = table::borrow_mut(&mut store.escrows, escrow_id);
        let signer_addr = signer::address_of(client);

        assert!(escrow.client == signer_addr, ENOT_AUTHORIZED);
        assert!(!escrow.disputed, EDISPUTED);

        let num_milestones = vector::length(&escrow.milestones);
        assert!(escrow.next_milestone < num_milestones, EALL_MILESTONES_APPROVED);

        let current_index = escrow.next_milestone;
        let milestone_amount = *vector::borrow(&escrow.milestones, current_index);
        let freelancer_addr = escrow.freelancer;

        let payment = coin::extract(&mut escrow.funds, milestone_amount);
        coin::deposit(freelancer_addr, payment);

        escrow.next_milestone = current_index + 1;

        events::emit_milestone_approved(
            client_addr,
            escrow_id,
            current_index,
            milestone_amount,
            freelancer_addr,
        );

        if (escrow.next_milestone == num_milestones) {
            let Escrow {
                id: _,
                client: _,
                freelancer: _,
                arbitrator: _,
                milestones: _,
                next_milestone: _,
                total_locked: _,
                deadline: _,
                disputed: _,
                dispute_deadline: _,
                funds,
            } = table::remove(&mut store.escrows, escrow_id);
            coin::destroy_zero(funds);
        };
    }

    public entry fun raise_dispute(
        caller: &signer,
        client_addr: address,
        escrow_id: u64,
    ) acquires EscrowStore {
        assert!(exists<EscrowStore>(client_addr), EESCROW_NOT_FOUND);
        let store = borrow_global_mut<EscrowStore>(client_addr);
        assert!(table::contains(&store.escrows, escrow_id), EESCROW_NOT_FOUND);

        let escrow = table::borrow_mut(&mut store.escrows, escrow_id);
        let caller_addr = signer::address_of(caller);

        assert!(caller_addr == escrow.client || caller_addr == escrow.freelancer, ENOT_AUTHORIZED);
        assert!(!escrow.disputed, EALREADY_DISPUTED);

        escrow.disputed = true;
        let dispute_deadline = timestamp::now_seconds() + DEFAULT_DISPUTE_DURATION;
        escrow.dispute_deadline = dispute_deadline;

        events::emit_dispute_raised(client_addr, escrow_id, caller_addr, dispute_deadline);
    }

    public entry fun resolve_dispute(
        arbitrator: &signer,
        client_addr: address,
        escrow_id: u64,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    ) acquires EscrowStore {
        assert!(exists<EscrowStore>(client_addr), EESCROW_NOT_FOUND);
        let store = borrow_global_mut<EscrowStore>(client_addr);
        assert!(table::contains(&store.escrows, escrow_id), EESCROW_NOT_FOUND);

        let escrow_ref = table::borrow(&store.escrows, escrow_id);
        let arbitrator_addr = signer::address_of(arbitrator);
        assert!(escrow_ref.arbitrator == arbitrator_addr, ENOT_AUTHORIZED);
        assert!(escrow_ref.disputed, ENOT_DISPUTED);

        let Escrow {
            id: _,
            client,
            freelancer,
            arbitrator: _,
            milestones: _,
            next_milestone: _,
            total_locked: _,
            deadline: _,
            disputed: _,
            dispute_deadline: _,
            funds,
        } = table::remove(&mut store.escrows, escrow_id);

        let total_remaining = coin::value(&funds);
        assert!(amount_to_client + amount_to_freelancer == total_remaining, EINVALID_DISPUTE_SPLIT);

        if (amount_to_client > 0) {
            let client_payment = coin::extract(&mut funds, amount_to_client);
            coin::deposit(client, client_payment);
        };

        if (amount_to_freelancer > 0) {
            let freelancer_payment = coin::extract(&mut funds, amount_to_freelancer);
            coin::deposit(freelancer, freelancer_payment);
        };

        coin::destroy_zero(funds);

        events::emit_dispute_resolved(
            client_addr,
            escrow_id,
            arbitrator_addr,
            amount_to_client,
            amount_to_freelancer,
        );
    }

    public entry fun claim_timeout_resolution(
        caller: &signer,
        client_addr: address,
        escrow_id: u64,
    ) acquires EscrowStore {
        assert!(exists<EscrowStore>(client_addr), EESCROW_NOT_FOUND);
        let store = borrow_global_mut<EscrowStore>(client_addr);
        assert!(table::contains(&store.escrows, escrow_id), EESCROW_NOT_FOUND);

        let caller_addr = signer::address_of(caller);
        let escrow_ref = table::borrow(&store.escrows, escrow_id);

        assert!(caller_addr == escrow_ref.client || caller_addr == escrow_ref.freelancer, ENOT_AUTHORIZED);
        assert!(escrow_ref.disputed, ENOT_DISPUTED);
        assert!(timestamp::now_seconds() >= escrow_ref.dispute_deadline, EDISPUTE_TIMEOUT_NOT_REACHED);

        let Escrow {
            id: _,
            client,
            freelancer,
            arbitrator: _,
            milestones: _,
            next_milestone: _,
            total_locked: _,
            deadline: _,
            disputed: _,
            dispute_deadline: _,
            funds,
        } = table::remove(&mut store.escrows, escrow_id);

        let total_remaining = coin::value(&funds);
        let amount_to_freelancer = total_remaining / 2;
        let amount_to_client = total_remaining - amount_to_freelancer;

        if (amount_to_client > 0) {
            let client_payment = coin::extract(&mut funds, amount_to_client);
            coin::deposit(client, client_payment);
        };

        if (amount_to_freelancer > 0) {
            let freelancer_payment = coin::extract(&mut funds, amount_to_freelancer);
            coin::deposit(freelancer, freelancer_payment);
        };

        coin::destroy_zero(funds);

        events::emit_timeout_resolved(
            client_addr,
            escrow_id,
            caller_addr,
            amount_to_client,
            amount_to_freelancer,
        );
    }

    public entry fun refund(
        client: &signer,
        client_addr: address,
        escrow_id: u64,
    ) acquires EscrowStore {
        assert!(exists<EscrowStore>(client_addr), EESCROW_NOT_FOUND);
        let store = borrow_global_mut<EscrowStore>(client_addr);
        assert!(table::contains(&store.escrows, escrow_id), EESCROW_NOT_FOUND);

        let signer_addr = signer::address_of(client);
        let escrow_ref = table::borrow(&store.escrows, escrow_id);

        assert!(escrow_ref.client == signer_addr, ENOT_AUTHORIZED);
        assert!(!escrow_ref.disputed, EDISPUTED);
        assert!(timestamp::now_seconds() >= escrow_ref.deadline, EDEADLINE_NOT_REACHED);

        let Escrow {
            id: _,
            client: _,
            freelancer: _,
            arbitrator: _,
            milestones: _,
            next_milestone: _,
            total_locked: _,
            deadline: _,
            disputed: _,
            dispute_deadline: _,
            funds,
        } = table::remove(&mut store.escrows, escrow_id);

        let amount = coin::value(&funds);
        coin::deposit(signer_addr, funds);

        events::emit_escrow_refunded(client_addr, escrow_id, signer_addr, amount);
    }

    // View / Inspection functions
    public fun exists_at(client_addr: address, escrow_id: u64): bool acquires EscrowStore {
        if (!exists<EscrowStore>(client_addr)) return false;
        let store = borrow_global<EscrowStore>(client_addr);
        table::contains(&store.escrows, escrow_id)
    }

    public fun get_total_locked(client_addr: address, escrow_id: u64): u64 acquires EscrowStore {
        assert!(exists_at(client_addr, escrow_id), EESCROW_NOT_FOUND);
        let store = borrow_global<EscrowStore>(client_addr);
        table::borrow(&store.escrows, escrow_id).total_locked
    }

    public fun get_next_milestone(client_addr: address, escrow_id: u64): u64 acquires EscrowStore {
        assert!(exists_at(client_addr, escrow_id), EESCROW_NOT_FOUND);
        let store = borrow_global<EscrowStore>(client_addr);
        table::borrow(&store.escrows, escrow_id).next_milestone
    }

    public fun is_disputed(client_addr: address, escrow_id: u64): bool acquires EscrowStore {
        assert!(exists_at(client_addr, escrow_id), EESCROW_NOT_FOUND);
        let store = borrow_global<EscrowStore>(client_addr);
        table::borrow(&store.escrows, escrow_id).disputed
    }

    public fun get_dispute_deadline(client_addr: address, escrow_id: u64): u64 acquires EscrowStore {
        assert!(exists_at(client_addr, escrow_id), EESCROW_NOT_FOUND);
        let store = borrow_global<EscrowStore>(client_addr);
        table::borrow(&store.escrows, escrow_id).dispute_deadline
    }

    public fun get_remaining_funds(client_addr: address, escrow_id: u64): u64 acquires EscrowStore {
        assert!(exists_at(client_addr, escrow_id), EESCROW_NOT_FOUND);
        let store = borrow_global<EscrowStore>(client_addr);
        coin::value(&table::borrow(&store.escrows, escrow_id).funds)
    }

    public fun get_next_escrow_id(client_addr: address): u64 acquires EscrowStore {
        if (!exists<EscrowStore>(client_addr)) return 1;
        borrow_global<EscrowStore>(client_addr).next_escrow_id
    }
}

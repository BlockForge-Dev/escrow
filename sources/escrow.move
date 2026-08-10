module escrow_addr::escrow {
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
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

    struct Escrow has key {
        client: address,
        freelancer: address,
        arbitrator: address,
        milestones: vector<u64>,        // amounts for each milestone
        next_milestone: u64,            // index of next milestone to be approved
        total_locked: u64,
        deadline: u64,                  // unix timestamp after which refund is possible
        disputed: bool,
        funds: Coin<AptosCoin>,
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
    ) {
        let client_addr = signer::address_of(client);
        
        assert!(!vector::is_empty(&milestones), EEMPTY_MILESTONES);
        assert!(client_addr != freelancer, EINVALID_FREELANCER);
        assert!(!exists<Escrow>(client_addr), EESCROW_ALREADY_EXISTS);

        let now = timestamp::now_seconds();
        assert!(deadline > now, EINVALID_DEADLINE);

        let total_locked = get_total(&milestones);
        assert!(total_locked > 0, EZERO_AMOUNT);

        let funds = coin::withdraw<AptosCoin>(client, total_locked);

        let escrow = Escrow {
            client: client_addr,
            freelancer,
            arbitrator,
            milestones,
            next_milestone: 0,
            total_locked,
            deadline,
            disputed: false,
            funds,
        };

        move_to(client, escrow);

        events::emit_escrow_created(
            client_addr,
            freelancer,
            arbitrator,
            total_locked,
            deadline,
        );
    }

    public entry fun approve_milestone(client: &signer, escrow_addr: address) acquires Escrow {
        assert!(exists<Escrow>(escrow_addr), EESCROW_NOT_FOUND);

        let client_addr = signer::address_of(client);
        let escrow = borrow_global_mut<Escrow>(escrow_addr);

        assert!(escrow.client == client_addr, ENOT_AUTHORIZED);
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
            escrow_addr,
            current_index,
            milestone_amount,
            freelancer_addr,
        );

        if (escrow.next_milestone == num_milestones) {
            let Escrow {
                client: _,
                freelancer: _,
                arbitrator: _,
                milestones: _,
                next_milestone: _,
                total_locked: _,
                deadline: _,
                disputed: _,
                funds,
            } = move_from<Escrow>(escrow_addr);
            coin::destroy_zero(funds);
        };
    }

    public entry fun raise_dispute(caller: &signer, escrow_addr: address) acquires Escrow {
        assert!(exists<Escrow>(escrow_addr), EESCROW_NOT_FOUND);

        let caller_addr = signer::address_of(caller);
        let escrow = borrow_global_mut<Escrow>(escrow_addr);

        assert!(caller_addr == escrow.client || caller_addr == escrow.freelancer, ENOT_AUTHORIZED);
        assert!(!escrow.disputed, EALREADY_DISPUTED);

        escrow.disputed = true;

        events::emit_dispute_raised(escrow_addr, caller_addr);
    }

    public entry fun resolve_dispute(
        arbitrator: &signer,
        escrow_addr: address,
        amount_to_client: u64,
        amount_to_freelancer: u64,
    ) acquires Escrow {
        assert!(exists<Escrow>(escrow_addr), EESCROW_NOT_FOUND);

        let arbitrator_addr = signer::address_of(arbitrator);
        let escrow_ref = borrow_global<Escrow>(escrow_addr);

        assert!(escrow_ref.arbitrator == arbitrator_addr, ENOT_AUTHORIZED);
        assert!(escrow_ref.disputed, ENOT_DISPUTED);

        let Escrow {
            client,
            freelancer,
            arbitrator: _,
            milestones: _,
            next_milestone: _,
            total_locked: _,
            deadline: _,
            disputed: _,
            funds,
        } = move_from<Escrow>(escrow_addr);

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
            escrow_addr,
            arbitrator_addr,
            amount_to_client,
            amount_to_freelancer,
        );
    }

    public entry fun refund(client: &signer, escrow_addr: address) acquires Escrow {
        assert!(exists<Escrow>(escrow_addr), EESCROW_NOT_FOUND);

        let client_addr = signer::address_of(client);
        let escrow_ref = borrow_global<Escrow>(escrow_addr);

        assert!(escrow_ref.client == client_addr, ENOT_AUTHORIZED);
        assert!(!escrow_ref.disputed, EDISPUTED);
        assert!(timestamp::now_seconds() >= escrow_ref.deadline, EDEADLINE_NOT_REACHED);
        assert!(escrow_ref.next_milestone == 0, EMILESTONES_ALREADY_APPROVED);

        let Escrow {
            client: _,
            freelancer: _,
            arbitrator: _,
            milestones: _,
            next_milestone: _,
            total_locked: _,
            deadline: _,
            disputed: _,
            funds,
        } = move_from<Escrow>(escrow_addr);

        let amount = coin::value(&funds);
        coin::deposit(client_addr, funds);

        events::emit_escrow_refunded(escrow_addr, client_addr, amount);
    }

    // View / Inspection functions
    public fun exists_at(addr: address): bool {
        exists<Escrow>(addr)
    }

    public fun get_total_locked(addr: address): u64 acquires Escrow {
        assert!(exists<Escrow>(addr), EESCROW_NOT_FOUND);
        borrow_global<Escrow>(addr).total_locked
    }

    public fun get_next_milestone(addr: address): u64 acquires Escrow {
        assert!(exists<Escrow>(addr), EESCROW_NOT_FOUND);
        borrow_global<Escrow>(addr).next_milestone
    }

    public fun is_disputed(addr: address): bool acquires Escrow {
        assert!(exists<Escrow>(addr), EESCROW_NOT_FOUND);
        borrow_global<Escrow>(addr).disputed
    }

    public fun get_remaining_funds(addr: address): u64 acquires Escrow {
        assert!(exists<Escrow>(addr), EESCROW_NOT_FOUND);
        coin::value(&borrow_global<Escrow>(addr).funds)
    }
}

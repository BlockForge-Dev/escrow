module escrow_addr::escrow {
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use std::vector;
    use std::signer;

    /// Error codes
    const EEMPTY_MILESTONES: u64 = 1;
    const EINVALID_DEADLINE: u64 = 2;
    const EINVALID_FREELANCER: u64 = 3;
    const EESCROW_ALREADY_EXISTS: u64 = 4;
    const EZERO_AMOUNT: u64 = 5;

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

    #[event]
    struct EscrowCreated has drop, store {
        client: address,
        freelancer: address,
        arbitrator: address,
        total_locked: u64,
        deadline: u64,
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

        event::emit(EscrowCreated {
            client: client_addr,
            freelancer,
            arbitrator,
            total_locked,
            deadline,
        });
    }

    public fun exists_at(addr: address): bool {
        exists<Escrow>(addr)
    }

    public fun get_total_locked(addr: address): u64 acquires Escrow {
        assert!(exists<Escrow>(addr), 0);
        borrow_global<Escrow>(addr).total_locked
    }
}

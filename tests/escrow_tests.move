#[test_only]
module escrow_addr::escrow_tests {
    use aptos_framework::account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use std::signer;
    use std::vector;

    use escrow_addr::escrow;

    /// Error codes matching escrow module for expected failure tests
    const ENOT_AUTHORIZED: u64 = 7;
    const EDISPUTED: u64 = 8;
    const EDEADLINE_NOT_REACHED: u64 = 12;
    const EDISPUTE_TIMEOUT_NOT_REACHED: u64 = 15;

    fun setup_test(
        aptos_framework: &signer,
        client: &signer,
        freelancer1: &signer,
        freelancer2: &signer,
        arbitrator: &signer,
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);

        let client_addr = signer::address_of(client);
        let f1_addr = signer::address_of(freelancer1);
        let f2_addr = signer::address_of(freelancer2);
        let arbitrator_addr = signer::address_of(arbitrator);

        account::create_account_for_test(client_addr);
        account::create_account_for_test(f1_addr);
        account::create_account_for_test(f2_addr);
        account::create_account_for_test(arbitrator_addr);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        coin::register<AptosCoin>(client);
        coin::register<AptosCoin>(freelancer1);
        coin::register<AptosCoin>(freelancer2);
        coin::register<AptosCoin>(arbitrator);

        let coins = coin::mint<AptosCoin>(5000, &mint_cap);
        coin::deposit(client_addr, coins);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, client = @0x123, f1 = @0x456, f2 = @0x789, arbitrator = @0xAAA)]
    public fun test_multiple_simultaneous_escrows(
        aptos_framework: &signer,
        client: &signer,
        f1: &signer,
        f2: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, f1, f2, arbitrator);

        let client_addr = signer::address_of(client);
        let f1_addr = signer::address_of(f1);
        let f2_addr = signer::address_of(f2);
        let arbitrator_addr = signer::address_of(arbitrator);

        let m1 = vector::empty<u64>();
        vector::push_back(&mut m1, 300);
        let m2 = vector::empty<u64>();
        vector::push_back(&mut m2, 400);
        let m3 = vector::empty<u64>();
        vector::push_back(&mut m3, 500);

        // Create 3 simultaneous escrows for client
        escrow::create_escrow(client, f1_addr, arbitrator_addr, m1, 1000);
        escrow::create_escrow(client, f2_addr, arbitrator_addr, m2, 1000);
        escrow::create_escrow(client, f1_addr, arbitrator_addr, m3, 1000);

        assert!(escrow::exists_at(client_addr, 1), 1);
        assert!(escrow::exists_at(client_addr, 2), 2);
        assert!(escrow::exists_at(client_addr, 3), 3);

        assert!(escrow::get_total_locked(client_addr, 1) == 300, 4);
        assert!(escrow::get_total_locked(client_addr, 2) == 400, 5);
        assert!(escrow::get_total_locked(client_addr, 3) == 500, 6);

        // Approve milestone on escrow 2 only
        escrow::approve_milestone(client, client_addr, 2);

        assert!(coin::balance<AptosCoin>(f2_addr) == 400, 7);
        assert!(!escrow::exists_at(client_addr, 2), 8);
        assert!(escrow::exists_at(client_addr, 1), 9);
        assert!(escrow::exists_at(client_addr, 3), 10);
    }

    #[test(aptos_framework = @0x1, client = @0x123, f1 = @0x456, f2 = @0x789, arbitrator = @0xAAA)]
    public fun test_dispute_timeout_auto_resolution(
        aptos_framework: &signer,
        client: &signer,
        f1: &signer,
        f2: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, f1, f2, arbitrator);

        let client_addr = signer::address_of(client);
        let f1_addr = signer::address_of(f1);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 1000);

        escrow::create_escrow(client, f1_addr, arbitrator_addr, milestones, 1000);

        // Freelancer raises dispute
        escrow::raise_dispute(f1, client_addr, 1);
        assert!(escrow::is_disputed(client_addr, 1), 1);

        // Fast forward 7 days (604,800 seconds) past dispute_deadline
        timestamp::fast_forward_seconds(604805);

        // Freelancer claims timeout resolution (50/50 fallback)
        escrow::claim_timeout_resolution(f1, client_addr, 1);

        // 1000 locked: client gets 500 back (4000 initial remaining + 500 = 4500), freelancer gets 500
        assert!(coin::balance<AptosCoin>(client_addr) == 4500, 2);
        assert!(coin::balance<AptosCoin>(f1_addr) == 500, 3);
        assert!(!escrow::exists_at(client_addr, 1), 4);
    }

    #[test(aptos_framework = @0x1, client = @0x123, f1 = @0x456, f2 = @0x789, arbitrator = @0xAAA)]
    #[expected_failure(abort_code = EDISPUTE_TIMEOUT_NOT_REACHED, location = escrow_addr::escrow)]
    public fun test_dispute_timeout_fails_before_deadline(
        aptos_framework: &signer,
        client: &signer,
        f1: &signer,
        f2: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, f1, f2, arbitrator);

        let client_addr = signer::address_of(client);
        let f1_addr = signer::address_of(f1);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 1000);

        escrow::create_escrow(client, f1_addr, arbitrator_addr, milestones, 1000);
        escrow::raise_dispute(f1, client_addr, 1);

        // Attempting claim immediately before 7 days -> aborts
        escrow::claim_timeout_resolution(f1, client_addr, 1);
    }

    #[test(aptos_framework = @0x1, client = @0x123, f1 = @0x456, f2 = @0x789, arbitrator = @0xAAA)]
    public fun test_flexible_refund_after_partial_milestone_payment(
        aptos_framework: &signer,
        client: &signer,
        f1: &signer,
        f2: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, f1, f2, arbitrator);

        let client_addr = signer::address_of(client);
        let f1_addr = signer::address_of(f1);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 300);
        vector::push_back(&mut milestones, 700);

        escrow::create_escrow(client, f1_addr, arbitrator_addr, milestones, 1000);

        // Approve milestone 1 (300 paid to freelancer, 700 remaining locked)
        escrow::approve_milestone(client, client_addr, 1);
        assert!(coin::balance<AptosCoin>(f1_addr) == 300, 1);
        assert!(escrow::get_remaining_funds(client_addr, 1) == 700, 2);

        // Fast forward past deadline (1000)
        timestamp::fast_forward_seconds(1005);

        // Client refunds remaining unapproved milestone funds (700)
        escrow::refund(client, client_addr, 1);

        assert!(coin::balance<AptosCoin>(client_addr) == 4700, 3); // 4000 after 1000 deposit + 700 refund = 4700
        assert!(!escrow::exists_at(client_addr, 1), 4);
    }
}

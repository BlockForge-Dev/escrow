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
    const EMILESTONES_ALREADY_APPROVED: u64 = 13;

    fun setup_test(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        account::create_account_for_test(client_addr);
        account::create_account_for_test(freelancer_addr);
        account::create_account_for_test(arbitrator_addr);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        coin::register<AptosCoin>(client);
        coin::register<AptosCoin>(freelancer);
        coin::register<AptosCoin>(arbitrator);

        let coins = coin::mint<AptosCoin>(1000, &mint_cap);
        coin::deposit(client_addr, coins);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    public fun test_create_and_approve_all_milestones(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 300);
        vector::push_back(&mut milestones, 200);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);

        assert!(escrow::exists_at(client_addr), 1);
        assert!(escrow::get_next_milestone(client_addr) == 0, 2);

        // Approve 1st milestone (300)
        escrow::approve_milestone(client, client_addr);
        assert!(coin::balance<AptosCoin>(freelancer_addr) == 300, 3);
        assert!(escrow::get_next_milestone(client_addr) == 1, 4);
        assert!(escrow::get_remaining_funds(client_addr) == 200, 5);

        // Approve 2nd milestone (200) - completes escrow and deletes resource
        escrow::approve_milestone(client, client_addr);
        assert!(coin::balance<AptosCoin>(freelancer_addr) == 500, 6);
        assert!(!escrow::exists_at(client_addr), 7);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    #[expected_failure(abort_code = ENOT_AUTHORIZED, location = escrow_addr::escrow)]
    public fun test_only_client_can_approve(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 500);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);

        // Freelancer attempts to approve -> aborts with ENOT_AUTHORIZED
        escrow::approve_milestone(freelancer, client_addr);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    public fun test_dispute_and_resolution(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 500);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);

        // Freelancer raises dispute
        escrow::raise_dispute(freelancer, client_addr);
        assert!(escrow::is_disputed(client_addr), 1);

        // Arbitrator resolves dispute: 200 to client, 300 to freelancer
        escrow::resolve_dispute(arbitrator, client_addr, 200, 300);

        assert!(coin::balance<AptosCoin>(client_addr) == 700, 2); // 500 remaining + 200 resolved
        assert!(coin::balance<AptosCoin>(freelancer_addr) == 300, 3);
        assert!(!escrow::exists_at(client_addr), 4);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    #[expected_failure(abort_code = EDISPUTED, location = escrow_addr::escrow)]
    public fun test_dispute_blocks_approval(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 500);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);
        escrow::raise_dispute(client, client_addr);

        // Client attempts approval while disputed -> aborts with EDISPUTED
        escrow::approve_milestone(client, client_addr);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    public fun test_refund_after_deadline_success(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 500);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);

        // Advance time past deadline (1000)
        timestamp::fast_forward_seconds(1005);

        // Client requests refund
        escrow::refund(client, client_addr);

        assert!(coin::balance<AptosCoin>(client_addr) == 1000, 1);
        assert!(!escrow::exists_at(client_addr), 2);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    #[expected_failure(abort_code = EDEADLINE_NOT_REACHED, location = escrow_addr::escrow)]
    public fun test_refund_fails_before_deadline(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 500);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);

        // Try refund before deadline (current time is 0 < 1000)
        escrow::refund(client, client_addr);
    }

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    #[expected_failure(abort_code = EMILESTONES_ALREADY_APPROVED, location = escrow_addr::escrow)]
    public fun test_refund_fails_if_milestone_approved(
        aptos_framework: &signer,
        client: &signer,
        freelancer: &signer,
        arbitrator: &signer,
    ) {
        setup_test(aptos_framework, client, freelancer, arbitrator);

        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let arbitrator_addr = signer::address_of(arbitrator);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 250);
        vector::push_back(&mut milestones, 250);

        escrow::create_escrow(client, freelancer_addr, arbitrator_addr, milestones, 1000);

        // Approve 1st milestone
        escrow::approve_milestone(client, client_addr);

        // Fast forward past deadline
        timestamp::fast_forward_seconds(1005);

        // Refund fails because next_milestone > 0
        escrow::refund(client, client_addr);
    }

    #[test]
    public fun test_get_total() {
        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 100);
        vector::push_back(&mut milestones, 250);
        vector::push_back(&mut milestones, 150);
        assert!(escrow::get_total(&milestones) == 500, 0);
    }
}

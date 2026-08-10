#[test_only]
module escrow_addr::escrow_tests {
    use aptos_framework::account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use std::signer;
    use std::vector;

    use escrow_addr::escrow;

    #[test(aptos_framework = @0x1, client = @0x123, freelancer = @0x456, arbitrator = @0x789)]
    public fun test_create_escrow_success(
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
        let coins = coin::mint<AptosCoin>(1000, &mint_cap);
        coin::deposit(client_addr, coins);

        let initial_balance = coin::balance<AptosCoin>(client_addr);
        assert!(initial_balance == 1000, 0);

        let milestones = vector::empty<u64>();
        vector::push_back(&mut milestones, 300);
        vector::push_back(&mut milestones, 200);

        let deadline = 1000;

        escrow::create_escrow(
            client,
            freelancer_addr,
            arbitrator_addr,
            milestones,
            deadline,
        );

        assert!(escrow::exists_at(client_addr), 1);

        let final_balance = coin::balance<AptosCoin>(client_addr);
        assert!(final_balance == 500, 2);
        assert!(escrow::get_total_locked(client_addr) == 500, 3);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
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

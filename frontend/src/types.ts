export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'local';

export type EscrowRole = 'client' | 'freelancer' | 'arbitrator' | 'guest';

export interface EscrowResource {
  client: string;
  freelancer: string;
  arbitrator: string;
  milestones: string[];
  next_milestone: string;
  total_locked: string;
  deadline: string;
  disputed: boolean;
  funds: {
    value: string;
  };
}

export interface EscrowItem {
  address: string;
  resource: EscrowResource;
  role: EscrowRole;
}

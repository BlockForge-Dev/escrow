import type { NetworkType } from './types';

export const DEFAULT_MODULE_ADDRESS = '0x2b2c1988fb1d3688b16d480b7eff6a3d62133a789de1d34f81a5aea7e5fdac05';

export const NETWORK_NODE_URLS: Record<NetworkType, string> = {
  mainnet: 'https://api.mainnet.aptoslabs.com/v1',
  testnet: 'https://api.testnet.aptoslabs.com/v1',
  devnet: 'https://api.devnet.aptoslabs.com/v1',
  local: 'http://127.0.0.1:8080/v1',
};

export const OCTA = 100000000; // 1 APT = 10^8 Octas

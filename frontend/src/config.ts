import type { NetworkType } from './types';

export const DEFAULT_MODULE_ADDRESS = '0x9738830421e09f651a3c66afa6acf1c028a60a02dfbbfce348cf03c02fd04540';

export const NETWORK_NODE_URLS: Record<NetworkType, string> = {
  mainnet: 'https://api.mainnet.aptoslabs.com/v1',
  testnet: 'https://api.testnet.aptoslabs.com/v1',
  devnet: 'https://api.devnet.aptoslabs.com/v1',
  local: 'http://127.0.0.1:8080/v1',
};

export const OCTA = 100000000; // 1 APT = 10^8 Octas

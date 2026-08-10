import type { NetworkType } from './types';

export const DEFAULT_MODULE_ADDRESS = '0x3c6b0ded4b64efe9693eedab0e4a2b1dd073662bcecbd3b5a975370b5db644d0';

export const NETWORK_NODE_URLS: Record<NetworkType, string> = {
  mainnet: 'https://api.mainnet.aptoslabs.com/v1',
  testnet: 'https://api.testnet.aptoslabs.com/v1',
  devnet: 'https://api.devnet.aptoslabs.com/v1',
  local: 'http://127.0.0.1:8080/v1',
};

export const OCTA = 100000000; // 1 APT = 10^8 Octas

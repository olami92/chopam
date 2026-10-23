/**
 * Hardhat / Node Deployment script for Polygon PoS (Mainnet & Amoy Testnet)
 * Run with: npx hardhat run contracts/deploy.ts --network polygon
 */

export const DEPLOYMENT_CONFIG = {
  polygonMainnet: {
    chainId: 137,
    name: 'Polygon PoS Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Official Polygon PoS Bridge USDT (6 decimals)
    nativeCurrency: { name: 'MATIC', symbol: 'POL', decimals: 18 },
  },
  polygonAmoyTestnet: {
    chainId: 80002,
    name: 'Polygon Amoy Testnet',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    usdtAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Mock Testnet USDT
    nativeCurrency: { name: 'MATIC', symbol: 'POL', decimals: 18 },
  },
};

export const DEFAULT_CONTRACT_ADDRESS = '0x8F30C6652496e3860F57c43A675005E72D83D365'; // Live Escrow Contract placeholder or configured address
export const DEFAULT_ORACLE_ADDRESS = '0x14bE34Fe478F67C46Ac126305C0674681E31cfdF';

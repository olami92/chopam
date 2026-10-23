import { ethers } from 'ethers';

export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CHAIN_ID_HEX = '0x89'; // 137 in hex
export const AMOY_CHAIN_ID = 80002;
export const AMOY_CHAIN_ID_HEX = '0x13882';

export const POLYGON_CONFIG = {
  chainId: POLYGON_CHAIN_ID,
  chainIdHex: POLYGON_CHAIN_ID_HEX,
  chainName: 'Polygon Mainnet',
  rpcUrls: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  blockExplorerUrls: ['https://polygonscan.com'],
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Polygon USDT
  escrowContractAddress: '0x8F30C6652496e3860F57c43A675005E72D83D365', // SkillPlay Escrow on Polygon
};

// USDT Standard ERC-20 Minimal ABI
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

// SkillPlay Escrow ABI
export const ESCROW_ABI = [
  'function usdtToken() view returns (address)',
  'function oracle() view returns (address)',
  'function feeTreasury() view returns (address)',
  'function userBalances(address user) view returns (uint256)',
  'function processedSettlements(bytes32 matchId) view returns (bool)',
  'function userWithdrawNonces(address user) view returns (uint256)',
  'function deposit(uint256 amount) external',
  'function executeWithdrawal(address user, uint256 netAmount, uint256 platformFee, uint256 nonce) external',
  'function settleMatch(bytes32 matchId, address winner, address loser, uint256 payoutAmount, uint256 platformFee) external',
  'event Deposited(address indexed user, uint256 amount, uint256 newBalance, uint256 timestamp)',
  'event Withdrawn(address indexed user, uint256 amount, uint256 fee, uint256 nonce, uint256 timestamp)',
  'event MatchSettled(bytes32 indexed matchId, address indexed winner, address indexed loser, uint256 payoutAmount, uint256 platformFee)',
];

export interface Web3WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  usdtBalance: string;
  contractDepositedBalance: string;
  isCorrectNetwork: boolean;
}

/**
 * Switch or add Polygon PoS Network in user's Web3 Provider (MetaMask/Trust/OKX)
 */
export async function switchToPolygonNetwork(): Promise<boolean> {
  const ethereum = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
  if (!ethereum) return false;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: unknown) {
    // 4902 error code means the chain has not been added to MetaMask
    if ((switchError as { code?: number })?.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: POLYGON_CHAIN_ID_HEX,
              chainName: POLYGON_CONFIG.chainName,
              rpcUrls: POLYGON_CONFIG.rpcUrls,
              blockExplorerUrls: POLYGON_CONFIG.blockExplorerUrls,
              nativeCurrency: POLYGON_CONFIG.nativeCurrency,
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Polygon network:', addError);
        return false;
      }
    }
    console.error('Failed to switch to Polygon network:', switchError);
    return false;
  }
}

/**
 * Fetch on-chain USDT balance and Escrow Vault deposited balance for an account
 */
export async function fetchOnChainBalances(
  accountAddress: string
): Promise<{ usdtBalance: string; contractBalance: string }> {
  try {
    const ethereum = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    let provider: ethers.Provider;

    if (ethereum) {
      provider = new ethers.BrowserProvider(ethereum);
    } else {
      provider = new ethers.JsonRpcProvider(POLYGON_CONFIG.rpcUrls[0]);
    }

    const usdtContract = new ethers.Contract(POLYGON_CONFIG.usdtAddress, ERC20_ABI, provider);
    const escrowContract = new ethers.Contract(POLYGON_CONFIG.escrowContractAddress, ESCROW_ABI, provider);

    const [rawUsdtBalance, rawEscrowBalance] = await Promise.all([
      usdtContract.balanceOf(accountAddress).catch(() => BigInt(0)),
      escrowContract.userBalances(accountAddress).catch(() => BigInt(0)),
    ]);

    // USDT on Polygon uses 6 decimals
    const usdtBalance = ethers.formatUnits(rawUsdtBalance, 6);
    const contractBalance = ethers.formatUnits(rawEscrowBalance, 6);

    return { usdtBalance, contractBalance };
  } catch (error) {
    console.warn('Could not read balances directly from RPC:', error);
    return { usdtBalance: '0.00', contractBalance: '0.00' };
  }
}

/**
 * Execute on-chain deposit flow:
 * 1. Check & Approve USDT to Escrow Contract
 * 2. Call Escrow.deposit(amount)
 */
export async function depositPolygonUsdt(
  amountUsdt: number,
  onStatusUpdate?: (status: string) => void
): Promise<{ txHash: string; success: boolean }> {
  const ethereum = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
  if (!ethereum) {
    throw new Error('No EVM wallet detected. Please install MetaMask, OKX Wallet, or use Telegram Web3.');
  }

  // Ensure network is Polygon
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  if (Number(network.chainId) !== POLYGON_CHAIN_ID && Number(network.chainId) !== AMOY_CHAIN_ID) {
    onStatusUpdate?.('Switching network to Polygon PoS...');
    const switched = await switchToPolygonNetwork();
    if (!switched) {
      throw new Error('Please switch your wallet network to Polygon Mainnet to complete deposit.');
    }
  }

  // 6 decimals for USDT
  const amountUnits = ethers.parseUnits(amountUsdt.toFixed(2), 6);
  const userAddress = await signer.getAddress();

  const usdtContract = new ethers.Contract(POLYGON_CONFIG.usdtAddress, ERC20_ABI, signer);
  const escrowContract = new ethers.Contract(POLYGON_CONFIG.escrowContractAddress, ESCROW_ABI, signer);

  // 1. Check Allowance
  onStatusUpdate?.('Checking USDT spending allowance...');
  const currentAllowance: bigint = await usdtContract.allowance(userAddress, POLYGON_CONFIG.escrowContractAddress).catch(() => BigInt(0));

  if (currentAllowance < amountUnits) {
    onStatusUpdate?.('Step 1/2: Approving USDT for Smart Contract...');
    // Approve slightly more or exact amount
    const approveTx = await usdtContract.approve(POLYGON_CONFIG.escrowContractAddress, amountUnits);
    onStatusUpdate?.('Waiting for approval transaction confirmation on Polygon...');
    await approveTx.wait(1);
  }

  // 2. Deposit into Escrow Contract
  onStatusUpdate?.('Step 2/2: Confirming Smart Escrow Vault Deposit...');
  const depositTx = await escrowContract.deposit(amountUnits);
  onStatusUpdate?.('Confirming deposit on Polygon blockchain...');
  const receipt = await depositTx.wait(1);

  return {
    txHash: receipt?.hash || depositTx.hash,
    success: true,
  };
}

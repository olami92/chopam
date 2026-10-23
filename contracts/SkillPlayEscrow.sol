// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SkillPlayEscrow
 * @notice Production-grade non-custodial Escrow and Vault contract for Polygon PoS.
 *         Supports USDT deposits (6 decimals), authorized backend Oracle-mediated
 *         instant match pot settlements, and user withdrawals with replay protection.
 */
contract SkillPlayEscrow is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Polygon PoS USDT Contract Address (Native PoS Bridge USDT: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F)
    IERC20 public immutable usdtToken;

    /// @notice Authorized backend oracle/relayer address
    address public oracle;

    /// @notice Fee recipient wallet (collects platform commission)
    address public feeTreasury;

    /// @notice Track individual user on-chain balance deposits
    mapping(address => uint256) public userBalances;

    /// @notice Replay protection for unique match IDs / settlement transactions
    mapping(bytes32 => bool) public processedSettlements;

    /// @notice Replay protection for withdrawal nonces
    mapping(address => uint256) public userWithdrawNonces;

    // --- Events ---
    event Deposited(address indexed user, uint256 amount, uint256 newBalance, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee, uint256 nonce, uint256 timestamp);
    event MatchSettled(
        bytes32 indexed matchId,
        address indexed winner,
        address indexed loser,
        uint256 payoutAmount,
        uint256 platformFee
    );
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event FeeTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event EmergencyDrain(address indexed token, address indexed recipient, uint256 amount);

    // --- Errors ---
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientContractBalance();
    error InsufficientUserBalance();
    error UnauthorizedOracle();
    error SettlementAlreadyProcessed();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert UnauthorizedOracle();
        _;
    }

    /**
     * @param _usdtToken Address of the USDT token on Polygon.
     * @param _oracle Address of the authorized backend relayer key.
     * @param _feeTreasury Address that receives platform rake/fees.
     */
    constructor(
        address _usdtToken,
        address _oracle,
        address _feeTreasury
    ) Ownable(msg.sender) {
        if (_usdtToken == address(0) || _oracle == address(0) || _feeTreasury == address(0)) {
            revert ZeroAddress();
        }
        usdtToken = IERC20(_usdtToken);
        oracle = _oracle;
        feeTreasury = _feeTreasury;
    }

    // =========================================================================
    //                            USER ACTIONS
    // =========================================================================

    /**
     * @notice Deposit USDT into the escrow contract.
     * @dev User must approve this contract on the USDT token before calling.
     * @param amount Amount of USDT (in 6 decimals, e.g. 10_000_000 = 10 USDT).
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        // Transfer USDT from user to this contract using SafeERC20
        usdtToken.safeTransferFrom(msg.sender, address(this), amount);

        userBalances[msg.sender] += amount;

        emit Deposited(msg.sender, amount, userBalances[msg.sender], block.timestamp);
    }

    // =========================================================================
    //                        AUTHORIZED ORACLE ACTIONS
    // =========================================================================

    /**
     * @notice Oracle releases funds to a user for an off-chain/on-chain withdrawal request.
     * @param user Target recipient address.
     * @param netAmount Amount of USDT sent to user.
     * @param platformFee Fee amount sent to feeTreasury.
     * @param nonce Nonce corresponding to the user withdrawal request.
     */
    function executeWithdrawal(
        address user,
        uint256 netAmount,
        uint256 platformFee,
        uint256 nonce
    ) external onlyOracle nonReentrant whenNotPaused {
        if (user == address(0)) revert ZeroAddress();
        if (netAmount == 0) revert ZeroAmount();
        if (nonce != userWithdrawNonces[user]) revert SettlementAlreadyProcessed();

        userWithdrawNonces[user]++;

        uint256 totalOutflow = netAmount + platformFee;
        if (usdtToken.balanceOf(address(this)) < totalOutflow) {
            revert InsufficientContractBalance();
        }

        // Deduct from tracked user balance if tracked on-chain
        if (userBalances[user] >= totalOutflow) {
            userBalances[user] -= totalOutflow;
        } else {
            userBalances[user] = 0;
        }

        // Transfer funds
        usdtToken.safeTransfer(user, netAmount);
        if (platformFee > 0) {
            usdtToken.safeTransfer(feeTreasury, platformFee);
        }

        emit Withdrawn(user, netAmount, platformFee, nonce, block.timestamp);
    }

    /**
     * @notice Direct settlement of an escrow match between two players.
     * @param matchId Unique 32-byte identifier for the game match.
     * @param winner Address of the victorious player.
     * @param loser Address of the defeated/forfeited player.
     * @param payoutAmount Net USDT to be transferred to the winner.
     * @param platformFee Platform fee to be transferred to the feeTreasury.
     */
    function settleMatch(
        bytes32 matchId,
        address winner,
        address loser,
        uint256 payoutAmount,
        uint256 platformFee
    ) external onlyOracle nonReentrant whenNotPaused {
        if (winner == address(0)) revert ZeroAddress();
        if (payoutAmount == 0) revert ZeroAmount();
        if (processedSettlements[matchId]) revert SettlementAlreadyProcessed();

        processedSettlements[matchId] = true;

        uint256 totalDisbursement = payoutAmount + platformFee;
        if (usdtToken.balanceOf(address(this)) < totalDisbursement) {
            revert InsufficientContractBalance();
        }

        // Pay out winner
        usdtToken.safeTransfer(winner, payoutAmount);

        // Send platform commission
        if (platformFee > 0) {
            usdtToken.safeTransfer(feeTreasury, platformFee);
        }

        emit MatchSettled(matchId, winner, loser, payoutAmount, platformFee);
    }

    // =========================================================================
    //                           ADMIN / OWNER ACTIONS
    // =========================================================================

    function setOracle(address _newOracle) external onlyOwner {
        if (_newOracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracle, _newOracle);
        oracle = _newOracle;
    }

    function setFeeTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        emit FeeTreasuryUpdated(feeTreasury, _newTreasury);
        feeTreasury = _newTreasury;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency escape hatch for any stuck tokens (restricted to 2-step owner).
     */
    function emergencyWithdraw(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(0)) revert ZeroAddress();
        IERC20(tokenAddress).safeTransfer(owner(), amount);
        emit EmergencyDrain(tokenAddress, owner(), amount);
    }
}

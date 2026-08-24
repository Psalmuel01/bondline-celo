// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {BondlineMath} from "./BondlineMath.sol";

/// @title Circle
/// @notice One friend group's Circle — its roster, its cosign threshold, and its
///         shared Pot. Deployed as an EIP-1167 minimal-proxy clone by
///         CircleFactory, so every Circle has a real, distinct contract address
///         it can point to and share — "our own Circle", not a row in a shared
///         mapping.
///
///         A Circle holds only three things: who's in the group (fixed at
///         creation), the group's cosign threshold, and the CELO Pot that
///         accumulates from members' crossed Bonds. All value-moving calls are
///         gated to the single BondlineCore that orchestrates Bonds and cosigns —
///         the Circle itself has no opinion on how CELO arrives or leaves, which
///         keeps each clone's attack surface tiny and its state provably isolated
///         from every other Circle.
contract Circle is Initializable {
    using BondlineMath for uint256;

    /// @notice The core authorized to move this Circle's Pot. Set once at init.
    address public core;

    /// @notice Human-readable Circle name (e.g. "Cabo 2026"). Display only.
    string public name;

    /// @notice Per-Circle cosign threshold in basis points, immutable for life.
    ///         Applies to both Bond resolution and Pot payouts.
    uint16 public cosignThresholdBps;

    address[] private _members;
    mapping(address => bool) public isMember;

    error NotCore();
    error AlreadyInitialized();
    error TransferFailed();

    event PotFunded(address indexed from, uint256 amount, uint256 newBalance);
    event PayoutPaid(address indexed to, uint256 amount, uint256 newBalance);

    modifier onlyCore() {
        if (msg.sender != core) revert NotCore();
        _;
    }

    /// @dev Disable initializers on the implementation contract so the logic
    ///      contract behind the clones can never itself be initialized/hijacked.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize a freshly-cloned Circle. Called once by the factory in
    ///         the same tx as the clone deploy. The factory is responsible for
    ///         validating members (>=2, no zero, no duplicates) and the bps
    ///         range; by the time we're here those invariants already hold.
    function initialize(string calldata name_, address[] calldata members_, uint16 cosignThresholdBps_, address core_)
        external
        initializer
    {
        core = core_;
        name = name_;
        cosignThresholdBps = cosignThresholdBps_;
        for (uint256 i = 0; i < members_.length; i++) {
            _members.push(members_[i]);
            isMember[members_[i]] = true;
        }
    }

    /// @notice Receive a crossed Bond's stake from the core into the shared Pot.
    ///         Value is carried by msg.value; the Pot balance is simply this
    ///         contract's CELO balance, so no separate accounting can desync.
    function fundPot() external payable onlyCore {
        emit PotFunded(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Pay out an approved Circle payout. The core enforces that the
    ///         payout cleared this Circle's threshold before calling; the Pot only
    ///         checks it can cover the amount (implicit in the transfer).
    function payout(address to, uint256 amount) external onlyCore {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit PayoutPaid(to, amount, address(this).balance);
    }

    // --- views ---

    function members() external view returns (address[] memory) {
        return _members;
    }

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Cosigns required for an action with `eligibleCosigners` eligible
    ///         members, under this Circle's threshold. Exposed so the core and the
    ///         frontend read identical math from one source.
    function requiredCosigns(uint256 eligibleCosigners) external view returns (uint256) {
        return BondlineMath.requiredCosigns(eligibleCosigners, cosignThresholdBps);
    }
}

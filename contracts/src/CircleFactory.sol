// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Circle} from "./Circle.sol";

/// @title CircleFactory
/// @notice Deploys a fresh Circle clone (EIP-1167 minimal proxy) per friend
///         group, so each group gets its own distinct, shareable contract
///         address in a single transaction. Also serves as the on-chain
///         registry: the frontend reads `allCircles()` / `CircleCreated` events
///         to discover every group with no external indexer.
contract CircleFactory {
    /// @notice The Circle logic contract all clones delegate to.
    address public immutable implementation;

    /// @notice The BondlineCore every Circle authorizes to move its Pot. Wired at
    ///         construction and stamped into each clone at init time.
    address public immutable core;

    address[] private _circles;
    mapping(address => bool) public isCircle;

    uint16 internal constant BPS_DENOMINATOR = 10_000;
    /// @notice Floor on the cosign threshold (10%). Below this a single or zero
    ///         cosign could clear Bonds, gutting the whole point.
    uint16 public constant MIN_THRESHOLD_BPS = 1_000;

    error CircleTooSmall();
    error ZeroMember();
    error DuplicateMember();
    error ThresholdOutOfRange();
    error ZeroAddress();

    event CircleCreated(
        address indexed circle, address indexed creator, string name, address[] members, uint16 cosignThresholdBps
    );

    constructor(address core_, address implementation_) {
        if (core_ == address(0) || implementation_ == address(0)) revert ZeroAddress();
        core = core_;
        implementation = implementation_;
    }

    /// @notice Create a new Circle. Validates the member set and threshold, clones
    ///         the Circle implementation, and initializes it in one tx.
    /// @param name_ human-readable group name (display only)
    /// @param members_ fixed member list, >=2, no zero address, no duplicates
    /// @param cosignThresholdBps_ cosign bar in bps, [1000, 10000]
    /// @return circle the address of the newly deployed Circle clone
    function createCircle(string calldata name_, address[] calldata members_, uint16 cosignThresholdBps_)
        external
        returns (address circle)
    {
        if (members_.length < 2) revert CircleTooSmall();
        if (cosignThresholdBps_ < MIN_THRESHOLD_BPS || cosignThresholdBps_ > BPS_DENOMINATOR) {
            revert ThresholdOutOfRange();
        }
        // O(n^2) duplicate/zero check — Circles are tiny, and doing it here keeps
        // the clone's initializer trivial and gas-flat.
        for (uint256 i = 0; i < members_.length; i++) {
            if (members_[i] == address(0)) revert ZeroMember();
            for (uint256 j = i + 1; j < members_.length; j++) {
                if (members_[i] == members_[j]) revert DuplicateMember();
            }
        }

        circle = Clones.clone(implementation);
        Circle(circle).initialize(name_, members_, cosignThresholdBps_, core);

        _circles.push(circle);
        isCircle[circle] = true;

        emit CircleCreated(circle, msg.sender, name_, members_, cosignThresholdBps_);
    }

    // --- registry views ---

    function allCircles() external view returns (address[] memory) {
        return _circles;
    }

    function circleCount() external view returns (uint256) {
        return _circles.length;
    }
}

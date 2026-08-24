// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BondlineMath
/// @notice The cosign-threshold math for Bondline, written once and shared by
///         both the Bond-resolution path and the Pot-payout path so the two can
///         never drift. All rules operate on `eligibleCosigners` — for a Bond
///         that's (Circle members - 1), since the creator can't cosign their own
///         Bond; for a Payout it's the full membership.
library BondlineMath {
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Cosigns needed to clear the bar, given the eligible cosigner count
    ///         and a basis-point threshold. Rounds UP (a 50% bar in a 3-cosigner
    ///         Circle needs 2, not 1) and is floored at 1 so a Bond can never
    ///         clear on zero cosigns, even at a 0-ish threshold or an empty
    ///         eligible set.
    /// @dev ceil(eligibleCosigners * bps / 10000) = (e*bps + 9999) / 10000.
    ///      eligibleCosigners is bounded by Circle size (validated small on
    ///      creation), so e*bps cannot overflow uint256.
    function requiredCosigns(uint256 eligibleCosigners, uint16 bps) internal pure returns (uint256) {
        uint256 needed = (eligibleCosigners * bps + (BPS_DENOMINATOR - 1)) / BPS_DENOMINATOR;
        return needed == 0 ? 1 : needed;
    }

    /// @notice True once the confirming side has cleared the bar — the trigger to
    ///         resolve a Bond as met without waiting out the window.
    function isCleared(uint256 cosigns, uint256 required) internal pure returns (bool) {
        return cosigns >= required;
    }

    /// @notice True once clearing the bar is mathematically impossible — every
    ///         cosigner who hasn't already objected could confirm and still fall
    ///         short. This is the early-cross trigger: a doomed Bond shouldn't
    ///         make the Circle wait out the full window.
    /// @dev remaining possible confirmations = eligibleCosigners - objections.
    ///      Unreachable when that maximum can't meet the bar.
    function isUnreachable(uint256 eligibleCosigners, uint256 objections, uint256 required)
        internal
        pure
        returns (bool)
    {
        return eligibleCosigners - objections < required;
    }
}

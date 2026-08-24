// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BondlineCore} from "../src/BondlineCore.sol";
import {Circle} from "../src/Circle.sol";
import {CircleFactory} from "../src/CircleFactory.sol";

contract BondlineCoreTest is Test {
    BondlineCore core;
    CircleFactory factory;
    address circleImpl;

    // a 4-member Circle at 50% -> eligible cosigners 3, required cosigns 2
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address stranger = makeAddr("stranger");
    address payable vendor = payable(makeAddr("vendor"));

    function setUp() public {
        circleImpl = address(new Circle());
        core = new BondlineCore();
        factory = new CircleFactory(address(core), circleImpl);
        core.setFactory(address(factory));

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(dave, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    // --- helpers ---

    function _circle(uint16 bps, address[] memory members) internal returns (address) {
        return factory.createCircle("Test Circle", members, bps);
    }

    function _four(uint16 bps) internal returns (address) {
        address[] memory m = new address[](4);
        m[0] = alice;
        m[1] = bob;
        m[2] = carol;
        m[3] = dave;
        return _circle(bps, m);
    }

    function _openBond(address circle, address who, uint256 stake) internal returns (uint256 id) {
        vm.prank(who);
        id = core.openBond{value: stake}(circle, "ship it", uint64(block.timestamp + 1 days));
    }

    function _declare(uint256 id, address who) internal {
        vm.prank(who);
        core.declareDone(id, keccak256("receipts"), "ipfs://receipts");
    }

    function _status(uint256 id) internal view returns (BondlineCore.Status s) {
        (,,,,, s,,,,,) = core.bonds(id);
    }

    // --- wiring ---

    function test_setFactory_isWriteOnce() public {
        vm.expectRevert(BondlineCore.FactoryAlreadySet.selector);
        core.setFactory(address(0xBEEF));
    }

    function test_setFactory_onlyDeployer() public {
        BondlineCore fresh = new BondlineCore();
        vm.prank(stranger);
        vm.expectRevert(BondlineCore.OnlyDeployer.selector);
        fresh.setFactory(address(factory));
    }

    // --- factory / clones ---

    function test_factory_createsDistinctClones() public {
        address c1 = _four(5000);
        address c2 = _four(5000);
        assertTrue(c1 != c2, "clones must be distinct addresses");
        assertTrue(factory.isCircle(c1));
        assertTrue(factory.isCircle(c2));
        assertEq(factory.circleCount(), 2);
    }

    function test_factory_rejectsDuplicateMember() public {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = alice;
        vm.expectRevert(CircleFactory.DuplicateMember.selector);
        _circle(5000, m);
    }

    function test_factory_rejectsThresholdOutOfRange() public {
        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;
        vm.expectRevert(CircleFactory.ThresholdOutOfRange.selector);
        _circle(999, m); // below 10%
        vm.expectRevert(CircleFactory.ThresholdOutOfRange.selector);
        _circle(10001, m); // above 100%
    }

    function test_factory_rejectsTooSmall() public {
        address[] memory m = new address[](1);
        m[0] = alice;
        vm.expectRevert(CircleFactory.CircleTooSmall.selector);
        _circle(5000, m);
    }

    function test_clone_cannotBeReinitialized() public {
        address circle = _four(5000);
        address[] memory m = new address[](2);
        m[0] = stranger;
        m[1] = alice;
        vm.expectRevert();
        Circle(circle).initialize("hijack", m, 5000, address(core));
    }

    // --- Bond creation ---

    function test_open_revertsForNonMember() public {
        address circle = _four(5000);
        vm.prank(stranger);
        vm.expectRevert(BondlineCore.NotCircleMember.selector);
        core.openBond{value: 1 ether}(circle, "x", uint64(block.timestamp + 1 days));
    }

    function test_open_revertsForUnknownCircle() public {
        vm.prank(alice);
        vm.expectRevert(BondlineCore.UnknownCircle.selector);
        core.openBond{value: 1 ether}(address(0xdead), "x", uint64(block.timestamp + 1 days));
    }

    // --- cosigning: early clear ---

    function test_earlyClear_resolvesWithoutWaitingWindow() public {
        address circle = _four(5000); // eligible 3, required 2
        uint256 id = _openBond(circle, alice, 2 ether);
        _declare(id, alice);

        uint256 balBefore = alice.balance;
        vm.prank(bob);
        core.cosign(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.PendingCosign)); // 1/2, still open

        vm.prank(carol);
        core.cosign(id); // clears bar at 2/2 -> resolves NOW

        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Met));
        assertEq(alice.balance, balBefore + 2 ether);
        // window never expired; resolution happened purely on hitting the bar
        assertLt(block.timestamp, core.COSIGN_WINDOW());
    }

    // --- cosigning: early cross ---

    function test_earlyCross_resolvesWhenBarUnreachable() public {
        address circle = _four(5000); // eligible 3, required 2
        uint256 id = _openBond(circle, alice, 2 ether);
        _declare(id, alice);

        vm.prank(bob);
        core.object(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.PendingCosign)); // 1 objection, still reachable

        vm.prank(carol);
        core.object(id); // 2 objections -> only 1 possible confirm left < 2 -> cross NOW

        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Crossed));
        assertEq(Circle(circle).balance(), 2 ether);
    }

    function test_singleObjection_doesNotAutoKill_unlike_unanimous() public {
        address circle = _four(5000); // required 2, eligible 3
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);

        vm.prank(bob);
        core.object(id); // one objection
        // still pending: unlike the old unanimous model, one objection doesn't kill it
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.PendingCosign));

        vm.prank(carol);
        core.cosign(id);
        vm.prank(dave);
        core.cosign(id); // 2 confirms -> cleared despite the earlier objection
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Met));
    }

    // --- cosigning: expiry ---
    // Note: because cosign auto-clears the instant the bar is met, a Bond can
    // only survive to expiry if it never cleared the bar — so resolveExpired in
    // practice always crosses. Its clear branch (resolve on cosigns >= required
    // at close) is kept as defensive code but is unreachable under early-clear.
    // "Both directions" of resolution are covered by the early-clear and
    // early-cross tests above; expiry itself only crosses.

    function test_expiry_crossesWhenUnderBarAtClose() public {
        address circle = _four(5000); // required 2
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(bob);
        core.cosign(id); // 1 confirm, below bar, window left to run

        vm.warp(block.timestamp + core.COSIGN_WINDOW() + 1);
        // 1 < 2 at close -> crosses (under threshold resolves against creator)
        core.resolveExpired(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Crossed));
        assertEq(Circle(circle).balance(), 1 ether);
    }

    function test_expiry_crossesOnSilence() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        // nobody cosigns
        vm.warp(block.timestamp + core.COSIGN_WINDOW() + 1);
        core.resolveExpired(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Crossed));
    }

    function test_expiry_10pctCircleClearsOnOneCosign() public {
        address circle = _four(1000); // 10%: eligible 3, required 1
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(bob);
        // a single confirm already clears required=1 -> auto-clears immediately
        core.cosign(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Met));
    }

    function test_crossMissed_afterDeadlineWithoutDeclaration() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 2 ether);
        // creator never declares; deadline passes
        vm.warp(block.timestamp + 2 days);
        // permissionless — a non-member can even trigger it
        vm.prank(stranger);
        core.crossMissed(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Crossed));
        assertEq(Circle(circle).balance(), 2 ether);
    }

    function test_crossMissed_revertsBeforeDeadline() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        vm.expectRevert(BondlineCore.DeadlineNotReached.selector);
        core.crossMissed(id);
    }

    function test_crossMissed_revertsIfAlreadyPending() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice); // now PendingCosign, not Active
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(BondlineCore.NotActive.selector);
        core.crossMissed(id);
    }

    function test_resolveExpired_revertsWhileWindowOpen() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.expectRevert(BondlineCore.CosignStillOpen.selector);
        core.resolveExpired(id);
    }

    // --- cosigning: access control ---

    function test_creatorCannotCosign() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(alice);
        vm.expectRevert(BondlineCore.CreatorCannotCosign.selector);
        core.cosign(id);
    }

    function test_nonMemberCannotCosign() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(stranger);
        vm.expectRevert(BondlineCore.NotCircleMember.selector);
        core.cosign(id);
    }

    function test_doubleCosignReverts() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(bob);
        core.cosign(id);
        vm.prank(bob);
        vm.expectRevert(BondlineCore.AlreadyResponded.selector);
        core.cosign(id);
    }

    function test_declare_onlyCreatorBeforeDeadline() public {
        address circ = _four(5000);
        uint256 id = _openBond(circ, alice, 1 ether);

        vm.prank(bob);
        vm.expectRevert(BondlineCore.NotCreator.selector);
        core.declareDone(id, bytes32(0), "");

        vm.warp(block.timestamp + 2 days); // past deadline
        vm.prank(alice);
        vm.expectRevert(BondlineCore.DeadlinePassed.selector);
        core.declareDone(id, bytes32(0), "");
    }

    function test_declare_requiresReceipt() public {
        address circle = _four(5000);
        uint256 id = _openBond(circle, alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(BondlineCore.ReceiptRequired.selector);
        core.declareDone(id, bytes32(0), "https://example.com/receipt");

        vm.prank(alice);
        vm.expectRevert(BondlineCore.ReceiptRequired.selector);
        core.declareDone(id, keccak256("receipt"), "");
    }

    // --- 2-member and 100% edge Circles ---

    function test_twoMemberCircle_50pct() public {
        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;
        address circle = _circle(5000, m); // eligible 1, required 1
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(bob);
        core.cosign(id); // single eligible cosigner confirms -> done
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Met));
    }

    function test_100pctCircle_requiresAll() public {
        address circle = _four(10000); // eligible 3, required 3
        uint256 id = _openBond(circle, alice, 1 ether);
        _declare(id, alice);
        vm.prank(bob);
        core.cosign(id);
        vm.prank(carol);
        core.cosign(id);
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.PendingCosign)); // 2/3
        vm.prank(dave);
        core.cosign(id); // 3/3
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Met));
    }

    // --- clone isolation ---

    function test_isolation_crossCreditsOnlyOwningCircle() public {
        address circleA = _four(5000);
        address[] memory m2 = new address[](2);
        m2[0] = alice;
        m2[1] = bob;
        address circleB = _circle(5000, m2);

        uint256 id = _openBond(circleA, alice, 3 ether);
        _declare(id, alice);
        vm.prank(bob);
        core.object(id);
        vm.prank(carol);
        core.object(id); // object -> funds circleA only

        assertEq(Circle(circleA).balance(), 3 ether);
        assertEq(Circle(circleB).balance(), 0, "circleB must be untouched");
    }

    function test_isolation_directCircleCallsRevert() public {
        address circle = _four(5000);
        // Only the core may move a Circle's Pot — direct calls from anyone else
        // (member or not) revert, so one Circle can't be drained out of band.
        vm.prank(alice);
        vm.expectRevert(Circle.NotCore.selector);
        Circle(circle).payout(vendor, 1 ether);

        vm.prank(alice);
        vm.expectRevert(Circle.NotCore.selector);
        Circle(circle).fundPot{value: 1 ether}();
    }

    function test_isolation_nonMemberOfOtherCircleCannotOpen() public {
        address circleA = _four(5000);
        address[] memory m2 = new address[](2);
        m2[0] = stranger;
        m2[1] = bob;
        address circleB = _circle(5000, m2);
        assertTrue(circleA != circleB);

        // carol is in circleA but not circleB -> can't open against circleB
        vm.prank(carol);
        vm.expectRevert(BondlineCore.NotCircleMember.selector);
        core.openBond{value: 1 ether}(circleB, "x", uint64(block.timestamp + 1 days));
    }

    // --- payouts ---

    function _fund(address circle, uint256 amount) internal {
        uint256 id = _openBond(circle, alice, amount);
        _declare(id, alice);
        // Object from each non-creator member, stopping the moment the Bond
        // early-crosses and forfeits — otherwise a later cosign hits an already
        // resolved Bond (NotPending). Which cosign is decisive depends on the
        // Circle threshold, so we drive it dynamically rather than hard-coding.
        address[3] memory cosigners = [bob, carol, dave];
        for (uint256 i = 0; i < cosigners.length; i++) {
            if (_status(id) != BondlineCore.Status.PendingCosign) break;
            vm.prank(cosigners[i]);
            core.object(id);
        }
        assertEq(uint256(_status(id)), uint256(BondlineCore.Status.Crossed));
        assertEq(Circle(circle).balance(), amount);
    }

    function test_payout_executesAtThreshold() public {
        address circle = _four(5000); // payouts: eligible = full membership 4, required ceil(2)=2
        _fund(circle, 4 ether);

        vm.prank(alice);
        uint256 pid = core.proposePayout(circle, vendor, 4 ether, "group dinner");
        // proposer auto-cosigned (1/2), not yet executed
        assertEq(vendor.balance, 0);

        vm.prank(bob);
        core.cosignPayout(pid); // 2/2 -> executes
        assertEq(vendor.balance, 4 ether);
        assertEq(Circle(circle).balance(), 0);
    }

    function test_payout_nonMemberCannotPropose() public {
        address circle = _four(5000);
        _fund(circle, 2 ether);
        vm.prank(stranger);
        vm.expectRevert(BondlineCore.NotCircleMember.selector);
        core.proposePayout(circle, vendor, 1 ether, "x");
    }

    function test_payout_overBalanceReverts() public {
        address circle = _four(5000);
        _fund(circle, 1 ether);
        vm.prank(alice);
        vm.expectRevert(BondlineCore.InsufficientPotBalance.selector);
        core.proposePayout(circle, vendor, 2 ether, "too much");
    }

    function test_payout_doubleCosignReverts() public {
        address circle = _four(10000); // required = all 4, so it stays open after proposer
        _fund(circle, 2 ether);
        vm.prank(alice);
        uint256 pid = core.proposePayout(circle, vendor, 2 ether, "trip");
        vm.prank(alice);
        vm.expectRevert(BondlineCore.AlreadyCosignedPayout.selector);
        core.cosignPayout(pid);
    }

    // --- reentrancy ---

    function test_refundReentrancyGuarded() public {
        ReentrantCreator attacker = new ReentrantCreator(core);
        vm.deal(address(attacker), 10 ether);
        address[] memory m = new address[](2);
        m[0] = address(attacker);
        m[1] = bob;
        address circle = _circle(5000, m); // eligible 1, required 1

        uint256 id = attacker.open{value: 2 ether}(circle);
        vm.prank(address(attacker));
        core.declareDone(id, keccak256("receipt"), "ipfs://receipt");
        attacker.arm(id);

        // bob confirms -> refund fires to attacker, which re-enters on receive.
        // nonReentrant makes the whole resolution revert rather than double-pay.
        vm.prank(bob);
        vm.expectRevert();
        core.cosign(id);
    }
}

/// @dev Attacker that re-enters the core when it receives its stake refund.
contract ReentrantCreator {
    BondlineCore private immutable core;
    uint256 private armedId;
    bool private armed;

    constructor(BondlineCore _core) {
        core = _core;
    }

    function open(address circle) external payable returns (uint256) {
        return core.openBond{value: msg.value}(circle, "x", uint64(block.timestamp + 1 days));
    }

    function arm(uint256 id) external {
        armedId = id;
        armed = true;
    }

    receive() external payable {
        if (armed) {
            armed = false;
            // try to re-enter a resolving path
            core.resolveExpired(armedId);
        }
    }
}

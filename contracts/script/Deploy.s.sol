// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BondlineCore} from "../src/BondlineCore.sol";
import {Circle} from "../src/Circle.sol";
import {CircleFactory} from "../src/CircleFactory.sol";

/// @notice Deploys the Bondline stack and wires it:
///   1. Circle implementation (the clone template — never used directly)
///   2. BondlineCore (holds all escrow + cosign state)
///   3. CircleFactory (clones Circles, pointed at the core + implementation)
///   4. core.setFactory(factory) — write-once link so the core trusts the
///      factory's Circle registry.
///
/// Run against Celo Sepolia:
///   forge script script/Deploy.s.sol --rpc-url celo_sepolia --broadcast
contract Deploy is Script {
    function run() external returns (BondlineCore core, CircleFactory factory, Circle circleImpl) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        circleImpl = new Circle();
        core = new BondlineCore();
        factory = new CircleFactory(address(core), address(circleImpl));
        core.setFactory(address(factory));

        vm.stopBroadcast();

        console2.log("Circle implementation:", address(circleImpl));
        console2.log("BondlineCore:", address(core));
        console2.log("CircleFactory:", address(factory));
        console2.log("");
        console2.log("web/.env.local:");
        console2.log("NEXT_PUBLIC_CORE_ADDRESS=", address(core));
        console2.log("NEXT_PUBLIC_CIRCLE_FACTORY_ADDRESS=", address(factory));
    }
}

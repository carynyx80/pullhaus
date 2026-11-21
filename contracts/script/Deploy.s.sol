// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockPULL} from "../src/MockPULL.sol";
import {MockVRFCoordinator} from "../src/MockVRFCoordinator.sol";
import {PullhausCards} from "../src/PullhausCards.sol";
import {PullhausRewards} from "../src/PullhausRewards.sol";
import {PullhausPacks} from "../src/PullhausPacks.sol";
import {PullhausMarketplace} from "../src/PullhausMarketplace.sol";
import {PullhausForge} from "../src/PullhausForge.sol";
import {CardMath} from "../src/libraries/CardMath.sol";
import {IVRFCoordinatorV2Plus} from "../src/interfaces/IVRFCoordinatorV2Plus.sol";

/// @notice Deploys Pullhaus to Anvil, BSC testnet, opBNB testnet, or BSC mainnet.
/// Chainlink VRF v2.5 is required on BSC (56) and BSC testnet (97) unless ALLOW_MOCK_VRF=true.
/// opBNB has no published VRF v2.5 coordinator; the mock is allowed on opBNB testnet (5611) and Anvil.
contract Deploy is Script {
    struct Cfg {
        uint256 pk;
        address admin;
        address treasury;
        address indexer;
        address keeper;
        address pull;
        bool useDead;
        address vrf;
        bytes32 keyHash;
        uint256 subId;
        bool nativePayment;
        uint16 confirmations;
        uint32 gasLimit;
        bool allowMock;
        bool localTools;
        bool mockVrf;
        bool mockToken;
        uint256 t1;
        uint256 t2;
        uint256 t3;
        uint256 t4;
        uint256 mythic;
        uint64 duration;
        string baseURI;
    }

    struct Suite {
        PullhausCards cards;
        PullhausRewards rewards;
        PullhausPacks packs;
        PullhausMarketplace market;
        PullhausForge forge;
    }

    function run() external {
        Cfg memory c = _load();
        Suite memory s = _deploy(c);
        _rolesAndConfig(c, s);
        _log(c, s);
        _write(c, s);
    }

    function _load() internal view returns (Cfg memory c) {
        c.pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(c.pk);
        c.admin = vm.envOr("ADMIN_ADDRESS", deployer);
        c.treasury = vm.envOr("TREASURY_ADDRESS", c.admin);
        c.indexer = vm.envOr("INDEXER_ADDRESS", deployer);
        c.keeper = vm.envOr("KEEPER_ADDRESS", deployer);
        c.pull = vm.envOr("PULL_TOKEN", address(0));
        c.useDead = vm.envOr("PULL_BURN_TO_DEAD", false);
        c.vrf = vm.envOr("VRF_COORDINATOR", address(0));
        c.keyHash = vm.envOr("VRF_KEY_HASH", bytes32(0));
        c.subId = vm.envOr("VRF_SUB_ID", uint256(0));
        c.nativePayment = vm.envOr("VRF_NATIVE_PAYMENT", true);
        c.confirmations = uint16(vm.envOr("VRF_CONFIRMATIONS", uint256(3)));
        c.gasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS", uint256(2_000_000)));
        bool defaultAllow = block.chainid == 31337 || block.chainid == 5611;
        c.allowMock = vm.envOr("ALLOW_MOCK_VRF", defaultAllow);
        c.localTools = block.chainid == 31337;
        c.baseURI = vm.envOr("BASE_URI", string("http://127.0.0.1:4181/metadata/"));
        _tiers(c);
    }

    function _tiers(Cfg memory c) internal view {
        c.t1 = 100 ether;
        c.t2 = 300 ether;
        c.t3 = 800 ether;
        c.t4 = 2_000 ether;
        c.mythic = 500 ether;
        c.duration = 1 hours;
        if (block.chainid != 31337) {
            c.t1 = 1_000 ether;
            c.t2 = 10_000 ether;
            c.t3 = 50_000 ether;
            c.t4 = 200_000 ether;
            c.mythic = 25_000 ether;
            c.duration = 7 days;
        }
        if (vm.envExists("TIER1")) c.t1 = vm.envUint("TIER1");
        if (vm.envExists("TIER2")) c.t2 = vm.envUint("TIER2");
        if (vm.envExists("TIER3")) c.t3 = vm.envUint("TIER3");
        if (vm.envExists("TIER4")) c.t4 = vm.envUint("TIER4");
        if (vm.envExists("MYTHIC_BURN")) c.mythic = vm.envUint("MYTHIC_BURN");
        if (vm.envExists("EPOCH_DURATION")) c.duration = uint64(vm.envUint("EPOCH_DURATION"));
    }

    function _deploy(Cfg memory c) internal returns (Suite memory s) {
        vm.startBroadcast(c.pk);
        if (c.pull == address(0)) {
            c.pull = address(new MockPULL());
            c.mockToken = true;
            c.useDead = false;
        }
        c.mockVrf = c.vrf == address(0);
        if (c.mockVrf) {
            require(c.allowMock, "VRF_COORDINATOR required (ALLOW_MOCK_VRF=true deploys the insecure mock)");
            c.vrf = address(new MockVRFCoordinator(c.keeper, true));
            if (c.keyHash == bytes32(0)) c.keyHash = bytes32(uint256(1));
            if (c.subId == 0) c.subId = 1;
        }
        s.cards = new PullhausCards(c.admin, c.baseURI);
        s.rewards = new PullhausRewards(c.admin, c.pull, c.localTools);
        s.packs = new PullhausPacks(c.admin, c.pull, address(s.cards), address(s.rewards), c.treasury, c.vrf, c.useDead);
        s.market = new PullhausMarketplace(c.admin, c.pull, address(s.cards), address(s.rewards), c.treasury, c.useDead);
        s.forge = new PullhausForge(c.admin, c.pull, address(s.cards), address(s.rewards), c.treasury, c.useDead);
        vm.stopBroadcast();
    }

    function _rolesAndConfig(Cfg memory c, Suite memory s) internal {
        vm.startBroadcast(c.pk);
        s.cards.grantRole(s.cards.MINTER_ROLE(), address(s.packs));
        s.cards.grantRole(s.cards.MINTER_ROLE(), address(s.forge));
        s.cards.grantRole(s.cards.FORGE_ROLE(), address(s.forge));
        s.cards.grantRole(s.cards.INDEXER_ROLE(), c.indexer);
        s.rewards.grantRole(s.rewards.GAME_ROLE(), address(s.packs));
        s.rewards.grantRole(s.rewards.GAME_ROLE(), address(s.market));
        s.rewards.grantRole(s.rewards.GAME_ROLE(), address(s.forge));
        s.rewards.setTierThresholds(c.t1, c.t2, c.t3, c.t4);
        s.rewards.startEpoch(c.duration);
        s.packs.setVrf(c.keyHash, c.subId, c.confirmations, c.gasLimit, c.nativePayment);
        s.packs.setOdds(CardMath.Odds({common: 6200, rare: 2600, epic: 1000, legendary: 200, mythic: 0}));
        _packs(s.packs);
        s.forge.setCosts(50 ether, 75 ether, c.mythic);
        if (!c.mockVrf && vm.envOr("VRF_ADD_CONSUMER", false)) {
            IVRFCoordinatorV2Plus(c.vrf).addConsumer(c.subId, address(s.packs));
        }
        vm.stopBroadcast();
    }

    function _packs(PullhausPacks packs) internal {
        packs.setPack(1, "Ember Slip", 100 ether, 1, 1, 0, 0, 0, true);
        packs.setPack(2, "Atelier Five", 450 ether, 5, 1, 0, 0, 0, true);
        packs.setPack(3, "Gilded Hour", 250 ether, 1, 2, 3, 0, 0, true);
        packs.setPack(4, "First Light", 150 ether, 1, 3, 0, uint64(block.timestamp + 1 days), 1 days, true);
    }

    function _log(Cfg memory c, Suite memory s) internal view {
        console2.log("chainId", block.chainid);
        console2.log("pull", c.pull);
        console2.log("cards", address(s.cards));
        console2.log("rewards", address(s.rewards));
        console2.log("packs", address(s.packs));
        console2.log("marketplace", address(s.market));
        console2.log("forge", address(s.forge));
        console2.log("vrf", c.vrf);
        console2.log("mockVrf", c.mockVrf);
        console2.log("admin", c.admin);
        console2.log("indexer", c.indexer);
        console2.log("keeper", c.keeper);
    }

    function _write(Cfg memory c, Suite memory s) internal {
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "pull", c.pull);
        vm.serializeAddress(obj, "cards", address(s.cards));
        vm.serializeAddress(obj, "rewards", address(s.rewards));
        vm.serializeAddress(obj, "packs", address(s.packs));
        vm.serializeAddress(obj, "marketplace", address(s.market));
        vm.serializeAddress(obj, "forge", address(s.forge));
        vm.serializeAddress(obj, "vrfCoordinator", c.vrf);
        vm.serializeAddress(obj, "admin", c.admin);
        vm.serializeAddress(obj, "indexer", c.indexer);
        vm.serializeAddress(obj, "keeper", c.keeper);
        vm.serializeAddress(obj, "treasury", c.treasury);
        vm.serializeBool(obj, "mockVrf", c.mockVrf);
        vm.serializeBool(obj, "mockToken", c.mockToken);
        vm.serializeUint(obj, "blockNumber", block.number);
        string memory out = vm.serializeBool(obj, "localTools", c.localTools);
        vm.writeJson(out, "./deployments/local.json");
    }
}

/// @notice Run after the deployer owns a funded VRF v2.5 subscription.
contract AddConsumer is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address coordinator = vm.envAddress("VRF_COORDINATOR");
        uint256 subId = vm.envUint("VRF_SUB_ID");
        address packs = vm.envAddress("PACKS_ADDRESS");
        vm.startBroadcast(pk);
        IVRFCoordinatorV2Plus(coordinator).addConsumer(subId, packs);
        vm.stopBroadcast();
    }
}

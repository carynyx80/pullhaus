// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MockPULL} from "../src/MockPULL.sol";
import {MockVRFCoordinator} from "../src/MockVRFCoordinator.sol";
import {PullhausCards} from "../src/PullhausCards.sol";
import {PullhausRewards} from "../src/PullhausRewards.sol";
import {PullhausPacks} from "../src/PullhausPacks.sol";
import {PullhausMarketplace} from "../src/PullhausMarketplace.sol";
import {PullhausForge} from "../src/PullhausForge.sol";
import {CardMath} from "../src/libraries/CardMath.sol";
import {PullSettle} from "../src/libraries/PullSettle.sol";
import {VRFConsumerBase} from "../src/VRFConsumerBase.sol";

contract EvilPull is ERC20 {
    address public hookTarget;
    bytes public hookData;
    bool public armed;

    constructor() ERC20("Evil Pull", "EVIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function arm(address target, bytes calldata data) external {
        hookTarget = target;
        hookData = data;
        armed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        _hook();
        return ok;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        bool ok = super.transferFrom(from, to, amount);
        _hook();
        return ok;
    }

    function _hook() internal {
        if (!armed) return;
        armed = false;
        (bool ok, bytes memory reason) = hookTarget.call(hookData);
        if (!ok) {
            assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
    }
}

contract PullhausTest is Test {
    uint64 internal constant WEEK = 7 days;

    MockPULL internal pull;
    MockVRFCoordinator internal coord;
    PullhausCards internal cards;
    PullhausRewards internal rewards;
    PullhausPacks internal packs;
    PullhausMarketplace internal market;
    PullhausForge internal forge;

    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal indexer = makeAddr("indexer");

    function setUp() public {
        pull = new MockPULL();
        (coord, cards, rewards, packs, market, forge) = _wire(address(this), address(pull), treasury, false);

        cards.grantRole(cards.INDEXER_ROLE(), indexer);
        rewards.grantRole(rewards.GAME_ROLE(), address(this));

        packs.setPack(1, "Ember Slip", 100 ether, 1, 1, 0, 0, 0, true);
        packs.setPack(2, "Atelier Five", 450 ether, 5, 1, 0, 0, 0, true);
        packs.setPack(3, "Gilded Hour", 250 ether, 1, 2, 3, 0, 0, true);
        packs.setPack(4, "First Light", 150 ether, 1, 3, 0, uint64(block.timestamp + 1 days), 1 days, true);
        forge.setCosts(50 ether, 75 ether, 1_000 ether);
        rewards.startEpoch(WEEK);

        _fund(alice);
        _fund(bob);
    }

    function test_burnMath_exactSplit() public {
        uint256 supplyBefore = pull.totalSupply();
        uint256 aliceBefore = pull.balanceOf(alice);
        uint256 rewardsBefore = pull.balanceOf(address(rewards));
        uint256 treasuryBefore = pull.balanceOf(treasury);

        uint256 id = _open(alice, 7);

        assertEq(aliceBefore - pull.balanceOf(alice), 100 ether);
        assertEq(supplyBefore - pull.totalSupply(), 50 ether);
        assertEq(pull.balanceOf(address(rewards)) - rewardsBefore, 30 ether);
        assertEq(pull.balanceOf(treasury) - treasuryBefore, 20 ether);
        assertEq(rewards.lifetimePoints(alice), 50 ether);
        assertEq(rewards.epochPoints(1, alice), 50 ether);
        assertEq(packs.totalBurned(), 50 ether);
        (, , uint256 pool,,,) = rewards.epochs(1);
        assertEq(pool, 30 ether);
        assertTrue(cards.exists(id));
        assertEq(cards.ownerOf(id), alice);
    }

    function test_deadBurn_whenConfigured() public {
        packs.setUseDeadBurn(true);
        uint256 supplyBefore = pull.totalSupply();
        uint256 deadBefore = pull.balanceOf(PullSettle.DEAD);
        _open(alice, 3);
        assertEq(pull.totalSupply(), supplyBefore);
        assertEq(pull.balanceOf(PullSettle.DEAD) - deadBefore, 50 ether);
        assertEq(rewards.lifetimePoints(alice), 50 ether);
    }

    function testFuzz_splitConserves(uint128 price, uint16 rawB, uint16 rawR) public pure {
        uint16 b = rawB % 10_001;
        uint16 r = uint16(uint256(rawR) % (10_001 - b));
        (uint256 burnAmt, uint256 rewardAmt, uint256 treasuryAmt) = PullSettle.amounts(price, b, r);
        assertEq(burnAmt + rewardAmt + treasuryAmt, uint256(price));
    }

    function test_vrf_sealsAttributesUntilReveal() public {
        uint256 id = _open(alice, 42);

        PullhausCards.PublicView memory hidden = cards.publicCard(id);
        assertTrue(hidden.exists);
        assertFalse(hidden.revealed);
        assertEq(hidden.seed, 0);
        assertEq(hidden.rarity, 0);
        assertEq(hidden.atk, 0);
        assertEq(cards.tokenURI(id), string.concat("https://pullhaus.local/metadata/sealed/", vm.toString(id)));

        vm.prank(bob);
        vm.expectRevert(PullhausCards.NotOwner.selector);
        cards.ownerCard(id);

        vm.prank(alice);
        (uint256[] memory ids, PullhausCards.Card[] memory mine) = cards.myCards();
        assertEq(ids.length, 1);
        assertGt(mine[0].seed, 0);
        assertEq(mine[0].level, 1);

        vm.prank(alice);
        PullhausCards.Card memory owned = cards.ownerCard(id);
        bytes32 expected = keccak256(
            abi.encode(id, owned.seed, owned.rarity, owned.atk, owned.def, owned.spd, owned.element, owned.ability, owned.setId)
        );
        assertEq(cards.commitmentOf(id), expected);

        vm.prank(bob);
        vm.expectRevert(PullhausCards.NotOwner.selector);
        cards.reveal(id);

        vm.prank(alice);
        cards.reveal(id);

        PullhausCards.PublicView memory open = cards.publicCard(id);
        assertTrue(open.revealed);
        assertEq(open.seed, owned.seed);
        assertEq(open.rarity, owned.rarity);
        assertEq(open.atk, owned.atk);
        assertEq(cards.tokenURI(id), string.concat("https://pullhaus.local/metadata/", vm.toString(id)));

        vm.prank(alice);
        vm.expectRevert(PullhausCards.AlreadyRevealed.selector);
        cards.reveal(id);
    }

    function test_sealedTransfer_keepsAttributesPrivate() public {
        uint256 id = _open(alice, 5);
        vm.prank(alice);
        cards.transferFrom(alice, bob, id);

        vm.prank(bob);
        PullhausCards.Card memory owned = cards.ownerCard(id);
        assertGt(owned.seed, 0);

        vm.prank(alice);
        vm.expectRevert(PullhausCards.NotOwner.selector);
        cards.ownerCard(id);

        assertEq(cards.publicCard(id).seed, 0);
    }

    function test_packRoll_respectsLegendaryTable() public {
        packs.setOdds(CardMath.Odds({common: 0, rare: 0, epic: 0, legendary: 10_000, mythic: 0}));
        uint256 id = _open(alice, 99);
        vm.prank(alice);
        assertEq(cards.ownerCard(id).rarity, 3);
    }

    function test_defaultOdds_sumAndMythicZero() public pure {
        CardMath.Odds memory odds = CardMath.Odds(6200, 2600, 1000, 200, 0);
        assertEq(CardMath.sum(odds), 10_000);
        for (uint256 i; i < 300; i++) {
            assertLt(CardMath.roll(i + 1, odds), 4);
        }
        CardMath.Odds memory onlyMythic = CardMath.Odds(0, 0, 0, 0, 10_000);
        assertEq(CardMath.roll(123, onlyMythic), 4);
    }

    function test_tierBoost_preservesSum() public pure {
        CardMath.Odds memory odds = CardMath.Odds(6200, 2600, 1000, 200, 0);
        uint16[5] memory boosts;
        boosts[1] = 150;
        boosts[2] = 301;
        CardMath.Odds memory next = CardMath.applyTier(odds, boosts, 2);
        assertEq(CardMath.sum(next), 10_000);
        assertEq(next.common, 6200 - 301);
        assertEq(next.rare, 2600 + 150);
        assertEq(next.epic, 1000 + 90);
        assertEq(next.legendary, 200 + 61);
    }

    function test_derive_ranges() public pure {
        (uint16 atk, uint16 def, uint16 spd, uint8 element, uint16 ability) = CardMath.derive(1, 2);
        assertEq(element, 1);
        assertEq(ability, 3);
        assertEq(atk, 78);
        assertEq(def, 94);
        assertEq(spd, 97);
        assertEq(CardMath.scaled(100, 1), 100);
        assertEq(CardMath.scaled(100, 2), 108);
    }

    function test_tierGate_andEarlyAccess() public {
        vm.prank(alice);
        vm.expectRevert(PullhausPacks.TierLocked.selector);
        packs.openPack(3);

        rewards.accrue(alice, 800 ether);
        assertEq(rewards.tierOf(alice), 3);
        vm.prank(alice);
        packs.openPack(3);

        vm.prank(bob);
        vm.expectRevert(PullhausPacks.TooEarly.selector);
        packs.openPack(4);

        rewards.accrue(bob, 2_000 ether);
        assertEq(rewards.tierOf(bob), 4);
        vm.prank(bob);
        packs.openPack(4);
    }

    function test_rewards_proRata_andSingleClaim() public {
        pull.faucet();
        pull.transfer(address(rewards), 400 ether);
        rewards.notifyFunding(400 ether);
        rewards.accrue(alice, 100 ether);
        rewards.accrue(bob, 300 ether);

        vm.prank(alice);
        vm.expectRevert(PullhausRewards.EpochStillOpen.selector);
        rewards.claim(1);

        uint256 id = rewards.currentEpoch();
        vm.warp(block.timestamp + WEEK);
        rewards.finalizeEpoch(id);

        assertEq(rewards.claimable(id, alice), 100 ether);
        assertEq(rewards.claimable(id, bob), 300 ether);

        vm.prank(alice);
        rewards.claim(id);
        vm.prank(bob);
        rewards.claim(id);
        assertEq(pull.balanceOf(alice), 10_000 ether + 100 ether);
        assertEq(pull.balanceOf(bob), 10_000 ether + 300 ether);

        vm.prank(alice);
        vm.expectRevert(PullhausRewards.AlreadyClaimed.selector);
        rewards.claim(id);
    }

    function test_rewards_roundingDust() public {
        pull.faucet();
        pull.transfer(address(rewards), 100);
        rewards.notifyFunding(100);
        rewards.accrue(alice, 1);
        rewards.accrue(bob, 2);
        uint256 id = rewards.currentEpoch();
        vm.warp(block.timestamp + WEEK);
        rewards.finalizeEpoch(id);
        assertEq(rewards.claimable(id, alice), 33);
        assertEq(rewards.claimable(id, bob), 66);
    }

    function test_season_advancesWithoutErasingHistory() public {
        rewards.accrue(alice, 10 ether);
        assertEq(rewards.seasonPoints(1, alice), 10 ether);
        rewards.advanceSeason();
        assertEq(rewards.season(), 2);
        rewards.accrue(alice, 4 ether);
        assertEq(rewards.seasonPoints(1, alice), 10 ether);
        assertEq(rewards.seasonPoints(2, alice), 4 ether);
    }

    function test_debugEndEpoch_localOnly() public {
        uint256 id = rewards.currentEpoch();
        rewards.debugEndEpoch();
        rewards.finalizeEpoch(id);

        PullhausRewards locked = new PullhausRewards(address(this), address(pull), false);
        vm.expectRevert(PullhausRewards.LocalToolsDisabled.selector);
        locked.debugEndEpoch();
    }

    function test_upgrade_andLevelCap() public {
        uint256 keep = _mint(alice, 0, 41);
        uint256 sacrifice = _mint(alice, 0, 42);
        uint256 rare = _mint(alice, 1, 43);

        vm.prank(alice);
        vm.expectRevert(PullhausForge.RarityMismatch.selector);
        forge.upgrade(keep, rare);

        uint256 aliceBefore = pull.balanceOf(alice);
        vm.prank(alice);
        forge.upgrade(keep, sacrifice);
        assertEq(aliceBefore - pull.balanceOf(alice), 50 ether);
        assertFalse(cards.exists(sacrifice));
        vm.prank(alice);
        assertEq(cards.ownerCard(keep).level, 2);
        assertEq(rewards.lifetimePoints(alice), 25 ether);

        cards.grantRole(cards.FORGE_ROLE(), address(this));
        for (uint256 i; i < 18; i++) {
            cards.levelUp(keep);
        }
        vm.expectRevert(PullhausCards.LevelCap.selector);
        cards.levelUp(keep);
    }

    function test_fusion_threeCommons_twoLegendaries_andBigBurn() public {
        uint256[] memory commons = new uint256[](3);
        commons[0] = _mint(alice, 0, 11);
        commons[1] = _mint(alice, 0, 12);
        commons[2] = _mint(alice, 0, 13);
        vm.prank(alice);
        forge.fuse(commons);
        uint256[] memory owned = cards.tokensOfOwner(alice);
        assertEq(owned.length, 1);
        vm.prank(alice);
        assertEq(cards.ownerCard(owned[0]).rarity, 1);
        assertFalse(cards.exists(commons[0]));

        uint256[] memory legs = new uint256[](2);
        legs[0] = _mint(bob, 3, 21);
        legs[1] = _mint(bob, 3, 22);
        vm.prank(bob);
        forge.fuse(legs);
        uint256 mythicId = cards.tokensOfOwner(bob)[0];
        vm.prank(bob);
        assertEq(cards.ownerCard(mythicId).rarity, 4);

        uint256[] memory one = new uint256[](1);
        one[0] = _mint(alice, 3, 31);
        uint256 supplyBefore = pull.totalSupply();
        vm.prank(alice);
        forge.fuse(one);
        assertLt(pull.totalSupply(), supplyBefore);
        uint256[] memory aliceIds = cards.tokensOfOwner(alice);
        bool found;
        for (uint256 i; i < aliceIds.length; i++) {
            vm.prank(alice);
            if (cards.ownerCard(aliceIds[i]).rarity == 4) found = true;
        }
        assertTrue(found);

        uint256[] memory bad = new uint256[](1);
        bad[0] = _mint(bob, 0, 32);
        vm.prank(bob);
        vm.expectRevert(PullhausForge.BadInput.selector);
        forge.fuse(bad);
    }

    function test_fiveCardPack_fitsCallbackGas() public {
        vm.prank(alice);
        uint256 req = packs.openPack(2);
        uint256[] memory words = new uint256[](1);
        words[0] = 123456;
        uint256 before = gasleft();
        coord.fulfill(req, words);
        uint256 used = before - gasleft();
        assertLt(used, 2_000_000);
        assertEq(cards.balanceOf(alice), 5);
        (, , , , , , bool done) = packs.requests(req);
        assertTrue(done);
    }

    function test_marketplace_feeSplit_cancel_andSealed() public {
        uint256 sealedId = _open(alice, 8);
        vm.prank(alice);
        vm.expectRevert(PullhausMarketplace.SealedCard.selector);
        market.list(sealedId, 1 ether);

        vm.prank(alice);
        cards.reveal(sealedId);
        vm.prank(alice);
        market.list(sealedId, 1_000 ether);
        assertEq(cards.ownerOf(sealedId), address(market));

        vm.prank(alice);
        market.cancel(sealedId);
        assertEq(cards.ownerOf(sealedId), alice);

        vm.prank(alice);
        market.list(sealedId, 1_000 ether);

        uint256 bobBefore = pull.balanceOf(bob);
        uint256 aliceBefore = pull.balanceOf(alice);
        uint256 supplyBefore = pull.totalSupply();
        uint256 rewardsBefore = pull.balanceOf(address(rewards));
        uint256 treasuryBefore = pull.balanceOf(treasury);

        vm.prank(bob);
        market.buy(sealedId);

        assertEq(bobBefore - pull.balanceOf(bob), 1_000 ether);
        assertEq(pull.balanceOf(alice) - aliceBefore, 950 ether);
        assertEq(supplyBefore - pull.totalSupply(), 25 ether);
        assertEq(pull.balanceOf(address(rewards)) - rewardsBefore, 15 ether);
        assertEq(pull.balanceOf(treasury) - treasuryBefore, 10 ether);
        assertEq(rewards.lifetimePoints(bob), 25 ether);
        assertEq(cards.ownerOf(sealedId), bob);
        (, , bool active) = market.listings(sealedId);
        assertFalse(active);

        vm.prank(alice);
        vm.expectRevert(PullhausMarketplace.ListingInactive.selector);
        market.buy(sealedId);
    }

    function test_accessControl_andPause() public {
        vm.prank(alice);
        vm.expectRevert();
        packs.setOdds(CardMath.Odds({common: 10_000, rare: 0, epic: 0, legendary: 0, mythic: 0}));

        vm.prank(alice);
        vm.expectRevert();
        packs.pause();

        vm.prank(alice);
        vm.expectRevert();
        rewards.startEpoch(1 days);

        vm.prank(alice);
        vm.expectRevert();
        forge.setCosts(1, 1, 1);

        vm.prank(alice);
        vm.expectRevert();
        cards.mintSealed(alice, 0, 1, 1);

        packs.pause();
        vm.prank(alice);
        vm.expectRevert();
        packs.openPack(1);
        packs.unpause();
        _open(alice, 1);
    }

    function test_onlyCoordinatorCanRawFulfill() public {
        vm.prank(alice);
        uint256 req = packs.openPack(1);
        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(VRFConsumerBase.OnlyCoordinator.selector, bob, address(coord)));
        packs.rawFulfillRandomWords(req, words);
    }

    function test_strangerCannotFulfillMock() public {
        vm.prank(alice);
        uint256 req = packs.openPack(1);
        uint256[] memory words = new uint256[](1);
        words[0] = 5;
        vm.prank(bob);
        vm.expectRevert();
        coord.fulfill(req, words);
        coord.fulfill(req, words);
        vm.expectRevert(abi.encodeWithSelector(MockVRFCoordinator.UnknownRequest.selector, req));
        coord.fulfill(req, words);
    }

    function test_gameCard_indexerOnly() public {
        uint256 id = _mint(alice, 0, 9);
        vm.prank(alice);
        vm.expectRevert(PullhausCards.NotAuthorized.selector);
        cards.gameCard(id);
        vm.prank(indexer);
        assertEq(cards.gameCard(id).level, 1);
    }

    function test_reentrancy_openPack() public {
        EvilPull evil = new EvilPull();
        (, , , PullhausPacks packs_,,) = _wire(address(this), address(evil), treasury, false);
        packs_.setPack(1, "x", 100 ether, 1, 1, 0, 0, 0, true);
        evil.mint(alice, 1_000 ether);
        vm.prank(alice);
        evil.approve(address(packs_), type(uint256).max);
        evil.arm(address(packs_), abi.encodeWithSelector(PullhausPacks.openPack.selector, uint256(1)));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        packs_.openPack(1);
    }

    function test_reentrancy_marketBuy() public {
        EvilPull evil = new EvilPull();
        (, PullhausCards cards_, , , PullhausMarketplace market_,) = _wire(address(this), address(evil), treasury, false);
        cards_.grantRole(cards_.MINTER_ROLE(), address(this));
        uint256 id = cards_.mintSealed(alice, 0, 7, 1);
        vm.prank(alice);
        cards_.reveal(id);
        vm.prank(alice);
        cards_.setApprovalForAll(address(market_), true);
        vm.prank(alice);
        market_.list(id, 100 ether);

        evil.mint(bob, 1_000 ether);
        vm.prank(bob);
        evil.approve(address(market_), type(uint256).max);
        evil.arm(address(market_), abi.encodeWithSelector(PullhausMarketplace.buy.selector, id));
        vm.prank(bob);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        market_.buy(id);
        assertEq(cards_.ownerOf(id), address(market_));
    }

    function test_reentrancy_claim() public {
        EvilPull evil = new EvilPull();
        (, , PullhausRewards rewards_,,,) = _wire(address(this), address(evil), treasury, false);
        rewards_.grantRole(rewards_.GAME_ROLE(), address(this));
        evil.mint(address(rewards_), 100 ether);
        uint256 id = rewards_.startEpoch(WEEK);
        rewards_.notifyFunding(100 ether);
        rewards_.accrue(alice, 100 ether);
        vm.warp(block.timestamp + WEEK);
        rewards_.finalizeEpoch(id);
        evil.arm(address(rewards_), abi.encodeWithSelector(PullhausRewards.claim.selector, id));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        rewards_.claim(id);
        assertFalse(rewards_.claimed(id, alice));
    }

    function _wire(address admin, address token, address treasury_, bool useDead)
        internal
        returns (
            MockVRFCoordinator coord_,
            PullhausCards cards_,
            PullhausRewards rewards_,
            PullhausPacks packs_,
            PullhausMarketplace market_,
            PullhausForge forge_
        )
    {
        coord_ = new MockVRFCoordinator(admin, true);
        cards_ = new PullhausCards(admin, "https://pullhaus.local/metadata/");
        rewards_ = new PullhausRewards(admin, token, true);
        packs_ = new PullhausPacks(admin, token, address(cards_), address(rewards_), treasury_, address(coord_), useDead);
        market_ = new PullhausMarketplace(admin, token, address(cards_), address(rewards_), treasury_, useDead);
        forge_ = new PullhausForge(admin, token, address(cards_), address(rewards_), treasury_, useDead);
        cards_.grantRole(cards_.MINTER_ROLE(), address(packs_));
        cards_.grantRole(cards_.MINTER_ROLE(), address(forge_));
        cards_.grantRole(cards_.FORGE_ROLE(), address(forge_));
        rewards_.grantRole(rewards_.GAME_ROLE(), address(packs_));
        rewards_.grantRole(rewards_.GAME_ROLE(), address(market_));
        rewards_.grantRole(rewards_.GAME_ROLE(), address(forge_));
    }

    function _fund(address user) internal {
        vm.startPrank(user);
        pull.faucet();
        pull.approve(address(packs), type(uint256).max);
        pull.approve(address(market), type(uint256).max);
        pull.approve(address(forge), type(uint256).max);
        cards.setApprovalForAll(address(market), true);
        vm.stopPrank();
    }

    function _open(address user, uint256 word) internal returns (uint256 id) {
        id = cards.nextId();
        vm.prank(user);
        uint256 req = packs.openPack(1);
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        coord.fulfill(req, words);
    }

    function _mint(address to, uint8 rarity, uint256 seed) internal returns (uint256 id) {
        cards.grantRole(cards.MINTER_ROLE(), address(this));
        id = cards.mintSealed(to, rarity, seed, 1);
        cards.revokeRole(cards.MINTER_ROLE(), address(this));
    }
}

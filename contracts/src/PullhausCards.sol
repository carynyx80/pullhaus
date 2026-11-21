// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {CardMath} from "./libraries/CardMath.sol";

/// @title PullhausCards
/// @notice Sealed ERC-721s. Attributes stay out of public getters and mint events until the
/// owner calls `reveal`. This is commit-reveal at the application and ABI layer.
///
/// On a public chain the preimage still lives in contract storage, and Chainlink's fulfillment
/// calldata is public. Treat sealed state as product privacy (indexers, marketplaces, casual
/// reads), not cryptographic privacy. Phase 2 is documented in docs/zk-phase2.md.
contract PullhausCards is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant FORGE_ROLE = keccak256("FORGE_ROLE");
    bytes32 public constant INDEXER_ROLE = keccak256("INDEXER_ROLE");

    uint8 public constant MAX_LEVEL = 20;

    struct Card {
        uint8 rarity;
        uint8 level;
        uint8 element;
        uint16 atk;
        uint16 def;
        uint16 spd;
        uint16 ability;
        uint32 setId;
        bool revealed;
        uint256 seed;
    }

    struct PublicView {
        bool exists;
        bool revealed;
        uint8 rarity;
        uint8 level;
        uint8 element;
        uint16 atk;
        uint16 def;
        uint16 spd;
        uint16 ability;
        uint32 setId;
        uint256 seed;
    }

    uint256 public nextId = 1;
    string public baseURI;
    mapping(uint256 => Card) private _cards;
    mapping(uint256 => bytes32) public commitmentOf;
    mapping(address => uint256[]) private _byOwner;
    mapping(uint256 => uint256) private _indexOf;

    error NotOwner();
    error NotAuthorized();
    error AlreadyRevealed();
    error UnknownCard();
    error LevelCap();
    error ZeroAddress();

    event CardMinted(uint256 indexed tokenId, address indexed to, bytes32 commitment);
    event CardRevealed(
        uint256 indexed tokenId,
        uint8 rarity,
        uint8 element,
        uint8 level,
        uint16 atk,
        uint16 def,
        uint16 spd,
        uint16 ability,
        uint32 setId,
        uint256 seed
    );
    event CardBurned(uint256 indexed tokenId, address indexed from);
    event CardLeveled(uint256 indexed tokenId, uint8 level);
    event BaseURISet(string baseURI);

    constructor(address admin, string memory baseURI_) ERC721("Pullhaus Card", "PULLCARD") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        baseURI = baseURI_;
    }

    function mintSealed(address to, uint8 rarity, uint256 seed, uint32 setId)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ZeroAddress();
        if (rarity > 4) revert UnknownCard();
        tokenId = nextId++;
        (uint16 atk, uint16 def, uint16 spd, uint8 element, uint16 ability) = CardMath.derive(seed, rarity);
        _cards[tokenId] = Card({
            rarity: rarity,
            level: 1,
            element: element,
            atk: atk,
            def: def,
            spd: spd,
            ability: ability,
            setId: setId,
            revealed: false,
            seed: seed
        });
        bytes32 commitment = _commitment(tokenId);
        commitmentOf[tokenId] = commitment;
        _safeMint(to, tokenId);
        emit CardMinted(tokenId, to, commitment);
    }

    function reveal(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        Card storage c = _cards[tokenId];
        if (c.revealed) revert AlreadyRevealed();
        if (_commitment(tokenId) != commitmentOf[tokenId]) revert UnknownCard();
        c.revealed = true;
        emit CardRevealed(tokenId, c.rarity, c.element, c.level, c.atk, c.def, c.spd, c.ability, c.setId, c.seed);
    }

    function _commitment(uint256 tokenId) internal view returns (bytes32) {
        Card storage c = _cards[tokenId];
        return keccak256(abi.encode(tokenId, c.seed, c.rarity, c.atk, c.def, c.spd, c.element, c.ability, c.setId));
    }

    function burnCard(uint256 tokenId) external onlyRole(FORGE_ROLE) {
        _burn(tokenId);
    }

    function levelUp(uint256 tokenId) external onlyRole(FORGE_ROLE) {
        Card storage c = _cards[tokenId];
        if (c.level == 0) revert UnknownCard();
        if (c.level >= MAX_LEVEL) revert LevelCap();
        c.level += 1;
        emit CardLeveled(tokenId, c.level);
    }

    function publicCard(uint256 tokenId) external view returns (PublicView memory v) {
        v.exists = _ownerOf(tokenId) != address(0);
        if (!v.exists) return v;
        Card storage c = _cards[tokenId];
        v.revealed = c.revealed;
        if (!c.revealed) return v;
        v.rarity = c.rarity;
        v.level = c.level;
        v.element = c.element;
        v.atk = c.atk;
        v.def = c.def;
        v.spd = c.spd;
        v.ability = c.ability;
        v.setId = c.setId;
        v.seed = c.seed;
    }

    function ownerCard(uint256 tokenId) external view returns (Card memory) {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        return _cards[tokenId];
    }

    /// @dev Forge and the indexer wallet. `eth_call` can spoof `msg.sender`; this is not a
    /// privacy boundary. See the contract natspec.
    function gameCard(uint256 tokenId) external view returns (Card memory) {
        if (!hasRole(FORGE_ROLE, msg.sender) && !hasRole(INDEXER_ROLE, msg.sender)) revert NotAuthorized();
        return _cards[tokenId];
    }

    function myCards() external view returns (uint256[] memory ids, Card[] memory cards_) {
        ids = _byOwner[msg.sender];
        cards_ = new Card[](ids.length);
        for (uint256 i; i < ids.length; i++) {
            cards_[i] = _cards[ids[i]];
        }
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _byOwner[owner];
    }

    function isRevealed(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) return false;
        return _cards[tokenId].revealed;
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function scaledStats(uint256 tokenId)
        external
        view
        returns (uint16 atk, uint16 def, uint16 spd, uint8 level)
    {
        Card storage c = _cards[tokenId];
        bool open = c.revealed || ownerOf(tokenId) == msg.sender;
        if (!open) return (0, 0, 0, 0);
        level = c.level;
        atk = CardMath.scaled(c.atk, c.level);
        def = CardMath.scaled(c.def, c.level);
        spd = CardMath.scaled(c.spd, c.level);
    }

    function setBaseURI(string calldata next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = next;
        emit BaseURISet(next);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!exists(tokenId)) revert UnknownCard();
        if (!_cards[tokenId].revealed) {
            return string.concat(baseURI, "sealed/", Strings.toString(tokenId));
        }
        return string.concat(baseURI, Strings.toString(tokenId));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0)) _remove(from, tokenId);
        if (to != address(0)) _add(to, tokenId);
        if (to == address(0)) {
            delete _cards[tokenId];
            delete commitmentOf[tokenId];
            emit CardBurned(tokenId, from);
        }
    }

    function _add(address to, uint256 tokenId) internal {
        _indexOf[tokenId] = _byOwner[to].length;
        _byOwner[to].push(tokenId);
    }

    function _remove(address from, uint256 tokenId) internal {
        uint256[] storage arr = _byOwner[from];
        uint256 idx = _indexOf[tokenId];
        uint256 lastId = arr[arr.length - 1];
        arr[idx] = lastId;
        _indexOf[lastId] = idx;
        arr.pop();
        delete _indexOf[tokenId];
    }
}

# Phase 2 — prove a rarity without opening the card

Pullhaus v1 is commit-reveal at the application layer. It is not zero-knowledge. This note is the plan for the version that is.

## What v1 actually hides

- `PullhausCards.publicCard` returns zeros while a card is sealed.
- Mint and pack events emit a commitment and token id, not the seed, rarity, or stats.
- The API serves sealed rows without attributes. `GET /inventory` and `GET /cards/:id/private` require a SIWE session for the owning wallet.
- `reveal` checks the stored commitment and then emits the attributes.

## What v1 cannot hide

Contract storage is public. The seed is written during the VRF callback so the chain can enforce the roll. `eth_getStorageAt` reads it. Chainlink's fulfillment transaction also carries the random word in calldata, and the card seed is `keccak256(word, requestId, index)`. Anyone who watches the coordinator can recompute the card. `gameCard` is role-gated, but `eth_call` can set `from` to the indexer address, so that role is an indexer convenience, not a lock.

Treat v1 privacy as product privacy: marketplaces, the public site, and casual log readers do not see the card. A determined reader of the chain can.

## Target

A holder can prove "this sealed token is at least Epic" (or exactly one rarity, or inside a tier band) without revealing the seed, the other stats, or the art. The proof verifies on BNB Chain. The card stays sealed.

## Sketch

1. **Stop storing the seed in plaintext.** The VRF callback stores only `commitment = keccak256(seed, rarity, stats, nullifier)`. The seed has to reach the owner without landing in calldata. That means the oracle (or a coprocessor sitting next to it) encrypts the opening to the owner's key, or the owner and the contract run a commit where the owner samples the seed inside a proof and the contract only sees the commitment. Chainlink VRF v2.5 does not encrypt outputs. Phase 2 replaces the raw callback with one of:
   - a coprocessor (Brevis, RISC Zero Bonsai, or Succinct) that consumes the VRF word off the public calldata path and posts a proof plus a ciphertext, or
   - owner-supplied entropy committed before the pack is paid, combined with the VRF word inside the proof so neither side can grind alone.
2. **Card opening is a private witness.** The owner holds `(seed, rarity, stats, salt)`. The onchain commitment binds them.
3. **Rarity proof.** A Circom or Noir circuit:
   - checks `commitment == hash(seed, rarity, stats, salt)`,
   - checks `rarity` equals the public claimed rarity (or is in a public minimum band),
   - checks the stats match `CardMath.derive(seed, rarity)` so a holder cannot invent a legendary with common numbers,
   - emits a nullifier `hash(tokenId, secret)` so the same card cannot be proved twice in a gated drop.
4. **Verifier on BNB Chain.** A Groth16 or PLONK verifier (gas-budgeted against BSC's block gas limit) with `verify(tokenId, claimedRarity, nullifier, proof)`. The sealed NFT is the ticket. The proof does not call `reveal`.
5. **What stays off the proof.** Art, name, and lore stay offchain, derived from the seed the owner already has. The public site still shows a back until `reveal`.

## Migration

- New cards go through the proving path. v1 cards can be revealed in the clear or re-wrapped by burning them into a v2 commitment if the owner is willing to publish the old seed once.
- Pack odds, burn accounting, the epoch pool, and the marketplace do not change. The marketplace keeps refusing sealed listings.
- `INDEXER_ROLE` goes away for attribute reads. The indexer only learns a card when it is revealed or when the owner asks the API to store art, still behind SIWE.

## Not in this phase

- Hiding the fact that a wallet opened a pack. The mint is an ERC-721 transfer.
- Private battles. The arena in v1 needs the stats in the clear. A later circuit can prove "A beats B" from two commitments.
- A trusted setup ceremony choice. Pick the proving system after measuring verifier gas on BSC, not before.

## 2024-05-18 - Missing Treasury Account Validation in Anchor Smart Contract
**Vulnerability:** The `tesoreria` account in `programs/casino_solana/src/lib.rs` lacked an `address` constraint. An attacker could pass their own account as `tesoreria` during the `comprar_bloques` instruction and steal the deposited funds, bypassing the intended treasury entirely.
**Learning:** In Solana Anchor smart contracts, constant destination accounts (like treasuries or commission wallets) must have their addresses explicitly validated.
**Prevention:** Always use the `#[account(address = pubkey!("..."))]` constraint for predefined, constant protocol accounts to ensure funds flow only to authorized destinations.

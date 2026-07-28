## 2026-06-28 - [CRITICAL] Missing Address Constraint in Anchor Contract Treasury Wallet

**Vulnerability:** The `ComprarBloque` instruction in the Solana Anchor smart contract (`programs/casino_solana/src/lib.rs`) was accepting any account as the `tesoreria` (treasury) account.

**Learning:** When passing constant destination accounts for protocol funds in Solana smart contracts, you must explicitly validate their address using an `address` constraint (e.g. `#[account(address = pubkey!("..."))]`). Without this, attackers can pass arbitrary public keys (their own addresses) and siphon the deposits. Avoid using the System Program ID as a placeholder for wallets, and use a newly generated, valid keypair instead to prevent issues. Import the macro properly via `use anchor_lang::solana_program::pubkey::pubkey;`.

**Prevention:** Always add strict constraint validation (like `address = ...`) to any account that is expected to receive protocol fees or treasury funds, ensuring that funds go to the intended recipients.

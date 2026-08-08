
## 2024-05-18 - Missing Treasury Account Validation
**Vulnerability:** The `tesoreria` account in the `ComprarBloque` instruction was missing an explicit `address` constraint validation. It only had `/// CHECK: Tesorería del juego` and `#[account(mut)]`.
**Learning:** In Solana smart contracts, accounts representing constant destinations for protocol funds (like treasuries or commission wallets) must explicitly validate their address. Without this, an attacker could supply an arbitrary account they control as the `tesoreria` account and siphon funds because the system program transfer would succeed, but the Anchor program would assume the correct treasury was credited.
**Prevention:** Always use an `address` constraint (e.g., `#[account(address = pubkey!("..."))]`) for accounts that expect a specific, constant public key destination. Rely on `anchor_lang::prelude::*` for the `pubkey!` macro instead of `Pubkey::from_str`.

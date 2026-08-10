## 2025-02-15 - [CRITICAL] Missing Address Validation on Treasury Account
**Vulnerability:** The `tesoreria` account in the `ComprarBloque` instruction lacked an `address` constraint. An attacker could supply an arbitrary account as the treasury and steal the funds intended for the protocol.
**Learning:** In Solana smart contracts, accounts representing constant destinations for protocol funds (like treasuries or commission wallets) must explicitly validate their address using an `address` constraint.
**Prevention:** Always use `#[account(mut, address = pubkey!("..."))]` for accounts that are intended to be fixed protocol wallets to prevent siphoning of funds.

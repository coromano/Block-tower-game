## 2024-07-30 - Arbitrary Account Injection on Constant Destinations
**Vulnerability:** A constant destination account (like `tesoreria`) in the `ComprarBloque` instruction was defined as just an `AccountInfo` with a simple `/// CHECK` and no `address` constraint. This meant attackers could pass any account and siphon game treasury funds.
**Learning:** Constant destinations for protocol funds in Solana Anchor must explicitly validate their address using an `address` constraint.
**Prevention:** Use Anchor's `#[account(address = pubkey!("..."))]` constraint to strictly enforce known, constant addresses. Always import `pubkey` macro via `use anchor_lang::solana_program::pubkey::pubkey;`.

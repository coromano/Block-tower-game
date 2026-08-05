## 2024-05-24 - [Arbitrary Account Destination Vulnerability]
**Vulnerability:** The treasury account (`tesoreria`) in the Anchor smart contract lacked an `address` constraint, allowing attackers to pass any arbitrary account and siphon funds.
**Learning:** Always validate destination accounts for protocol funds using explicit address constraints (e.g., `pubkey!`) to prevent malicious actors from redirecting transfers.
**Prevention:** Use `#[account(address = pubkey!("..."))]` for all constant destination accounts like treasuries or commission wallets.

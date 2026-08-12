## 2026-08-12 - Missing Destination Account Validation Allows Fund Theft
**Vulnerability:** The Anchor smart contract for buying blocks accepts an arbitrary account as the `tesoreria` (treasury) destination without validating its address. This allows users to pass their own wallet as the treasury, effectively giving themselves free blocks by routing the payment back to themselves.
**Learning:** In Solana programs, it is critical to use the `address = pubkey!(...)` constraint on accounts that are constant destinations for protocol funds.
**Prevention:** Always hardcode expected protocol treasury or commission wallets using `address` constraints in the `#[derive(Accounts)]` macro instead of relying only on the client to pass the correct account.

## 2024-08-04 - [CRITICAL] Fix Missing Treasury Address Validation

**Vulnerability:** The Anchor smart contract lacked address validation for the `tesoreria` (treasury) account. Attackers could supply any address, bypassing intended logic and sending funds to their own wallets instead of the protocol treasury. The frontend was also actively supplying the user's `publicKey` as a second purchase call, effectively stealing protocol fees directly.

**Learning:** Accounts representing constant destinations for protocol funds (like treasuries or commission wallets) must explicitly validate their address using an `address` constraint to prevent arbitrary account supply and fund siphoning. The `pubkey!` macro should be used from `anchor_lang::prelude::*`.

**Prevention:** Always add an `address = pubkey!("...")` constraint on accounts acting as payment sinks in Solana Anchor programs. Ensure frontend integration only interacts with intended treasury addresses, and avoid fallback patterns that allow users to intercept fees.

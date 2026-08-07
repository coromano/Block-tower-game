## 2025-08-07 - [CRITICAL] Fix unvalidated treasury account
**Vulnerability:** The Anchor smart contract was accepting any account as the `tesoreria` destination, allowing attackers to siphon funds by providing their own account instead of the protocol's treasury.
**Learning:** Accounts representing constant destinations for protocol funds (like treasuries or commission wallets) must explicitly validate their address using an `address` constraint to prevent arbitrary account injection.
**Prevention:** Always use the `address = pubkey!("...")` constraint on accounts representing static destinations, and avoid using dummy placeholder keys in production.

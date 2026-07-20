## 2024-05-24 - Missing Address Constraint on Protocol Treasury
**Vulnerability:** The Anchor smart contract accepted any arbitrary account as the `tesoreria` (treasury) account during the `comprar_bloques` instruction.
**Learning:** In Solana smart contracts, accounts representing constant destinations for protocol funds (like treasuries or commission wallets) must explicitly validate their address using an `address` constraint to prevent attackers from supplying arbitrary accounts and siphoning funds. Using the Solana System Program ID as a placeholder for wallet keys also poses a critical risk if deployed.
**Prevention:** Always use the `#[account(address = pubkey!("..."))]` macro for constant treasury accounts and avoid using placeholder IDs like the System Program ID.

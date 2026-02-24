"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";


export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // CONFIGURACIÓN CLAVE:
  // Aquí le decimos que NO se conecte a Internet, sino a tu PC (localhost)
  const endpoint = "http://127.0.0.1:8899";

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(), // Soportamos Phantom
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
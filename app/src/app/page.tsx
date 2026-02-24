"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, Idl, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl.json"; 
import GameCanvas, { GameRef, BloqueVivo } from "../components/GameCanvas";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, fetchAllDigitalAssetByOwner } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';

const WalletMultiButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, { ssr: false });
const PROGRAM_ID = new PublicKey("9bygE6GBpYoj6Yz77VEJEy1Rpf59uaWHcdNdzFwbg6Yu"); 

// CHAT (Ahora más alto)
const ChatBox = ({ usuario }: { usuario: string }) => {
    const [mensajes, setMensajes] = useState<{usr: string, txt: string}[]>([{ usr: "System", txt: "Pot is distributing rewards!" }]);
    const [input, setInput] = useState("");
    const endRef = useRef<HTMLDivElement>(null);
    const enviar = () => { if (!input.trim()) return; setMensajes(prev => [...prev, { usr: usuario || "Anon", txt: input }]); setInput(""); };
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);
    return (
        // CAMBIO: Aumenté h-48 a h-64 para llenar mejor el espacio
        <div className="bg-gray-900 border-t border-gray-700 h-64 flex flex-col p-4 rounded-b-xl shadow-2xl">
            <div className="flex-grow overflow-y-auto space-y-2 mb-2 pr-2 scrollbar-thin">
                {mensajes.map((m, i) => (
                    <div key={i} className="text-sm">
                        <span className="font-bold text-purple-400">{m.usr}: </span>
                        <span className="text-gray-300">{m.txt}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
            <div className="flex gap-2">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} placeholder="Type here..." className="flex-grow bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
                <button onClick={enviar} className="bg-purple-600 px-6 py-2 rounded text-sm font-bold hover:bg-purple-500 transition-colors">Send</button>
            </div>
        </div>
    );
};

export default function Home() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const gameRef = useRef<GameRef>(null);

  // GAME STATES
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [bloquesDisponibles, setBloquesDisponibles] = useState(0); 
  const [rankingSupervivencia, setRankingSupervivencia] = useState<BloqueVivo[]>([]);
  const [eventosActivos, setEventosActivos] = useState<string[]>([]);
  
  const rankingRef = useRef<BloqueVivo[]>([]);

  // ECONOMY
  const [saldoBilleteraJuego, setSaldoBilleteraJuego] = useState(0.0000); 
  const [pozoComun, setPozoComun] = useState(10.0000); 
  const [totalInvertido, setTotalInvertido] = useState(0.0000); 
  const [totalGanado, setTotalGanado] = useState(0.0000); 
  
  // Dynamic Cost Logic
  const [montoDeposito, setMontoDeposito] = useState<string>("0.5");
  const [lastLaunchTime, setLastLaunchTime] = useState(0); 
  const [penaltyCount, setPenaltyCount] = useState(0); 
  const [costoActualBloque, setCostoActualBloque] = useState(0.05); 
  const [tiempoRestanteCooldown, setTiempoRestanteCooldown] = useState(0); 

  // Customization
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [zonaElegida, setZonaElegida] = useState(0);
  const [modoPersonalizacion, setModoPersonalizacion] = useState<'color' | 'imagen'>('color');
  const [colorElegido, setColorElegido] = useState("#3B82F6");
  const [letraElegida, setLetraElegida] = useState("ABC");
  const [urlImagen, setUrlImagen] = useState("");
  const [misNFTs, setMisNFTs] = useState<any[]>([]);
  const [cargandoNFTs, setCargandoNFTs] = useState(false);

  useEffect(() => { rankingRef.current = rankingSupervivencia; }, [rankingSupervivencia]);

  // DISTRIBUTION LOGIC
  useEffect(() => {
      const timer = setInterval(() => {
          const currentRanking = rankingRef.current;
          if (pozoComun <= 0.0001 || currentRanking.length === 0) return;
          const porcentajeReparto = 0.01; 
          const montoARepartir = pozoComun * porcentajeReparto;
          const pagoPorBloque = montoARepartir / currentRanking.length;

          if (publicKey && isRegistered) {
              const misBloques = currentRanking.filter(b => b.owner === publicKey.toString());
              if (misBloques.length > 0) {
                  const miGanancia = misBloques.length * pagoPorBloque;
                  setPozoComun(prev => Math.max(0, prev - miGanancia)); 
                  setSaldoBilleteraJuego(prev => prev + miGanancia);    
                  setTotalGanado(prev => prev + miGanancia);            
              }
              const bloquesOtros = currentRanking.length - misBloques.length;
              if (bloquesOtros > 0) {
                  const gananciaOtros = bloquesOtros * pagoPorBloque;
                  setPozoComun(prev => Math.max(0, prev - gananciaOtros));
              }
          }
      }, 1000); 
      return () => clearInterval(timer);
  }, [pozoComun, publicKey, isRegistered]); 

  // DYNAMIC PRICE
  useEffect(() => {
      const timer = setInterval(() => {
          const ahora = Date.now();
          const tiempoPasado = (ahora - lastLaunchTime) / 1000; 
          const PRECIO_BASE = 0.05;
          const TIEMPO_COOLDOWN = 15;
          if (tiempoPasado >= TIEMPO_COOLDOWN) {
              setPenaltyCount(0);
              setCostoActualBloque(PRECIO_BASE); 
              setTiempoRestanteCooldown(0);
          } else {
              const factorTiempo = (TIEMPO_COOLDOWN - tiempoPasado) / TIEMPO_COOLDOWN;
              const penalizacionAcumulada = 0.05 * penaltyCount;
              const costoExtra = penalizacionAcumulada * factorTiempo;
              setCostoActualBloque(PRECIO_BASE + costoExtra);
              setTiempoRestanteCooldown(TIEMPO_COOLDOWN - tiempoPasado);
          }
      }, 50); 
      return () => clearInterval(timer);
  }, [lastLaunchTime, penaltyCount]);

  useEffect(() => { if (publicKey) setLetraElegida(publicKey.toString().slice(0,3).toUpperCase()); }, [publicKey]);
  
  // AUTOMATIC EVENTS LOOP
  useEffect(() => {
    const intervalo = setInterval(() => {
        const nuevos: string[] = [];
        if (Math.random() < 0.15) { gameRef.current?.triggerFloorTrap(); nuevos.push("FLOOR CRACK 🕳️"); }
        if (Math.random() < 0.3) { gameRef.current?.triggerEarthquake(); nuevos.push("EARTHQUAKE 🌍"); }
        if (Math.random() < 0.25) { gameRef.current?.triggerFire(); nuevos.push("FIRE 🔥"); }
        if (Math.random() < 0.2) { gameRef.current?.triggerBlackHole(); nuevos.push("BLACK HOLE ⚫"); }
        if (nuevos.length > 0) { setEventosActivos(prev => [...prev, ...nuevos]); setTimeout(() => setEventosActivos([]), 5000); }
    }, 10000); 
    return () => clearInterval(intervalo);
  }, []);

  // --- FUNCIONES ELIMINADAS: spawnBloqueManual y forzarEvento ya no existen en UI ---

  const cargarMisNFTs = async () => { if (!publicKey) return; setCargandoNFTs(true); try { const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata()); const assets = await fetchAllDigitalAssetByOwner(umi, umiPublicKey(publicKey.toBase58())); const loaded: any[] = []; for (const asset of assets.slice(0, 10)) { if (asset.metadata.uri) { const res = await fetch(asset.metadata.uri); const json = await res.json(); if (json.image) loaded.push({ name: json.name, image: json.image, mint: asset.publicKey }); } } setMisNFTs(loaded); } catch (e) { console.error(e); } finally { setCargandoNFTs(false); } };
  const getProgram = () => { if (!wallet) return null; const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" }); (idl as any).address = PROGRAM_ID.toString(); return new Program(idl as Idl, provider); };
  
  const depositarFondos = async () => {
    if (!publicKey || !wallet) return; const amount = parseFloat(montoDeposito); if (isNaN(amount) || amount <= 0) { setMensaje("Invalid Amount"); setTimeout(() => setMensaje(""), 3000); return; }
    setLoading(true); setMensaje("Processing...");
    try {
      const program = getProgram(); if (!program) return;
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from("jugador"), publicKey.toBuffer()], PROGRAM_ID);
      await program.methods.comprarBloques(new BN(1)).accounts({ jugadorStats: pda, user: publicKey, tesoreria: publicKey, systemProgram: web3.SystemProgram.programId }).rpc();
      setSaldoBilleteraJuego(prev => prev + amount); setMensaje(`Deposit Successful: ${amount} SOL`); setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) { setMensaje("Error: " + error.message); setTimeout(() => setMensaje(""), 3000); } finally { setLoading(false); }
  };

  const lanzarBloque = () => {
      if (!isRegistered) { setMensaje("⚠️ Please register your name first!"); setTimeout(() => setMensaje(""), 3000); return; }
      if (saldoBilleteraJuego < costoActualBloque) { setMensaje("⚠️ Insufficient Funds"); setTimeout(() => setMensaje(""), 3000); return; }
      if (gameRef.current && publicKey) {
          setSaldoBilleteraJuego(prev => prev - costoActualBloque);
          setTotalInvertido(prev => prev + costoActualBloque);
          
          const feeDev = costoActualBloque * 0.01; const aportePozo = costoActualBloque * 0.99; 
          setPozoComun(prev => prev + aportePozo);

          setLastLaunchTime(Date.now());
          setPenaltyCount(prev => prev + 1); 
          
          if (modoPersonalizacion === 'color') gameRef.current.spawnBlock({ tipo: 'color', valor: colorElegido, letra: letraElegida, zona: zonaElegida, owner: publicKey.toString(), userName: nombreUsuario });
          else gameRef.current.spawnBlock({ tipo: 'imagen', valor: urlImagen || 'https://placehold.co/100x100/png', zona: zonaElegida, owner: publicKey.toString(), userName: nombreUsuario });
      }
  };

  const registrarUsuario = () => { if(nombreUsuario.trim().length < 3) { setMensaje("Name too short!"); setTimeout(() => setMensaje(""), 3000); return; } setIsRegistered(true); };
  const retirarFondos = async () => { if(saldoBilleteraJuego <= 0) return; setLoading(true); setTimeout(() => { setMensaje(`Withdrawn ${saldoBilleteraJuego.toFixed(4)} SOL!`); setSaldoBilleteraJuego(0); setTotalInvertido(0); setTotalGanado(0); setLoading(false); setTimeout(() => setMensaje(""), 3000); }, 1500); };
  const inicializarJugador = async () => { if (!publicKey || !wallet) return; setLoading(true); try { const program = getProgram(); if (!program) return; const [pda] = PublicKey.findProgramAddressSync([Buffer.from("jugador"), publicKey.toBuffer()], PROGRAM_ID); await program.methods.inicializarJugador().accounts({ jugadorStats: pda, user: publicKey, systemProgram: web3.SystemProgram.programId }).rpc(); setMensaje("Account Created!"); setTimeout(() => setMensaje(""), 3000); } catch (error: any) { setMensaje("Error: " + error.message); setTimeout(() => setMensaje(""), 3000); } finally { setLoading(false); } };
  const neto = totalGanado - totalInvertido;

  return (
    <main className="flex min-h-screen bg-gray-950 text-white p-4 gap-4 overflow-x-auto">
      
      <div className="flex-1 flex flex-col min-w-[1200px] items-center">
        {/* HEADER */}
        <div className="w-full flex justify-between items-center mb-2 px-4 bg-gray-900/50 p-2 rounded-xl border border-gray-800 backdrop-blur-sm">
             <div className="flex flex-col">
                 <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Casino Block Tower</h1>
                 <div className="flex gap-4 text-xs mt-1 font-mono">
                    <span className="text-gray-400">Invested: <span className="text-red-400">-{totalInvertido.toFixed(4)}</span></span>
                    <span className="text-gray-400">Earned: <span className="text-green-400">+{totalGanado.toFixed(4)}</span></span>
                    <span className="text-gray-400">Net: <span className={`font-bold ${neto >= 0 ? 'text-green-400' : 'text-red-500'}`}>{neto >= 0 ? '+' : ''}{neto.toFixed(4)}</span></span>
                 </div>
             </div>
             <div className="flex flex-col items-center">
                 <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest animate-pulse">🔥 Shared Pot 🔥</div>
                 <div className="text-3xl font-black text-yellow-400 drop-shadow-lg tabular-nums">
                     {pozoComun.toFixed(4)} <span className="text-sm text-yellow-600">SOL</span>
                 </div>
                 <div className="text-[9px] text-gray-500">Payout 1% per sec</div>
             </div>
             <div className="flex gap-4 items-center">
                <div className="bg-gray-800 border border-green-500 px-4 py-1 rounded-lg shadow-lg flex items-center gap-2">
                    <span className="text-xs text-gray-400">BALANCE:</span>
                    <span className="text-xl font-mono font-bold text-green-400">{saldoBilleteraJuego.toFixed(4)}</span>
                </div>
                <WalletMultiButton />
             </div>
        </div>

        <div className="relative">
             <div className="absolute top-10 w-full flex justify-center z-10 pointer-events-none">
                {eventosActivos.length > 0 && (<div className="px-6 py-2 rounded-full border bg-red-900/90 border-red-500 text-white font-bold animate-pulse shadow-xl">⚠️ {eventosActivos.join(" + ")}</div>)}
             </div>
             <GameCanvas ref={gameRef} onReportSurvival={setRankingSupervivencia} />
        </div>

        {/* CHAT BOX (Ancho Completo 1200px) */}
        <div className="w-[1200px] mt-2">
            <ChatBox usuario={isRegistered ? nombreUsuario : "Anon"} />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-80 flex flex-col gap-4 h-screen overflow-y-auto pb-10 sticky top-0">
        
        {!isRegistered && (
            <div className="bg-purple-900 border border-purple-500 p-4 rounded-xl shadow-lg animate-pulse">
                <h2 className="text-sm font-bold text-white mb-2 uppercase">📝 Registration</h2>
                <p className="text-[10px] text-gray-300 mb-2">Choose a unique username to start playing.</p>
                <input type="text" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} className="w-full bg-black border border-purple-400 rounded px-2 py-1 text-white font-bold mb-2 text-xs" placeholder="Username..." />
                <button onClick={registrarUsuario} className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white shadow-lg">REGISTER & PLAY</button>
            </div>
        )}

        <div className={`transition-opacity duration-500 ${isRegistered ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="bg-gray-900 border border-blue-600 p-4 rounded-xl shadow-lg relative overflow-hidden mb-4">
                <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-red-500 to-yellow-500 transition-all duration-100 ease-linear" style={{ width: `${(tiempoRestanteCooldown / 15) * 100}%` }} />
                <h2 className="text-sm font-bold text-white mb-3 uppercase flex justify-between items-center">
                    🏗️ Drop Block
                    {tiempoRestanteCooldown > 0 && <span className="text-[10px] text-red-400 font-bold animate-pulse">HOT 🔥 x{penaltyCount}</span>}
                </h2>
                <div className="grid grid-cols-4 gap-1 mb-4">
                    {[0,1,2,3,4,5,6,7].map(z => (<button key={z} onClick={() => setZonaElegida(z)} className={`py-1 text-[10px] font-bold rounded border ${zonaElegida === z ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}>Z{z+1}</button>))}
                </div>
                <button onClick={lanzarBloque} disabled={saldoBilleteraJuego < costoActualBloque} className={`w-full py-4 rounded-lg font-bold text-lg shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center border-b-4 ${saldoBilleteraJuego >= costoActualBloque ? (tiempoRestanteCooldown > 0 ? "bg-orange-600 border-orange-800 hover:bg-orange-500" : "bg-blue-600 border-blue-800 hover:bg-blue-500") : "bg-gray-700 border-gray-800 cursor-not-allowed text-gray-500"}`}>
                    <span>DROP BLOCK</span>
                    <span className="text-xs font-mono opacity-80 mt-1">Cost: {costoActualBloque.toFixed(4)} SOL</span>
                </button>
            </div>

            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-lg mb-4">
                <h2 className="text-sm font-bold text-green-400 uppercase mb-3 border-b border-gray-700 pb-2">🏦 Cashier</h2>
                <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Deposit Amount (SOL):</label>
                    <div className="flex gap-2 mb-2">
                        <input type="number" step="0.1" min="0" value={montoDeposito} onChange={(e) => setMontoDeposito(e.target.value)} className="w-full bg-gray-800 border border-green-700 rounded px-2 py-1 text-white font-mono text-sm focus:outline-none focus:border-green-500" placeholder="0.00" />
                    </div>
                    <button onClick={depositarFondos} disabled={loading} className="w-full py-2 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white shadow-lg">{loading ? "Processing..." : "DEPOSIT FUNDS"}</button>
                </div>
                <button onClick={retirarFondos} disabled={saldoBilleteraJuego <= 0} className="w-full py-2 border border-red-500 text-red-400 hover:bg-red-900/20 rounded text-xs font-bold">WITHDRAW ALL ({saldoBilleteraJuego.toFixed(4)})</button>
                {mensaje && <p className="mt-2 text-xs text-center text-blue-300 bg-blue-900/20 p-1 rounded animate-in fade-in zoom-in duration-300">{mensaje}</p>}
                <button onClick={inicializarJugador} className="w-full mt-2 text-[9px] text-gray-600 underline text-center">Create Account (If new)</button>
            </div>

            <div className="bg-gray-900 border border-purple-500 p-4 rounded-xl shadow-lg mb-4">
                <h2 className="text-sm font-bold text-white mb-2">🎨 Skin</h2>
                <div className="flex mb-2 text-xs border-b border-gray-700"> <button onClick={() => setModoPersonalizacion('color')} className={`flex-1 py-1 ${modoPersonalizacion === 'color' ? 'text-purple-400' : 'text-gray-500'}`}>Color</button> <button onClick={() => setModoPersonalizacion('imagen')} className={`flex-1 py-1 ${modoPersonalizacion === 'imagen' ? 'text-purple-400' : 'text-gray-500'}`}>NFT</button> </div>
                {modoPersonalizacion === 'color' ? (
                    <div className="flex gap-2"> <input type="color" value={colorElegido} onChange={(e) => setColorElegido(e.target.value)} className="h-6 w-full bg-transparent cursor-pointer" /> <input type="text" maxLength={3} value={letraElegida} onChange={(e) => setLetraElegida(e.target.value.toUpperCase())} className="w-12 bg-gray-800 border border-gray-600 rounded text-center font-bold text-xs" /> </div>
                ) : (
                    <div className="space-y-2"> <div className="flex gap-1"> <input type="text" value={urlImagen} onChange={(e) => setUrlImagen(e.target.value)} placeholder="URL..." className="flex-1 bg-gray-800 border border-gray-600 rounded px-1 text-[10px]" /> <button onClick={cargarMisNFTs} className="px-2 bg-blue-600 rounded text-[10px]">Load</button> </div> <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto"> {misNFTs.map(nft => ( <img key={nft.mint} src={nft.image} onClick={() => setUrlImagen(nft.image)} className="w-full aspect-square object-cover rounded cursor-pointer hover:border border-white" /> ))} </div> </div>
                )}
            </div>

            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-lg flex-grow overflow-hidden flex flex-col">
                <h2 className="text-yellow-400 font-bold text-sm mb-2 border-b border-gray-700 pb-1">🏆 Live Survivors</h2>
                <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                    {rankingSupervivencia.slice(0, 10).map((b, i) => (
                        <div key={b.id} className="bg-gray-800 p-2 rounded flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2"> 
                                <span className="font-bold text-gray-500">#{i+1}</span> 
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: b.color }}></div> 
                                <span className="text-white font-bold truncate max-w-[80px]">
                                    {b.userName || (b.owner === publicKey?.toString() ? "YOU" : "Player")}
                                </span> 
                            </div> 
                            <span className="text-yellow-400 font-mono">{b.tiempoVida}s</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </div>
    </main>
  );
}
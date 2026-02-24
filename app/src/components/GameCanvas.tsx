"use client";
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import Matter from "matter-js";

// DIMENSIONES
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 700;
const ZONES_COUNT = 8;
const ZONE_WIDTH = GAME_WIDTH / ZONES_COUNT;

export type BloqueVivo = {
    id: number;
    color: string;
    tiempoVida: number; 
    owner: string; 
    userName: string; 
};

export type BlockConfig = {
    tipo: 'color' | 'imagen';
    valor: string; 
    letra?: string; 
    zona: number;
    owner: string;
    userName: string;
};

export interface GameRef {
  spawnBlock: (config: BlockConfig) => void;
  triggerEarthquake: () => void;
  triggerBlackHole: () => void;
  triggerFire: () => void;
  triggerFloorTrap: () => void;
}

interface GameProps {
  onReportSurvival: (bloques: BloqueVivo[]) => void;
}

type Particle = { x: number; y: number; angle: number; distance: number; speed: number; size: number; color: string; };
type FireParticle = { x: number; y: number; vx: number; vy: number; life: number; size: number; colorType: 'yellow' | 'orange' | 'red'; };

const GameCanvas = forwardRef<GameRef, GameProps>((props, ref) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const floorSegmentsRef = useRef<Matter.Body[]>([]);
  
  const blackHoleImageRef = useRef<HTMLImageElement | null>(null);
  const particlesRef = useRef<Particle[]>([]); 
  const fireParticlesRef = useRef<FireParticle[]>([]); 

  // --- 1. GENERADOR DE FONDO CON ZONAS VISUALES ---
  const generarFondoConZonas = () => {
      if (typeof document === 'undefined') return ""; 
      const canvas = document.createElement('canvas');
      canvas.width = GAME_WIDTH;
      canvas.height = GAME_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return "";

      // Fondo Transparente
      ctx.fillStyle = "transparent"; 
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Líneas de Zona
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; 
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); 
      ctx.font = "bold 20px Monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.textAlign = "center";

      for (let i = 1; i < ZONES_COUNT; i++) {
          const x = i * ZONE_WIDTH;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, GAME_HEIGHT); 
          ctx.stroke();
      }

      // Números de Zona
      for (let i = 0; i < ZONES_COUNT; i++) {
          const centerX = (i * ZONE_WIDTH) + (ZONE_WIDTH / 2);
          ctx.fillText(`Z${i+1}`, centerX, 30); 
      }

      return canvas.toDataURL("image/png");
  };

  const generarTexturaSuelo = () => {
      if (typeof document === 'undefined') return ""; 
      const canvas = document.createElement('canvas');
      const w = 100; const h = 60;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return "";
      ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, w, h);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.strokeStyle = "#444"; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
      for(let i=0; i<3; i++) {
          ctx.beginPath(); const sx = Math.random() * w; const sy = Math.random() * h;
          ctx.moveTo(sx, sy); ctx.lineTo(sx + (Math.random()-0.5)*20, sy + 15); ctx.stroke();
      }
      return canvas.toDataURL("image/png");
  };

  const generarTexturaConLetra = (color: string, letra: string) => {
      if (typeof document === 'undefined') return ""; 
      const canvas = document.createElement('canvas');
      const size = 64; canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return "";
      ctx.fillStyle = color; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 4; ctx.strokeRect(0, 0, size, size);
      ctx.fillStyle = "white"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4; ctx.fillText(letra.toUpperCase().slice(0,3), size/2, size/2);
      return canvas.toDataURL("image/png");
  };

  useImperativeHandle(ref, () => ({
    spawnBlock: (config: BlockConfig) => {
      if (!engineRef.current) return;
      const zonaIndex = Math.max(0, Math.min(config.zona, ZONES_COUNT - 1));
      const minX = zonaIndex * ZONE_WIDTH + 25; 
      const maxX = (zonaIndex + 1) * ZONE_WIDTH - 25; 
      const randomX = Math.random() * (maxX - minX) + minX;
      
      const blockSize = 25; 
      const createBody = (renderConfig: any) => {
          if (!engineRef.current) return;
          const box = Matter.Bodies.rectangle(randomX, -50, blockSize, blockSize, {
            restitution: 0.1, friction: 0.9, density: 0.002, label: "block",
            plugin: { fireLife: 0, isBurning: false, originalColor: config.tipo === 'color' ? config.valor : '#ffffff', owner: config.owner, userName: config.userName, createdAt: Date.now() },
            render: renderConfig
          });
          Matter.World.add(engineRef.current.world, box);
      };
      if (config.tipo === 'imagen') {
          const imgLoader = new Image(); imgLoader.src = config.valor; imgLoader.crossOrigin = "Anonymous"; 
          imgLoader.onload = () => {
              const scaleX = blockSize / imgLoader.naturalWidth; const scaleY = blockSize / imgLoader.naturalHeight;
              createBody({ sprite: { texture: config.valor, xScale: scaleX, yScale: scaleY } });
          };
          imgLoader.onerror = () => createBody({ fillStyle: '#333333' }); 
      } else {
          const texturaURL = generarTexturaConLetra(config.valor, config.letra || "?");
          createBody({ sprite: { texture: texturaURL, xScale: 25 / 64, yScale: 25 / 64 } });
      }
    },
    triggerEarthquake: () => {
      if (!engineRef.current) return;
      const engine = engineRef.current; let duration = 0;
      const quakeInterval = setInterval(() => {
        const bodies = Matter.Composite.allBodies(engine.world);
        bodies.forEach(body => {
          if (!body.isStatic && body.label === "block") {
            Matter.Body.applyForce(body, body.position, { x: Math.sin(Date.now() / 25) * 0.02 * body.mass, y: -0.001 * body.mass });
          }
        });
        duration++; if (duration > 80) clearInterval(quakeInterval);
      }, 20); 
    },
    triggerBlackHole: () => {
        if (!engineRef.current) return;
        const world = engineRef.current.world;
        const x = Math.random() * (GAME_WIDTH - 200) + 100; const y = Math.random() * (GAME_HEIGHT - 300) + 200;
        const blackHole = Matter.Bodies.circle(x, y, 10, { 
            isStatic: true, isSensor: true, label: "blackHole",
            plugin: { lifeTime: 400, maxScale: 1.0, currentScale: 0.1, state: 'growing', rotationAngle: 0 },
            render: { visible: false }
        });
        for(let i=0; i<40; i++) particlesRef.current.push({ x: x, y: y, angle: Math.random() * Math.PI * 2, distance: 30 + Math.random() * 100, speed: 0.05 + Math.random() * 0.05, size: 1 + Math.random() * 2, color: Math.random() > 0.5 ? '#A855F7' : '#FFFFFF' });
        Matter.World.add(world, blackHole);
    },
    triggerFire: () => {
        if (!engineRef.current) return;
        const blocks = Matter.Composite.allBodies(engineRef.current.world).filter(b => b.label === "block" && !b.plugin.isBurning);
        if (blocks.length > 0) {
            for(let i=0; i<2; i++) { 
                if(blocks[i]) { const victim = blocks[Math.floor(Math.random() * blocks.length)]; victim.plugin.isBurning = true; victim.plugin.fireLife = 120; }
            }
        }
    },
    triggerFloorTrap: () => {
        if (!engineRef.current || floorSegmentsRef.current.length === 0) return;
        const world = engineRef.current.world;
        const idx = Math.floor(Math.random() * (floorSegmentsRef.current.length - 1));
        const sA = floorSegmentsRef.current[idx]; const sB = floorSegmentsRef.current[idx + 1];
        if (!sA || !sB) return;
        Matter.World.remove(world, [sA, sB]);
        setTimeout(() => Matter.World.add(world, [sA, sB]), Math.random() * 10000 + 20000);
    }
  }));

  useEffect(() => {
    if (!sceneRef.current) return;
    const holeImg = new Image(); holeImg.src = "/blackhole.png"; blackHoleImageRef.current = holeImg;

    const engine = Matter.Engine.create(); const world = engine.world; engineRef.current = engine;
    const render = Matter.Render.create({
      element: sceneRef.current, engine: engine,
      options: { width: GAME_WIDTH, height: GAME_HEIGHT, wireframes: false, background: 'transparent' }
    });

    const texSuelo = generarTexturaSuelo();
    const segments = [];
    const numSegments = Math.ceil(GAME_WIDTH / 100);
    for (let i = 0; i < numSegments; i++) {
        const x = 50 + (i * 100); 
        const segment = Matter.Bodies.rectangle(x, GAME_HEIGHT + 10, 100, 60, { isStatic: true, label: "floor", render: { sprite: { texture: texSuelo, xScale: 1, yScale: 1 } } });
        segments.push(segment);
    }
    floorSegmentsRef.current = segments;
    
    // --- LÍMITES DEL MAPA ---
    const pIzq = Matter.Bodies.rectangle(0, GAME_HEIGHT/2, 20, GAME_HEIGHT * 2, { isStatic: true, render: { visible: false } });
    const pDer = Matter.Bodies.rectangle(GAME_WIDTH, GAME_HEIGHT/2, 20, GAME_HEIGHT * 2, { isStatic: true, render: { visible: false } });
    
    // !!! NUEVO: TECHO INVISIBLE !!!
    // Situado en Y = -200 (Arriba, fuera de cámara pero cerca).
    // Evita que los bloques salgan volando y los obliga a bajar.
    const pTecho = Matter.Bodies.rectangle(GAME_WIDTH / 2, -200, GAME_WIDTH, 20, { 
        isStatic: true, 
        render: { visible: false } 
    });

    // Agregamos el techo al mundo
    Matter.World.add(world, [...segments, pIzq, pDer, pTecho]);

    // RENDER LOOP
    Matter.Events.on(render, 'afterRender', () => {
       const ctx = render.context;
       const blackHoles = Matter.Composite.allBodies(world).filter(b => b.label === "blackHole");
       const burningBlocks = Matter.Composite.allBodies(world).filter(b => b.label === "block" && b.plugin.isBurning);

       if(blackHoles.length > 0 && blackHoleImageRef.current) {
           ctx.save();
           blackHoles.forEach(hole => {
               const cx = hole.position.x; const cy = hole.position.y; const scale = hole.plugin.currentScale; const size = 100 * scale;
               particlesRef.current.forEach(p => { p.angle+=p.speed; p.distance-=0.5; if(p.distance<10) p.distance=60*scale; const px=cx+Math.cos(p.angle)*p.distance*scale; const py=cy+Math.sin(p.angle)*p.distance*scale; ctx.beginPath(); ctx.arc(px,py,p.size*scale,0,2*Math.PI); ctx.fillStyle=p.color; ctx.globalAlpha=0.6*scale; ctx.fill(); });
               ctx.save(); ctx.translate(cx,cy); ctx.rotate(hole.plugin.rotationAngle); ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(0,0,(size/2)*0.85,0,2*Math.PI); ctx.closePath(); ctx.clip(); ctx.drawImage(blackHoleImageRef.current!, -size/2, -size/2, size, size); ctx.restore();
               ctx.save(); ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(cx,cy,(size/2)*0.55,0,2*Math.PI); ctx.fillStyle="#000000"; ctx.fill(); ctx.restore();
           });
           ctx.restore();
       } else { particlesRef.current = [] }

       if(burningBlocks.length > 0) {
           ctx.save();
           burningBlocks.forEach(b => {
                ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(b.position.x-12.5, b.position.y-12.5, 25, 25);
                for(let k=0; k<2; k++) { 
                    const cr=Math.random(); let c:any='red'; if(cr>0.6)c='yellow';else if(cr>0.3)c='orange';
                    fireParticlesRef.current.push({x:b.position.x+(Math.random()-0.5)*25, y:b.position.y+(Math.random()-0.5)*25, vx:(Math.random()-0.5)*0.3, vy:-0.5-Math.random()*0.5, life:1, size:3+Math.random()*3, colorType:c});
                }
           });
           fireParticlesRef.current.forEach((p,i) => {
               p.x+=p.vx; p.y+=p.vy; p.life-=0.06; if(p.life<=0){fireParticlesRef.current.splice(i,1);return;}
               const a=p.life*0.9; let c=`rgba(220,20,20,${a})`; if(p.colorType==='yellow')c=`rgba(255,240,50,${a})`; else if(p.colorType==='orange')c=`rgba(255,140,0,${a})`;
               ctx.fillStyle=c; ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
           });
           ctx.restore();
       }
    });

    Matter.Events.on(engine, 'beforeUpdate', () => {
        const blocks = Matter.Composite.allBodies(world).filter(b => b.label === "block");
        const blackHoles = Matter.Composite.allBodies(world).filter(b => b.label === "blackHole");
        blocks.forEach(block => { if (block.position.y > GAME_HEIGHT + 100) Matter.World.remove(world, block); });
        
        if (engine.timing.timestamp % 1000 < 20) {
            const reporte: BloqueVivo[] = blocks.map(b => ({ id: b.id, color: b.plugin.originalColor, tiempoVida: Math.floor((Date.now() - b.plugin.createdAt) / 1000), owner: b.plugin.owner, userName: b.plugin.userName }));
            props.onReportSurvival(reporte);
        }
        
        if (blackHoles.length > 0) {
           blackHoles.forEach(hole => {
               hole.plugin.rotationAngle = (hole.plugin.rotationAngle || 0) + 0.05;
               if (hole.plugin.state === 'growing') { if (hole.plugin.currentScale < 1.0) hole.plugin.currentScale *= 1.05; else hole.plugin.state = 'stable'; }
               hole.plugin.lifeTime--; if (hole.plugin.lifeTime < 20) { hole.plugin.state = 'shrinking'; hole.plugin.currentScale *= 0.9; }
               if (hole.plugin.lifeTime <= 0) { Matter.World.remove(world, hole); return; }
               blocks.forEach(block => {
                   const dx = hole.position.x - block.position.x; const dy = hole.position.y - block.position.y; const d = Math.sqrt(dx*dx + dy*dy);
                   if (d < 30 * hole.plugin.currentScale) { Matter.World.remove(world, block); return; }
                   if (d < 350) { 
                       Matter.Body.set(block, "friction", 0.1); Matter.Body.set(block, "frictionStatic", 0.1); Matter.Body.set(block, "frictionAir", 0.005);
                       const str = 0.005 * block.mass * Math.pow((350 - d) / 350, 2);
                       Matter.Body.applyForce(block, block.position, { x: (dx/d) * str, y: (dy/d) * str });
                   } else if (block.friction === 0.1) { Matter.Body.set(block, "friction", 0.9); Matter.Body.set(block, "frictionStatic", 0.9); Matter.Body.set(block, "frictionAir", 0.01); }
               });
           });
       }
       blocks.forEach(block => {
           if (block.plugin.isBurning) {
               block.plugin.fireLife--;
               Matter.Composite.allBodies(world).filter(b => b.label === "block" && !b.plugin.isBurning).forEach(neighbor => {
                   if (Matter.Vector.magnitude(Matter.Vector.sub(block.position, neighbor.position)) < 32 && Math.random() < 0.02) { neighbor.plugin.isBurning = true; neighbor.plugin.fireLife = 120; }
               });
               if (block.plugin.fireLife <= 0) { Matter.World.remove(world, block); }
           }
       });
    });

    Matter.Render.run(render); const runner = Matter.Runner.create(); Matter.Runner.run(runner, engine);
    return () => { Matter.Render.stop(render); Matter.Runner.stop(runner); if (render.canvas) render.canvas.remove(); Matter.World.clear(world, false); Matter.Engine.clear(engine); };
  }, []);

  const [bgImage, setBgImage] = useState('url(/fondo-limpio.png)');
  useEffect(() => {
      const zonasUrl = generarFondoConZonas();
      setBgImage(`url(${zonasUrl}), url(/fondo-limpio.png)`);
  }, []);

  return (
    <div 
        ref={sceneRef} 
        className="border-4 border-purple-500 rounded-xl overflow-hidden shadow-2xl relative" 
        style={{ 
            width: `${GAME_WIDTH}px`, 
            height: `${GAME_HEIGHT}px`, 
            backgroundImage: bgImage, 
            backgroundSize: '100% 100%, 100% 100%', 
            backgroundRepeat: 'no-repeat'
        }} 
    />
  );
});

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;
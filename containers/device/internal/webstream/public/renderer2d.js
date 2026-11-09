import { BaseRenderer } from './renderer.js';

export class Canvas2DRenderer extends BaseRenderer {
    constructor(containerId) {
        super();
        this.container = document.getElementById(containerId);
        // Generiamo il canvas al volo dentro il DOM
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        
        this.topology = null;
        this.visConfig = null;
        
        this.imagesCache = new Map();
        this.isReady = false;
    }

    destroy() {
        this.isReady = false;
        // Rimuoviamo fisicamente l'elemento dal DOM, distruggendo il contesto 2D
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.ctx = null;
        console.log("Renderer 2D smantellato.");
    }

    async init(topology, visualConfig) {
        this.topology = topology;
        this.visConfig = visualConfig;

        const loadPromises = [];
        for (const [type, typeCfg] of Object.entries(visualConfig.assetTypes)) {
            if (typeCfg.asset2d) {
                loadPromises.push(this.loadImage(type, typeCfg.asset2d));
            }
        }
        loadPromises.push(this.loadImage('unknown', '/assets/images/unknown.png'));

        try {
            await Promise.all(loadPromises);
            this.isReady = true;
        } catch (err) {
            console.error("Renderer 2D: Errore asset, uso fallback:", err);
            this.isReady = true; 
        }
    }

    loadImage(type, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.imagesCache.set(type, img);
                resolve();
            };
            img.onerror = () => reject(new Error(`Impossibile caricare l'immagine ${src}`));
        });
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    update(snapshot) {
        if (!this.isReady || !this.ctx) return;

        // Reset dello schermo (trasparente, rivela lo sfondo CSS chiaro)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // A. DISEGNO DELLE CONNESZIONI (Tubi con frecce direzionali)
        this.ctx.lineWidth = this.visConfig.pipes.strokeWidth;
        this.ctx.strokeStyle = this.visConfig.pipes.defaultColor;

        if (this.topology && this.topology.connections) {
            this.topology.connections.forEach(conn => {
                const fromComponent = conn.from.component;
                const toComponent = conn.to.component;
                const fromNode = this.visConfig.layout[fromComponent];
                const toNode = this.visConfig.layout[toComponent];

                if (fromNode && toNode) {

                    // Calcoliamo la distanza e il vettore di direzione della linea
                    const dx = toNode.x - fromNode.x;
                    const dy = toNode.y - fromNode.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 70) { // Evita calcoli strani se i nodi sono troppo vicini
                        const margin = 35; // Pixel di spazio vuoto attorno al centro dell'icona
                        const offsetAmount = 10;  // Pixel di sfasamento laterale per evitare sovrapposizioni
                        
                        // 2. Troncamento delle estremità (Margine sui bordi dei componenti)
                        const cropStartX = fromNode.x + (dx / dist) * margin;
                        const cropStartY = fromNode.y + (dy / dist) * margin;
                        const cropEndX = toNode.x - (dx / dist) * margin;
                        const cropEndY = toNode.y - (dy / dist) * margin;

                        // 3. Calcolo del vettore normale unitario (perpendicolare alla direzione del flusso)
                        const nx = -dy / dist;
                        const ny = dx / dist;

                        // 4. Sfasamento laterale: sposta la linea a "destra" lungo la sua direzione
                        const startX = cropStartX + nx * offsetAmount;
                        const startY = cropStartY + ny * offsetAmount;
                        const endX = cropEndX + nx * offsetAmount;
                        const endY = cropEndY + ny * offsetAmount;

                        // Disegna la linea del tubo troncata
                        this.ctx.beginPath();
                        this.ctx.moveTo(startX, startY);
                        this.ctx.lineTo(endX, endY);
                        this.ctx.stroke();

                        // Posizioniamo la freccia esattamente a metà del tubo REALE (troncato)
                        const midX = (startX + endX) / 2;
                        const midY = (startY + endY) / 2;
                        const angle = Math.atan2(endY - startY, endX - startX);
                        
                        this.ctx.save();
                        this.ctx.translate(midX, midY);
                        this.ctx.rotate(angle);
                        this.ctx.fillStyle = this.visConfig.pipes.defaultColor;
                        this.ctx.beginPath();
                        this.ctx.moveTo(8, 0);       
                        this.ctx.lineTo(-6, -6);     
                        this.ctx.lineTo(-2, 0);      
                        this.ctx.lineTo(-6, 6);      
                        this.ctx.closePath();
                        this.ctx.fill();
                        this.ctx.restore();
                    }
                }
            });
        }

        // B. DISEGNO DEI COMPONENTI
        let unmappedCount = 0; 

        for (const [nodeName, nodeState] of Object.entries(snapshot)) {
            let layoutInfo = this.visConfig.layout[nodeName];
            let componentType = layoutInfo ? layoutInfo.type : 'unknown';

            if (!layoutInfo) {
                unmappedCount++;
                layoutInfo = {
                    x: 60 + (unmappedCount * 70),
                    y: this.canvas.height - 80,
                    label: `⚠️ ${nodeName}`
                };
            }

            let img = this.imagesCache.get(componentType);
            if (!img && componentType !== 'unknown') img = this.imagesCache.get('unknown');

            this.ctx.save();

            const size = 50;
            if (img) {
                this.ctx.drawImage(img, layoutInfo.x - size/2, layoutInfo.y - size/2, size, size);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(layoutInfo.x, layoutInfo.y, 20, 0, 2 * Math.PI);
                this.ctx.fillStyle = "#e74c3c";
                this.ctx.fill();
            }

            // MODIFICATO: Colori scuri per i testi (Sfondo chiaro)
            this.ctx.font = "bold 13px sans-serif";
            this.ctx.textAlign = "center";
            
            // Titolo Componente (Nero)
            this.ctx.fillStyle = "#1a1a1a";
            const labelText = layoutInfo.label || nodeName;
            this.ctx.fillText(labelText, layoutInfo.x, layoutInfo.y - 32);

            // Variabili Real-Time (Antracite)
            this.ctx.font = "11px sans-serif";
            let textYOffset = 38;
            for (const [varName, varVal] of Object.entries(nodeState)) {
                if (typeof varVal === 'object' && varVal !== null) {
                    for (const [subKey, subVal] of Object.entries(varVal)) {
                        const valFormatted = typeof subVal === 'number' ? subVal.toFixed(1) : subVal;
                        this.ctx.fillStyle = "#555";
                        this.ctx.fillText(`${varName}.${subKey}: ${valFormatted}`, layoutInfo.x, layoutInfo.y + textYOffset);
                        textYOffset += 14;
                    }
                } else {
                    const valFormatted = typeof varVal === 'number' ? varVal.toFixed(1) : varVal;
                    this.ctx.fillStyle = "#555";
                    this.ctx.fillText(`${varName}: ${valFormatted}`, layoutInfo.x, layoutInfo.y + textYOffset);
                    textYOffset += 14;
                }
            }

            this.ctx.restore();
        }
    }
}

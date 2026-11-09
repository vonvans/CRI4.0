import { ResolveRendererStrategy } from './renderer.js';

class AppOrchestrator {
    constructor() {
        this.topology = null;
        this.visualConfig = null;
        this.latestSnapshot = null;
        this.currentRenderer = null;
        
        // Elementi DOM ereditati da index.html
        this.telemetryPanel = document.getElementById('telemetry-panel');
        this.viewSelector = document.getElementById('view-selector');
    }

    async bootstrap() {
        try {
            // 1. Scarichiamo la topologia statica del grafo fisico (Chiamata single-shot)
            const [topoRes, visRes] = await Promise.all([
                fetch('/api/topology'),
                fetch('/api/visualization')
            ]);

            if (!topoRes.ok || !visRes.ok) {
                throw new Error("Impossibile recuperare i metadati di configurazione dal server Go");
            }

            const rawTopology = await topoRes.json();
            this.topology = rawTopology.simulation || rawTopology;
            this.visualConfig = await visRes.json();

            // 2. RISOLUZIONE DELLA STRATEGIA (Inversione del Controllo)
            const defaultMode = this.visualConfig.renderMode || '2d';
            this.viewSelector.value = defaultMode;

            await this.initStrategy(defaultMode);

            // 2. Avviamo lo streaming SSE nativo agganciandoci al server Go
            this.initSSEStream();

            // 3. Facciamo partire il Game Loop continuo per il disegno dei frame
            this.startLoop();

            // 4. Gestiamo il ridimensionamento globale della finestra
            this.viewSelector.addEventListener('change', (e) => this.switchRenderer(e.target.value));
            window.addEventListener('resize', () => this.handleResize());
        } catch (error) {
            console.error("Errore critico durante il boot dell'interfaccia grafica:", error);
            this.telemetryPanel.innerHTML = `<span style="color: #e74c3c;">Errore di Boot: ${error.message}</span>`;
        }
    }

    async initStrategy(mode) {
        this.currentRenderer = await ResolveRendererStrategy(mode, 'canvas-container');
        await this.currentRenderer.init(this.topology, this.visualConfig);
        this.currentRenderer.resize(window.innerWidth, window.innerHeight);
    }

    async switchRenderer(newMode) {
        if (!this.currentRenderer) return;

        console.log(`Switching HMI View to: ${newMode}...`);
        
        // 1. Invochiamo la distruzione controllata del motore grafico precedente
        this.currentRenderer.destroy();
        this.currentRenderer = null; // Rilasciamo il puntatore per il garbage collector

        // 2. Istanziamo la nuova strategia (Lazy Loading automatico dei moduli di rete)
        await this.initStrategy(newMode);
        console.log("Nuovo renderer agganciato ed operativo.");
    }

    initSSEStream() {
        // EventSource apre una connessione HTTP persistente e gestisce i retry in automatico
        const eventSource = new EventSource('/stream');

        eventSource.onmessage = (event) => {
            // Estraiamo la fotografia istantanea dei dati inviata a 30 FPS dal server Go
            this.latestSnapshot = JSON.parse(event.data);
            
            // Aggiorniamo la vista testuale rapida nel pannello laterale dell'HMI
            this.updateTelemetryTextPanel();
        };

        eventSource.onerror = (err) => {
            console.error("Stream SSE interrotto temporaneamente, tentativo di riconnessione...", err);
        };
    }

    updateTelemetryTextPanel() {
        if (!this.latestSnapshot) {
            return;
        }

        let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
        for (const [nodeName, nodeState] of Object.entries(this.latestSnapshot)) {
            html += `<li style="margin-bottom: 8px;"><strong>${nodeName}</strong>:<br>`;
            
            for (const [varName, varVal] of Object.entries(nodeState)) {
                // Se la proprietà è a sua volta un oggetto (es: inputs o outputs), cicliamo le sue sotto-chiavi
                if (typeof varVal === 'object' && varVal !== null) {
                    for (const [subKey, subVal] of Object.entries(varVal)) {
                        const valFormatted = typeof subVal === 'number' ? subVal.toFixed(2) : subVal;
                        html += `&nbsp;&nbsp;<small style="color: #9b59b6;">${varName}.${subKey}:</small> <span style="color: #3498db;">${valFormatted}</span><br>`;
                    }
                } else {
                    // Trattamento normale per proprietà piatte o primitive
                    const valFormatted = typeof varVal === 'number' ? varVal.toFixed(2) : varVal;
                    html += `&nbsp;&nbsp;<small>${varName}:</small> <span style="color: #3498db;">${valFormatted}</span><br>`;
                }
            }
            html += `</li>`;
        }
        html += '</ul>';
        this.telemetryPanel.innerHTML = html;
    }

    startLoop() {
        const tick = () => {
            // Se c'è un motore grafico attivo e abbiamo dati freschi, ridisegnamo la scena
            if (this.currentRenderer && this.latestSnapshot) {
                this.currentRenderer.update(this.latestSnapshot);
            }

            // Richiede al browser di eseguire il prossimo frame non appena la GPU è pronta (~60Hz)
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    handleResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (this.currentRenderer) {
            this.currentRenderer.resize(width, height);
        }
    }
}

// Avvio immediato dell'applicazione a caricamento pagina completato
const app = new AppOrchestrator();
app.bootstrap();

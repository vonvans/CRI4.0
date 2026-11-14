// Il contratto astratto che tutti i motori devono implementare
export class BaseRenderer {
    async init(topology, visualConfig) {
        throw new Error("Metodo init() non implementato");
    }
    update(snapshot) {
        throw new Error("Metodo update() non implementato");
    }
    resize(width, height) {
        throw new Error("Metodo resize() non implementato");
    }
    destroy() {
        throw new Error("Metodo destroy() non implementato");
    }
}

/**
 * Factory asincrona che implementa lo Strategy Pattern con Lazy Loading.
 * @param {string} type - '2d' o '3d'
 * @param {string} canvasId - L'id del tag canvas HTML
 * @returns {Promise<BaseRenderer>} Il renderer specifico istanziato
 */
export async function ResolveRendererStrategy(type, canvasId) {
    switch (type.toLowerCase()) {
        case '2d':
            // Carica il modulo a runtime solo se esplicitamente richiesto
            const { Canvas2DRenderer } = await import('./renderer2d.js');
            return new Canvas2DRenderer(canvasId);
            
        case '3d':
            // Carica Three.js e il modulo 3D solo on-demand
            const { Three3DRenderer } = await import('./renderer3d.js');
            return new Three3DRenderer(canvasId);
            
        default:
            throw new Error(`Strategia di rendering '${type}' non supportata dal framework HMI.`);
    }
}

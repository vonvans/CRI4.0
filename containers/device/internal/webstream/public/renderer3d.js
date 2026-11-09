import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BaseRenderer } from './renderer.js';

export class Three3DRenderer extends BaseRenderer {
    constructor(containerId) {
        super();
        this.container = document.getElementById(containerId);
        
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.topology = null;
        this.visConfig = null;
        
        this.nodeModels = new Map();
        this.isReady = false;
    }

    async init(topology, visualConfig) {
        this.topology = topology;
        this.visConfig = visualConfig;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1a1a1a');

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(45, 14, -10);
        
        this.cameraTarget = new THREE.Vector3(45, 0, -35);
        this.camera.lookAt(this.cameraTarget);

        // Configurazione stati per il Drag del terreno 3D
        this.isDragging = false;
        this.prevMousePos = { x: 0, y: 0 };
        this.canvas.style.cursor = 'grab';

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 50, 20);
        this.scene.add(dirLight);

        // 1. TRACCIAMENTO DEI TUBI E DEI CONI DIREZIONALI
        if (this.topology && this.topology.connections) {
            this.topology.connections.forEach(conn => {
                const fromNode = this.visConfig.layout[conn.from.component];
                const toNode = this.visConfig.layout[conn.to.component];
                if (fromNode && toNode) this.build3DPipe(fromNode, toNode);
            });
        }

        // 2. CARICAMENTO MODELLI .GLB + INIEZIONE DELLE LABEL
        const loader = new GLTFLoader();
        const loadPromises = [];

        for (const [nodeName, layoutInfo] of Object.entries(this.visConfig.layout)) {
            const assetType = this.visConfig.assetTypes[layoutInfo.type];
            const x3d = layoutInfo.x * 0.1;
            const z3d = -layoutInfo.y * 0.1;
            const labelText = layoutInfo.label || nodeName;

            if (assetType && assetType.asset3d) {
                const p = new Promise((resolve) => {
                    loader.load(assetType.asset3d, 
                        (gltf) => {
                            const model = gltf.scene;
                            model.position.set(x3d, 0, z3d);
                            this.scene.add(model);
                            
                            // Crea e ancora la label testuale fluttuante sopra il modello GLB
                            const labelCtx = this.attachLabelToMesh(model, labelText, 4.5);

                            this.nodeModels.set(nodeName, { mesh: model, config: assetType, label: labelCtx });
                            resolve();
                        },
                        undefined,
                        (err) => {
                            console.warn(`Modello mancante per ${nodeName}, uso il fallback rosso:`, err);
                            this.buildFallbackBox(nodeName, x3d, z3d, labelText);
                            resolve();
                        }
                    );
                });
                loadPromises.push(p);
            } else {
                this.buildFallbackBox(nodeName, x3d, z3d, labelText);
            }
        }

        await Promise.all(loadPromises);

        // 3. EVENTI: ZOOM CON ROTELLA
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.fov += e.deltaY * 0.04;
            this.camera.fov = Math.max(15, Math.min(75, this.camera.fov));
            this.camera.updateProjectionMatrix();
        }, { passive: false });

        // 4. EVENTI: TRASLAZIONE CON MOUSE DRAG
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isDragging = true;
                this.prevMousePos = { x: e.clientX, y: e.clientY };
                this.canvas.style.cursor = 'grabbing';
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.prevMousePos.x;
            const deltaY = e.clientY - this.prevMousePos.y;
            const factor = (this.camera.fov / 45) * 0.04;

            const moveX = deltaX * factor;
            const moveZ = deltaY * factor;

            this.camera.position.x -= moveX;
            this.camera.position.z += moveZ;
            this.cameraTarget.x -= moveX;
            this.cameraTarget.z += moveZ;

            this.camera.lookAt(this.cameraTarget);
            this.prevMousePos = { x: e.clientX, y: e.clientY };
        });

        const stopDrag = () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        };
        window.addEventListener('mouseup', stopDrag);
        this.canvas.addEventListener('mouseleave', stopDrag);

        this.isReady = true;
    }

    build3DPipe(fromNode, toNode) {
        const p1 = new THREE.Vector3(fromNode.x * 0.1, 0, -fromNode.y * 0.1);
        const p2 = new THREE.Vector3(toNode.x * 0.1, 0, -toNode.y * 0.1);

        const distance = p1.distanceTo(p2);
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();

        // TRASLAZIONE LATERALE DETERMINISTICA
        // Calcoliamo la perpendicolare sul piano XZ e sfasiamo i punti di 0.8 unità
        const normal3d = new THREE.Vector3(-direction.z, 0, direction.x);
        const offsetAmount = 0.8; 
        p1.addScaledVector(normal3d, offsetAmount);
        p2.addScaledVector(normal3d, offsetAmount);

        const margin = 3.5; 

        if (distance > margin * 2) {
            const startP = p1.clone().addScaledVector(direction, margin);
            const endP = p2.clone().addScaledVector(direction, -margin);
            const croppedDistance = startP.distanceTo(endP);

            // Costruzione del tubo cilindrico
            const pipeGeometry = new THREE.CylinderGeometry(0.15, 0.15, croppedDistance, 8);
            const pipeMaterial = new THREE.MeshStandardMaterial({ color: this.visConfig.pipes.defaultColor, roughness: 0.4, metalness: 0.7 });
            const pipeMesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
            
            const midPoint = new THREE.Vector3().addVectors(startP, endP).multiplyScalar(0.5);
            pipeMesh.position.copy(midPoint);
            pipeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            this.scene.add(pipeMesh);

            // FRECCIA DIREZIONALE A CONO
            // Costruiamo un piccolo cono azzurro per indicare il verso delle connessioni
            const coneGeometry = new THREE.ConeGeometry(0.35, 0.7, 8);
            const coneMaterial = new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.3 });
            const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
            
            // Posizioniamo il cono leggermente rialzato sopra la mezzeria del tubo per massima visibilità
            coneMesh.position.copy(midPoint);
            coneMesh.position.y += 0.25; 
            
            // In Three.js i coni puntano verso +Y, allineandoli alla direzione del tubo punteranno al componente di output
            coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            this.scene.add(coneMesh);
        }
    }

    buildFallbackBox(nodeName, x, z, labelText) {
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);

        // Applica la label anche al blocco cubico di fallback (es: per il nodo $env)
        const labelCtx = this.attachLabelToMesh(mesh, labelText, 3.0);

        this.nodeModels.set(nodeName, { mesh: mesh, config: {}, isFallback: true, label: labelCtx });
    }

    // ── NUOVO HELPER: GENERAZIONE PROCEDURALE ETICHETTE SCADA 2D-IN-3D ──
    attachLabelToMesh(parentMesh, text, heightOffset) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

        // Adeguiamo la scala 3D al nuovo aspect ratio del canvas
        sprite.scale.set(4, 2.5, 1);
        sprite.position.set(0, heightOffset, 0);
        parentMesh.add(sprite);

        // Restituiamo il contesto di disegno per l'aggiornamento a runtime
        return { canvas, ctx, texture, labelText: text };
    }

    resize(width, height) {
        if (!this.renderer) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    update(snapshot) {
        if (!this.isReady || !this.renderer) {
            return;
        }

        for (const [nodeName, nodeState] of Object.entries(snapshot)) {
            const modelRef = this.nodeModels.get(nodeName);
            if (!modelRef) {
                continue;
            }

            if (modelRef.label) {
                this.updateLabelText(modelRef.label, nodeState);
            }

            if (modelRef.config.bindRotation) {
                const val = nodeState[modelRef.config.bindRotation] || 0;
                modelRef.mesh.rotation.y = (val / 100) * Math.PI * 2;
            }

            if (modelRef.config.bindColor) {
                const temp = nodeState[modelRef.config.bindColor] || 25.0;
                const intensity = Math.min(Math.max((temp - 25) / 50, 0), 1);
                
                modelRef.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.color.setRGB(1.0 * intensity, 0.5 * (1 - intensity), 0.2 * (1 - intensity));
                    }
                });
            }

            if (modelRef.isFallback) {
                modelRef.mesh.position.y = Math.sin(Date.now() * 0.003) * 0.2;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateLabelText(label, nodeState) {
        const ctx = label.ctx;
        const canvas = label.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Sfondo SCADA scuro arrotondato
        ctx.fillStyle = 'rgba(25, 25, 25, 0.85)';
        ctx.beginPath();
        ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 8);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Disegno del Titolo (In alto, Bianco)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label.labelText, canvas.width / 2, 26);

        // Disegno delle Variabili (Unpacking ricorsivo identico al 2D)
        ctx.font = '11px Arial';
        let yOffset = 48;

        for (const [varName, varVal] of Object.entries(nodeState)) {
            if (typeof varVal === 'object' && varVal !== null) {
                for (const [subKey, subVal] of Object.entries(varVal)) {
                    const valFormatted = typeof subVal === 'number' ? subVal.toFixed(1) : subVal;
                    ctx.fillStyle = '#3498db'; // Sotto-oggetti (es: porte) in azzurro
                    ctx.fillText(`${varName}.${subKey}: ${valFormatted}`, canvas.width / 2, yOffset);
                    yOffset += 14;
                }
            } else {
                const valFormatted = typeof varVal === 'number' ? varVal.toFixed(1) : varVal;
                ctx.fillStyle = '#aaaaaa'; // Variabili piatte in grigio chiaro
                ctx.fillText(`${varName}: ${valFormatted}`, canvas.width / 2, yOffset);
                yOffset += 14;
            }
        }

        // Notifica a Three.js che i pixel della GPU vanno aggiornati
        label.texture.needsUpdate = true;
    }

    destroy() {
        this.isReady = false;
        this.nodeModels.forEach(modelRef => {
            modelRef.mesh.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            this.scene.remove(modelRef.mesh);
        });

        this.renderer.dispose();
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        console.log("Renderer 3D completo smantellato.");
    }
}

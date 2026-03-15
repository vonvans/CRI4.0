import { Router } from 'express';
import * as controllers from './controllers';

export const router = Router();

router.get('/docker-images', controllers.getDockerImages);
router.post('/docker-build', controllers.buildDockerImage);
router.post('/docker-inspect', controllers.getContainerInspect);
router.post('/docker-logs', controllers.getContainerLogs);
router.post('/simulate-attack', controllers.simulateAttack);
router.post('/run-simulation', controllers.runSimulation);
router.post('/stop-simulation', controllers.stopSimulation);
router.post('/machine-content', controllers.getMachineContent);
router.post('/save-scada-project', controllers.saveScadaProject);

// Save System Routes
router.get('/saves', controllers.listSaves);
router.post('/saves', controllers.saveProject);
router.post('/saves/upload', controllers.uploadProject);
router.get('/saves/:filename', controllers.loadProject);
router.get('/saves/:filename/download', controllers.downloadProject);
router.delete('/saves/:filename', controllers.deleteProject);

// SSE for logs
router.get('/logs', controllers.subscribeToLogs);
router.post('/loki-delete', controllers.deleteLokiLogs);
router.get('/loki-query', controllers.queryLokiLogs);

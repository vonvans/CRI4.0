/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import url from 'url';
import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { exec } from 'child_process';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { generateZip } from "../renderer/components/Download4Run"; // percorso relativo corretto
import os from 'os';
import fs from 'fs';
import { promises as fsp } from "fs";
import AdmZip from 'adm-zip';
import { generateZipNode } from '../shared/make-node';

// In cima al file main (scope modulo)
type CurrentLab = {
  name: string;
  labsDir: string;
  labPath: string;
  zipPath: string;
};

let CURRENT_LAB: CurrentLab | null = null;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

async function emptyKatharaLabs(labsDir: string) {
  try {
    const entries = await fsp.readdir(labsDir);
    await Promise.allSettled(
      entries.map((entry) =>
        fsp.rm(path.join(labsDir, entry), { recursive: true, force: true })
      )
    );
    console.log("🧹 Contenuto rimosso da:", labsDir);
  } catch (err) {
    console.error("❌ Errore durante lo svuotamento:", err);
  }
}

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.handle('docker-images', async () => {
  return new Promise((resolve, reject) => {
    exec('docker images --format "{{.Repository}}" | grep "^icr/"', (error, stdout, stderr) => {
      if (error) {
        resolve([]);
      } else {
        resolve(stdout.trim().split("\n"));
      }
    });
  });
});

ipcMain.handle('docker-build', async (event, arg) => {
  return new Promise((resolve, reject) => {
    console.log("BUILDING:", arg);
    exec(`docker compose -f ./containers/docker-compose.yaml build ${arg}`, (error, stdout, stderr) => {
      if (error) {
        resolve([]);
      } else {
        resolve(stdout.split("\n"));
      }
    });
  });
});

ipcMain.handle("simulate-attack", async (event, { container, command }) => {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] simulate-attack request`);
  console.log(`Image name received: ${container}`);
  console.log(`Command to execute: ${command}`);

  // Step 1: trova il container attivo che deriva dall'immagine specificata
  const containerName = await new Promise<string>((resolve, reject) => {
    exec(
      `docker ps --filter ancestor=${container} --format "{{.Names}}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Error looking for container:", stderr);
          return reject("Failed to find container for image: " + container);
        }

        const name = stdout.trim().split("\n")[0];
        if (!name) {
          console.warn("⚠️ No running container found for image:", container);
          return reject("No running container found for image: " + container);
        }

        console.log(`✅ Using container: ${name}`);
        resolve(name);
      }
    );
  });

  // Step 2: esegui il comando nel container trovato
  return new Promise((resolve, reject) => {
    exec(`docker exec ${containerName} ${command}`, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Command execution error:", stderr || error.message);
        return reject(stderr || error.message);
      }

      console.log("✅ Command output:\n" + stdout);
      resolve(stdout.trim());
    });
  });
});

ipcMain.handle('run-simulation', async (event, { machines, labInfo }) => {
  console.log('machines?', Array.isArray(machines), machines?.length);
  console.log('labInfo?', labInfo);
  
  const LAB_NAME = labInfo?.name || 'default-lab';
  const LABS_DIR = path.join(os.homedir(), 'kathara-labs');
  const ZIP_PATH = path.join(LABS_DIR, `${LAB_NAME}.zip`);
  const LAB_PATH = path.join(LABS_DIR, LAB_NAME);

  // 1. Crea dir di destinazione
  if (!fs.existsSync(LABS_DIR)) {
    fs.mkdirSync(LABS_DIR, { recursive: true });
  }

  // 2. Genera ZIP con i dati passati
  console.log("📦 Generating ZIP...");
  await generateZipNode(machines, labInfo, ZIP_PATH);

  // 3. Estrai ZIP
  console.log("📂 Extracting ZIP...");
  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(LABS_DIR, true);

// subito dopo aver definito LAB_NAME / LABS_DIR / ZIP_PATH / LAB_PATH
CURRENT_LAB = { name: LAB_NAME, labsDir: LABS_DIR, labPath: LAB_PATH, zipPath: ZIP_PATH };

  // 4. Avvia kathara
  console.log("🚀 Launching Kathara...");
  return new Promise((resolve, reject) => {
    console.log("📂 Lanciando kathara in:", LAB_PATH);
console.log("📄 File presenti:", fs.readdirSync(LABS_DIR));
    exec(`kathara lstart --noterminals`, { cwd: LABS_DIR }, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Failed to start:", stderr || error.message);
        return reject(stderr || error.message);
      }

      console.log("✅ Lab started.");
      resolve(stdout.trim());
    });
  });
});



ipcMain.handle('stop-simulation', async () => {

  if (!CURRENT_LAB) {
    throw new Error("Nessuna simulazione attiva in questa sessione.");
  }

  const { name, labsDir, labPath } = CURRENT_LAB;

  // usa -n <labname> per essere espliciti
  const safeName = String(name).replace(/"/g, '\\"');
  //const cmd = `kathara lclean -n "${safeName}"`;
 const cmd = `kathara lclean -d "${labsDir}"`;

  console.log("🛑 Stopping lab with:", cmd);

  return await new Promise((resolve, reject) => {
    exec(cmd, async (error, stdout, stderr) => {
      if (error) {
        console.error("❌ lclean failed:", stderr || error.message);
        return reject(stderr || error.message);
      }

      await emptyKatharaLabs(labsDir);
      
      console.log("✅ lclean done.");
      resolve(stdout.trim());
    });
  });
});



if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
    protocol.handle('icr', (request) => {
      const filePath = request.url.slice('icr://'.length)
      return net.fetch(url.pathToFileURL(getAssetPath(filePath)).toString())
    })
  })
  .catch(console.log);

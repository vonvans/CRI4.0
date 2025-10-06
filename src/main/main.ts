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

/*ipcMain.handle("simulate-attack", async (event, { container, command }) => {
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
});*/


import { spawn } from 'child_process'; // metti questa importazione vicino a `import { exec } from 'child_process';`

// ...

/*
ipcMain.handle("simulate-attack", async (event, { container, command }) => {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] simulate-attack request`);
  console.log(`Image name received: ${container}`);
  console.log('Raw command payload (main):', command);

  // ------- Normalizzazione comando -------
  // Accettiamo:
  // - array di token: ['sh','/usr/local/bin/script.sh','192.168.10.1']
  // - stringa con spazi: "sh /usr/local/bin/script.sh 192.168.10.1"
  // - stringa con virgole: "sh,/usr/local/bin/script.sh,192.168.10.1"
  // - array con singolo elemento che contiene virgole: ["sh,/usr/..."]
  let args: string[] = [];

  try {
    if (Array.isArray(command)) {
      args = command.flatMap((el) =>
        String(el).split(/[,\s]+/).filter(Boolean)
      );
    } else if (typeof command === 'string') {
      args = command.trim().split(/[,\s]+/).filter(Boolean);
    } else {
      throw new Error('Invalid command type');
    }

    // rimuovi virgolette esterne residue e whitespace
    args = args.map(a => a.replace(/^["']|["']$/g, '').trim()).filter(Boolean);

    // de-dup mantenendo ordine
    const seen = new Set<string>();
    args = args.filter(x => (seen.has(x) ? false : (seen.add(x), true)));

    if (args.length === 0) {
      throw new Error('No valid command arguments after normalization.');
    }

    console.log('Normalized args for docker exec:', args);
  } catch (err) {
    console.error('❌ Failed to normalize command:', err);
    throw err;
  }

  // ------- Trova container corrispondente all'immagine -------
  const containerName = await new Promise<string>((resolve, reject) => {
    exec(
      `docker ps --filter ancestor=${container} --format "{{.Names}}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Error looking for container:", stderr || err.message);
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

  // ------- Esegui con spawn (arg array sicuro) -------
  return new Promise((resolve, reject) => {
    const dockerArgs = ['exec', containerName, ...args];
    console.log('Spawning process:', 'docker', dockerArgs.join(' '));

    const proc = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Command failed (code ' + code + '):', stderr || `exit ${code}`);
        return reject(stderr || `exit ${code}`);
      }
      console.log('✅ Command output:', stdout.trim());
      resolve(stdout.trim());
    });

    proc.on('error', (err) => {
      console.error('❌ Spawn error:', err);
      reject(err.message || String(err));
    });
  });
});

*/

ipcMain.handle("simulate-attack", async (event, payload: any) => {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] simulate-attack request`);

  // estrai campi
  const commandArgs =
    Array.isArray(payload?.commandArgs) && payload.commandArgs.length
      ? payload.commandArgs.map(String)
      : undefined;

  const commandStr =
    typeof payload?.command === "string" && payload.command.trim()
      ? payload.command.trim()
      : undefined;

  const containerNameFromPayload =
    typeof payload?.containerName === "string" && payload.containerName.trim()
      ? payload.containerName.trim()
      : undefined;

  const rawContainerField =
    typeof payload?.container === "string" && payload.container.trim()
      ? payload.container.trim()
      : undefined;

  const imageName =
    typeof payload?.imageName === "string" && payload.imageName.trim()
      ? payload.imageName.trim()
      : undefined;

  // costruisci args (priorità array)
  let args: string[] = [];
  if (commandArgs) {
    args = commandArgs;
  } else if (commandStr) {
    args = (commandStr.match(/\S+/g) || []).map(String);
  } else {
    throw new Error("No command provided (commandArgs/command missing).");
  }
  if (!args.length) throw new Error("Empty command arguments.");

  console.log("Raw payload fields:", { rawContainerField, containerNameFromPayload, imageName });
  console.log("Command ARGS (final):", args);

  // decide quale valore usare per risolvere il container (priorità containerNameFromPayload)
  // prende in ordine: containerNameFromPayload || rawContainerField || imageName
  const candidate = containerNameFromPayload || rawContainerField || imageName;
  if (!candidate) {
    throw new Error("No container information provided (containerName/container/imageName missing).");
  }

  // helper: riconosce se una stringa sembra un reference immagine (contiene / o : o @)
  const isImageRef = (s: string) => /[\/:@]/.test(s);

  // ------- Trova container corrispondente all'immagine (riciclato esattamente come richiesto) -------
  const containerName: string = await new Promise((resolve, reject) => {
    // se il candidato non è un image-ref, usalo direttamente come nome container
    if (!isImageRef(candidate)) {
      console.log("Candidate appears to be a container name, using directly:", candidate);
      return resolve(candidate);
    }

    // altrimenti (se è image-like) esegui il blocco originale per risolvere il container dall'immagine
    exec(
      `docker ps --filter ancestor=${candidate} --format "{{.Names}}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Error looking for container:", stderr || err.message);
          return reject("Failed to find container for image: " + candidate);
        }

        const name = stdout.trim().split("\n")[0];
        if (!name) {
          console.warn("⚠️ No running container found for image:", candidate);
          return reject("No running container found for image: " + candidate);
        }

        console.log(`✅ Using container: ${name}`);
        resolve(name);
      }
    );
  });

  // ------- Esegui con spawn (arg array sicuro) -------
  return await new Promise((resolve, reject) => {
    const dockerArgs = ["exec", containerName, ...args];
    console.log("Spawning process:", "docker", dockerArgs.join(" "));

    const proc = spawn("docker", dockerArgs, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error(`❌ Command failed (code ${code}):`, stderr || `exit ${code}`);
        return reject(stderr || `exit ${code}`);
      }
      console.log("✅ Command output:", stdout.trim());
      resolve(stdout.trim());
    });

    proc.on("error", (err) => {
      console.error("❌ Spawn error:", err);
      reject(err.message || String(err));
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



// --- helper per eseguire comandi in modo sicuro (no shell injection) ---
function runCmd(cmd: string, args: string[], opts: {cwd?: string, timeoutMs?: number} = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    let timedOut = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          try { child.kill('SIGKILL'); } catch {}
        }, opts.timeoutMs)
      : null;

    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));

    child.on('close', code => {
      if (timer) clearTimeout(timer);
      if (timedOut) return reject(new Error('command timeout'));
      if (code === 0) return resolve(out.trim());
      reject(new Error(err || `exit ${code}`));
    });

    child.on('error', e => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
  });
}



// --- shutdown orchestrato ---
let IS_SHUTTING_DOWN = false;

async function gracefulShutdown() {
  if (IS_SHUTTING_DOWN) return;
  IS_SHUTTING_DOWN = true;

  try {
    // 🔽 qui metti il comando che vuoi eseguire alla chiusura
    // Esempio: pulizia Kathara SE c'è un lab attivo
    if (CURRENT_LAB) {
      console.log('🧹 On-exit: kathara lclean …', CURRENT_LAB.labsDir);
      await runCmd('kathara', ['lclean', '-d', CURRENT_LAB.labsDir], { timeoutMs: 20_000 });
      await emptyKatharaLabs(CURRENT_LAB.labsDir);
    }

    // Oppure, un qualsiasi comando di shell:
    // await runCmd('sh', ['-lc', 'echo "bye" && date'], { timeoutMs: 5000 });

  } catch (e) {
    console.error('❌ On-exit command failed:', e);
  } finally {
    // esci subito senza rientrare in before-quit (eviti loop)
    app.exit(0);
  }
}

// --- intercetta Ctrl+C e terminazioni ---
process.on('SIGINT', () => {
  console.log('📴 Caught SIGINT (Ctrl+C)');
  gracefulShutdown();
});

process.on('SIGTERM', () => {
  console.log('📴 Caught SIGTERM');
  gracefulShutdown();
});

// quando Electron vuole chiudere (click X o sistema)
app.on('before-quit', (event) => {
  // preveniamo l’uscita immediata, facciamo cleanup e poi usciamo noi
  if (!IS_SHUTTING_DOWN) {
    event.preventDefault();
    gracefulShutdown();
  }
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

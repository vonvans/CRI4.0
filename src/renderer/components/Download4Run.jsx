import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

/**
 * Funzione per generare un file ZIP contenente il laboratorio Kathara.
 * @param {Array} machines - Lista delle macchine
 * @param {Object} labInfo - Informazioni sul laboratorio
 * @param {string} outputPath - Percorso dove salvare lo ZIP
 */
export async function generateZip(machines, labInfo, outputPath) {
  const zip = new AdmZip();

  // ✅ Puoi personalizzare qui la logica di generazione file
  // Aggiungi file di configurazione lab
 zip.addFile(`${labInfo.name}/lab.conf`, Buffer.from(`# Lab: ${labInfo.name}\n`));

machines.forEach((machine) => {
  const machineConf = `hostname=${machine.name}\ntype=${machine.type}`;
  zip.addFile(`${labInfo.name}/${machine.name}/machine.conf`, Buffer.from(machineConf));
});

  // Salva lo zip nel percorso indicato
  zip.writeZip(outputPath);
}
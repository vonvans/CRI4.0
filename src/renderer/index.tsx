/* eslint-disable prettier/prettier */
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './Layout';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<HashRouter><App /></HashRouter>);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);

window.addEventListener('beforeunload', () => {
  if (performance.getEntriesByType('navigation')[0].type !== 'reload') {
    localStorage.removeItem("navbar");
  }
});

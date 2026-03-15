/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
import { Button, Input } from '@nextui-org/react';
import { DownloadSymbol } from './Symbols/DownloadSymbol';
import { UploadSymbol } from './Symbols/UploadSymbol';
import { makeDownload, generateConfig } from '../scripts/make';

export function Configuration({ machines, labInfo, setMachines, setLabInfo }) {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      let fileReader = new FileReader();
      fileReader.onloadend = function (e) {
        try {
          let app = JSON.parse(e.target.result);
          setMachines(app[0].netkit);
          setLabInfo(app[0].labInfo);
        } catch (err) {
          console.error('Error parsing file:', err);
        }
      };
      fileReader.readAsText(file);
    }
    event.target.value = null;
  };

  return (
    <div className="grid gap-2">
      <div>
        <div className="grid p-2 justify-items-center">
          <h1 className="text-2xl">Save & Load</h1>
        </div>
        <div className="grid gap-2">
          <div>
            <label htmlFor="file-upload">
              <input
                id="file-upload"
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <Button
                as="span"
                className="w-full"
                startContent={<UploadSymbol />}
              >
                Import Config
              </Button>
            </label>
          </div>
          <Button
            onClick={() =>
              makeDownload(generateConfig(machines, labInfo), 'netkit.config')
            }
            startContent={<DownloadSymbol />}
          >
            Download Config
          </Button>
        </div>
      </div>
    </div>
  );
}

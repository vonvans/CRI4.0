/* eslint-disable react/no-array-index-key */
/* eslint-disable prettier/prettier */
// eslint-disable-next-line prettier/prettier
import { useState, useEffect } from "react";

function Settings() {
    const [dockerImages, setDockerImages] = useState([]);

    useEffect(() => {
        const fetchDockerImages = async () => {
          try {
            const images = await window.electron.ipcRenderer.invoke('docker-images');
            setDockerImages(images);
          } catch (error) {
            console.error('Error fetching Docker images:', error);
          }
        };

        fetchDockerImages();
      }, []);

  return (
    <div>
      <h1>Docker Images List</h1>
      {dockerImages.map((image, index) => (
          <h5 key={index}> {image}</h5>
      ))}
    </div>
  );
}

export default Settings;

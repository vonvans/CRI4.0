const API_URL = 'http://localhost:3001/api';

const ProjectService = {
    listSaves: async () => {
        try {
            const response = await fetch(`${API_URL}/saves`);
            if (!response.ok) throw new Error("Failed to list saves");
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    saveProject: async (labInfo, machines, filename) => {
        // Prepare machines by fetching content from containers if currently running
        const processedMachines = await Promise.all(machines.map(async (m) => {
            if (m.type === 'scada' || m.type === 'plc') {
                try {
                    const res = await fetch(`${API_URL}/machine-content`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ machineName: m.name, type: m.type })
                    });

                    if (res.ok) {
                        const { output } = await res.json();
                        if (output) {
                            return {
                                ...m,
                                industrial: {
                                    ...(m.industrial || {}),
                                    [m.type === 'scada' ? 'scadaProjectContent' : 'plcProgramContent']: output
                                }
                            };
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch content for ${m.name}`, e);
                }
            }
            return m;
        }));

        const projectData = {
            labInfo,
            machines: processedMachines,
            meta: {
                version: "1.0",
                createdAt: new Date().toISOString(),
                appVersion: "4.0"
            }
        };

        try {
            const response = await fetch(`${API_URL}/saves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, data: projectData })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to save");
            }

            return { success: true, filename };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    loadProject: async (filename) => {
        try {
            const response = await fetch(`${API_URL}/saves/${filename}`);
            if (!response.ok) throw new Error("Failed to load project");

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    deleteProject: async (filename) => {
        try {
            const response = await fetch(`${API_URL}/saves/${filename}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Failed to delete project");
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    uploadProject: async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const content = reader.result; // Base64 string
                    const response = await fetch(`${API_URL}/saves/upload`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: file.name, content })
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        resolve({ success: false, error: err.error || "Upload failed" });
                    } else {
                        const data = await response.json();
                        resolve({ success: true, filename: data.filename });
                    }
                } catch (e) {
                    resolve({ success: false, error: e.message });
                }
            };
            reader.onerror = (error) => resolve({ success: false, error: "File reading failed" });
        });
    },

    getDownloadUrl: (filename) => {
        return `${API_URL}/saves/${filename}/download`;
    }
};

export default ProjectService;

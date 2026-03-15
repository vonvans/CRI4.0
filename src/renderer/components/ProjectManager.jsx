import React, { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Listbox, ListboxItem, useDisclosure } from "@nextui-org/react";
import ProjectService from '../services/ProjectService';
import { DownloadSymbol } from "./Symbols/DownloadSymbol";
import { UploadSymbol } from "./Symbols/UploadSymbol";
import { toast } from 'react-hot-toast';

export function ProjectManager({ machines, labInfo, setMachines, setLabInfo }) {
    const { isOpen: isLoadOpen, onOpen: onLoadOpen, onOpenChange: onLoadOpenChange } = useDisclosure();
    const { isOpen: isSaveOpen, onOpen: onSaveOpen, onOpenChange: onSaveOpenChange } = useDisclosure();

    const [saveFilename, setSaveFilename] = useState("");
    const [savesList, setSavesList] = useState([]);
    const [currentProjectName, setCurrentProjectName] = useState("");

    const fetchSaves = async () => {
        const list = await ProjectService.listSaves();
        setSavesList(list);
    };

    const handleSave = async (onClose) => {
        if (!saveFilename) return;

        const result = await ProjectService.saveProject(labInfo, machines, saveFilename);
        if (result.success) {
            toast.success(`Project saved as ${result.filename}`);
            setCurrentProjectName(result.filename);

            // Trigger automatic download
            try {
                const downloadUrl = ProjectService.getDownloadUrl(result.filename);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', `${result.filename}.cri`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                console.error("Auto-download failed:", e);
                toast.error("Auto-download failed");
            }

            onClose();
        } else {
            toast.error("Failed to save project: " + result.error);
        }
    };

    const handleLoad = async (filename, onClose) => {
        const result = await ProjectService.loadProject(filename);
        if (result.success) {
            // Updated ProjectService returns { success: true, data: { ... } }
            // Expected content from API loadProject is the full JSON object
            const loadedData = result.data;

            // Check structure (legacy or new)
            // New structure from saveProject: { labInfo, machines, meta }
            if (loadedData.labInfo && loadedData.machines) {
                setLabInfo(loadedData.labInfo);
                setMachines(loadedData.machines);
            } else if (loadedData.project) { // Handle potential legacy structure if any
                setLabInfo(loadedData.project.labInfo);
                setMachines(loadedData.project.machines);
            } else {
                console.warn("Unknown project structure", loadedData);
                // Fallback attempt
                setLabInfo(loadedData.labInfo || loadedData);
            }

            toast.success(`Project ${filename} loaded`);
            setCurrentProjectName(filename);
            onClose();
        } else {
            toast.error("Failed to load project: " + result.error);
        }
    };

    const handleDelete = async (filename) => {
        if (confirm(`Are you sure you want to delete ${filename}?`)) {
            const result = await ProjectService.deleteProject(filename);
            if (result.success) {
                toast.success("Project deleted");
                fetchSaves();
            } else {
                toast.error("Failed to delete: " + result.error);
            }
        }
    };

    return (
        <div className="grid gap-2 border-b border-gray-200 pb-4 mb-2">
            <div className="flex justify-between items-center px-1">
                <span className="text-sm font-semibold text-gray-600">Project</span>
                <span className="text-xs text-blue-500 truncate max-w-[100px]" title={currentProjectName}>
                    {currentProjectName || "Unsaved"}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Button
                    onPress={() => { fetchSaves(); onLoadOpen(); }}
                    startContent={<UploadSymbol />}
                    size="sm"
                    color="primary"
                    variant="flat"
                    className="w-full"
                >
                    Load
                </Button>
                <Button
                    onPress={onSaveOpen}
                    startContent={<DownloadSymbol />}
                    size="sm"
                    color="success"
                    className="w-full"
                >
                    Save
                </Button>
            </div>

            {/* Load Modal */}
            <Modal isOpen={isLoadOpen} onOpenChange={onLoadOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Load Project</ModalHeader>
                            <ModalBody>
                                <div className="flex justify-end mb-2">
                                    <input
                                        type="file"
                                        accept=".cri"
                                        style={{ display: 'none' }}
                                        id="upload-project-input"
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;

                                            const toastId = toast.loading("Uploading...");
                                            const result = await ProjectService.uploadProject(file);

                                            if (result.success) {
                                                toast.success("Upload successful", { id: toastId });
                                                fetchSaves();
                                            } else {
                                                toast.error("Upload failed: " + result.error, { id: toastId });
                                            }
                                            // Reset input
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        variant="flat"
                                        onPress={() => document.getElementById('upload-project-input').click()}
                                        startContent={<UploadSymbol />}
                                    >
                                        Upload .cri
                                    </Button>
                                </div>
                                {savesList.length === 0 ? (
                                    <p className="text-gray-500">No saved projects found.</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {savesList.map(file => (
                                            <div key={file} className="flex justify-between items-center p-2 hover:bg-gray-100 rounded cursor-pointer">
                                                <span onClick={() => handleLoad(file, onClose)} className="flex-1 font-mono">
                                                    {file}
                                                </span>
                                                <Button size="sm" color="danger" variant="light" onPress={() => handleDelete(file)}>
                                                    Delete
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Save Modal */}
            <Modal isOpen={isSaveOpen} onOpenChange={onSaveOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Save Project</ModalHeader>
                            <ModalBody>
                                <Input
                                    label="Filename"
                                    placeholder="my-project"
                                    value={saveFilename}
                                    onValueChange={setSaveFilename}
                                    description="The project will be saved in the 'saves' directory."
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button color="primary" onPress={() => handleSave(onClose)}>
                                    Save
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}

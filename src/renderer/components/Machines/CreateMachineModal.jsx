/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from 'uuid';
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
    Button, RadioGroup, Radio,
    Tabs, Tab,
} from "@nextui-org/react";
import { api } from "../../api/index";
import { XSymbol } from "../Symbols/XSymbol";

export default function CreateMachineModal({ isOpen, onClose, onCreate, initialValues, title = "Create Custom Machine", hideLogo = false }) {
    const [baseMode, setBaseMode] = useState("upload");
    const [localImages, setLocalImages] = useState([]);
    const [isLoadingLocal, setIsLoadingLocal] = useState(false);
    const [selectedLocalImage, setSelectedLocalImage] = useState("");
    const [uploadedImage, setUploadedImage] = useState("");
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [uploadImageError, setUploadImageError] = useState("");
    const uploadInputRef = useRef(null);
    const [logo, setLogo] = useState("");
    const logoInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState("base");
    const [manifestContent, setManifestContent] = useState(null);
    const [manifestFileName, setManifestFileName] = useState("");
    const [manifestError, setManifestError] = useState("");
    const manifestInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        setLogo(initialValues?.logo || "");
        setSelectedLocalImage(initialValues?.image || "");
        setUploadedImage("");
        setUploadImageError("");
        setActiveTab("base");

        if (initialValues?.manifest) {
            setManifestContent(initialValues.manifest);
            setManifestFileName("manifest.json");
        } else {
            setManifestContent(null);
            setManifestFileName("");
        }
        setManifestError("");

        setBaseMode("upload");
        setIsLoadingLocal(true);
        api.getAllLocalImages()
            .then(imgs => setLocalImages(imgs || []))
            .catch(() => setLocalImages([]))
            .finally(() => setIsLoadingLocal(false));
    }, [isOpen]);

    function getSelectedImage() {
        if (baseMode === "local") return selectedLocalImage || (initialValues?.image || "");
        if (baseMode === "upload") return uploadedImage || (initialValues?.image || "");
        return initialValues?.image || "";
    }

    function readManifestFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                setManifestContent(parsed);
                setManifestFileName(file.name);
                setManifestError("");
            } catch (e) {
                setManifestError("Invalid JSON: " + e.message);
                setManifestContent(null);
            }
        };
        reader.readAsText(file);
    }

    function handleCreate() {
        const machineName = manifestContent?.image_name?.trim();
        if (!machineName) return;
        const image = machineName;
        const manifest = {
            ...manifestContent,
            fields: manifestContent.fields || {},
            dockerFlags: (manifestContent.dockerFlags || []).map(f => ({ ...f, id: f.id || uuidv4() })),
        };
        onCreate({ name: machineName, image, logo, manifest });
        handleReset();
    }

    function handleReset() {
        setBaseMode("upload");
        setLocalImages([]);
        setSelectedLocalImage("");
        setUploadedImage("");
        setIsLoadingImage(false);
        setUploadImageError("");
        setLogo("");
        setManifestContent(null);
        setManifestFileName("");
        setManifestError("");
        setActiveTab("base");
        onClose();
    }

    async function handleLoadDockerImage(file) {
        setIsLoadingImage(true);
        setUploadImageError("");
        try {
            const result = await api.loadDockerImage(file);
            if (result.canceled) return;
            if (result.error) { setUploadImageError(result.error); return; }
            setUploadedImage(result.tag || "");
        } catch (e) {
            setUploadImageError(String(e));
        } finally {
            setIsLoadingImage(false);
        }
    }

    function handleLogoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setLogo(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = "";
    }

    const fieldCount = Object.keys(manifestContent?.fields || {}).length;
    const flagCount = manifestContent?.dockerFlags?.length || 0;

    return (
        <Modal isOpen={isOpen} onOpenChange={handleReset} size="3xl" scrollBehavior="inside">
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader>{title}</ModalHeader>
                        <ModalBody>
                            <div className="grid gap-4">
                                {/* Logo */}
                                {!hideLogo && <div className="flex items-center gap-2">
                                    <div
                                        className="w-12 h-12 rounded-xl border border-default-200 bg-default-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                                        onClick={() => logoInputRef.current?.click()}
                                        title="Upload logo"
                                    >
                                        {logo ? (
                                            <img src={logo} alt="logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                                <polyline points="21 15 16 10 5 21"/>
                                            </svg>
                                        )}
                                    </div>
                                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    {logo && (
                                        <Button size="sm" variant="flat" color="danger" isIconOnly onPress={() => setLogo("")} title="Remove logo">
                                            <XSymbol size={14} />
                                        </Button>
                                    )}
                                </div>}

                                <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab} aria-label="Machine configuration tabs">
                                    {/* ── BASE IMAGE ── */}
                                    <Tab key="base" title="Base Image">
                                        <div className="grid gap-3 pt-2">
                                            {initialValues?.image && (
                                                <p className="text-xs text-default-400 font-mono">
                                                    Current: <span className="text-default-600">{initialValues.image}</span>
                                                </p>
                                            )}
                                            <RadioGroup
                                                value={baseMode}
                                                onValueChange={setBaseMode}
                                                orientation="horizontal"
                                                label="Image source"
                                            >
                                                <Radio value="upload">Upload .tar</Radio>
                                                <Radio value="local">Local Registry</Radio>
                                            </RadioGroup>

                                            {baseMode === "local" && (
                                                <div className="grid gap-2">
                                                    {isLoadingLocal ? (
                                                        <p className="text-sm text-default-400">Loading local images...</p>
                                                    ) : localImages.length === 0 ? (
                                                        <p className="text-sm text-default-400">No local images found.</p>
                                                    ) : (
                                                        <div className="border rounded-lg overflow-auto max-h-52">
                                                            {localImages.map((img) => {
                                                                const sel = selectedLocalImage === img;
                                                                return (
                                                                    <div
                                                                        key={img}
                                                                        className={`p-2 cursor-pointer font-mono text-sm ${sel ? "bg-[#DD4040] hover:bg-[#DD4040] text-white" : "hover:bg-default-100"}`}
                                                                        onClick={() => setSelectedLocalImage(img)}
                                                                    >
                                                                        {img}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {baseMode === "upload" && (
                                                <div className="grid gap-2">
                                                    {isLoadingImage ? (
                                                        <div className="flex items-center justify-center h-24 gap-2 text-sm text-default-400">
                                                            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                                            </svg>
                                                            Loading image…
                                                        </div>
                                                    ) : uploadedImage ? (
                                                        <div className="flex items-center justify-between p-3 bg-success-50 border border-success-200 rounded-xl">
                                                            <div>
                                                                <p className="text-xs text-success-600 font-medium">Image loaded</p>
                                                                <p className="font-mono text-sm text-success-800">{uploadedImage}</p>
                                                            </div>
                                                            <Button size="sm" variant="light" color="danger" onPress={() => { setUploadedImage(""); setUploadImageError(""); }}>
                                                                Clear
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <input
                                                                ref={uploadInputRef}
                                                                type="file"
                                                                accept=".tar"
                                                                className="sr-only"
                                                                onChange={(e) => { handleLoadDockerImage(e.target.files?.[0]); e.target.value = ""; }}
                                                            />
                                                            <label
                                                                className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all"
                                                                onDragOver={(e) => e.preventDefault()}
                                                                onDrop={(e) => { e.preventDefault(); handleLoadDockerImage(e.dataTransfer.files?.[0]); }}
                                                                onClick={() => uploadInputRef.current?.click()}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                                                </svg>
                                                                <span className="mt-1 text-xs font-medium text-default-600">Click or drag a Docker <code className="font-mono">.tar</code> file</span>
                                                                <span className="text-[10px] text-default-400 mt-0.5">Exported with <code className="font-mono">docker save</code></span>
                                                            </label>
                                                        </>
                                                    )}
                                                    {uploadImageError && (
                                                        <p className="text-xs text-danger-600 font-mono px-1">{uploadImageError}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Tab>

                                    {/* ── MANIFEST ── */}
                                    <Tab key="manifest" title="Manifest">
                                        <div className="grid gap-3 pt-2">
                                            <p className="text-sm text-default-500">
                                                Upload a <code className="text-xs bg-default-100 px-1 rounded font-mono">manifest.json</code> that describes the machine's configurable fields and docker options.
                                            </p>

                                            {!manifestContent ? (
                                                <>
                                                    <input
                                                        ref={manifestInputRef}
                                                        type="file"
                                                        accept=".json,application/json"
                                                        className="sr-only"
                                                        onChange={(e) => { readManifestFile(e.target.files?.[0]); e.target.value = ""; }}
                                                    />
                                                    <label
                                                        className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all"
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => { e.preventDefault(); readManifestFile(e.dataTransfer.files?.[0]); }}
                                                        onClick={() => manifestInputRef.current?.click()}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                                        </svg>
                                                        <span className="mt-1 text-xs font-medium text-default-600">Click or drag a <code className="font-mono">manifest.json</code> file</span>
                                                    </label>
                                                    {manifestError && (
                                                        <p className="text-xs text-danger-600 font-mono px-1">{manifestError}</p>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="grid gap-2">
                                                    <div className="flex items-center justify-between p-3 bg-success-50 border border-success-200 rounded-xl">
                                                        <div>
                                                            <p className="text-xs text-success-600 font-medium">Manifest loaded — {manifestFileName}</p>
                                                            {manifestContent.image_name && (
                                                                <p className="font-mono text-sm text-success-800">{manifestContent.image_name}</p>
                                                            )}
                                                            <p className="text-xs text-success-600 mt-0.5">
                                                                {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                                                                {flagCount > 0 ? `, ${flagCount} docker flag${flagCount !== 1 ? "s" : ""}` : ""}
                                                            </p>
                                                        </div>
                                                        <Button size="sm" variant="light" color="danger" onPress={() => { setManifestContent(null); setManifestFileName(""); setManifestError(""); }}>
                                                            Clear
                                                        </Button>
                                                    </div>
                                                    <pre className="border border-default-200 rounded-lg px-3 py-2 text-xs font-mono whitespace-pre overflow-auto max-h-64 bg-zinc-950 text-zinc-300 leading-relaxed">
                                                        {JSON.stringify(manifestContent, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </Tab>
                                </Tabs>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={handleReset}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleCreate}
                                isDisabled={!manifestContent?.image_name?.trim()}
                            >
                                {initialValues ? "Update Machine" : "Create Machine"}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}

/* eslint-disable prettier/prettier */
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import {
    Tabs, Tab, Button,
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@nextui-org/react";
import CreateMachineModal from "../components/Machines/CreateMachineModal";
import { PlusSymbol } from "../components/Symbols/PlusSymbol";
import { XSymbol } from "../components/Symbols/XSymbol";

function useLocalStorage(key) {
    const [items, setItems] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    function save(updated) {
        setItems(updated);
        localStorage.setItem(key, JSON.stringify(updated));
    }
    return { items, save };
}

function useTemplates() {
    const { items: templates, save } = useLocalStorage("customTemplates");
    return { templates, save };
}

function EditIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

/* ── Custom Machines sub-page ── */
function CustomMachinesTab() {
    const { templates, save } = useTemplates();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    function handleCreate({ name, image, logo, manifest }) {
        save([...templates, { id: uuidv4(), name, image, logo: logo || "", manifest: manifest || { fields: {}, dockerFlags: [] } }]);
        setIsCreateOpen(false);
    }

    function handleUpdate({ name, image, logo, manifest }) {
        save(templates.map(t =>
            t.id === editTarget.id ? { ...t, name, image, logo: logo || "", manifest: manifest || { fields: {}, dockerFlags: [] } } : t
        ));
        setEditTarget(null);
    }

    function handleDelete(id) {
        save(templates.filter(t => t.id !== id));
    }

    return (
        <div className="grid gap-4 pt-4">
            <div className="flex justify-end">
                <Button
                    color="primary"
                    size="sm"
                    className="text-white"
                    endContent={<PlusSymbol fill="white" size={18} />}
                    onPress={() => setIsCreateOpen(true)}
                >
                    Create
                </Button>
            </div>

            <Table aria-label="Custom machines table" removeWrapper>
                <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Image</TableColumn>
                    <TableColumn>Fields</TableColumn>
                    <TableColumn className="w-0">Actions</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No custom machines yet. Click Create to add one.">
                    {templates.map((tpl) => (
                        <TableRow key={tpl.id}>
                            <TableCell className="font-medium">{tpl.name}</TableCell>
                            <TableCell>
                                <span className="font-mono text-sm text-default-600">
                                    {tpl.image || <span className="text-default-400 italic">—</span>}
                                </span>
                            </TableCell>
                            <TableCell>
                                {Object.keys(tpl.manifest?.fields || {}).length > 0
                                    ? <span className="text-sm">{Object.keys(tpl.manifest.fields).length} field{Object.keys(tpl.manifest.fields).length !== 1 ? "s" : ""}</span>
                                    : <span className="text-default-400 text-sm">—</span>
                                }
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        onPress={() => setEditTarget(tpl)}
                                        aria-label="Edit"
                                    >
                                        <EditIcon />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        color="danger"
                                        variant="flat"
                                        onPress={() => handleDelete(tpl.id)}
                                        aria-label="Delete"
                                    >
                                        <XSymbol size={16} />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Create modal */}
            <CreateMachineModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreate={handleCreate}
            />

            {/* Edit modal */}
            <CreateMachineModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onCreate={handleUpdate}
                initialValues={editTarget}
            />
        </div>
    );
}

/* ── Custom Attacks sub-page ── */
function CustomAttacksTab() {
    const { items: attacks, save } = useLocalStorage("customAttacks");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    function handleCreate({ name, image, logo, manifest }) {
        save([...attacks, { id: uuidv4(), name, image, logo: logo || "", manifest: manifest || { fields: {}, dockerFlags: [] } }]);
        setIsCreateOpen(false);
    }

    function handleUpdate({ name, image, logo, manifest }) {
        save(attacks.map(t =>
            t.id === editTarget.id ? { ...t, name, image, logo: logo || "", manifest: manifest || { fields: {}, dockerFlags: [] } } : t
        ));
        setEditTarget(null);
    }

    function handleDelete(id) {
        save(attacks.filter(t => t.id !== id));
    }

    return (
        <div className="grid gap-4 pt-4">
            <div className="flex justify-end">
                <Button
                    color="primary"
                    size="sm"
                    className="text-white"
                    endContent={<PlusSymbol fill="white" size={18} />}
                    onPress={() => setIsCreateOpen(true)}
                >
                    Create
                </Button>
            </div>

            <Table aria-label="Custom attacks table" removeWrapper>
                <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Image</TableColumn>
                    <TableColumn>Fields</TableColumn>
                    <TableColumn className="w-0">Actions</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No custom attacks yet. Click Create to add one.">
                    {attacks.map((tpl) => (
                        <TableRow key={tpl.id}>
                            <TableCell className="font-medium">{tpl.name}</TableCell>
                            <TableCell>
                                <span className="font-mono text-sm text-default-600">
                                    {tpl.image || <span className="text-default-400 italic">—</span>}
                                </span>
                            </TableCell>
                            <TableCell>
                                {Object.keys(tpl.manifest?.fields || {}).length > 0
                                    ? <span className="text-sm">{Object.keys(tpl.manifest.fields).length} field{Object.keys(tpl.manifest.fields).length !== 1 ? "s" : ""}</span>
                                    : <span className="text-default-400 text-sm">—</span>
                                }
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Button isIconOnly size="sm" variant="flat" onPress={() => setEditTarget(tpl)} aria-label="Edit">
                                        <EditIcon />
                                    </Button>
                                    <Button isIconOnly size="sm" color="danger" variant="flat" onPress={() => handleDelete(tpl.id)} aria-label="Delete">
                                        <XSymbol size={16} />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <CreateMachineModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreate={handleCreate}
                title="Create Custom Attack"
                hideLogo
            />
            <CreateMachineModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onCreate={handleUpdate}
                initialValues={editTarget}
                title="Edit Custom Attack"
                hideLogo
            />
        </div>
    );
}

/* ── Settings page ── */
function Settings() {
    return (
        <div className="p-6">
            <h1 className="text-xl font-semibold mb-4">Settings</h1>
            <Tabs aria-label="Settings sections" variant="underlined" color="primary">
                <Tab key="custom-machines" title="Custom Machines">
                    <CustomMachinesTab />
                </Tab>
                <Tab key="custom-attacks" title="Custom Attacks">
                    <CustomAttacksTab />
                </Tab>
            </Tabs>
        </div>
    );
}

export default Settings;

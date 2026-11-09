/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { Button, Tabs, Tab } from "@nextui-org/react";
import { MdRefresh, MdOpenInNew } from "react-icons/md";
import { api } from "../api";

// Hide Arkime's top navigation bar inside the embedded viewer. The iframe is
// same-origin (served under /arkime via the app's reverse proxy), so we can
// reach its document and inject a <style>. Done on every load because Arkime is
// a Vue SPA that re-renders the frame on navigation. Our own sub-tabs replace
// Arkime's navbar as the way to move between views.
function injectArkimeCss(e) {
    try {
        const doc = e.target.contentDocument;
        if (!doc) return;
        let style = doc.getElementById("cri40-arkime-style");
        if (!style) {
            style = doc.createElement("style");
            style.id = "cri40-arkime-style";
            doc.head.appendChild(style);
        }
        style.textContent = `
            .navbar { display: none !important; }
            .navbarOffset { margin-top: 0 !important; padding-top: 0 !important; }
        `;
    } catch (_) {
        /* cross-origin: nothing we can do, leave the frame untouched */
    }
}

const VIEWS = [
    { key: "general", label: "General" },
    { key: "sessions", label: "Sessions" },
    { key: "packets", label: "Uniques" },
    { key: "connections", label: "Connection Graph" },
];

// Embedded Arkime traffic-analysis viewer (General / Sessions / Packets /
// Connection Graph). Rendered inside the Report page. `heightClass` controls the
// iframe area height so the component can live in a scrolling page.
//
// When `grow` is true the component fills its parent (which must be a flex
// column with a bounded height) and the iframe/content area expands to take all
// remaining space instead of using a fixed `heightClass`.
//
// `extraTabs` prepends custom tabs before the Arkime views, each:
//   { key, label, content, description? }
// When an extra tab is selected its `content` is rendered instead of the iframe
// (and the Arkime Reload/Open controls are hidden). Used by Report to surface
// the "Log Insights" table as the first tab of Statistics.
export default function ArkimeViewer({ heightClass = "h-[75vh]", grow = false, extraTabs = [] }) {
    const allTabs = [...extraTabs, ...VIEWS];
    const [urls, setUrls] = useState(null);
    const [selected, setSelected] = useState(allTabs[0]?.key || "general");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api.arkimeStatsUrls()
            .then((u) => { if (!cancelled) setUrls(u); })
            .catch((e) => console.error("Failed to get Arkime URLs", e));
        return () => { cancelled = true; };
    }, []);

    const activeExtra = extraTabs.find((t) => t.key === selected);
    const activeUrl = (!activeExtra && urls) ? urls[selected] : "";

    // The body area either grows to fill the parent (grow) or uses a fixed
    // height so the viewer can live inside a normally-scrolling page.
    const bodyClass = grow ? "flex-1 min-h-0" : heightClass;

    return (
        <div className={`flex flex-col gap-2${grow ? " h-full min-h-0" : ""}`}>
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-xl font-semibold text-white">Statistics</h1>
                    <p className="text-xs text-gray-400">
                        {activeExtra
                            ? (activeExtra.description || "")
                            : "Arkime traffic analysis. Available while a simulation is running."}
                    </p>
                </div>
                {!activeExtra && (
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="flat"
                            startContent={<MdRefresh />}
                            onPress={() => setReloadKey((k) => k + 1)}
                        >
                            Reload
                        </Button>
                        {activeUrl && (
                            <Button
                                size="sm"
                                variant="flat"
                                startContent={<MdOpenInNew />}
                                onPress={() => window.open(activeUrl, "_blank")}
                            >
                                Open in browser
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <Tabs
                aria-label="Statistics views"
                selectedKey={selected}
                onSelectionChange={(k) => setSelected(String(k))}
                size="sm"
            >
                {allTabs.map((v) => (
                    <Tab key={v.key} title={v.label} />
                ))}
            </Tabs>

            {activeExtra ? (
                <div className={`${bodyClass}${grow ? " overflow-auto" : ""}`}>{activeExtra.content}</div>
            ) : (
                <div className={`${bodyClass} bg-white rounded-md overflow-hidden border border-default-200`}>
                    {activeUrl ? (
                        <iframe
                            key={`${selected}-${reloadKey}`}
                            src={activeUrl}
                            title={`Arkime — ${selected}`}
                            className="w-full h-full border-none"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                            onLoad={injectArkimeCss}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-default-400">
                            Loading Arkime…
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

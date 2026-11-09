import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";

// Hide Arkime's top navigation bar inside an embedded viewer. The iframe is
// same-origin (served under /arkime via the app's reverse proxy), so we can
// reach its document and inject a <style>. Runs on every load because Arkime is
// a Vue SPA that re-renders the frame on navigation.
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

export default function UIModal({ isOpen, onClose, url, title, zoom = 1, hideArkimeNav = false }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="5xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            {title || "UI View"}
                        </ModalHeader>
                        <ModalBody>
                            <div className="w-full h-[600px] bg-white rounded-md overflow-hidden">
                                {url ? (
                                    <iframe
                                        src={url}
                                        title="UI View"
                                        className="w-full h-full border-none"
                                        style={{ zoom: zoom }}
                                        sandbox="allow-same-origin allow-scripts allow-forms"
                                        onLoad={hideArkimeNav ? injectArkimeCss : undefined}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        No URL provided
                                    </div>
                                )}
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <div className="flex-1 text-sm text-gray-500 self-center">
                                {url}
                            </div>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Close
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}

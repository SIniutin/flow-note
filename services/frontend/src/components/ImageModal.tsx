import { useState, useEffect } from "react";
import { Modal } from "./ui/surfaces";
import { Button } from "./ui/controls";
import { FileUpload } from "./ui/forms";
import { mediaClient, isValidPageId } from "../api/mediaClient";

interface Props {
    open:    boolean;
    onClose: () => void;
    /** Called with presigned media_id when upload to S3 succeeds, or base64 as fallback. */
    onApply: (src: string, mimeType: string, fileName: string, mediaId?: string) => void;
    pageId?: string;
    title?:  string;
}

export function ImageModal({ open, onClose, onApply, pageId, title = "Вставить изображение" }: Props) {
    const [file, setFile]       = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        if (!open) { setFile(null); setLoading(false); setError(null); }
    }, [open]);

    const apply = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        // Try S3 presigned upload if we have a valid page UUID
        if (pageId && isValidPageId(pageId)) {
            try {
                const mediaId = await mediaClient.uploadFile(pageId, file);
                // Pass empty src — EmbedMediaNodeView will fetch the download URL via media_id
                onApply("", file.type, file.name, mediaId);
                onClose();
                setLoading(false);
                return;
            } catch (e) {
                console.warn("[ImageModal] S3 upload failed, falling back to base64:", e);
            }
        }

        // Fallback: embed as base64 (non-UUID pages or upload error)
        const reader = new FileReader();
        reader.onloadend = () => {
            onApply(reader.result as string, file.type, file.name);
            onClose();
            setLoading(false);
        };
        reader.onerror = () => {
            setError("Не удалось прочитать файл");
            setLoading(false);
        };
        reader.readAsDataURL(file);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            footer={<>
                <Button variant="secondary" onClick={onClose}>Отмена</Button>
                <Button disabled={!file || loading} onClick={apply}>
                    {loading ? "Загрузка…" : "Применить"}
                </Button>
            </>}
        >
            <FileUpload value={file} onChange={setFile} />
            {error && (
                <div style={{ color: "var(--color-error, #e53e3e)", fontSize: "var(--fs-sm)", marginTop: 8 }}>
                    {error}
                </div>
            )}
        </Modal>
    );
}

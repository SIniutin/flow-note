import { useState, useEffect } from "react";
import { Modal } from "./ui/surfaces";
import { Button } from "./ui/controls";
import { FileUpload } from "./ui/forms";

interface Props {
    open: boolean;
    onClose: () => void;
    onApply: (base64: string, mimeType: string, fileName: string) => void;
    title?: string;
}

export function ImageModal({ open, onClose, onApply, title = "Вставить изображение" }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (!open) { setFile(null); setLoading(false); } }, [open]);

    const apply = () => {
        if (!file) return;
        setLoading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            onApply(reader.result as string, file.type, file.name);
            onClose();
            setLoading(false);
        };
        reader.onerror = () => setLoading(false);
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
        </Modal>
    );
}

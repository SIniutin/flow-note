import {useState, useEffect} from "react";
import {Modal} from "./ui/surfaces";
import {Button} from "./ui/controls";
import {FileUpload} from "./ui/forms";

interface Props {
    open: boolean;
    onClose: () => void;
    onApply: (base64: string) => void;
}

export function ImageModal({open, onClose, onApply}: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) {
            setFile(null);
            setLoading(false);
        }
    }, [open]);

    const apply = () => {
        console.log("ImageModal apply called, file:", file);
        if (!file) return;
        setLoading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            console.log("FileReader done, base64 length:", base64?.length);
            onApply(base64);
            onClose();
            setLoading(false);
        };
        reader.onerror = (e) => {
            console.error("FileReader error:", e);
            setLoading(false);
        };
        reader.readAsDataURL(file);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Вставить изображение"
            footer={<>
                <Button variant="secondary" onClick={onClose}>Отмена</Button>
                <Button disabled={!file || loading} onClick={apply}>
                    {loading ? "Загрузка…" : "Применить"}
                </Button>
            </>}
        >
            <FileUpload value={file} onChange={setFile}/>
        </Modal>
    );
}
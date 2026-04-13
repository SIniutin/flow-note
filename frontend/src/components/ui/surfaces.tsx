import React, {useEffect} from "react";
import "./surfaces.css";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    footer?: React.ReactNode;
    width?: number;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
                                                open, onClose, title, subtitle, footer, width = 420, children,
                                            }) => {
    useEffect(() => {
        if (!open) return;
        const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onEsc);
        return () => window.removeEventListener("keydown", onEsc);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="ui-overlay" onClick={onClose} role="presentation">
            <div
                className="ui-modal"
                style={{width}}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <header className="ui-modal__head">
                    <div>
                        <div className="ui-modal__title">{title}</div>
                        {subtitle && <div className="ui-modal__sub">{subtitle}</div>}
                    </div>
                    <button className="ui-modal__close" onClick={onClose} aria-label="Закрыть">×</button>
                </header>
                <div className="ui-modal__body">{children}</div>
                {footer && <footer className="ui-modal__foot">{footer}</footer>}
            </div>
        </div>
    );
};

interface SidePanelProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    width?: number;
    children: React.ReactNode;
}

export const SidePanel = React.forwardRef<HTMLElement, SidePanelProps>(function SidePanel({
                                                                                              open,
                                                                                              onClose,
                                                                                              title,
                                                                                              subtitle,
                                                                                              width = 320,
                                                                                              children,
                                                                                          }, ref) {
    if (!open) return null;
    return (
        <aside className="ui-side" style={{width}} role="complementary" aria-label={title}
               ref={ref as React.Ref<HTMLElement>}>
            <header className="ui-side__head">
                <div>
                    <div className="ui-side__title">{title}</div>
                    {subtitle && <div className="ui-side__sub">{subtitle}</div>}
                </div>
                <button className="ui-side__close" onClick={onClose} aria-label="Закрыть">×</button>
            </header>
            <div className="ui-side__body">{children}</div>
        </aside>
    );
});
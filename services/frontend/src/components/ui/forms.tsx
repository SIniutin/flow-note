import React, { useRef, useState } from "react";
import "./forms.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}
export const Input: React.FC<InputProps> = ({ label, error, id, className = "", ...rest }) => {
    const inputId = id || React.useId();
    return (
        <div className={`ui-field ${className}`}>
            {label && <label htmlFor={inputId} className="ui-field__label">{label}</label>}
            <input id={inputId} className={`ui-input${error ? " is-error" : ""}`} {...rest} />
            {error && <div className="ui-field__error">{error}</div>}
        </div>
    );
};

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
    children: React.ReactNode;
}
export const Radio: React.FC<RadioProps> = ({ children, className = "", ...rest }) => (
    <label className={`ui-radio ${className}`}>
        <input type="radio" {...rest} />
        <span className="ui-radio__dot" />
        <span className="ui-radio__label">{children}</span>
    </label>
);

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    children: React.ReactNode;
}
export const Checkbox: React.FC<CheckboxProps> = ({ children, className = "", ...rest }) => (
    <label className={`ui-check ${className}`}>
        <input type="checkbox" {...rest} />
        <span className="ui-check__box" />
        <span className="ui-check__label">{children}</span>
    </label>
);

interface FileUploadProps {
    label?: string;
    hint?: string;          // "Формат файла: ..."
    accept?: string;        // "image/png,image/jpeg,image/gif"
    maxSizeMb?: number;     // лимит в MB
    value?: File | null;
    onChange: (file: File | null) => void;
}
export const FileUpload: React.FC<FileUploadProps> = ({
                                                          label = "Файл изображения",
                                                          hint = "Формат файла: JPG, PNG, GIF. Не более 5 МБ",
                                                          accept = "image/png,image/jpeg,image/gif",
                                                          maxSizeMb = 5,
                                                          value, onChange,
                                                      }) => {
    const ref = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const pick = () => ref.current?.click();
    const handle = (f: File | null) => {
        if (f && f.size > maxSizeMb * 1024 * 1024) {
            setError(`Для загрузки доступны файлы в формате JPG, PNG, GIF`);
            onChange(null);
            return;
        }
        setError(null);
        onChange(f);
    };

    return (
        <div className="ui-upload">
            <div className="ui-upload__label">{label}</div>
            <div className={`ui-upload__drop${error ? " is-error" : ""}`}
                 onClick={pick}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files?.[0] ?? null); }}>
                <button type="button" className="ui-upload__btn" onClick={(e) => { e.stopPropagation(); pick(); }}>
                    Выбрать файл
                </button>
                <span className="ui-upload__hint"> или перенесите его сюда</span>
                <input ref={ref} type="file" accept={accept} hidden
                       onChange={(e) => handle(e.target.files?.[0] ?? null)} />
            </div>
            <div className="ui-upload__meta">{error || hint}</div>
            {value && !error && (
                <div className="ui-upload__file">
                    <span className="ui-upload__name">{value.name}</span>
                    <span className="ui-upload__size">{(value.size / 1024).toFixed(0)} KB</span>
                </div>
            )}
        </div>
    );
};
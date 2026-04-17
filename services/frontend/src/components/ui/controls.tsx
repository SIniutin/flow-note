import React, {useState} from "react";
import {createPortal} from "react-dom";
import "./controls.css";

// ─── Tooltip ─────────────────────────────────────────────────────────────────
// Floating UI в этом проекте работает только с виртуальным якорем
// (объект { getBoundingClientRect }), DOM-refs он не принимает корректно.
// Решение: позиционируем вручную через getBoundingClientRect на mouseenter.
// position:fixed + translateX(-50%) = всегда по центру кнопки, никогда
// не обрезается overflow:hidden предков.

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement;
    side?: "top" | "bottom";
}

interface TooltipPos {
    top: number;
    posLeft?: number;
    posRight?: number;
    transform?: string;
    placement: "top" | "bottom";
}

export const Tooltip: React.FC<TooltipProps> = ({content, children, side = "bottom"}) => {
    const [pos, setPos] = useState<TooltipPos | null>(null);

    const show = (e: React.MouseEvent<HTMLSpanElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const vw = window.innerWidth;
        const gap = 6;
        const approxH = 26;

        // Сторона: снизу или сверху
        let placement: "top" | "bottom" = side;
        if (side === "bottom" && rect.bottom + gap + approxH > window.innerHeight) placement = "top";
        if (side === "top" && rect.top - gap - approxH < 0) placement = "bottom";

        const top = placement === "bottom"
            ? rect.bottom + gap
            : rect.top - gap - approxH;

        // Умное горизонтальное выравнивание:
        //   < 30% экрана слева  → левый край тултипа = левый край кнопки
        //   > 70% экрана справа → правый край тултипа = правый край кнопки
        //   иначе               → тултип центрируется под кнопкой
        let posLeft: number | undefined;
        let posRight: number | undefined;
        let transform: string | undefined;

        const btnCenter = rect.left + rect.width / 2;

        if (rect.right > vw * 0.7) {
            // Правая зона — правый край тултипа = правый край кнопки
            posRight = vw - rect.right;
        } else if (rect.left < vw * 0.3) {
            // Левая зона — левый край тултипа = левый край кнопки
            posLeft = rect.left;
        } else {
            // Центр — центрируем под кнопкой
            posLeft = btnCenter;
            transform = "translateX(-50%)";
        }

        setPos({top, posLeft, posRight, transform, placement});
    };

    const hide = () => setPos(null);

    return (
        <>
            <span
                style={{display: "inline-flex", alignItems: "center"}}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show as unknown as React.FocusEventHandler}
                onBlur={hide}
            >
                {children}
            </span>

            {pos && content && createPortal(
                <span
                    className="ui-tt__bubble"
                    style={{
                        position: "fixed",
                        top: pos.top,
                        ...(pos.posRight !== undefined
                            ? {right: pos.posRight}
                            : {left: pos.posLeft, transform: pos.transform}),
                        pointerEvents: "none",
                        zIndex: 9999,
                    }}
                    role="tooltip"
                >
                    {content}
                </span>,
                document.body,
            )}
        </>
    );
};

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
type BtnSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: BtnVariant;
    size?: BtnSize;
    loading?: boolean;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
                                                  variant = "primary", size = "md", loading, fullWidth,
                                                  className = "", children, disabled, ...rest
                                              }) => (
    <button
        className={`ui-btn ui-btn--${variant} ui-btn--${size}${fullWidth ? " ui-btn--full" : ""} ${className}`}
        disabled={disabled || loading}
        {...rest}
    >
        {loading ? <span className="ui-btn__spinner"/> : children}
    </button>
);

// ─── IconButton ───────────────────────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    size?: BtnSize;
    label: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
                                                          active, size = "md", label, className = "", children, ...rest
                                                      }) => (
    <button
        type="button"
        aria-label={label}
        className={`ui-iconbtn ui-iconbtn--${size}${active ? " is-active" : ""} ${className}`}
        {...rest}
    >
        {children}
    </button>
);
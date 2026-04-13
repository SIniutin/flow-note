import React from "react";
import "./layout.css";

interface AvatarProps {
    name: string;
    size?: number;
    colorIndex?: 1 | 2 | 3 | 4;
}

export const Avatar: React.FC<AvatarProps> = ({name, size = 32, colorIndex = 1}) => (
    <span className={`ui-avatar ui-avatar--${colorIndex}`}
          style={{width: size, height: size, fontSize: size * 0.4}}>
        {name.charAt(0).toUpperCase()}
    </span>
);

interface CommentProps extends React.HTMLAttributes<HTMLDivElement> {
    author: string;
    date: string;
    text: React.ReactNode;
    resolved?: boolean;
    colorIndex?: 1 | 2 | 3 | 4;
    children?: React.ReactNode;
}

export const Comment: React.FC<CommentProps> = ({
                                                    author,
                                                    date,
                                                    text,
                                                    resolved,
                                                    colorIndex = 1,
                                                    children,
                                                    className,
                                                    ...rest
                                                }) => (
    <div className={`ui-comment${resolved ? " is-resolved" : ""}${className ? " " + className : ""}`} {...rest}>
        <div className="ui-comment__head">
            <Avatar name={author} colorIndex={colorIndex} size={28}/>
            <div className="ui-comment__meta">
                <div className="ui-comment__author">{author}</div>
                <div className="ui-comment__date">{date}</div>
            </div>
            {resolved && <span className="ui-comment__badge">Решено</span>}
        </div>
        <div className="ui-comment__body">{text}</div>
        {children && <div className="ui-comment__replies">{children}</div>}
    </div>
);

interface PageShellProps {
    title?: string;
    description?: string;
    toolbar?: React.ReactNode;
    rightTabs?: React.ReactNode;
    sidePanel?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
                                                        title = "Новая страница", description = "Добавить описание",
                                                        toolbar, rightTabs, sidePanel, footer, children,
                                                    }) => (
    <div className="ui-shell">
        <header className="ui-shell__head">
            <div className="ui-shell__title">
                <span className="ui-shell__icon">📄</span>
                <div>
                    <div className="ui-shell__name">{title}</div>
                    <div className="ui-shell__desc">{description}</div>
                </div>
            </div>
            {rightTabs && <div className="ui-shell__tabs">{rightTabs}</div>}
        </header>

        {toolbar && <div className="ui-shell__toolbar">{toolbar}</div>}

        <div className="ui-shell__main">
            <div className="ui-shell__content">{children}</div>
            {sidePanel && <aside className="ui-shell__side">{sidePanel}</aside>}
        </div>

        {footer && <div className="ui-shell__footer">{footer}</div>}
    </div>
);

export const PageSkeleton: React.FC = () => (
    <div className="ui-skeleton">
        <div className="ui-skeleton__bar" style={{width: "35%", height: 28}}/>
        <div className="ui-skeleton__bar" style={{width: "55%"}}/>
        <div className="ui-skeleton__bar" style={{width: "60%"}}/>
        <div className="ui-skeleton__bar" style={{width: "50%"}}/>
        <div className="ui-skeleton__bar" style={{width: "40%"}}/>
    </div>
);
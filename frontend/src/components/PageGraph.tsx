// ─── src/components/PageGraph.tsx ─────────────────────────────────────────────
// Визуальный граф связей страниц. Данные — GET /v1/pages/{id}/connected.
// Физическая симуляция (Fruchterman-Reingold) запускается синхронно при загрузке,
// затем рендерится статичный SVG. Без внешних зависимостей.

import { useState, useEffect } from "react";
import { pageClient } from "../api/pageClient";
import { pagesStore } from "../data/pagesStore";
import "./pageGraph.css";

// ── Physics ───────────────────────────────────────────────────────────────────

interface GNode {
    id:      string;
    title:   string;
    current: boolean;
    x: number; y: number;
    vx: number; vy: number;
}
interface GEdge { from: string; to: string }

const W = 640, H = 440, CX = W / 2, CY = H / 2;
const R_CURR = 28, R_NODE = 20;
const REPULSION = 14000;
const SPRING_K  = 0.05;
const REST_LEN  = 160;
const DAMPING   = 0.72;
const GRAVITY   = 0.014;
const STEPS     = 320;

function simulate(nodes: GNode[], edges: GEdge[]): GNode[] {
    const ns = nodes.map(n => ({ ...n }));
    for (let s = 0; s < STEPS; s++) {
        // Отталкивание между всеми парами
        for (let i = 0; i < ns.length; i++) {
            for (let j = i + 1; j < ns.length; j++) {
                const dx = ns[j].x - ns[i].x || 0.1;
                const dy = ns[j].y - ns[i].y || 0.1;
                const d2 = dx * dx + dy * dy;
                const inv = 1 / Math.sqrt(d2);
                const f   = REPULSION / d2;
                ns[i].vx -= f * dx * inv; ns[i].vy -= f * dy * inv;
                ns[j].vx += f * dx * inv; ns[j].vy += f * dy * inv;
            }
        }
        // Притяжение вдоль рёбер
        for (const e of edges) {
            const a = ns.find(n => n.id === e.from);
            const b = ns.find(n => n.id === e.to);
            if (!a || !b) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d  = Math.hypot(dx, dy) || 0.1;
            const f  = SPRING_K * (d - REST_LEN) / d;
            a.vx += f * dx; a.vy += f * dy;
            b.vx -= f * dx; b.vy -= f * dy;
        }
        // Интегрирование
        for (const n of ns) {
            if (n.current) { n.x = CX; n.y = CY; n.vx = 0; n.vy = 0; continue; }
            n.vx += GRAVITY * (CX - n.x);
            n.vy += GRAVITY * (CY - n.y);
            n.vx *= DAMPING; n.vy *= DAMPING;
            n.x = Math.max(44, Math.min(W - 44, n.x + n.vx));
            n.y = Math.max(36, Math.min(H - 36, n.y + n.vy));
        }
    }
    return ns;
}

/** Обрезаем ребро у границы окружности узла */
function clipEdge(
    ax: number, ay: number, bx: number, by: number,
    ra: number, rb: number,
): [number, number, number, number] {
    const dx = bx - ax, dy = by - ay;
    const d  = Math.hypot(dx, dy) || 1;
    return [ax + dx / d * ra, ay + dy / d * ra,
            bx - dx / d * rb, by - dy / d * rb];
}

const trunc = (s: string, max = 16) =>
    s.length > max ? s.slice(0, max - 1) + "…" : s;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    pageId:     string;
    onNavigate: (id: string) => void;
    onClose:    () => void;
}

export function PageGraph({ pageId, onNavigate, onClose }: Props) {
    const [nodes,   setNodes]   = useState<GNode[]>([]);
    const [edges,   setEdges]   = useState<GEdge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setNodes([]);
        setEdges([]);

        pageClient.getConnected(pageId)
            .then(({ pages, links }) => {
                const cp    = pagesStore.get(pageId);
                const angle = (2 * Math.PI) / Math.max(pages.length, 1);

                const initNodes: GNode[] = [
                    {
                        id: pageId, title: cp?.title ?? "Эта страница",
                        current: true, x: CX, y: CY, vx: 0, vy: 0,
                    },
                    ...pages.map((p, i) => ({
                        id: p.id, title: p.title, current: false,
                        x:  CX + Math.cos(angle * i) * 170,
                        y:  CY + Math.sin(angle * i) * 150,
                        vx: 0, vy: 0,
                    })),
                ];

                // Рёбра из бэкенда; если граф ещё пуст — рисуем звезду
                let initEdges: GEdge[] = links.map(l => ({
                    from: l.fromPageId, to: l.toPageId,
                }));
                if (initEdges.length === 0) {
                    initEdges = pages.map(p => ({ from: pageId, to: p.id }));
                }

                setNodes(simulate(initNodes, initEdges));
                setEdges(initEdges);
            })
            .catch(() => setError("Не удалось загрузить граф"))
            .finally(() => setLoading(false));
    }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="pg">
            {/* Header */}
            <div className="pg__head">
                <div className="pg__head-left">
                    <span className="pg__title">Граф связей</span>
                    {nodes.length > 1 && (
                        <span className="pg__count">{nodes.length - 1}</span>
                    )}
                </div>
                <button className="pg__close-btn" onClick={onClose} title="Закрыть">✕</button>
            </div>

            {/* Body */}
            <div className="pg__body">
                {loading ? (
                    <div className="pg__state">Загрузка…</div>
                ) : error ? (
                    <div className="pg__state pg__state--err">{error}</div>
                ) : nodes.length <= 1 ? (
                    <div className="pg__state">
                        <span>Нет связанных страниц.</span>
                        <span>
                            Вставьте ссылку через <kbd className="pg__kbd">/страница</kbd> в редакторе.
                        </span>
                    </div>
                ) : (
                    <svg
                        className="pg__svg"
                        viewBox={`0 0 ${W} ${H}`}
                        preserveAspectRatio="xMidYMid meet"
                    >
                        <defs>
                            <marker
                                id="pg-arrow" markerWidth="7" markerHeight="7"
                                refX="3.5" refY="3.5" orient="auto"
                            >
                                <path d="M0,0.5 L0,6.5 L6,3.5 z"
                                      fill="var(--border-strong)"/>
                            </marker>
                        </defs>

                        {/* Рёбра */}
                        {edges.map((e, i) => {
                            const a = nodes.find(n => n.id === e.from);
                            const b = nodes.find(n => n.id === e.to);
                            if (!a || !b) return null;
                            const ra = a.current ? R_CURR : R_NODE;
                            const rb = b.current ? R_CURR : R_NODE;
                            const [x1, y1, x2, y2] = clipEdge(a.x, a.y, b.x, b.y, ra + 2, rb + 9);
                            return (
                                <line key={i}
                                    x1={x1} y1={y1} x2={x2} y2={y2}
                                    className="pg__edge"
                                    markerEnd="url(#pg-arrow)"
                                />
                            );
                        })}

                        {/* Узлы */}
                        {nodes.map(n => {
                            const r   = n.current ? R_CURR : R_NODE;
                            const cls = [
                                "pg__node",
                                n.current  ? "pg__node--current"  : "",
                                hovered === n.id ? "pg__node--hover" : "",
                            ].filter(Boolean).join(" ");
                            return (
                                <g key={n.id}
                                   className={cls}
                                   transform={`translate(${Math.round(n.x)},${Math.round(n.y)})`}
                                   onClick={() => { if (!n.current) onNavigate(n.id); }}
                                   onMouseEnter={() => setHovered(n.id)}
                                   onMouseLeave={() => setHovered(null)}
                                   style={{ cursor: n.current ? "default" : "pointer" }}
                                >
                                    <circle r={r}/>
                                    {/* Tooltip при hover */}
                                    {hovered === n.id && !n.current && (
                                        <title>{n.title}</title>
                                    )}
                                    <text dy="0.35em" textAnchor="middle" className="pg__label">
                                        {trunc(n.title, n.current ? 18 : 14)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                )}
            </div>
        </div>
    );
}

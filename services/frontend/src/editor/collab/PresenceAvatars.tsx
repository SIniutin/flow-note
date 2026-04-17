// ─── src/editor/collab/PresenceAvatars.tsx ───────────────────────────────────
// Аватары активных пользователей в шапке редактора.
// Показывает только «чужих» пользователей (пирсов), себя не показывает.

import { useCollabStatus } from "./useCollabStatus";
import "./collab.css";

export function PresenceAvatars() {
    const { peers } = useCollabStatus();

    if (peers.length === 0) return null;

    return (
        <div className="presence" title={`${peers.length} пользователь(ей) онлайн`}>
            {peers.map((peer, i) => (
                <div
                    key={peer.clientId}
                    className="presence__avatar"
                    style={{
                        background: peer.color,
                        // Аватары немного перекрываются
                        zIndex: peers.length - i,
                        marginLeft: i === 0 ? 0 : -8,
                    }}
                    title={peer.name}
                >
                    {peer.name.charAt(0).toUpperCase()}
                </div>
            ))}
            <span className="presence__label">
                {peers.length === 1
                    ? `${peers[0].name} онлайн`
                    : `${peers.length} пользователя онлайн`}
            </span>
        </div>
    );
}

import type { ReactNode } from "react";
import "./shared.css";

export interface EmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="tl-empty-state" role="status">
            <p className="tl-empty-state__title">{title}</p>
            {description && (
                <p className="tl-empty-state__description">{description}</p>
            )}
            {action && <div className="tl-empty-state__action">{action}</div>}
        </div>
    );
}

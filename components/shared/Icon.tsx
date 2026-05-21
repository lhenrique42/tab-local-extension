import {
    Search,
    Plus,
    X,
    Check,
    Settings,
    Moon,
    Sun,
    GripVertical,
    MoreHorizontal,
    ExternalLink,
    Trash2,
    Save,
    Pencil,
    Layers,
    AppWindow,
    Zap,
    Cpu,
    Lock,
    Copy,
    Download,
    ChevronDown,
    ChevronRight,
    type LucideProps,
} from "lucide-react";
import type { FC } from "react";

// Static map — explicit named imports preserve Lucide tree-shaking.
const ICON_MAP = {
    search: Search,
    plus: Plus,
    x: X,
    check: Check,
    settings: Settings,
    moon: Moon,
    sun: Sun,
    grip: GripVertical,
    more: MoreHorizontal,
    external: ExternalLink,
    trash: Trash2,
    save: Save,
    pencil: Pencil,
    layers: Layers,
    window: AppWindow,
    zap: Zap,
    cpu: Cpu,
    lock: Lock,
    copy: Copy,
    download: Download,
    "chevron-down": ChevronDown,
    "chevron-right": ChevronRight,
} as const satisfies Record<string, FC<LucideProps>>;

export type IconName = keyof typeof ICON_MAP;

export interface IconProps {
    name: IconName;
    size?: number;
    className?: string;
    "aria-hidden"?: boolean;
    "aria-label"?: string;
}

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
    const LucideIcon = ICON_MAP[name];
    if (!LucideIcon) return null;
    return (
        <LucideIcon
            size={size}
            className={className}
            strokeWidth={1.5}
            {...rest}
        />
    );
}

import "./settings.css";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { storage } from "../../lib/storage/adapter";
import { useStorage } from "../../lib/hooks/useStorage";
import type { UserSettings, StorageRoot } from "../../lib/storage/schema";
import { useImportExport } from "../../composables/useImportExport";
import { Button, ConfirmDialog } from "../shared";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type RestoreMode = UserSettings["defaultRestoreMode"];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

interface SectionProps {
    label: string;
    children: ReactNode;
}

function Section({ label, children }: SectionProps) {
    const sectionId = `section-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
        <section className="tl-settings__section" aria-labelledby={sectionId}>
            <h2 id={sectionId} className="tl-settings__section-label">
                {label}
            </h2>
            {children}
        </section>
    );
}

interface RowProps {
    name: string;
    description?: string;
    children: ReactNode;
}

function Row({ name, description, children }: RowProps) {
    return (
        <div className="tl-settings__row">
            <div className="tl-settings__row-info">
                <div className="tl-settings__row-name">{name}</div>
                {description && (
                    <div className="tl-settings__row-desc">{description}</div>
                )}
            </div>
            {children}
        </div>
    );
}

interface RadioGroupProps<T extends string> {
    name: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}

function RadioGroup<T extends string>({
    name,
    value,
    options,
    onChange,
}: RadioGroupProps<T>) {
    return (
        <div
            className="tl-settings__radio-group"
            role="group"
            aria-label={name}
        >
            {options.map((opt) => (
                <label key={opt.value} className="tl-settings__radio-label">
                    <input
                        type="radio"
                        name={name}
                        value={opt.value}
                        checked={value === opt.value}
                        onChange={() => onChange(opt.value)}
                    />
                    {opt.label}
                </label>
            ))}
        </div>
    );
}

interface ToggleProps {
    id: string;
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
}

function Toggle({ id, checked, label, onChange }: ToggleProps) {
    return (
        <label className="tl-settings__toggle" htmlFor={id} aria-label={label}>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="tl-settings__toggle-track" aria-hidden="true" />
            <span className="tl-settings__toggle-thumb" aria-hidden="true" />
        </label>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Settings component                                             */
/* ------------------------------------------------------------------ */

export function Settings() {
    const [root, loading] = useStorage();
    const settings = root.settings;

    const {
        error,
        setError,
        success,
        setSuccess,
        handleExport,
        handleImportFile,
    } = useImportExport();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingRoot, setPendingRoot] = useState<StorageRoot | null>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (
        e: ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const rootData = await handleImportFile(file);
            setPendingRoot(rootData);
            setShowConfirm(true);
        } catch (_err) {
            // Error handled by hook
        } finally {
            e.target.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (!pendingRoot) return;
        try {
            await chrome.storage.local.set({ __tablocal_root: pendingRoot });
            setSuccess("Data imported successfully!");
            setError(null);
        } catch (_err) {
            setError("Failed to save imported data");
            setSuccess(null);
        } finally {
            setShowConfirm(false);
            setPendingRoot(null);
        }
    };

    const handleCancelImport = () => {
        setShowConfirm(false);
        setPendingRoot(null);
    };

    async function patchSettings(fn: (s: UserSettings) => void) {
        await storage.patch((draft) => fn(draft.settings));
    }

    function handleRestoreModeChange(mode: RestoreMode) {
        void patchSettings((s) => {
            s.defaultRestoreMode = mode;
        });
    }

    function handleNativeSyncToggle(checked: boolean) {
        void patchSettings((s) => {
            s.nativeGroupSyncEnabled = checked;
        });
    }

    function handleAutoGroupToggle(checked: boolean) {
        void patchSettings((s) => {
            s.autoGroupByDomainEnabled = checked;
        });
    }

    return (
        <div className="tl-settings" role="main" aria-label="TabLocal Settings">
            {/* Header */}
            <div className="tl-settings__header">
                <h1 className="tl-settings__title">Settings</h1>
                <span className="tl-settings__eyebrow">TabLocal</span>
            </div>

            {loading ? (
                <div
                    className="tl-settings__body"
                    aria-busy="true"
                    aria-label="Loading settings"
                />
            ) : (
                <div className="tl-settings__body">
                    {/* Restore */}
                    <Section label="Restore">
                        <Row
                            name="Default restore mode"
                            description="Where tabs open when you restore a collection."
                        >
                            <RadioGroup<RestoreMode>
                                name="restore-mode"
                                value={settings.defaultRestoreMode}
                                options={[
                                    {
                                        value: "discard-background",
                                        label: "New window (background)",
                                    },
                                    {
                                        value: "active-all",
                                        label: "Current window (active)",
                                    },
                                ]}
                                onChange={handleRestoreModeChange}
                            />
                        </Row>
                    </Section>

                    {/* Integrations */}
                    <Section label="Integrations">
                        <Row
                            name="Sync native Chrome tab groups"
                            description="Mirror color and title changes from live Chrome tab groups into saved collections."
                        >
                            <Toggle
                                id="toggle-native-sync"
                                checked={settings.nativeGroupSyncEnabled}
                                label="Sync native Chrome tab groups"
                                onChange={handleNativeSyncToggle}
                            />
                        </Row>
                    </Section>

                    {/* Automation */}
                    <Section label="Automation">
                        <Row
                            name="Auto-group tabs by domain"
                            description="Show the Auto-Group button in the popup to cluster open tabs by hostname."
                        >
                            <Toggle
                                id="toggle-auto-group"
                                checked={settings.autoGroupByDomainEnabled}
                                label="Auto-group tabs by domain"
                                onChange={handleAutoGroupToggle}
                            />
                        </Row>
                    </Section>

                    {/* Export Data */}
                    <Section label="Export Data">
                        <Row
                            name="Export all data"
                            description="Download all your groups, collections, and settings as a JSON file."
                        >
                            <Button variant="secondary" onClick={handleExport}>
                                Export
                            </Button>
                        </Row>
                    </Section>

                    {/* Import Data */}
                    <Section label="Import Data">
                        <Row
                            name="Import from file"
                            description="Upload a previously exported JSON file. This will replace all your current data."
                        >
                            <div className="tl-settings__import-controls">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileSelected}
                                    style={{ display: "none" }}
                                    data-testid="import-file-input"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={handleImportClick}
                                >
                                    Import File
                                </Button>
                            </div>
                        </Row>
                        {error && (
                            <div className="tl-settings__error" role="alert">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div
                                className="tl-settings__success"
                                role="status"
                                aria-live="polite"
                            >
                                {success}
                            </div>
                        )}
                    </Section>
                </div>
            )}

            {showConfirm && (
                <ConfirmDialog
                    title="Confirm Import"
                    message="This will replace all your current data. Continue?"
                    confirmLabel="Import"
                    onConfirm={handleConfirmImport}
                    onCancel={handleCancelImport}
                />
            )}
        </div>
    );
}

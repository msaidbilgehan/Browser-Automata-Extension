import { useState, useEffect, useCallback } from "react";
import { Package, Download, Check, RefreshCw, WifiOff, AlertTriangle, ArrowUpCircle, Pencil, Trash2, RotateCcw, XCircle } from "lucide-react";
import { sendToBackground } from "@/shared/messaging";
import type { TemplateCategory, Template } from "@/shared/types/entities";
import type { InstalledTemplateRecord } from "@/shared/storage/keys";
import type { RemoteTemplate } from "@/shared/types/template-registry";
import type { TemplateStatus } from "@/shared/types/messages";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  form_fill: "Form Fill",
  scraping: "Scraping",
  navigation: "Navigation",
  ui_modification: "UI Mod",
  accessibility: "Accessibility",
  productivity: "Productivity",
  privacy: "Privacy",
  custom: "Custom",
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  form_fill: "bg-warning/20 text-warning",
  scraping: "bg-active/20 text-active",
  navigation: "bg-active-dim/20 text-active-dim",
  ui_modification: "bg-error/20 text-error",
  accessibility: "bg-active/20 text-active",
  productivity: "bg-warning/20 text-warning",
  privacy: "bg-error-dim/20 text-error-dim",
  custom: "bg-bg-tertiary text-text-muted",
};

export function TemplatesView() {
  const [templates, setTemplates] = useState<RemoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, TemplateStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [removedTemplates, setRemovedTemplates] = useState<InstalledTemplateRecord[]>([]);

  const fetchStatuses = useCallback(async (remoteTemplates: RemoteTemplate[]) => {
    const compatible = remoteTemplates.filter((t) => t.compatible && t.template);

    try {
      // Fetch statuses for catalog templates
      if (compatible.length > 0) {
        const response = await sendToBackground({
          type: "GET_TEMPLATE_STATUSES",
          queries: compatible.map((remote) => {
            const t = remote.template!;
            return {
              templateId: t.id,
              remoteContentHash: remote.contentHash,
              templateName: t.name,
              templateDescription: t.description,
              templateCategory: t.category,
              templateTags: t.tags,
              templateAuthor: t.author,
            };
          }),
        });
        setStatusMap(response.statuses);
      }

      // Detect removed templates: installed but no longer in catalog
      const { installed } = await sendToBackground({ type: "GET_INSTALLED_TEMPLATES" });
      const catalogIds = new Set(compatible.map((t) => t.template!.id));
      const orphaned = Object.values(installed).filter((r) => !catalogIds.has(r.templateId));
      setRemovedTemplates(orphaned);
    } catch {
      // Non-critical — statuses will show as "not_installed" by default
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const catalogResponse = await sendToBackground({ type: "FETCH_TEMPLATE_CATALOG" });
      if (catalogResponse.ok && catalogResponse.templates) {
        setTemplates(catalogResponse.templates);
        if (catalogResponse.error) {
          setOffline(true);
        }
        await fetchStatuses(catalogResponse.templates);
      } else {
        setError(catalogResponse.error ?? "Failed to load templates");
      }
    } catch (err) {
      setError(`Failed to load templates: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const handleInstall = async (template: Template) => {
    setInstalling(template.id);
    setError(null);
    try {
      await sendToBackground({ type: "INSTALL_TEMPLATE", templateId: template.id });
      // Refresh statuses to pick up the new record
      await fetchStatuses(templates);
    } catch (err) {
      setError(`Failed to install: ${String(err)}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleUpdate = async (template: Template) => {
    setUpdating(template.id);
    setConfirmUpdate(null);
    setError(null);
    try {
      const result = await sendToBackground({ type: "UPDATE_TEMPLATE", templateId: template.id });
      if (result.ok) {
        await fetchStatuses(templates);
      } else {
        setError(result.error ?? "Failed to update template");
      }
    } catch (err) {
      setError(`Failed to update: ${String(err)}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleUninstall = async (templateId: string) => {
    setUninstalling(templateId);
    setConfirmUninstall(null);
    setError(null);
    try {
      const result = await sendToBackground({ type: "UNINSTALL_TEMPLATE", templateId });
      if (result.ok) {
        await fetchStatuses(templates);
      } else {
        setError(result.error ?? "Failed to uninstall template");
      }
    } catch (err) {
      setError(`Failed to uninstall: ${String(err)}`);
    } finally {
      setUninstalling(null);
    }
  };

  const handleReset = async (templateId: string) => {
    setResetting(templateId);
    setConfirmReset(null);
    setError(null);
    try {
      const result = await sendToBackground({ type: "RESET_TEMPLATE", templateId });
      if (result.ok) {
        await fetchStatuses(templates);
      } else {
        setError(result.error ?? "Failed to reset template");
      }
    } catch (err) {
      setError(`Failed to reset: ${String(err)}`);
    } finally {
      setResetting(null);
    }
  };

  const getStatus = (templateId: string): TemplateStatus => {
    return statusMap[templateId] ?? "not_installed";
  };

  const compatibleTemplates = templates.filter((t) => t.compatible && t.template);
  const incompatibleTemplates = templates.filter((t) => !t.compatible);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Templates</h2>
        <div className="flex items-center gap-2">
          {offline ? (
            <span className="text-warning inline-flex items-center gap-1 text-[10px]">
              <WifiOff size={10} />
              Offline
            </span>
          ) : null}
          <span className="text-text-muted text-[10px]">
            {String(compatibleTemplates.length)} available
          </span>
          <button
            onClick={() => void fetchCatalog()}
            disabled={loading}
            className="text-text-muted hover:text-text-primary transition-colors"
            title="Refresh templates"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && !offline ? (
        <div className="border-error-dim bg-error-dim/10 rounded-md border p-2">
          <p className="text-error text-xs">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <RefreshCw size={24} className="text-text-muted animate-spin" />
          <p className="text-text-muted text-xs">Loading templates...</p>
        </div>
      ) : compatibleTemplates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Package size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No templates available</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {compatibleTemplates.map((remote) => {
            const template = remote.template as Template;
            const status = getStatus(template.id);
            const isInstalling = installing === template.id;
            const isUpdating = updating === template.id;
            const isUninstalling = uninstalling === template.id;
            const isConfirming = confirmUpdate === template.id;
            const isConfirmingUninstall = confirmUninstall === template.id;
            const isInstalled = status !== "not_installed";

            return (
              <Card key={template.id}>
                <div className="flex h-full flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-text-primary text-xs leading-tight font-medium">
                      {template.name}
                    </p>
                    {status === "update_available" || status === "update_and_modified" ? (
                      <span className="text-warning text-[9px] font-medium shrink-0">
                        v{template.meta.templateVersion}
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      CATEGORY_COLORS[template.category]
                    }`}
                  >
                    {CATEGORY_LABELS[template.category]}
                  </span>

                  <p className="text-text-muted flex-1 text-[10px] leading-snug">
                    {template.description}
                  </p>

                  {template.author ? (
                    <p className="text-text-muted text-[9px]">by {template.author}</p>
                  ) : null}

                  <div className="pt-1">
                    {status === "not_installed" ? (
                      <Button
                        variant="primary"
                        onClick={() => void handleInstall(template)}
                        disabled={isInstalling}
                        className="gap-1"
                      >
                        <Download size={10} />
                        {isInstalling ? "Installing..." : "Install"}
                      </Button>
                    ) : status === "installed" ? (
                      <div className="flex items-center justify-between">
                        <span className="text-active inline-flex items-center gap-1 text-[10px] font-medium">
                          <Check size={10} />
                          Installed
                        </span>
                        <button
                          onClick={() => setConfirmUninstall(template.id)}
                          disabled={isUninstalling}
                          className="text-text-muted hover:text-error transition-colors"
                          title="Uninstall template"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ) : status === "local_modified" ? (
                      confirmReset === template.id ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-warning text-[9px]">
                            Reset to original? Your local changes will be discarded.
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="primary"
                              onClick={() => void handleReset(template.id)}
                              disabled={resetting === template.id}
                              className="gap-1"
                            >
                              <RotateCcw size={10} />
                              {resetting === template.id ? "Resetting..." : "Reset"}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setConfirmReset(null)}
                              disabled={resetting === template.id}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-warning inline-flex items-center gap-1 text-[10px] font-medium">
                              <Pencil size={10} />
                              Modified Locally
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setConfirmReset(template.id)}
                                disabled={resetting === template.id}
                                className="text-text-muted hover:text-warning transition-colors"
                                title="Reset to original"
                              >
                                <RotateCcw size={10} />
                              </button>
                              <button
                                onClick={() => setConfirmUninstall(template.id)}
                                disabled={isUninstalling}
                                className="text-text-muted hover:text-error transition-colors"
                                title="Uninstall template"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    ) : status === "update_available" ? (
                      isConfirming ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-warning text-[9px]">
                            Update to v{template.meta.templateVersion}?
                            This will replace existing entities from this template.
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="primary"
                              onClick={() => void handleUpdate(template)}
                              disabled={isUpdating}
                              className="gap-1"
                            >
                              <ArrowUpCircle size={10} />
                              {isUpdating ? "Updating..." : "Confirm"}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setConfirmUpdate(null)}
                              disabled={isUpdating}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmUpdate(template.id)}
                            disabled={isUpdating}
                            className="gap-1"
                          >
                            <ArrowUpCircle size={10} />
                            {isUpdating ? "Updating..." : "Update Available"}
                          </Button>
                          <button
                            onClick={() => setConfirmUninstall(template.id)}
                            disabled={isUninstalling}
                            className="text-text-muted hover:text-error transition-colors"
                            title="Uninstall template"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )
                    ) : status === "update_and_modified" ? (
                      isConfirming ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-error text-[9px]">
                            Update to v{template.meta.templateVersion}?
                            You have local changes that will be overwritten.
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="primary"
                              onClick={() => void handleUpdate(template)}
                              disabled={isUpdating}
                              className="gap-1"
                            >
                              <ArrowUpCircle size={10} />
                              {isUpdating ? "Updating..." : "Overwrite"}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setConfirmUpdate(null)}
                              disabled={isUpdating}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-warning inline-flex items-center gap-1 text-[9px] font-medium">
                              <Pencil size={9} />
                              Modified Locally
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setConfirmReset(template.id)}
                                disabled={resetting === template.id}
                                className="text-text-muted hover:text-warning transition-colors"
                                title="Reset to original"
                              >
                                <RotateCcw size={10} />
                              </button>
                              <button
                                onClick={() => setConfirmUninstall(template.id)}
                                disabled={isUninstalling}
                                className="text-text-muted hover:text-error transition-colors"
                                title="Uninstall template"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmUpdate(template.id)}
                            disabled={isUpdating}
                            className="gap-1"
                          >
                            <ArrowUpCircle size={10} />
                            {isUpdating ? "Updating..." : "Update Available"}
                          </Button>
                        </div>
                      )
                    ) : null}

                    {isConfirmingUninstall && isInstalled ? (
                      <div className="mt-1 flex flex-col gap-1">
                        <p className="text-error text-[9px]">
                          Uninstall this template? All its entities will be removed.
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="primary"
                            onClick={() => void handleUninstall(template.id)}
                            disabled={isUninstalling}
                            className="gap-1 bg-error hover:bg-error/80"
                          >
                            <Trash2 size={10} />
                            {isUninstalling ? "Removing..." : "Uninstall"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setConfirmUninstall(null)}
                            disabled={isUninstalling}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {removedTemplates.length > 0 ? (
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-error-dim text-[10px] font-medium">Removed from Catalog</p>
          {removedTemplates.map((record) => {
            const isConfirmingRemoved = confirmUninstall === record.templateId;
            const isUninstallingRemoved = uninstalling === record.templateId;
            return (
              <div
                key={record.templateId}
                className="bg-bg-secondary flex flex-col gap-1 rounded-md px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <XCircle size={10} className="text-error-dim shrink-0" />
                  <span className="text-text-secondary text-[10px]">
                    {record.templateName ?? record.templateId}
                  </span>
                  <span className="text-text-muted ml-auto text-[9px]">
                    v{record.templateVersion}
                  </span>
                  {!isConfirmingRemoved ? (
                    <button
                      onClick={() => setConfirmUninstall(record.templateId)}
                      disabled={isUninstallingRemoved}
                      className="text-text-muted hover:text-error transition-colors"
                      title="Uninstall template"
                    >
                      <Trash2 size={10} />
                    </button>
                  ) : null}
                </div>
                {isConfirmingRemoved ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-error text-[9px]">
                      Uninstall this removed template? All its entities will be deleted.
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="primary"
                        onClick={() => void handleUninstall(record.templateId)}
                        disabled={isUninstallingRemoved}
                        className="gap-1 bg-error hover:bg-error/80"
                      >
                        <Trash2 size={10} />
                        {isUninstallingRemoved ? "Removing..." : "Uninstall"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmUninstall(null)}
                        disabled={isUninstallingRemoved}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {incompatibleTemplates.length > 0 ? (
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-text-muted text-[10px] font-medium">Incompatible</p>
          {incompatibleTemplates.map((remote) => (
            <div
              key={remote.slug}
              className="bg-bg-secondary flex items-center gap-2 rounded-md px-2 py-1.5"
            >
              <AlertTriangle size={10} className="text-warning shrink-0" />
              <span className="text-text-muted text-[10px]">
                {remote.slug}
              </span>
              <span className="text-text-muted ml-auto text-[9px]">
                requires {remote.minVersion}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

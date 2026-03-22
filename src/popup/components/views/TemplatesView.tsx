import { useState, useEffect, useCallback } from "react";
import { Package, Download, Check, RefreshCw, WifiOff, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { sendToBackground } from "@/shared/messaging";
import type { TemplateCategory, Template } from "@/shared/types/entities";
import type { RemoteTemplate } from "@/shared/types/template-registry";
import type { InstalledTemplateRecord } from "@/shared/storage/keys";
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
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledTemplateRecord>>({});
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState<string | null>(null);

  const fetchInstalledTemplates = useCallback(async () => {
    try {
      const response = await sendToBackground({ type: "GET_INSTALLED_TEMPLATES" });
      setInstalledMap(response.installed);
    } catch {
      // Non-critical — installed map just won't show update badges
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const [catalogResponse] = await Promise.all([
        sendToBackground({ type: "FETCH_TEMPLATE_CATALOG" }),
        fetchInstalledTemplates(),
      ]);
      if (catalogResponse.ok && catalogResponse.templates) {
        setTemplates(catalogResponse.templates);
        if (catalogResponse.error) {
          setOffline(true);
        }
      } else {
        setError(catalogResponse.error ?? "Failed to load templates");
      }
    } catch (err) {
      setError(`Failed to load templates: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchInstalledTemplates]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const handleInstall = async (template: Template) => {
    setInstalling(template.id);
    setError(null);
    try {
      await sendToBackground({ type: "INSTALL_TEMPLATE", templateId: template.id });
      // Refresh installed map to pick up the new record
      await fetchInstalledTemplates();
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
        await fetchInstalledTemplates();
      } else {
        setError(result.error ?? "Failed to update template");
      }
    } catch (err) {
      setError(`Failed to update: ${String(err)}`);
    } finally {
      setUpdating(null);
    }
  };

  const getTemplateStatus = (template: Template): "not_installed" | "installed" | "update_available" => {
    const record = installedMap[template.id];
    if (!record) return "not_installed";
    if (record.templateVersion !== template.meta.templateVersion) return "update_available";
    return "installed";
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
            const status = getTemplateStatus(template);
            const isInstalling = installing === template.id;
            const isUpdating = updating === template.id;
            const isConfirming = confirmUpdate === template.id;
            const installedRecord = installedMap[template.id];

            return (
              <Card key={template.id}>
                <div className="flex h-full flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-text-primary text-xs leading-tight font-medium">
                      {template.name}
                    </p>
                    {status === "update_available" ? (
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
                    {status === "installed" ? (
                      <span className="text-active inline-flex items-center gap-1 text-[10px] font-medium">
                        <Check size={10} />
                        Installed
                      </span>
                    ) : status === "update_available" ? (
                      isConfirming ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-warning text-[9px]">
                            Update from v{installedRecord?.templateVersion} to v{template.meta.templateVersion}?
                            This will replace existing scripts from this template.
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
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmUpdate(template.id)}
                          disabled={isUpdating}
                          className="gap-1"
                        >
                          <ArrowUpCircle size={10} />
                          {isUpdating ? "Updating..." : "Update Available"}
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => void handleInstall(template)}
                        disabled={isInstalling}
                        className="gap-1"
                      >
                        <Download size={10} />
                        {isInstalling ? "Installing..." : "Install"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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

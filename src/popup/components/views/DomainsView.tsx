import { useEffect, useMemo } from "react";
import { Globe } from "lucide-react";
import type { UrlPattern } from "@/shared/types/entities";
import { now } from "@/shared/utils";
import { useScriptsStore } from "../../stores/scripts-store";
import { useShortcutsStore } from "../../stores/shortcuts-store";
import { useCSSRulesStore } from "../../stores/css-rules-store";
import { useNetworkRulesStore } from "../../stores/network-rules-store";
import { useExtractionRulesStore } from "../../stores/extraction-rules-store";
import { Toggle } from "../ui/Toggle";
import { Card } from "../ui/Card";

interface ScopedEntity {
  id: string;
  scope: UrlPattern;
  enabled: boolean;
  entityType: "script" | "shortcut" | "css" | "network" | "extraction";
}

function extractDomain(scope: UrlPattern): string {
  if (scope.type === "global") return "Global";
  if (scope.type === "regex") return scope.value || "regex";
  // For exact and glob, try to extract domain
  const value = scope.value;
  if (!value) return "Unknown";
  try {
    // Strip protocol if present
    const withoutProtocol = value.replace(/^https?:\/\//, "");
    // Get domain part (before first / or *)
    const domain = withoutProtocol.split(/[/*]/)[0] ?? "";
    // Remove leading wildcards like *.
    return domain.replace(/^\*\./, "") || value;
  } catch {
    return value;
  }
}

interface DomainGroup {
  domain: string;
  entities: ScopedEntity[];
  counts: Record<ScopedEntity["entityType"], number>;
  allEnabled: boolean;
}

export function DomainsView() {
  const scriptsStore = useScriptsStore();
  const shortcutsStore = useShortcutsStore();
  const cssStore = useCSSRulesStore();
  const networkStore = useNetworkRulesStore();
  const extractionStore = useExtractionRulesStore();

  useEffect(() => {
    void scriptsStore.load();
    void shortcutsStore.load();
    void cssStore.load();
    void networkStore.load();
    void extractionStore.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const domainGroups = useMemo(() => {
    const allEntities: ScopedEntity[] = [
      ...Object.values(scriptsStore.scripts).map((s) => ({
        id: s.id,
        scope: s.scope,
        enabled: s.enabled,
        entityType: "script" as const,
      })),
      ...Object.values(shortcutsStore.shortcuts).map((s) => ({
        id: s.id,
        scope: s.scope,
        enabled: s.enabled,
        entityType: "shortcut" as const,
      })),
      ...Object.values(cssStore.cssRules).map((r) => ({
        id: r.id,
        scope: r.scope,
        enabled: r.enabled,
        entityType: "css" as const,
      })),
      ...Object.values(networkStore.networkRules).map((r) => ({
        id: r.id,
        scope: r.scope,
        enabled: r.enabled,
        entityType: "network" as const,
      })),
      ...Object.values(extractionStore.extractionRules).map((r) => ({
        id: r.id,
        scope: r.scope,
        enabled: r.enabled,
        entityType: "extraction" as const,
      })),
    ];

    // Group by domain
    const grouped = new Map<string, ScopedEntity[]>();
    for (const entity of allEntities) {
      const domain = extractDomain(entity.scope);
      const list = grouped.get(domain) ?? [];
      list.push(entity);
      grouped.set(domain, list);
    }

    // Build domain groups sorted by domain name
    const groups: DomainGroup[] = [];
    for (const [domain, entities] of grouped) {
      const counts: Record<ScopedEntity["entityType"], number> = {
        script: 0,
        shortcut: 0,
        css: 0,
        network: 0,
        extraction: 0,
      };
      for (const e of entities) {
        counts[e.entityType]++;
      }
      groups.push({
        domain,
        entities,
        counts,
        allEnabled: entities.every((e) => e.enabled),
      });
    }

    groups.sort((a, b) => {
      // "Global" always first
      if (a.domain === "Global") return -1;
      if (b.domain === "Global") return 1;
      return a.domain.localeCompare(b.domain);
    });

    return groups;
  }, [
    scriptsStore.scripts,
    shortcutsStore.shortcuts,
    cssStore.cssRules,
    networkStore.networkRules,
    extractionStore.extractionRules,
  ]);

  const loading =
    scriptsStore.loading ||
    shortcutsStore.loading ||
    cssStore.loading ||
    networkStore.loading ||
    extractionStore.loading;

  const handleDomainToggle = async (group: DomainGroup, enabled: boolean) => {
    const timestamp = now();
    const promises: Promise<void>[] = [];

    for (const entity of group.entities) {
      if (entity.enabled === enabled) continue;

      switch (entity.entityType) {
        case "script": {
          const script = scriptsStore.scripts[entity.id];
          if (script) {
            promises.push(
              scriptsStore.save({
                ...script,
                enabled,
                meta: { ...script.meta, updatedAt: timestamp },
              }),
            );
          }
          break;
        }
        case "shortcut": {
          const shortcut = shortcutsStore.shortcuts[entity.id];
          if (shortcut) {
            promises.push(
              shortcutsStore.save({
                ...shortcut,
                enabled,
                meta: { ...shortcut.meta, updatedAt: timestamp },
              }),
            );
          }
          break;
        }
        case "css": {
          const rule = cssStore.cssRules[entity.id];
          if (rule) {
            promises.push(
              cssStore.save({
                ...rule,
                enabled,
                meta: { ...rule.meta, updatedAt: timestamp },
              }),
            );
          }
          break;
        }
        case "network": {
          const rule = networkStore.networkRules[entity.id];
          if (rule) {
            promises.push(
              networkStore.save({
                ...rule,
                enabled,
                meta: { ...rule.meta, updatedAt: timestamp },
              }),
            );
          }
          break;
        }
        case "extraction": {
          const rule = extractionStore.extractionRules[entity.id];
          if (rule) {
            promises.push(
              extractionStore.save({
                ...rule,
                enabled,
                meta: { ...rule.meta, updatedAt: timestamp },
              }),
            );
          }
          break;
        }
      }
    }

    await Promise.all(promises);
  };

  const ENTITY_LABELS: Record<ScopedEntity["entityType"], string> = {
    script: "Scripts",
    shortcut: "Shortcuts",
    css: "CSS",
    network: "Network",
    extraction: "Extract",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Domains</h2>
      </div>

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs">Loading...</p>
      ) : domainGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Globe size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No entities configured yet</p>
          <p className="text-text-muted text-[10px]">
            Create scripts, shortcuts, or rules to see domain groupings
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {domainGroups.map((group) => (
            <Card key={group.domain}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-xs font-medium">{group.domain}</p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(Object.entries(group.counts) as [ScopedEntity["entityType"], number][])
                      .filter(([, count]) => count > 0)
                      .map(([type, count]) => (
                        <span
                          key={type}
                          className="bg-bg-tertiary text-text-muted rounded px-1.5 py-0.5 text-[10px]"
                        >
                          {count} {ENTITY_LABELS[type]}
                        </span>
                      ))}
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Toggle
                    checked={group.allEnabled}
                    onChange={(enabled) => void handleDomainToggle(group, enabled)}
                    size="sm"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

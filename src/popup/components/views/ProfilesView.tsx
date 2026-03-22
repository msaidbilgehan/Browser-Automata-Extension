import { useState, useEffect, useMemo, useCallback } from "react";
import { Users, Plus, Trash2, Check } from "lucide-react";
import { create } from "zustand";
import type { Profile, EntityId } from "@/shared/types/entities";
import { localStore, onStorageChange } from "@/shared/storage";
import { sendToBackground } from "@/shared/messaging";
import { generateId, now } from "@/shared/utils";
import { useEditorDraft } from "../../hooks/use-editor-draft";
import { removeDraft, loadAllDrafts } from "../../stores/editor-session";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { EditorHeader } from "../ui/EditorHeader";
import { EmptyState } from "../ui/EmptyState";
import { ListHeader } from "../ui/ListHeader";

// ─── Inline Profiles Store ──────────────────────────────────────────────────

interface ProfilesState {
  profiles: Record<string, Profile>;
  activeProfileId: EntityId | null;
  loading: boolean;
  editingId: EntityId | null;

  load: () => Promise<void>;
  save: (profile: Profile) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  switchProfile: (id: EntityId | null) => Promise<void>;
  setEditing: (id: EntityId | null) => void;
}

const useProfilesStore = create<ProfilesState>((set) => {
  onStorageChange("profiles", (newValue) => {
    if (newValue) set({ profiles: newValue });
  });

  return {
    profiles: {},
    activeProfileId: null,
    loading: false,
    editingId: null,

    load: async () => {
      set({ loading: true });
      const profiles = (await localStore.get("profiles")) ?? {};
      const state = await sendToBackground({ type: "GET_STATE" });
      set({ profiles, activeProfileId: state.activeProfileId, loading: false });
    },

    save: async (profile) => {
      await sendToBackground({ type: "PROFILE_SAVE", profile });
      set((s) => ({
        profiles: { ...s.profiles, [profile.id]: profile },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "PROFILE_DELETE", profileId: id });
      set((s) => {
        const next = { ...s.profiles };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return {
          profiles: next,
          editingId: s.editingId === id ? null : s.editingId,
          activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
        };
      });
    },

    switchProfile: async (id) => {
      await sendToBackground({ type: "PROFILE_SWITCH", profileId: id });
      set({ activeProfileId: id });
    },

    setEditing: (id) => {
      set({ editingId: id });
    },
  };
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function createNewProfile(): Profile {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    description: "",
    isActive: false,
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

// ─── Profile Editor ─────────────────────────────────────────────────────────

function ProfileEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: Profile;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove } = useProfilesStore();
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<Profile>({
    tab: "profiles",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });

  const patch = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const handleSave = async () => {
    const updated: Profile = {
      ...draft,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    await commitDraft();
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    await removeDraft("profiles", draft.id);
    onBack();
  };

  const handleDiscard = async () => {
    if (isNew) {
      await commitDraft();
      onBack();
    } else {
      await discardDraft();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <EditorHeader
        title={isNew ? "New Profile" : "Edit Profile"}
        isDirty={isDirty}
        onBack={onBack}
        onSave={() => void handleSave()}
        onDiscard={() => void handleDiscard()}
      />

      <div className="flex flex-col gap-2">
        <Input
          label="Name"
          value={draft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="Work, Personal, Testing..."
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-description" className="text-text-secondary text-xs font-medium">
            Description
          </label>
          <textarea
            id="profile-description"
            value={draft.description}
            onChange={(e) => {
              patch("description", e.target.value);
            }}
            placeholder="Optional description..."
            rows={3}
            className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none"
          />
        </div>

        {!isNew ? (
          <div className="flex justify-end pt-1">
            <Button variant="danger" onClick={() => void handleDelete()} className="gap-1">
              <Trash2 size={12} />
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Profiles View ──────────────────────────────────────────────────────────

export function ProfilesView() {
  const { profiles, activeProfileId, loading, editingId, load, switchProfile, setEditing } =
    useProfilesStore();
  const [newProfile, setNewProfile] = useState<Profile | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingId && !newProfile) {
      void loadAllDrafts("profiles").then((map) => { setDraftIds(new Set(Object.keys(map))); });
    }
  }, [editingId, newProfile]);

  const profileList = useMemo(
    () =>
      Object.values(profiles)
        .filter((s): s is Profile => typeof s.name === "string")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [profiles],
  );

  // Editor for new profile
  if (newProfile) {
    return (
      <ProfileEditor
        initial={newProfile}
        isNew
        onBack={() => {
          setNewProfile(null);
        }}
      />
    );
  }

  // Editor for existing profile
  if (editingId) {
    const profile = profiles[editingId];
    if (profile) {
      return (
        <ProfileEditor
          key={editingId}
          initial={profile}
          isNew={false}
          onBack={() => {
            setEditing(null);
          }}
        />
      );
    }
  }

  // List view
  return (
    <div className="flex flex-col gap-2">
      <ListHeader
        title="Profiles"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setNewProfile(createNewProfile());
            }}
            className="gap-1"
          >
            <Plus size={12} />
            New
          </Button>
        }
      />

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs">Loading...</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* No Profile option */}
          <Card onClick={() => void switchProfile(null)}>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  activeProfileId === null ? "bg-active" : "bg-text-muted"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-text-primary truncate text-xs font-medium">
                  No Profile (all items)
                </p>
                <p className="text-text-muted text-[10px]">
                  Show all scripts, shortcuts, and rules
                </p>
              </div>
              {activeProfileId === null ? (
                <span className="bg-active-dim text-active flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium">
                  <Check size={10} />
                  Active
                </span>
              ) : (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void switchProfile(null);
                  }}
                >
                  Use
                </Button>
              )}
            </div>
          </Card>

          {profileList.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No custom profiles yet"
              description="Create profiles to organize automations by context"
            />
          ) : (
            profileList.map((profile) => {
              const isActive = activeProfileId === profile.id;
              return (
                <Card
                  key={profile.id}
                  onClick={() => {
                    setEditing(profile.id);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isActive ? "bg-active" : "bg-text-muted"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-text-primary truncate text-xs font-medium">
                          {profile.name || "Untitled"}
                        </p>
                        {draftIds.has(profile.id) && (
                          <span className="bg-warning/20 text-warning shrink-0 rounded px-1 py-0.5 text-[9px] font-medium">
                            Draft
                          </span>
                        )}
                      </div>
                      {profile.description ? (
                        <p className="text-text-muted truncate text-[10px]">
                          {profile.description}
                        </p>
                      ) : null}
                    </div>
                    {isActive ? (
                      <span className="bg-active-dim text-active flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium">
                        <Check size={10} />
                        Active
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          void switchProfile(profile.id);
                        }}
                      >
                        Use
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

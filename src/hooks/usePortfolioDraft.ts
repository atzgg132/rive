"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadImage } from "@/utils/clientUploads";
import {
  DEFAULT_PORTFOLIO_CONTENT,
  DEFAULT_PORTFOLIO_THEME,
  MAX_PROFILE_IMAGE_UPLOAD_BYTES,
  mergePortfolioContent,
  normalizeSlug,
  type PortfolioContent,
  type PortfolioMediaSettings,
  type PortfolioTheme,
} from "@/utils/portfolio";
import {
  PORTFOLIO_AUTOSAVE_DELAY_MS,
  buildPortfolioPersistBody,
  classifyLocalDraft,
  contentFromRecord,
  isQuietPersistFailure,
  parsePortfolioDraftSnapshot,
  portfolioDraftStorageKey,
  seoFromRecord,
  shouldApplyServerSnapshot,
  snapshotFromDraft,
  themeFromRecord,
  type PortfolioDraftOverrides,
  type PortfolioDraftSnapshot,
  type PortfolioRecord,
  type PortfolioSeo,
} from "@/utils/portfolioDraft";

type PersistOptions = {
  status?: "draft" | "published";
  contentOverride?: PortfolioContent;
  successMessage?: string;
  silent?: boolean;
};

function applyRecordToForm(
  record: PortfolioRecord,
  setters: {
    setContent: (content: PortfolioContent) => void;
    setTheme: (theme: PortfolioTheme) => void;
    setTemplateKey: (templateKey: string) => void;
    setSlug: (slug: string) => void;
    setSeo: (seo: PortfolioSeo) => void;
  },
  refs: {
    content: { current: PortfolioContent };
    theme: { current: PortfolioTheme };
    templateKey: { current: string };
    slug: { current: string };
    seo: { current: PortfolioSeo };
  },
) {
  const nextContent = contentFromRecord(record);
  const nextTheme = themeFromRecord(record);
  const nextSeo = seoFromRecord(record);
  refs.content.current = nextContent;
  refs.theme.current = nextTheme;
  refs.templateKey.current = record.templateKey;
  refs.slug.current = record.slug;
  refs.seo.current = nextSeo;
  setters.setContent(nextContent);
  setters.setTheme(nextTheme);
  setters.setTemplateKey(record.templateKey);
  setters.setSlug(record.slug);
  setters.setSeo(nextSeo);
}

export function usePortfolioDraft() {
  const [portfolio, setPortfolio] = useState<PortfolioRecord | null>(null);
  const [content, setContent] = useState<PortfolioContent>(DEFAULT_PORTFOLIO_CONTENT);
  const [theme, setTheme] = useState<PortfolioTheme>(DEFAULT_PORTFOLIO_THEME);
  const [templateKey, setTemplateKey] = useState("minimal-pro");
  const [slug, setSlug] = useState("");
  const [seo, setSeo] = useState<PortfolioSeo>({ title: "", description: "", indexable: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflictState, setConflictState] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<PortfolioDraftSnapshot | null>(null);

  const contentRef = useRef(content);
  const themeRef = useRef(theme);
  const templateKeyRef = useRef(templateKey);
  const slugRef = useRef(slug);
  const seoRef = useRef(seo);
  const portfolioRef = useRef(portfolio);
  const dirtyRef = useRef(dirty);
  const conflictRef = useRef(conflictState);
  const editVersionRef = useRef(0);
  const draftHydratedRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingPersistRef = useRef<PersistOptions | null>(null);
  const persistRef = useRef<(options?: PersistOptions) => Promise<void>>(async () => undefined);

  useEffect(() => {
    contentRef.current = content;
    themeRef.current = theme;
    templateKeyRef.current = templateKey;
    slugRef.current = slug;
    seoRef.current = seo;
    portfolioRef.current = portfolio;
    dirtyRef.current = dirty;
    conflictRef.current = conflictState;
  }, [conflictState, content, dirty, portfolio, seo, slug, templateKey, theme]);

  const flushDraftSnapshot = useCallback((overrides: PortfolioDraftOverrides = {}) => {
    const current = portfolioRef.current;
    if (!current || !draftHydratedRef.current) return;
    try {
      const snapshot = snapshotFromDraft({
        revision: current.revision,
        content: overrides.content ?? contentRef.current,
        theme: overrides.theme ?? themeRef.current,
        templateKey: overrides.templateKey ?? templateKeyRef.current,
        slug: overrides.slug ?? slugRef.current,
        seo: overrides.seo ?? seoRef.current,
      });
      window.localStorage.setItem(portfolioDraftStorageKey(current.id), JSON.stringify(snapshot));
    } catch {
      // Local recovery is best-effort; the server remains the source of truth.
    }
  }, []);

  const markDirty = useCallback((overrides: PortfolioDraftOverrides = {}) => {
    editVersionRef.current += 1;
    setDirty(true);
    dirtyRef.current = true;
    if (!conflictRef.current) {
      setSaveError("");
      flushDraftSnapshot(overrides);
    }
  }, [flushDraftSnapshot]);

  const applySnapshot = useCallback((snapshot: PortfolioDraftSnapshot) => {
    const restoredContent = mergePortfolioContent(snapshot.content);
    contentRef.current = restoredContent;
    themeRef.current = snapshot.theme;
    templateKeyRef.current = snapshot.templateKey;
    slugRef.current = snapshot.slug;
    seoRef.current = snapshot.seo;
    setContent(restoredContent);
    setTheme(snapshot.theme);
    setTemplateKey(snapshot.templateKey);
    setSlug(snapshot.slug);
    setSeo(snapshot.seo);
  }, []);

  const loadPortfolio = useCallback(async ({
    preserveRecovery = true,
    replaceWith,
  }: {
    preserveRecovery?: boolean;
    replaceWith?: PortfolioDraftSnapshot | null;
  } = {}) => {
    setLoading(true);
    setLoadError("");
    setSaveError("");
    try {
      let response = await fetch("/api/portfolio");
      let data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not load your portfolio.");
      }
      if (!data.portfolio) {
        response = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Could not create your portfolio.");
        }
      }
      if (!data.portfolio) throw new Error("Rive did not return a portfolio record.");
      const record = data.portfolio as PortfolioRecord;
      setPortfolio(record);
      portfolioRef.current = record;
      applyRecordToForm(record, { setContent, setTheme, setTemplateKey, setSlug, setSeo }, {
        content: contentRef,
        theme: themeRef,
        templateKey: templateKeyRef,
        slug: slugRef,
        seo: seoRef,
      });
      setDirty(false);
      dirtyRef.current = false;
      setConflictState(false);
      conflictRef.current = false;
      draftHydratedRef.current = true;

      const storageKey = portfolioDraftStorageKey(record.id);
      const stored = preserveRecovery
        ? parsePortfolioDraftSnapshot(window.localStorage.getItem(storageKey))
        : null;
      const incoming = replaceWith ?? (classifyLocalDraft(record.revision, stored) === "restore" ? stored : null);
      const conflictDraft = !replaceWith && classifyLocalDraft(record.revision, stored) === "conflict" ? stored : null;

      if (incoming) {
        applySnapshot(incoming);
        setRecoveryDraft(null);
        markDirty(incoming);
      } else if (conflictDraft) {
        setRecoveryDraft(conflictDraft);
        setConflictState(true);
        conflictRef.current = true;
        setSaveError("This portfolio changed in another tab. Reload the latest version or keep your local draft.");
      } else if (preserveRecovery) {
        setRecoveryDraft(null);
      } else {
        window.localStorage.removeItem(storageKey);
        setRecoveryDraft(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load your portfolio.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, markDirty]);

  const persist = useCallback(async (options: PersistOptions = {}) => {
    const current = portfolioRef.current;
    if (!current) return;
    if (options.silent && !options.status && !dirtyRef.current) return;
    if (inFlightRef.current) {
      const pending = pendingPersistRef.current;
      if (pending?.status === "published" && options.silent) return;
      pendingPersistRef.current = options;
      return;
    }

    inFlightRef.current = true;
    let succeeded = false;
    const submittedEditVersion = editVersionRef.current;
    const submittedContent = options.contentOverride ?? contentRef.current;
    const explicitStatus = options.status;
    if (!conflictRef.current) {
      flushDraftSnapshot(options.contentOverride ? { content: options.contentOverride } : {});
    }
    setSaving(true);
    if (!options.silent) setSaveError("");

    try {
      const response = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPortfolioPersistBody({
          revision: current.revision,
          content: submittedContent,
          theme: themeRef.current,
          templateKey: templateKeyRef.current,
          slug: slugRef.current,
          savedSlug: current.slug,
          seo: seoRef.current,
          status: explicitStatus,
        })),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.conflict) {
          const alreadyConflicting = conflictRef.current;
          setConflictState(true);
          conflictRef.current = true;
          pendingPersistRef.current = null;
          if (!alreadyConflicting) flushDraftSnapshot();
          throw new Error("This portfolio changed in another tab. Reload the latest version or keep your local draft.");
        }
        if (response.status === 409) {
          /* The URL was refused, not the revision. Put the field back to the
             one the server holds so the next autosave stops carrying a value
             that will be refused again — otherwise a single unavailable URL
             keeps failing every save and none of the writing that follows is
             ever stored. The message still tells them the URL did not stick. */
          setSlug(current.slug);
          slugRef.current = current.slug;
        }
        setConflictState(false);
        throw new Error(data.message || "could not save portfolio");
      }

      if (!data.portfolio) throw new Error(data.message || "could not save portfolio");
      const saved = data.portfolio as PortfolioRecord;
      setPortfolio(saved);
      portfolioRef.current = saved;
      if (shouldApplyServerSnapshot(submittedEditVersion, editVersionRef.current)) {
        applyRecordToForm(saved, { setContent, setTheme, setTemplateKey, setSlug, setSeo }, {
          content: contentRef,
          theme: themeRef,
          templateKey: templateKeyRef,
          slug: slugRef,
          seo: seoRef,
        });
        setDirty(false);
        dirtyRef.current = false;
        setRecoveryDraft(null);
        setConflictState(false);
        conflictRef.current = false;
        window.localStorage.removeItem(portfolioDraftStorageKey(saved.id));
      } else {
        flushDraftSnapshot();
        if (!pendingPersistRef.current) pendingPersistRef.current = { silent: true };
      }
      succeeded = true;
      if (!options.silent) {
        toast.success(options.successMessage || (explicitStatus === "published" ? "portfolio published" : "portfolio saved"));
      }
    } catch (error) {
      const quiet = options.silent && isQuietPersistFailure(error, navigator.onLine);
      if (!quiet) {
        setSaveError(error instanceof Error ? error.message : "could not save portfolio");
        if (!options.silent) {
          toast.error(error instanceof Error ? error.message : "could not save portfolio");
        }
      }
    } finally {
      inFlightRef.current = false;
      setSaving(false);
      const queued = pendingPersistRef.current;
      pendingPersistRef.current = null;
      if (succeeded && queued && !conflictRef.current) {
        void persistRef.current(queued);
      }
    }
  }, [flushDraftSnapshot]);

  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPortfolio();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadPortfolio]);

  useEffect(() => {
    if (!portfolio || !draftHydratedRef.current || conflictState) return;
    const storageKey = portfolioDraftStorageKey(portfolio.id);
    if (!dirty && !recoveryDraft) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Recovery storage is best-effort.
      }
      return;
    }
    const timer = window.setTimeout(() => {
      flushDraftSnapshot();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [conflictState, content, dirty, flushDraftSnapshot, portfolio, recoveryDraft, seo, slug, templateKey, theme]);

  useEffect(() => {
    if (!dirty || !portfolio || conflictState || loading) return;
    const timer = window.setTimeout(() => {
      void persist({ silent: true });
    }, PORTFOLIO_AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [conflictState, content, dirty, loading, persist, portfolio, seo, slug, templateKey, theme]);

  useEffect(() => {
    const retry = () => {
      if (dirtyRef.current && !conflictRef.current && portfolioRef.current) {
        void persistRef.current({ silent: true });
      }
    };
    const persistLocal = () => {
      if (dirtyRef.current) flushDraftSnapshot();
    };
    window.addEventListener("online", retry);
    window.addEventListener("pagehide", persistLocal);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("pagehide", persistLocal);
    };
  }, [flushDraftSnapshot]);

  const updateSlug = (value: string) => {
    const nextSlug = normalizeSlug(value);
    slugRef.current = nextSlug;
    setSlug(nextSlug);
    markDirty({ slug: nextSlug });
  };

  const updateTheme = (update: Partial<PortfolioTheme>) => {
    const nextTheme = { ...themeRef.current, ...update };
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    markDirty({ theme: nextTheme });
  };

  const updateSeo = (update: Partial<PortfolioSeo>) => {
    const nextSeo = { ...seoRef.current, ...update };
    seoRef.current = nextSeo;
    setSeo(nextSeo);
    markDirty({ seo: nextSeo });
  };

  const updateContent = (update: Partial<PortfolioContent>) => {
    const nextContent = { ...contentRef.current, ...update };
    contentRef.current = nextContent;
    setContent(nextContent);
    markDirty({ content: nextContent });
  };

  const updateMediaSettings = (update: Partial<PortfolioMediaSettings>) => {
    updateContent({ mediaSettings: { ...contentRef.current.mediaSettings, ...update } });
  };

  const chooseTemplate = (nextTemplateKey: string, accent: string) => {
    const nextTheme = { ...themeRef.current, accent };
    templateKeyRef.current = nextTemplateKey;
    themeRef.current = nextTheme;
    setTemplateKey(nextTemplateKey);
    setTheme(nextTheme);
    markDirty({ templateKey: nextTemplateKey, theme: nextTheme });
  };

  const handleImageUpload = async (projectId: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("images must be 5 MB or smaller");
      return;
    }
    try {
      const imageUrl = await uploadImage(file);
      const nextContent = {
        ...contentRef.current,
        projects: contentRef.current.projects.map((item) => item.id === projectId ? { ...item, imageUrl } : item),
      };
      contentRef.current = nextContent;
      setContent(nextContent);
      markDirty({ content: nextContent });
      toast.success("image added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "could not upload image");
    }
  };

  const persistProfileImage = (profileImageUrl: string, message: string, profileImageSourceUrl?: string) => {
    const nextContent = {
      ...contentRef.current,
      profileImageUrl,
      profileImageSourceUrl: profileImageUrl
        ? (profileImageSourceUrl ?? contentRef.current.profileImageSourceUrl) || profileImageUrl
        : "",
      ...(profileImageUrl ? {} : { showProfileImage: false }),
    };
    contentRef.current = nextContent;
    setContent(nextContent);
    markDirty({ content: nextContent });
    toast.success(message);
  };

  const handleProfileImageUpload = async (file: File | undefined, sourceFile?: File): Promise<boolean> => {
    if (!file) return false;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("choose a PNG, JPEG, or WebP image");
      return false;
    }
    if (file.size > MAX_PROFILE_IMAGE_UPLOAD_BYTES) {
      toast.error("profile photos must be 2 MB or smaller");
      return false;
    }
    if (sourceFile && (!["image/png", "image/jpeg", "image/webp"].includes(sourceFile.type) || sourceFile.size > MAX_PROFILE_IMAGE_UPLOAD_BYTES)) {
      toast.error("the original profile photo must be a PNG, JPEG, or WebP image no larger than 2 MB");
      return false;
    }
    try {
      const sourceUrl = sourceFile ? await uploadImage(sourceFile) : contentRef.current.profileImageSourceUrl;
      const imageUrl = await uploadImage(file);
      persistProfileImage(imageUrl, "profile photo saved", sourceUrl || imageUrl);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "could not upload profile photo");
      return false;
    }
  };

  const reloadLatestPortfolio = async () => {
    if (portfolio) window.localStorage.removeItem(portfolioDraftStorageKey(portfolio.id));
    setRecoveryDraft(null);
    setDirty(false);
    dirtyRef.current = false;
    await loadPortfolio({ preserveRecovery: false });
  };

  const reloadAndKeepLocalDraft = async () => {
    const currentSnapshot = snapshotFromDraft({
      revision: portfolioRef.current?.revision ?? 0,
      content: contentRef.current,
      theme: themeRef.current,
      templateKey: templateKeyRef.current,
      slug: slugRef.current,
      seo: seoRef.current,
    });
    const stored = portfolio
      ? parsePortfolioDraftSnapshot(window.localStorage.getItem(portfolioDraftStorageKey(portfolio.id)))
      : null;
    const localDraft = dirtyRef.current ? currentSnapshot : (stored ?? currentSnapshot);
    await loadPortfolio({ preserveRecovery: false, replaceWith: localDraft });
  };

  return {
    portfolio,
    content,
    theme,
    templateKey,
    slug,
    seo,
    loading,
    loadError,
    saving,
    dirty,
    saveError,
    conflictState,
    loadPortfolio,
    persist,
    updateContent,
    updateSlug,
    updateTheme,
    updateSeo,
    updateMediaSettings,
    chooseTemplate,
    handleImageUpload,
    handleProfileImageUpload,
    persistProfileImage,
    reloadLatestPortfolio,
    reloadAndKeepLocalDraft,
  };
}

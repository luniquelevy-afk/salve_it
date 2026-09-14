// Contenu public administrable du site vitrine (EF-30 à EF-34).
import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { CefrLevel } from './access.js';
import { recordAudit } from './audit.js';

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ─────────────────────────────────────────────────────────────
// Informations du centre
// ─────────────────────────────────────────────────────────────

const SETTINGS_COLUMNS =
  'centre_name, tagline, about, phone, whatsapp, email, address, opening_hours, facebook_url, instagram_url, map_url, key_figures, updated_at';

export interface SiteSettings {
  centreName: string;
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  openingHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  mapUrl: string | null;
  keyFigures: { value: string; label: string }[];
}

function toSettings(row: Record<string, unknown>): SiteSettings & { updatedAt: string } {
  return {
    centreName: row.centre_name as string,
    tagline: row.tagline as string | null,
    about: row.about as string | null,
    phone: row.phone as string | null,
    whatsapp: row.whatsapp as string | null,
    email: row.email as string | null,
    address: row.address as string | null,
    openingHours: row.opening_hours as string | null,
    facebookUrl: row.facebook_url as string | null,
    instagramUrl: row.instagram_url as string | null,
    mapUrl: row.map_url as string | null,
    keyFigures: row.key_figures as { value: string; label: string }[],
    updatedAt: row.updated_at as string,
  };
}

export async function getSiteSettings() {
  const { data, error } = await supabaseAdmin.from('site_settings').select(SETTINGS_COLUMNS).eq('id', true).single();
  if (error) throw error;
  return toSettings(data);
}

export async function updateSiteSettings(actorId: string, input: SiteSettings) {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .update({
      centre_name: input.centreName,
      tagline: input.tagline,
      about: input.about,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      address: input.address,
      opening_hours: input.openingHours,
      facebook_url: input.facebookUrl,
      instagram_url: input.instagramUrl,
      map_url: input.mapUrl,
      key_figures: input.keyFigures,
      updated_by: actorId,
    })
    .eq('id', true)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error) throw error;
  await recordAudit({ actorId, action: 'site.settings.update', entityType: 'site_settings' });
  return toSettings(data);
}

// ─────────────────────────────────────────────────────────────
// Formations publiques (EF-31)
// ─────────────────────────────────────────────────────────────

const PROGRAM_COLUMNS =
  'id, name, level, description, is_active, slug, is_public, summary, duration_label, schedule_label, audience, objectives, display_order';

function toProgram(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    level: row.level as CefrLevel | null,
    description: row.description as string | null,
    isActive: row.is_active as boolean,
    slug: row.slug as string | null,
    isPublic: row.is_public as boolean,
    summary: row.summary as string | null,
    durationLabel: row.duration_label as string | null,
    scheduleLabel: row.schedule_label as string | null,
    audience: row.audience as string | null,
    objectives: row.objectives as string[],
    displayOrder: row.display_order as number,
  };
}

export type PublicProgram = ReturnType<typeof toProgram>;

export async function listProgramsWithPublicFields() {
  const { data, error } = await supabaseAdmin.from('programs').select(PROGRAM_COLUMNS).order('display_order').order('name');
  if (error) throw error;
  return data.map(toProgram);
}

async function listPublicPrograms() {
  const { data, error } = await supabaseAdmin
    .from('programs')
    .select(PROGRAM_COLUMNS)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('display_order')
    .order('name');
  if (error) throw error;
  return data.map(toProgram);
}

export async function getPublicProgram(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('programs')
    .select(PROGRAM_COLUMNS)
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'program_not_found', 'Formation introuvable.');
  return toPublicProgram(toProgram(data));
}

// Champs de gestion retirés des réponses publiques.
function toPublicProgram({ isActive: _active, isPublic: _public, displayOrder: _order, ...program }: PublicProgram) {
  return program;
}

export interface ProgramPublicInput {
  slug?: string | null | undefined;
  isPublic: boolean;
  summary?: string | null | undefined;
  description?: string | null | undefined;
  durationLabel?: string | null | undefined;
  scheduleLabel?: string | null | undefined;
  audience?: string | null | undefined;
  objectives: string[];
  displayOrder: number;
}

export async function updateProgramPublic(actorId: string, programId: string, input: ProgramPublicInput) {
  const { data: current, error: loadError } = await supabaseAdmin.from('programs').select('name').eq('id', programId).maybeSingle();
  if (loadError) throw loadError;
  if (!current) throw new HttpError(404, 'program_not_found', 'Formation introuvable.');

  const slug = slugify(input.slug?.trim() || (current.name as string));
  if (input.isPublic && !slug) throw new HttpError(400, 'slug_required', 'Adresse de page invalide.');

  const { data, error } = await supabaseAdmin
    .from('programs')
    .update({
      slug: slug || null,
      is_public: input.isPublic,
      summary: input.summary || null,
      description: input.description || null,
      duration_label: input.durationLabel || null,
      schedule_label: input.scheduleLabel || null,
      audience: input.audience || null,
      objectives: input.objectives.map((objective) => objective.trim()).filter(Boolean),
      display_order: input.displayOrder,
    })
    .eq('id', programId)
    .select(PROGRAM_COLUMNS)
    .single();
  if (error?.code === '23505') throw new HttpError(409, 'slug_taken', 'Cette adresse de page est déjà utilisée par une autre formation.');
  if (error) throw error;
  await recordAudit({ actorId, action: 'program.public.update', entityType: 'program', entityId: programId, metadata: { isPublic: input.isPublic } });
  return toProgram(data);
}

// ─────────────────────────────────────────────────────────────
// Collections : témoignages, FAQ, galerie
// ─────────────────────────────────────────────────────────────

interface CollectionDefinition<Item, Input> {
  table: string;
  columns: string;
  entityType: string;
  fromRow: (row: Record<string, unknown>) => Item;
  toRow: (input: Input) => Record<string, unknown>;
}

function collection<Item, Input>(definition: CollectionDefinition<Item, Input>) {
  const notFound = () => new HttpError(404, `${definition.entityType}_not_found`, 'Élément introuvable.');

  return {
    async list(onlyPublished: boolean): Promise<Item[]> {
      let query = supabaseAdmin.from(definition.table).select(definition.columns);
      if (onlyPublished) query = query.eq('is_published', true);
      const { data, error } = await query.order('display_order').order('created_at');
      if (error) throw error;
      return (data as unknown as Record<string, unknown>[]).map(definition.fromRow);
    },
    async create(actorId: string, input: Input): Promise<Item> {
      const { data, error } = await supabaseAdmin.from(definition.table).insert(definition.toRow(input)).select(definition.columns).single();
      if (error?.code === '23514') throw new HttpError(400, 'invalid_content', 'Contenu invalide (consentement, lien https ou champ obligatoire).');
      if (error) throw error;
      const item = definition.fromRow(data as unknown as Record<string, unknown>);
      await recordAudit({ actorId, action: `${definition.entityType}.create`, entityType: definition.entityType, entityId: (data as unknown as { id: string }).id });
      return item;
    },
    async update(actorId: string, id: string, input: Input): Promise<Item> {
      const { data, error } = await supabaseAdmin.from(definition.table).update(definition.toRow(input)).eq('id', id).select(definition.columns).maybeSingle();
      if (error?.code === '23514') throw new HttpError(400, 'invalid_content', 'Contenu invalide (consentement, lien https ou champ obligatoire).');
      if (error) throw error;
      if (!data) throw notFound();
      await recordAudit({ actorId, action: `${definition.entityType}.update`, entityType: definition.entityType, entityId: id });
      return definition.fromRow(data as unknown as Record<string, unknown>);
    },
    async remove(actorId: string, id: string): Promise<void> {
      const { data, error } = await supabaseAdmin.from(definition.table).delete().eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      await recordAudit({ actorId, action: `${definition.entityType}.delete`, entityType: definition.entityType, entityId: id });
    },
  };
}

export interface TestimonialInput {
  authorName: string;
  authorContext?: string | null | undefined;
  quote: string;
  photoUrl?: string | null | undefined;
  consentConfirmed: boolean;
  isPublished: boolean;
  displayOrder: number;
}

export const testimonials = collection({
  table: 'testimonials',
  columns: 'id, author_name, author_context, quote, photo_url, consent_confirmed, is_published, display_order',
  entityType: 'testimonial',
  fromRow: (row) => ({
    id: row.id as string,
    authorName: row.author_name as string,
    authorContext: row.author_context as string | null,
    quote: row.quote as string,
    photoUrl: row.photo_url as string | null,
    consentConfirmed: row.consent_confirmed as boolean,
    isPublished: row.is_published as boolean,
    displayOrder: row.display_order as number,
  }),
  toRow: (input: TestimonialInput) => ({
    author_name: input.authorName,
    author_context: input.authorContext || null,
    quote: input.quote,
    photo_url: input.photoUrl || null,
    consent_confirmed: input.consentConfirmed,
    is_published: input.isPublished,
    display_order: input.displayOrder,
  }),
});

export interface FaqInput {
  question: string;
  answer: string;
  isPublished: boolean;
  displayOrder: number;
}

export const faqItems = collection({
  table: 'faq_items',
  columns: 'id, question, answer, is_published, display_order',
  entityType: 'faq_item',
  fromRow: (row) => ({
    id: row.id as string,
    question: row.question as string,
    answer: row.answer as string,
    isPublished: row.is_published as boolean,
    displayOrder: row.display_order as number,
  }),
  toRow: (input: FaqInput) => ({ question: input.question, answer: input.answer, is_published: input.isPublished, display_order: input.displayOrder }),
});

export interface GalleryInput {
  imageUrl: string;
  altText: string;
  caption?: string | null | undefined;
  isPublished: boolean;
  displayOrder: number;
}

export const galleryImages = collection({
  table: 'gallery_images',
  columns: 'id, image_url, alt_text, caption, is_published, display_order',
  entityType: 'gallery_image',
  fromRow: (row) => ({
    id: row.id as string,
    imageUrl: row.image_url as string,
    altText: row.alt_text as string,
    caption: row.caption as string | null,
    isPublished: row.is_published as boolean,
    displayOrder: row.display_order as number,
  }),
  toRow: (input: GalleryInput) => ({
    image_url: input.imageUrl,
    alt_text: input.altText,
    caption: input.caption || null,
    is_published: input.isPublished,
    display_order: input.displayOrder,
  }),
});

// Tout le contenu public en une requête : une seule requête réseau par visite (ENF-03).
export async function getPublicSite() {
  const [settings, programs, publishedTestimonials, faq, gallery] = await Promise.all([
    getSiteSettings(),
    listPublicPrograms(),
    testimonials.list(true),
    faqItems.list(true),
    galleryImages.list(true),
  ]);
  const { updatedAt: _updatedAt, ...publicSettings } = settings;
  return {
    settings: publicSettings,
    programs: programs.map(toPublicProgram),
    testimonials: publishedTestimonials.map(({ consentConfirmed: _consent, isPublished: _published, displayOrder: _order, ...testimonial }) => testimonial),
    faq: faq.map(({ isPublished: _published, displayOrder: _order, ...item }) => item),
    gallery: gallery.map(({ isPublished: _published, displayOrder: _order, ...image }) => image),
  };
}

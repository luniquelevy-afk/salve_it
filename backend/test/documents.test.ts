import { describe, expect, it } from 'vitest';
import { buildChecklist, CHECKLIST_NOTICE, isApplicable, type DocumentSnapshot, type Requirement } from '../src/services/checklist.js';
import { detectDocumentMimeType, sanitizeDocumentFileName } from '../src/services/document-files.js';

describe('fichiers déposés', () => {
  it('détecte le type réel par la signature binaire', () => {
    expect(detectDocumentMimeType(Buffer.from('%PDF-1.7\n...'))).toBe('application/pdf');
    expect(detectDocumentMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(detectDocumentMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe('image/png');
    expect(detectDocumentMimeType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
  });

  it('refuse un fichier déguisé (extension ou en-tête mensongers)', () => {
    expect(detectDocumentMimeType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectDocumentMimeType(Buffer.from('MZ\x90\x00'))).toBeNull();
    expect(detectDocumentMimeType(Buffer.alloc(0))).toBeNull();
  });

  it('nettoie le nom affiché et impose l’extension réelle', () => {
    expect(sanitizeDocumentFileName('..%2F..%2Fetc%2Fpasseport%20Grâce.exe', 'application/pdf')).toBe('passeport_Grace.pdf');
    expect(sanitizeDocumentFileName('C:\\Users\\x\\scan diplôme.PNG', 'image/png')).toBe('scan_diplome.png');
    expect(sanitizeDocumentFileName(undefined, 'image/jpeg')).toBe('document.jpg');
    expect(sanitizeDocumentFileName('%E0%A4%A', 'image/webp')).toBe('E0_A4_A.webp');
  });
});

const requirement = (overrides: Partial<Requirement>): Requirement => ({
  id: overrides.code ?? 'id',
  code: 'passeport',
  label: 'Passeport',
  description: null,
  documentType: 'passeport',
  visaTypes: ['etudes', 'tourisme', 'travail'],
  financingSources: null,
  requiresGuarantor: null,
  sourceLabel: 'Ambassade',
  sourceUrl: 'https://ambbrazzaville.esteri.it/',
  lastVerifiedAt: '2026-09-01',
  requiresHumanVerification: true,
  displayOrder: 0,
  isActive: true,
  ...overrides,
});

const requirements: Requirement[] = [
  requirement({ code: 'passeport', documentType: 'passeport', displayOrder: 1 }),
  requirement({ code: 'universitaly', documentType: 'preinscription_universitaly', visaTypes: ['etudes'], displayOrder: 2, lastVerifiedAt: null }),
  requirement({ code: 'garant', documentType: 'documents_garant', visaTypes: ['etudes', 'tourisme'], requiresGuarantor: true, displayOrder: 3 }),
  requirement({ code: 'voyage', documentType: 'reservation_voyage', visaTypes: ['tourisme'], displayOrder: 4 }),
  requirement({ code: 'assurance', documentType: 'assurance_sante', displayOrder: 5 }),
  requirement({ code: 'inactif', isActive: false }),
];

const TODAY = new Date('2026-09-14T12:00:00Z');

describe('checklist dynamique', () => {
  it('filtre selon le type de visa et la présence d’un garant', () => {
    const studies = { visaType: 'etudes' as const, financingSource: 'famille', hasGuarantor: false };
    expect(requirements.filter((r) => isApplicable(r, studies)).map((r) => r.code)).toEqual(['passeport', 'universitaly', 'assurance']);
    const withGuarantor = { visaType: 'etudes' as const, financingSource: 'garant', hasGuarantor: null };
    expect(requirements.filter((r) => isApplicable(r, withGuarantor)).map((r) => r.code)).toContain('garant');
    const tourism = { visaType: 'tourisme' as const, financingSource: null, hasGuarantor: null };
    expect(requirements.filter((r) => isApplicable(r, tourism)).map((r) => r.code)).toEqual(['passeport', 'voyage', 'assurance']);
  });

  it('sans type de visa : uniquement les exigences communes', () => {
    const unknown = { visaType: null, financingSource: null, hasGuarantor: null };
    expect(requirements.filter((r) => isApplicable(r, unknown)).map((r) => r.code)).toEqual(['passeport', 'assurance']);
  });

  it('croise les documents : manquant, validé, expiré, bientôt expiré', () => {
    const documents = new Map<string, DocumentSnapshot>([
      ['passeport', { id: 'd1', status: 'validated', expiresAt: '2026-10-01', currentVersion: 2, reviewerComment: null, updatedAt: '' }],
      ['assurance_sante', { id: 'd2', status: 'validated', expiresAt: '2026-09-01', currentVersion: 1, reviewerComment: null, updatedAt: '' }],
    ]);
    const checklist = buildChecklist(requirements, { visaType: 'etudes', financingSource: 'famille', hasGuarantor: false }, documents, TODAY);
    const byCode = Object.fromEntries(checklist.items.map((item) => [item.code, item]));
    expect(byCode.passeport).toMatchObject({ status: 'validated', expiringSoon: true });
    expect(byCode.universitaly).toMatchObject({ status: 'missing', document: null });
    expect(byCode.assurance).toMatchObject({ status: 'expired', expiringSoon: false });
    expect(checklist.progress).toEqual({ validated: 1, total: 3 });
  });

  it('expose les sources non vérifiées et la mention obligatoire (§11.3)', () => {
    const checklist = buildChecklist(requirements, { visaType: 'etudes', financingSource: null, hasGuarantor: null }, new Map(), TODAY);
    expect(checklist.unverifiedCount).toBe(1);
    expect(checklist.oldestVerificationAt).toBeNull();
    expect(checklist.notice).toBe(CHECKLIST_NOTICE);
    const allVerified = buildChecklist(requirements.filter((r) => r.lastVerifiedAt), { visaType: 'etudes', financingSource: null, hasGuarantor: null }, new Map(), TODAY);
    expect(allVerified.oldestVerificationAt).toBe('2026-09-01');
  });
});

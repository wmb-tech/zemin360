import type { EvidenceSourceKind } from '@evidex/shared';

/**
 * ### Kanıt sağlayıcı arayüzü (ADR-0003)
 * Her kaynak türü (GitHub, canlı URL, belge, referans, meydan okuma) bu arayüzü uygular.
 * ⚠ `extract` ham içerik döndürmez; yalnız sinyal. Kod ve belge metni hiçbir yerde saklanmaz.
 */
export interface ExtractedSignals {
  languages?: string[];
  tools?: string[];
  firstActivityAt?: string; // ISO tarih
  lastActivityAt?: string;
  authorshipRatio?: number; // 0..1 — commit'lerin ne kadarı kişiye ait
  contributors?: number;
  deployed?: boolean;
  hasTests?: boolean;
  hasReadme?: boolean;
  summary?: string; // makine özeti, kısa
  [key: string]: unknown;
}

export interface OwnershipCheck {
  verified: boolean;
  method: 'github_app' | 'dns_meta' | 'upload' | 'org_account' | 'platform';
  detail?: string;
}

export interface EvidenceProvider {
  readonly kind: EvidenceSourceKind;
  verifyOwnership(ref: string, ctx: { talentGithubLogin?: string }): Promise<OwnershipCheck>;
  extract(ref: string): Promise<ExtractedSignals>;
}

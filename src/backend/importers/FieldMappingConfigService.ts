import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceType } from '@shared/types';

function ensureDir(baseDir: string) {
  const dir = join(baseDir, 'field-mappings');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getFilePath(baseDir: string, sourceType: SourceType) {
  return join(ensureDir(baseDir), `${sourceType}.json`);
}

export class FieldMappingConfigService {
  static load(baseDir: string, sourceType: SourceType) {
    if (sourceType === 'unknown_template') return {};
    try {
      const content = readFileSync(getFilePath(baseDir, sourceType), 'utf-8');
      const parsed = JSON.parse(content);
      return typeof parsed === 'object' && parsed ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  static save(baseDir: string, sourceType: SourceType, mappings: Record<string, string>) {
    if (sourceType === 'unknown_template') return;
    writeFileSync(getFilePath(baseDir, sourceType), JSON.stringify(mappings, null, 2), 'utf-8');
  }
}

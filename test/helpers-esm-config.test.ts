import {mkdtempSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import {
  getMongoURLEnvName,
  getMongodbMemoryOptions,
  isMongoMemoryReplSetOptions,
  shouldUseSharedDBForAllJestWorkers,
} from '../src/helpers';

describe('helpers with ESM default export config', () => {
  const originalConfigFile = process.env.MONGO_MEMORY_SERVER_FILE;
  const tempDir = mkdtempSync(join(tmpdir(), 'jest-mongodb-esm-config-'));
  const configPath = join(tempDir, 'jest-mongodb-config.mjs');

  beforeAll(() => {
    writeFileSync(
      configPath,
      [
        'export default {',
        '  mongodbMemoryServerOptions: {replSet: {count: 1}},',
        "  mongoURLEnvName: 'CUSTOM_URL',",
        '  useSharedDBForAllJestWorkers: false,',
        '};',
        '',
      ].join('\n')
    );

    process.env.MONGO_MEMORY_SERVER_FILE = configPath;
  });

  afterAll(() => {
    if (typeof originalConfigFile === 'undefined') {
      delete process.env.MONGO_MEMORY_SERVER_FILE;
    } else {
      process.env.MONGO_MEMORY_SERVER_FILE = originalConfigFile;
    }
  });

  it('loads options from default export without throwing', () => {
    const options = getMongodbMemoryOptions(tempDir);

    expect(options).toEqual(expect.objectContaining({replSet: {count: 1}}));
    expect(getMongoURLEnvName(tempDir)).toBe('CUSTOM_URL');
    expect(shouldUseSharedDBForAllJestWorkers(tempDir)).toBe(false);
    expect(isMongoMemoryReplSetOptions(options)).toBe(true);
  });

  it('treats missing options as non-replSet', () => {
    expect(isMongoMemoryReplSetOptions(undefined)).toBe(false);
  });
});

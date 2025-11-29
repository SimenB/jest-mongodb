import {spawnSync} from 'child_process';
import {resolve} from 'path';
import type {MongoMemoryReplSet, MongoMemoryServer} from 'mongodb-memory-server';
import type {Config} from './types';

type MongoMemoryReplSetOpts = NonNullable<ConstructorParameters<typeof MongoMemoryReplSet>[0]>;
type MongoMemoryServerOpts = NonNullable<ConstructorParameters<typeof MongoMemoryServer>[0]>;

export function isMongoMemoryReplSetOptions(
  options?: MongoMemoryReplSetOpts | MongoMemoryServerOpts
): options is MongoMemoryReplSetOpts {
  return Boolean((options as MongoMemoryReplSetOpts | undefined)?.replSet);
}

function getConfigFile() {
  return process.env.MONGO_MEMORY_SERVER_FILE || 'jest-mongodb-config.js';
}

const configCache = new Map<string, Config | null>();

function importConfig(configPath: string): Config | undefined {
  try {
    // Node 22.12+ can let `require` load ESM by default. When Jest runs in CJS mode
    // and the config is `.mjs`, spawn a one-off Node process to import it as ESM
    // and return the plain JSON payload.
    const {status, stdout} = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        [
          'import {pathToFileURL} from "node:url";',
          `const mod = await import(pathToFileURL(${JSON.stringify(configPath)}).href);`,
          'const payload = mod.default ?? mod;',
          'console.log(JSON.stringify(payload));',
        ].join('\n'),
      ],
      {encoding: 'utf8'}
    );

    if (status === 0 && stdout.trim()) {
      return JSON.parse(stdout) as Config;
    }
  } catch {
    // ignore and fall through to undefined
  }

  return undefined;
}

function loadConfig(cwd?: string): Config | undefined {
  const baseDir = cwd || process.cwd();

  if (configCache.has(baseDir)) {
    return configCache.get(baseDir) ?? undefined;
  }

  const configPath = resolve(baseDir, getConfigFile());

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loadedConfig = require(configPath) as Config | {default?: Config};

    if (loadedConfig && typeof (loadedConfig as {default?: Config}).default !== 'undefined') {
      const config = (loadedConfig as {default?: Config}).default;
      configCache.set(baseDir, config ?? null);

      return config;
    }

    const config = loadedConfig as Config;
    configCache.set(baseDir, config ?? null);

    return config;
  } catch {
    const importedConfig = importConfig(configPath);
    configCache.set(baseDir, importedConfig ?? null);

    return importedConfig;
  }
}

export function getMongodbMemoryOptions(
  cwd?: string
): MongoMemoryReplSetOpts | MongoMemoryServerOpts | undefined {
  const config = loadConfig(cwd);

  if (config?.mongodbMemoryServerOptions) {
    return config.mongodbMemoryServerOptions;
  }

  return {
    binary: {
      checkMD5: false,
    },
    instance: {},
  };
}

export function getMongoURLEnvName(cwd?: string) {
  const config = loadConfig(cwd);

  return config?.mongoURLEnvName || 'MONGO_URL';
}

export function shouldUseSharedDBForAllJestWorkers(cwd?: string) {
  const config = loadConfig(cwd);

  if (typeof config?.useSharedDBForAllJestWorkers === 'undefined') {
    return true;
  }

  return config.useSharedDBForAllJestWorkers;
}

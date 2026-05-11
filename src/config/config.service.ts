import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { parse } from 'smol-toml';
import * as v from 'valibot';
import { Config, ConfigSchema } from './config.schema';

@Injectable()
export class ConfigService {
  private readonly config: Config;

  constructor() {
    const configFile = process.env.CONFIG_FILE ?? 'config.toml';
    const raw = readFileSync(configFile, 'utf-8');
    const parsed = parse(raw);
    this.config = v.parse(ConfigSchema, parsed);
  }

  get(): Config {
    return this.config;
  }
}

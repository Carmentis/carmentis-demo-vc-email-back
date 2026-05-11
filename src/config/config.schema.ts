import * as v from 'valibot';

export const ConfigSchema = v.object({
  email: v.object({
    host: v.string(),
    port: v.pipe(v.number(), v.integer()),
    secure: v.boolean(),
    from: v.string(),
    auth: v.object({
      user: v.string(),
      pass: v.string(),
    }),
  }),
  relay: v.object({
    url: v.string(),
  }),
});

export type Config = v.InferOutput<typeof ConfigSchema>;

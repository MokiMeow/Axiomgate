import { z } from "zod";

export const Sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

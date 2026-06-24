import type { ParserKey } from '../../shared/product/manifest';
import type { PrereqReport } from '../../shared/types/prerequisites';
import { parsePrereqOutput } from '../prerequisites/prereq-parser';

/**
 * Engine-side binding for the manifest's `ParserKey`s. A step that turns its streamed
 * output into a structured result names a parser key in the manifest; the engine looks
 * the function up here instead of hard-coding it. (The `composePs` key documents the
 * docker-status query parser, which is invoked directly from its query handler rather
 * than through a streamed task.)
 */
export type StreamResultParser = (raw: string, exitCode: number | null) => PrereqReport;

const STREAM_PARSERS: Partial<Record<ParserKey, StreamResultParser>> = {
  prereq: parsePrereqOutput,
};

/** Resolve a step's stream-result parser from its manifest `parser` key. */
export function streamResultParser(key: ParserKey | undefined): StreamResultParser {
  const parser = key ? STREAM_PARSERS[key] : undefined;
  if (!parser) throw new Error(`No stream-result parser registered for parser key "${key}".`);
  return parser;
}

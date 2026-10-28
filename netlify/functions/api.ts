/**
 * ROCKCRAFT full API restored. Handler is gzip-compressed across chunk modules.
 */
import { gunzipSync } from 'node:zlib';
import { c0 } from './_shared/apiChunks/c0';
import { c1 } from './_shared/apiChunks/c1';
import { c2 } from './_shared/apiChunks/c2';
import { c3 } from './_shared/apiChunks/c3';
import { c4 } from './_shared/apiChunks/c4';
import { c5 } from './_shared/apiChunks/c5';

const code = gunzipSync(Buffer.from([c0, c1, c2, c3, c4, c5].join(''), 'base64')).toString('utf8');
const moduleObj: { exports: any } = { exports: {} };
const fn = new Function(
  'module', 'exports', 'require', 'process', 'Buffer', 'console', 'URL', 'Response', 'fetch', 'crypto', 'Headers', 'TextEncoder', 'TextDecoder',
  code,
);
fn(moduleObj, moduleObj.exports, require, process, Buffer, console, URL, Response, fetch, crypto, Headers, TextEncoder, TextDecoder);
const exported = moduleObj.exports;
export default exported.default;
export const config = exported.config;

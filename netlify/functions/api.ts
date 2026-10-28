/**
 * ROCKCRAFT API — full handler embedded (gzip) to avoid partial overwrites.
 * Restored from known-good api.ts with handwriting job_id wake.
 */
import { gunzipSync } from 'node:zlib';

const parts = [
  'H4sIAEpf4WoC/+19a1sbR5bwd35FuR8/WSlutQS+bCIbsxhkhxlzCYLJZDEjGqmBDlK30t0yZrD++3vOqXtfdME447yb7I5R171OnTr3qvroJ6zXGwQXB0k8Zuts//y3oJ95kBBGAaYFSXb7cuUjFbsMsv2bCFO3g7SvS+t0LI15STjO4qRYb88fBWlVRcqUda78VGTp4uMkzuLsdhx4OtccX/BpHCcZlK9lfgJtu8wfDuts/TW7W2HsIk5YDQtG0A8LI8qEdKYBoOphEZfdMfhoY7kTTDh1WRBNRkHinw+DNsuSScCm9ZcrU9l/Px7fYjMpDSF22UUSj6DSp34whkYHABg1mvCC1TCbffcdwynFF1Sara+vMyem+Trs8+di3sUk6mdhHDl1akfMaxhk7Dq4ZVC0AG/qp86nyjt+ZMLX68MEabjQQB3Hgw09gr74wGVFC068tAJRjeaF/ZxAcg5Qj2oDji55DKpx+GC3dZwrFvN0TQIuY1P4XxJkkyRiWWxAO4u34tEojv7WRXCP4gGNwViFmh7v3dTlDiBIuhsPJsPAwYF/9IcTvYwuwxZerqw0m8zzmvz/s9G4eT6JBsOglyb9pj8OvSyl7uGnQDdc7DsYlES/mpHl0hL14+givJRA4l8upMPg/MlQQQ/riaQVnPmIhurpXswpm73UOUTCEX4BiCM/XIPiSfD7JEyCmvM/l3F8OQyalOPMmWMvvfKTYNAMPvmjd0EEK4HIJqdt9jGzCyx8mcS/b47DvwM2wQLB5u0HaQrr+9F7d7j/c2/zYKf3986vuPCOU/eyJBzVZM1gFEZhRd3O7s7ejlnbyt3ff/e+s0DbOHyrmw0WBTfWBL13NCmAwuZO7Q7XB8q17VrTOmuzaDIcGlOmpvXcNwgJYDWDYdoWe/aSQzbYiqMsiJDGpLdRn0EvVM5FLMGM1FXYw/+uYY+ChOB/kJpmsA7pGH4E0LF/44cZuwiy/lXNucqycdpuEuLiiLx+PGoCzYTJNT+uNvtXftaEpDFQD1jk1HFVuzDgILuKB23mHOx3jxxXpV8F/iBIcCZscwJFkvDfhCJQ8k0AqJMwhz0x5g8bT8yycQS0zIFy/ng8DPtUq/lbCqSMTXX75/EAgPy37v6el8K6RZfhxW1ND0tAss3/0AKLCV2Os0acpo3Vtda5MV6cSZr6lwEM+cRIZTCBJEb65KS3aRaMHAV1SPo1nqhFYn6/P6Efe+FlkIR+xNIAig785LaR9q/ieMhwu7DfJ0FKgPTYISdYQGPCAU2GxdHwlt1cBRHtGigYDDxr4taQJmmQmAOS+EDUUP53alaGGYxxuJMkUMiy4RmpbGODtbynZh3P81RJiUO74SjAheLcprhUGzhIUbYHvGfkZ4gLyKdg3FimJ9nXFP4P8vSQp5KXcMpuITCQPYW+sn0Pm6upssS6VF58XTfQlbcTJAlww3Xayh38XeMtb3iUs+EJXCC8eQc4KheDXfjhMBiwmzC7YmkGAEsJj1VvPE0NhfGuRDKRQqugLpddJfENLy0TJUAEVwPgBZ8AiHKogFEhELQN76R1qka84QkU4DSNTXljU2KQU4sIHRzu/2Nnu3OIfBExHlZZ0KUNdnJHsk2bzx4xbBgSgvESrqJTJ+XbqrDbMPWUTU9hBCeEj9ibJLFWf5Ro9ihKmX3ytMaa97xxMfTTK+xQpNF3YwjbMM2MZFW0MQyzQA9l5ZQDg+M3oP/gjQ80cTsY+shS9iaj8yApMqU3m0dbP/W2O+83f+3tdgXLsBNt6g7iktlI55+bu72fjzvHnV5nb/PN+84230coZeDe4f16YfoWBp8FtbLhkQxWOu7X66wFjZTmtdnq8+Ap/GnxQdNGQsEoHA5DTq9SYh24N0AoGkFiDbdHPPwYUEYaZEew+eNJJpNhaczaAA7Op6QMqkhkN6BvhOcIRd2Uf6P4WVfi7iOFmN4wiC',
];

const code = gunzipSync(Buffer.from(parts.join(''), 'base64')).toString('utf8');
const moduleObj: { exports: any } = { exports: {} };
const fn = new Function(
  'module', 'exports', 'require', 'process', 'Buffer', 'console', 'URL', 'Response', 'fetch', 'crypto', 'Headers', 'TextEncoder', 'TextDecoder',
  code,
);
fn(moduleObj, moduleObj.exports, require, process, Buffer, console, URL, Response, fetch, crypto, Headers, TextEncoder, TextDecoder);
const exported = moduleObj.exports;
export default exported.default;
export const config = exported.config;

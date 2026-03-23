import typstInit from '@jchoi2x/typst-ts-parser/pkg/wasm-pack-shim.mjs';
import { hljsTypst, initHljs } from '../../hljs.mjs';

/// Begin of Retrieve Wasm Modules from somewhere
/// We need a compiler module and a parser module
/// - `@jchoi2x/typst-ts-parser`

// Bundle
// @ts-ignore
import parserModule from '../../../../../node_modules/@jchoi2x/typst-ts-parser/pkg/typst_ts_parser_bg.wasm';

window.$typst$parserModule = typstInit(parserModule).then(() => initHljs());
window.hljsTypst = hljsTypst;

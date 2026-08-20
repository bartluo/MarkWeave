import type { HTMLTagToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import sanitize from '../../utils/dompurify';
import { htmlToVNode } from '../../utils/snabbdom';

export default function htmlRuby(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: HTMLTagToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { children } = token;
    const { start, end } = token.range;
    const content = this.highlight(h, block, start, end, token);
    // `token.raw` is untrusted user input. Sanitize it before parsing into
    // vnodes — `htmlToVNode` assigns `innerHTML`, which would otherwise allow
    // DOM XSS (e.g. `<ruby><img src=x onerror=...>`). Only ruby markup is
    // needed for the preview, so restrict the allowed tags accordingly.
    const vNode = htmlToVNode(
        sanitize(token.raw, {
            ALLOWED_TAGS: ['ruby', 'rt', 'rp', 'rb', 'rtc', '#text'],
            ALLOWED_ATTR: [],
        }),
    );
    const previewSelector = `span.${CLASS_NAMES.MU_RUBY_RENDER}`;

    return children?.length
        ? [
                h(`span.${className}.${CLASS_NAMES.MU_RUBY}`, [
                    h(
                        `span.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_RUBY_TEXT}`,
                        content,
                    ),
                    h(
                        previewSelector,
                        {
                            attrs: {
                                contenteditable: 'false',
                                spellcheck: 'false',
                            },
                            dataset: {
                                start: String(start + 6), // '<ruby>'.length
                                end: String(end - 7), // '</ruby>'.length
                            },
                        },
                        vNode,
                    ),
                ]),
                // if children is empty string, no need to render ruby characters...
            ]
        : [
                h(`span.${className}.${CLASS_NAMES.MU_RUBY}`, [
                    h(
                        `span.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_RUBY_TEXT}`,
                        content,
                    ),
                ]),
            ];
}

declare module "CETEIcean" {
  export default class CETEI {
    constructor(options?: { documentObject?: Document });
    els: Set<string>;
    addBehaviors(behaviors: Record<string, unknown>): void;
    preprocess(xmlDoc: Document): Element;
    fallback(elements: string[]): void;
  }
}

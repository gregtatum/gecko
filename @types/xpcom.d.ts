/// <reference path="xpcom/types.d.ts" />

declare namespace XPCOM {
  export interface ComponentFactory {
      readonly createInstance: <I extends InterfaceRef>(ref: I) => InterfaceFor<I>;
      readonly getService: <I extends InterfaceRef>(ref: I) => InterfaceFor<I>;
  }

  export type Classes = { readonly [key: string]: ComponentFactory };

  export interface Components {
      readonly classes: Classes;
      readonly interfaces: InterfaceRefs;
  }
}

declare var Components: XPCOM.Components;
declare var Cc: XPCOM.Classes;
declare var Ci: XPCOM.InterfaceRefs;

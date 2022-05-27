/// <reference path="interface_lists.d.ts" />

declare namespace XPCOM {
  export type Out<T> = { value?: T };
  export type InOut<T> = { value: T };

  export interface InterfaceRef {
    readonly name: string;
  }

  type InterfaceFor<I extends InterfaceRef> =
    I['name'] extends keyof Interfaces ? Interfaces[I['name']] : never;

  export interface nsISupports {
    QueryInterface: <T, I extends InterfaceRef>(this: T, ref: I) => T & InterfaceFor<I>;
  }

  type IDLAString = string;
  type IDLACString = string;
  type IDLAUTF8String = string;
  type IDLjsval = string;
  type IDLPromise =Promise<any>;
}

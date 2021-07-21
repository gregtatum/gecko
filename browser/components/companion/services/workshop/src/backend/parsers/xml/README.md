## XML parsers

In order to be able to handle XML namespaces a global node builder is added to the parser to select a node builder depending on the namespace to use (current one or dependending on the tag prefix).
Each XML node should have a JS counterpart, it's up to its implementation to validate the node and to check that the potential children have the correct namespace, properties, ...

At end, a very basic and compact object is created to store all the parsed document.

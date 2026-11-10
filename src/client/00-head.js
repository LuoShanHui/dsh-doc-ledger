/**
 * dsh-doc-ledger client plugin: the document ledger sidebar tab, rendered
 * natively in React from the host projection endpoint.
 */
window.__ModuleLoader__.load({
  id: "dsh-doc-ledger",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    var react = require("react");

    var NS = "doc-ledger";
    var TAB_ID = "dsh-doc-ledger";
    var KIND = "doc-ledger";
    var BASE = "/doc-ledger";


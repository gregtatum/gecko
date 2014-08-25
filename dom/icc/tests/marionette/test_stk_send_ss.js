/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

MARIONETTE_HEAD_JS = "stk_helper.js";

function testSendSS(command, expect) {
  log("STK CMD " + JSON.stringify(command));
  is(command.typeOfCommand, iccManager.STK_CMD_SEND_SS, expect.name);
  is(command.commandQualifier, expect.commandQualifier, expect.name);
  is(command.options.text, expect.title, expect.name);

  let icons = command.options.icons;
  if (icons) {
    isIcons(icons, expect.icons, expect.name);

    let iconSelfExplanatory = command.options.iconSelfExplanatory;
    is(iconSelfExplanatory, expect.iconSelfExplanatory, expect.name);
  }

  runNextTest();
}

let tests = [
  {command: "d029810301110082028183850c43616c6c20466f7277617264891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_1_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Call Forward"}},
  {command: "d01b810301110082028183891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_1_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d02d810301110082028183850c43616c6c20466f7277617264891491aa120a21436587092143658709214365a711fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_2_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Call Forward"}},
  {command: "d01f810301110082028183891491aa120a21436587092143658709214365a711fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_2_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d081fd8103011100820281838581eb4576656e20696620746865204669786564204469616c6c696e67204e756d626572207365727669636520697320656e61626c65642c2074686520737570706c656d656e74617279207365727669636520636f6e74726f6c20737472696e6720696e636c7564656420696e207468652053454e442053532070726f61637469766520636f6d6d616e64207368616c6c206e6f7420626520636865636b656420616761696e73742074686f7365206f66207468652046444e206c6973742e2055706f6e20726563656976696e67207468697320636f6d6d616e642c20746865204d45207368616c6c20646563698904ffba13fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_3_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Even if the Fixed Dialling Number service is enabled, the supplementary service control string included in the SEND SS proactive command shall not be checked against those of the FDN list. Upon receiving this command, the ME shall deci"}},
  {command: "d00f8103011100820281838904ffba13fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_3_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d01d8103011100820281838500891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_4_with_alpha_identifier",
            commandQualifier: 0x00,
            title: ""}},
  // send_ss_cmd_4_without_alpha_identifier has the same pdu as
  // send_ss_cmd_1_without_alpha_identifier.
  {command: "d02b810301110082028183850a42617369632049636f6e891091aa120a214365870921436587a901fb9e020001",
   func: testSendSS,
   expect: {name: "send_ss_cmd_5_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Basic Icon",
            iconSelfExplanatory: true,
            icons: [basicIcon]}},
  {command: "d01f810301110082028183891091aa120a214365870921436587a901fb9e020001",
   func: testSendSS,
   expect: {name: "send_ss_cmd_5_without_alpha_identifier",
            commandQualifier: 0x00,
            iconSelfExplanatory: true,
            icons: [basicIcon]}},
  {command: "d02c810301110082028183850b436f6c6f75722049636f6e891091aa120a214365870921436587a901fb9e020003",
   func: testSendSS,
   expect: {name: "send_ss_cmd_6_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Colour Icon",
            iconSelfExplanatory: true,
            icons: [colorIcon]}},
  {command: "d01f810301110082028183891091aa120a214365870921436587a901fb9e020003",
   func: testSendSS,
   expect: {name: "send_ss_cmd_6_without_alpha_identifier",
            commandQualifier: 0x00,
            iconSelfExplanatory: true,
            icons: [colorIcon]}},
  {command: "d02b810301110082028183850a42617369632049636f6e891091aa120a214365870921436587a901fb9e020101",
   func: testSendSS,
   expect: {name: "send_ss_cmd_7_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Basic Icon",
            iconSelfExplanatory: false,
            icons: [basicIcon]}},
  {command: "d01f810301110082028183891091aa120a214365870921436587a901fb9e020101",
   func: testSendSS,
   expect: {name: "send_ss_cmd_7_without_alpha_identifier",
            commandQualifier: 0x00,
            iconSelfExplanatory: false,
            icons: [basicIcon]}},
  {command: "d036810301110082028183851980041704140420041004120421042204120423041904220415891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_8_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "ЗДРАВСТВУЙТЕ"}},
  // send_ss_cmd_8_without_alpha_identifier has the same pdu as
  // send_ss_cmd_1_without_alpha_identifier.
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001000b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_9_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001000b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_9_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d02d810301110082028183851054657874204174747269627574652032891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_10_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 2"}},
  // send_ss_cmd_10_without_alpha_identifier has the same pdu as
  // send_ss_cmd_1_without_alpha_identifier.
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001001b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_11_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001001b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_11_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001002b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_12_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001002b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_12_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001004b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_13_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001004b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_13_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652032891091aa120a214365870921436587a901fbd004001000b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_14_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 2"}},
  // send_ss_cmd_14_without_alpha_identifier has the same pdu as
  // send_ss_cmd_9_without_alpha_identifier.
  {command: "d02d810301110082028183851054657874204174747269627574652033891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_15_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 3"}},
  // send_ss_cmd_15_without_alpha_identifier has the same pdu as
  // send_ss_cmd_1_without_alpha_identifier.
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001008b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_16_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001008b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_16_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001010b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_17_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001010b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_17_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001020b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_18_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001020b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_18_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001040b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_19_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001040b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_19_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d033810301110082028183851054657874204174747269627574652031891091aa120a214365870921436587a901fbd004001080b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_20_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "Text Attribute 1"}},
  {command: "d021810301110082028183891091aa120a214365870921436587a901fbd004001080b4",
   func: testSendSS,
   expect: {name: "send_ss_cmd_20_without_alpha_identifier",
            commandQualifier: 0x00}},
  {command: "d0228103011100820281838505804f60597d891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_21_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "你好"}},
  // send_ss_cmd_21_without_alpha_identifier has the same pdu as
  // send_ss_cmd_1_without_alpha_identifier.
  {command: "d02081030111008202818385038030eb891091aa120a214365870921436587a901fb",
   func: testSendSS,
   expect: {name: "send_ss_cmd_22_with_alpha_identifier",
            commandQualifier: 0x00,
            title: "ル"}},
  // send_ss_cmd_22_without_alpha_identifier has the same pdu as
  // send_ss_cmd_1_without_alpha_identifier.
];

runNextTest();

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CompileCodepages } from "wbxml";


import Common from './codepages/Common';
import AirSync from  './codepages/AirSync';
import Contacts from  './codepages/Contacts';
import Email from './codepages/Email';
import Calendar from './codepages/Calendar';
import Move from './codepages/Move';
import ItemEstimate from "./codepages/ItemEstimate";
import FolderHierarchy from "./codepages/FolderHierarchy";
import MeetingResponse from "./codepages/MeetingResponse";
import Tasks from "./codepages/Tasks";
import ResolveRecipients from "./codepages/ResolveRecipients";
import ValidateCert from "./codepages/ValidateCert";
import Contacts2 from "./codepages/Contacts2";
import Ping from "./codepages/Ping";
import Provision from "./codepages/Provision";
import Search from "./codepages/Search";
import GAL from "./codepages/GAL";
import AirSyncBase from "./codepages/AirSyncBase";
import Settings from "./codepages/Settings";
import DocumentLibrary from "./codepages/DocumentLibrary";
import ItemOperations from "./codepages/ItemOperations";
import ComposeMail from "./codepages/ComposeMail";
import Email2 from "./codepages/Email2";
import Notes from "./codepages/Notes";
import RightsManagement from "./codepages/RightsManagement";

const codepages = {
  Common,
  AirSync,
  Contacts,
  Email,
  Calendar,
  Move,
  ItemEstimate,
  FolderHierarchy,
  MeetingResponse,
  Tasks,
  ResolveRecipients,
  ValidateCert,
  Contacts2,
  Ping,
  Provision,
  Search,
  GAL,
  AirSyncBase,
  Settings,
  DocumentLibrary,
  ItemOperations,
  ComposeMail,
  Email2,
  Notes,
  RightsManagement,
};

CompileCodepages(codepages);
export default codepages;

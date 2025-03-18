import { CommandExecutor } from "./cli/common";
import { upsertConfigMapCommand } from "./libs/k8s-helpers";

const command = upsertConfigMapCommand("staging", "amit", { what: 'world'});
new CommandExecutor(command).exec(); 

import {
  Collection,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';

import { setchannelCommand } from './setchannel';
import { setrolesCommand } from './setroles';
import { addpromptCommand } from './addprompt';
import { addpollCommand } from './addpoll';
import { scheduleCommand } from './schedule';
import { statsCommand } from './stats';
import { testCommand } from './test';
import { trackchannelCommand } from './trackchannel';

// Pikkit CSV commands
import { importpikkitcsvCommand } from './importpikkitcsv';
import { setcsvmapCommand } from './setcsvmap';
import { recapCommand } from './recap';
import { tagbetCommand } from './tagbet';
import { tagbetsbulkCommand } from './tagbetsbulk';
import { listbetsCommand } from './listbets';

// Bet logging and grading commands
import { logbetCommand } from './logbet';
import { gradebetCommand } from './gradebet';
import { cardpostCommand } from './cardpost';
import { linkwhopCommand } from './linkwhop';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>();

// Register all commands
const commandList: Command[] = [
  setchannelCommand,
  setrolesCommand,
  addpromptCommand,
  addpollCommand,
  scheduleCommand,
  statsCommand,
  testCommand,
  trackchannelCommand,
  // Pikkit CSV commands
  importpikkitcsvCommand,
  setcsvmapCommand,
  recapCommand,
  tagbetCommand,
  tagbetsbulkCommand,
  listbetsCommand,
  // Bet logging and grading commands
  logbetCommand,
  gradebetCommand,
  cardpostCommand,
  linkwhopCommand,
];

for (const command of commandList) {
  commands.set(command.data.name, command);
}

// Export command data for registration
export function getCommandsData() {
  return commandList.map((cmd) => cmd.data.toJSON());
}

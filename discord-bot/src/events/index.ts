import { Client } from 'discord.js';
import { registerReadyEvent } from './ready';
import { registerGuildMemberAddEvent } from './guildMemberAdd';
import { registerMessageCreateEvent } from './messageCreate';
import { registerInteractionCreateEvent } from './interactionCreate';

export function registerEvents(client: Client): void {
  registerReadyEvent(client);
  registerGuildMemberAddEvent(client);
  registerMessageCreateEvent(client);
  registerInteractionCreateEvent(client);
}

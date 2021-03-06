const Warning = require('../../models/warningModel');
const WarningThreshold = require('../../models/warningThresholdModel');
const Blacklist = require('../../models/blackListModel');
const Discord = require('discord.js');

module.exports = {
	name: 'warn',
	description: 'The purpose of this command is to warn.',
	args: true,
	cooldown: 5,
	async execute(message, args) {
		if(!message.member.hasPermission('KICK_MEMBERS')) return;

		const matchedIDs = args.filter(el => message.guild.members.get(el));
		for(const i in args) {
			if(message.guild.members.get(args[i])) {
				delete args[i];
			} else if(Discord.MessageMentions.USERS_PATTERN.test(args[i])) {
				delete args[i];
			}
		}
		const noMentions = 'please mention someone to warn!';
		const cannotWarnModMessage = 'you cannot warn a mod!';
		const userDoesntExistMessage = 'does\'nt exist in this server anymore!';

		let reason;

		const warnManage = async (guildMember, reason) => {
			let warning = await Warning.findOne({ guildID: guildMember.guild.id, userID: guildMember.id });
			if(!warning) {
				warning = await Warning.create({
					guildID: message.guild.id,
					guildName: message.guild.name,
					userID: guildMember.user.id,
					userTag: guildMember.user.tag,
					warnings: process.env.WARNING_INITIAL * 1
				});
			} else {
				warning = await Warning.findOneAndUpdate({
					guildID: message.guild.id,
					userID: guildMember.user.id
				}, {
					guildName: message.guild.name,
					userTag: guildMember.user.tag,
					warnings: warning.warnings + 1
				}, { upsert: true, new: true })
			}

			let warningThreshold = await WarningThreshold.findOne({ guildID: message.guild.id });
			if(!warningThreshold) {
				warningThreshold = process.env.WARNING_THRESHOLD_INITIAL;
			} else {
				warningThreshold = warningThreshold.threshold;
			}
			warning = warning.warnings;

			if(warning >= warningThreshold) {
				await message.channel.send(`<@${guildMember.user.id}>, you have reached \`${warning}\` warning(s) out of \`${warningThreshold}\`, you will be banned!`);

				await Blacklist.create({
					guildID: message.guild.id,
					guildName: message.guild.name,
					userID: guildMember.user.id,
					userTag: guildMember.user.tag,
					reason
				});

				return await guildMember.ban({
					reason
				});
			}

			await message.channel.send(`<@${guildMember.user.id}>, you have \`${warning}\` warning(s) out of \`${warningThreshold}\` for \`${reason.split(' ').join(' ')}\``);
		}

		const warn = async (userArr, userArrIDs, reason) => {
			const realWarnMentions = async userNewArr => {
				for(const user in userNewArr) {
					const guildMember = message.guild.members.get(userNewArr[user].id);
					if(guildMember.hasPermission('KICK_MEMBERS')) return await message.reply(cannotWarnModMessage);

					if(!guildMember) {
						await message.reply(`${userNewArr[user].id} ${userDoesntExistMessage}`);
						continue;
					}

					await warnManage(guildMember, reason);
				}
			};

			const realWarnIDs = async userNewIDsArray => {
				for(const user in userNewIDsArray) {
					const guildMember = message.guild.members.get(userNewIDsArray[user]);
					if(guildMember.hasPermission('KICK_MEMBERS')) return await message.reply(cannotWarnModMessage);

					if(!guildMember) {
						await message.reply(`${userNewIDsArray[user]} ${userDoesntExistMessage}`);
						continue;
					}

					await warnManage(guildMember, reason);
				}
			};

			if(userArr[0]) {
				return await realWarnMentions(userArr);
			}

			return await realWarnIDs(userArrIDs);
		};

		reason = `${message.author.tag}: reason not supplied.`;

		if(message.mentions.users.array().length >= 1) {
			const mentionedArray = message.mentions.users.array();

			reason = `${message.author.tag}: ${args.join(' ')}`;

			await warn(mentionedArray, false, reason);
		} else if(matchedIDs) {
			reason = `${message.author.tag}: ${args.join(' ')}`;

			await warn(false, matchedIDs, reason);
		} else {
			return await message.reply(noMentions);
		}
	},
};

let gifs = require('../assets/permGifs.json')
// let categoryStats = {}
// let commandStats = {}
exports.handleMeDaddy = async function (msg) {
  if (
    !msg.channel.guild ||
    msg.author.bot ||
    await this.db.isBlocked(msg.author.id, msg.channel.guild.id)
  ) {
    return
  }

  if (this.config.premium && !this.config.premiumGuilds.includes(msg.channel.guild.id)) {
    return msg.channel.createMessage('This server is not a premium activated server. If you believe this is an error, contact melmsie.')
  }

  const gConfig = await this.db.getGuild(msg.channel.guild.id) || {
    prefix: this.config.defaultPrefix,
    disabledCommands: []
  }

  const prefix = (() => {
    const { nick, username } = msg.channel.guild.members.get(this.bot.user.id)
    return this.mentionRX.test(msg.content)
      ? `@${nick || username}`.toLowerCase()
      : gConfig.prefix
  })()
  if (!msg.cleanContent.toLowerCase().startsWith(prefix)) {
    return
  }

  let [command, ...cleanArgs] = msg.cleanContent.slice(prefix.length + 1).split(/\s+/g)
  const args = msg.content.slice(prefix.length + 1).split(/\s+/g).slice(1)
  if (args[0] === command) {
    args.shift()
  }
  command = command && (this.cmds.find(c => c.props.triggers.includes(command.toLowerCase())) || this.tags[command.toLowerCase()])

  if (
    !command &&
    msg.mentions.find(u => u.id === this.bot.user.id) &&
    msg.content.toLowerCase().includes('hello')
  ) {
    return msg.channel.createMessage(`Hello, ${msg.author.username}. My prefix is \`${gConfig.prefix}\`. Example: \`${gConfig.prefix} meme\``)
  } else if (
    !command ||
    (command.props.ownerOnly && !this.config.devs.includes(msg.author.id)) ||
    gConfig.disabledCommands.includes(command.props.triggers[0]) ||
    (gConfig.disabledCommands.includes('nsfw') && command.props.isNSFW)
  ) {
    return
  }
  /* Starting this later
  if (categoryStats[command.category]) {
    categoryStats[command.category]++
  } else {
    categoryStats[command.category] = 1
  }
  if (commandStats[command.cmdProps.triggers[0]]) {
    commandStats[command.cmdProps.triggers[0]]++
  } else {
    commandStats[command.cmdProps.triggers[0]] = 1
  }
  */
  this.db.addPls(msg.channel.guild.id, msg.author.id)
  if (msg.member.roles.some(id => msg.channel.guild.roles.get(id).name === 'no memes for you')) return

  const cooldown = await this.db.getCooldown(command.props.triggers[0], msg.author.id)
  if (cooldown > Date.now()) {
    const waitTime = (cooldown - Date.now()) / 1000
    let cooldownWarning = command.props.cooldownMessage || `**Time left until you can run the command again:** `

    const cooldownMessage = {
      embed: {
        title: 'You are being ratelimited <:errorSign:428021845078573058>',
        description: cooldownWarning + (waitTime > 60 ? `${this.parseTime(waitTime)}` : `${waitTime.toFixed()} seconds`) + `\n\n<:ratelimited:430818160434741250> Default Cooldown: ${this.parseTime(command.props.cooldown / 1000)}\n<:donateSign:428024864700497921> [Donor](https://www.patreon.com/dankmemerbot) Cooldown: ${command.props.donorBlocked ? this.parseTime(command.props.cooldown / 1000) : this.parseTime(command.props.donorCD / 1000)}`
      }
    }
    return msg.channel.createMessage(cooldownMessage)
  }
  const addCooldown = () => this.db.addCooldown(command.props.triggers[0], msg.author.id)

  try {
    const permissions = msg.channel.permissionsOf(this.bot.user.id)
    if (command.props.perms.some(perm => !permissions.has(perm))) {
      const neededPerms = command.props.perms.filter(perm => !permissions.has(perm))
      if (permissions.has('sendMessages')) {
        if (permissions.has('embedLinks')) {
          if (neededPerms.length > 1) {
            msg.channel.createMessage({ embed: {
              'title': 'oh no!',
              'description': `You need to add **${neededPerms.join(', ')}** to use this command!\nGo to **Server settings => Roles => Dank Memer** to change this!`,
              'color': this.randomColor(),
              'footer': {
                'text': 'If it still doesn\'t work, check channel permissions too!'
              }
            }})
          } else {
            msg.channel.createMessage(
              {
                'embed': {
                  'title': 'oh no!',
                  'description': `You need to add **${neededPerms}** to use this command!\nGo to **Server settings => Roles => Dank Memer** to change this!`,
                  'color': this.randomColor(),
                  'image': {
                    'url': gifs[neededPerms[0]]
                  },
                  'footer': {
                    'text': 'If it still doesn\'t work, check channel permissions too!'
                  }
                }
              }
            )
          }
        } else {
          msg.channel.createMessage(
            `You need to add **${neededPerms.join(', ')}** to use this command!\n\nGo to **Server settings => Roles => Dank Memer** to change this!`
          )
        }
      }
    } else if (command.props.isNSFW && !msg.channel.nsfw) {
      msg.channel.createMessage(
        {'embed': {
          'title': 'NSFW not allowed here',
          'description': 'Use NSFW commands in a NSFW marked channel (look in channel settings, dummy)',
          'color': this.randomColor(),
          'image': {
            'url': gifs.nsfw
          }
        }}
      )
    } else {
      msg.reply = (str) => { msg.channel.createMessage(`${msg.author.mention}, ${str}`) }

      let res = await command.run({
        msg,
        args,
        cleanArgs,
        Memer: this,
        addCD: addCooldown
      })
      if (!res) {
        return
      }
      if (res instanceof Object) {
        if (res.reply) {
          return msg.channel.createMessage(`${msg.author.mention}, ${res.content}`)
        }
        res = Object.assign({ color: this.randomColor() }, res)
        res = {
          content: res.content,
          file: res.file,
          embed: res
        }
        if (Object.keys(res.embed).join(',') === 'color,content,file') {
          delete res.embed // plz fix later
        }
      }

      await msg.channel.createMessage(res, res.file)
    }
  } catch (e) {
    if (e.message.includes('Disconnected') || e.message.includes('Voice connection timeout')) {
      msg.channel.createMessage(`Discord done hecked up: \`${e.message}\` \n\nTo fix this, go to your server settings, change the region to any other region, hit save, and try the command again.\nPlease join here (<https://discord.gg/ebUqc7F>) if the issue doesn't stop being an ass. `)
      await this.bot.createMessage('431132690339856384', `**Error: ${e.message} **\nServer ID: ${msg.channel.guild.id}\nVoice Endpoint: ${this.bot.voiceConnections.get(msg.channel.guild.id).endpoint ? this.bot.voiceConnections.get(msg.channel.guild.id).endpoint : 'Not available'}\nCluster ${this.clusterID}| Shard ${msg.channel.guild.shard.id}\n\`\`\` ${e.stack} \`\`\``)
      this.log(`Voice error:\n\tCommand: ${command.props.triggers[0]}\n\tServer Region: ${msg.channel.guild.region}\n\tServer ID: ${msg.channel.guild.id}\n\tError: ${e.stack}`, 'error')
    } else if (e.message.includes('new_val')) {
      msg.channel.createMessage(`We done hecked up: \`${e.message}\` \n\nWe do not currently know what is causing this issue, but we are working on it.\nPlease join here (<https://discord.gg/ebUqc7F>) if the issue doesn't stop being an ass. `)
      let user = await this.db.getUser(msg.author.id)
      await this.bot.createMessage('431840220032270337', `**Error: ${e.message} **\nServer ID: ${msg.channel.guild.id}\nUser ID: ${user.id}\nCommands ran: ${user.pls} \nCurrent Coins: ${user.coin}\nCluster ${this.clusterID}| Shard ${msg.channel.guild.shard.id}\n\`\`\` ${e.stack} \`\`\``)
      this.log(`Error:\n\tCommand: ${command.props.triggers[0]}\n\tServer ID: ${msg.channel.guild.id}\n\tError: ${e.stack}`, 'error')
    } else {
      msg.channel.createMessage(`Something went wrong while executing this hecking command: \`${e.message}\` \nPlease join here (<https://discord.gg/ebUqc7F>) if the issue doesn't stop being an ass.`)
      await this.bot.createMessage('431692509895458833', `**Error: ${e.message}**\n**Command Ran: ${command.props.triggers[0]}\nSupplied arguments: ${args.join(' ')}\nServer ID: ${msg.channel.guild.id}\n\`\`\` ${e.stack} \`\`\``)
      this.log(`Command error:\n\tCommand: ${command.props.triggers[0]}\n\tSupplied arguments: ${cleanArgs.join(' ')}\n\tServer ID: ${msg.channel.guild.id}\nCluster ${this.clusterID}| Shard ${msg.channel.guild.shard.id}\n\tError: ${e.stack}`, 'error')
    }
  }
}

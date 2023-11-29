const Discord = require('discord.js');
const ytdl = require('ytdl-core-discord');
const https = require('https');
const http = require('http');
const yts = require('yt-search');
const { VoiceConnectionStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const music = require('@discordjs/voice');
const { addSpeechEvent, SpeechEvents } = require("discord-speech-recognition");
const { getInfo } = require('discord-ytdl-core');
const { forEach } = require('lodash');
const mySecret = process.env['token']
const version = "1.0";
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});
addSpeechEvent(bot);
const PREFIX = "+";

var connectionMap = new Object();


bot.on('ready', () => {
  console.log('bot online');
})

bot.on(SpeechEvents.speech, async (msg) => {
  // If bot didn't recognize speech, content will be empty
  if (!msg.content) return;
  msg.author.send(msg.content);
  if (msg.content.toLowerCase().indexOf("reader") == -1) return;
  var command = msg.content.substring(msg.content.toLowerCase().indexOf("reader") + 6).toLowerCase();
  if (command.indexOf("play") != -1) {
    const v = await realvideosearch(command.substring(command.indexOf("play") + 4));
    var newvid = 'https://www.youtube.com/watch?v=' + v.videoId;
    if (connectionMap[msg.guild.id] != null) {
      msg.author.send(newvid);
      connectionMap[msg.guild.id][1].push(newvid);
      if (connectionMap[msg.guild.id][2] == "null") {
        connectionMap[msg.guild.id][2] = createAudioPlayer();
        connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
          queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
            if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
              queue.connection.voiceConnection.configureNetworking();
            }
          })
        });
        connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
          if (connectionMap[msg.guild.id][1].length == 0) {
            connectionMap[msg.guild.id][0].destroy();
            connectionMap[msg.guild.id] = null;
          }
          else {
            next(msg);
          }
        });
        next(msg);
      }
    }
    return;
  }
  if (command.indexOf("stop") != -1) {
    if (connectionMap[msg.guild.id] != null) {
      connectionMap[msg.guild.id][0].destroy();
      connectionMap[msg.guild.id] = null;
    }
    return;
  }
  if (command.indexOf("skip") != -1) {
    if ((connectionMap[msg.guild.id][1] == null || connectionMap[msg.guild.id][1].length <= 0) && getVoiceConnection(msg.guild.id) != null) {
      msg.channel.send('nothing to skip to... disconnecting');
      connectionMap[msg.guild.id][0].destroy()
      connectionMap[msg.guild.id] = null;
      return;
    }
    else if (connectionMap[msg.guild.id] != null && connectionMap[msg.guild.id][1] != null && connectionMap[msg.guild.id][1].length > 0) {
      next(msg);
    }
    return;
  }


  return;
});

function startVoiceConnection(msg, startPlayer, startingQue) {
  connectionMap[msg.guild.id] = []
  connectionMap[msg.guild.id].push(joinVoiceChannel({
    channelId: msg.member.voice.channel.id,
    guildId: msg.guild.id,
    adapterCreator: msg.guild.voiceAdapterCreator,
  }));
  connectionMap[msg.guild.id].push([])
  connectionMap[msg.guild.id].push("null")
  if (startPlayer) {
    connectionMap[msg.guild.id][1].push(startingQue);
    connectionMap[msg.guild.id][2] = createAudioPlayer();
    connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
      queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
        if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
          queue.connection.voiceConnection.configureNetworking();
        }
      })
    });
    connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
      if (connectionMap[msg.guild.id][1].length == 0) {
        connectionMap[msg.guild.id][0].destroy();
        connectionMap[msg.guild.id] == null;
      }
      else {
        next(msg);
      }
    });
  }
}

bot.on('messageCreate', message => {
  const args = message.content.substring(PREFIX.length).split(" ");
  if (message.content.substring(0, PREFIX.length) == '+') {
    switch (args[0]) {
      case 'version':
        {
          message.channel.send('version: ' + version);
          break;
        }
      case 'join':
        if (message.member.voice.channelId == null) {
          message.channel.send('get in a vc mate');
          return;
        }
        else {
          if (connectionMap[message.guild.id] != null) {
            message.channel.send('already in a vc');
            return;
          }
          else {
            startVoiceConnection(message, false, "");
          }
        }
      case 'play':
        if (!args[1] && args[0] == "play") {
          message.channel.send('give me a yt link dumbass');
          return;
        }

        if (message.member.voice.channelId == null && args[0] == "play") {
          message.channel.send('get in a vc mate');
          return;
        }
        else if (args[0] == "play") {
          if (ytdl.validateURL(args[1])) {
            if (connectionMap[message.guild.id] != null) {
              connectionMap[message.guild.id][1].push(args[1]);
            }
            else if (connectionMap[message.guild.id] == null && message.member.voice.channel.id != null) {
              startVoiceConnection(message, true, args[1]);
              next(message)
            }
          }
          else {
            videosearch(message.content.substring(5), message)
          }
        }
        break;
      case 'stop':
        if (connectionMap[message.guild.id] != null) {
          connectionMap[message.guild.id][0].destroy();
          connectionMap[message.guild.id] = null;
        }

        break;

      case 'queue':
        if (connectionMap[message.guild.id] != null) {
          queue(message);
          break;

        }

      case 'skip':
        if ((connectionMap[message.guild.id][1] == null || connectionMap[message.guild.id][1].length <= 0) && connectionMap[message.guild.id] != null) {
          message.channel.send('nothing to skip to... disconnecting');
          connectionMap[message.guild.id][0].destroy()
          connectionMap[message.guild.id] = null;
          return;
        }
        else if (connectionMap[message.guild.id] != null && connectionMap[message.guild.id][1][0] != null) {
          next(message);
        }

        break;
      case 'pray':
        message.channel.send('bismillah wallahi astaghfirullah isalamek asalam alaykum allahu akbar');

        break;
      case 'prayA':
        message.channel.send('بسم الله ربي استغفر الله اسلامك' + ' اسلامك السلام عليكم الله اكبر');
        break;
      case 'tracker':
        if (!args[1]) {
          message.channel.send("Give Steam Profile Link")
        } else if (/^(?:https:\/\/)steamcommunity\.com\/(?:profiles|id)\/[a-zA-Z0-9]+/.test(args[1])) {

          https.get(args[1] + "?xml=1", (response) => {
            let data = '';

            response.on('data', (chunk) => {
              console.log(data);
              data += chunk;
            });

            response.on('end', () => {
              if (response.statusCode === 200) {
                // Request was successful
                var parseString = require('xml2js').parseString;
                parseString(data, (err, result) => {
                  statsSearch(result, message, args[1]);
                });
              } else {
                // Request failed
                console.error("Request failed with status: " + response.statusCode);
              }
            });
          });
        }
    }
  }
});
async function statsSearch(xml, statsMSG, steamLink) {
  var steamID = JSON.parse(JSON.stringify(xml)).profile.steamID64
  var steamName = JSON.parse(JSON.stringify(xml)).profile.steamID
  var steamPic = JSON.parse(JSON.stringify(xml)).profile.avatarMedium
  http.get("http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=730&key=DEB4ABFEB7E5FC72FC2A482038F672E6&steamid=" + steamID, (response) => {
    let data = '';

    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      if (response.statusCode === 200) {
        var playerstats = JSON.parse(data).playerstats.stats
        var kills = playerstats[0].value
        var deaths = playerstats[1].value
        var hours = playerstats[2].value / 3600
        var wins;
        var headshots;
        var money;
        var damage;
        var shotsHit;
        var shotsFired;
        for (var i = 0; i < playerstats.length; i++) {
          if (playerstats[i].name == "total_wins") {
            wins = playerstats[i].value
          }
          if (playerstats[i].name == "total_kills_headshot") {
            headshots = playerstats[i].value
          }
          if (playerstats[i].name == "total_money_earned") {
            money = playerstats[i].value
          }
          if (playerstats[i].name == "total_damage_done") {
            damage = playerstats[i].value
          }
          if (playerstats[i].name == "total_shots_hit") {
            shotsHit = playerstats[i].value
          }
          if (playerstats[i].name == "total_shots_fired") {
            shotsFired = playerstats[i].value
          }
        }

        const embed = new EmbedBuilder()
          .setTitle(steamName + "")
          .setURL(steamLink)
          .setColor(0xff8afb)
          .setAuthor({ name: 'Player Statistics', iconURL: 'https://i.redd.it/which-official-cs2-logo-do-you-like-better-1-or-2-v0-meakmjcylyqa1.jpg?width=358&format=pjpg&auto=webp&s=7999d040dcab80a7521b44f1d81dd840a7ef7135' })
          .addFields(
            { name: 'Hours Played', value: hours.toLocaleString(), inline: true },
            { name: 'Kills', value: kills.toLocaleString(), inline: true },
            { name: 'Deaths', value: deaths.toLocaleString(), inline: true },
            { name: 'K/D Ratio', value: "" + Number((kills / deaths).toFixed(2)), inline: true },
            { name: 'Total Wins', value: "" + wins, inline: true },
            { name: 'Headshot Acc', value: (100 * Number((headshots / kills).toFixed(2))) + "%", inline: true },
            { name: 'Overall Acc', value: (100 * Number((shotsHit / shotsFired).toFixed(2))) + "%", inline: true },
            { name: 'Damage Dealt', value: damage.toLocaleString(), inline: true },
            { name: 'Money Earned', value: "$" + money.toLocaleString(), inline: true },
          )
          .setThumbnail(steamPic + "");

        statsMSG.channel.send({ embeds: [embed] });
      } else {
        // Request failed
        console.error("Request failed with status: " + response.statusCode);
      }
    });
  });
}
async function realvideosearch(t) {
  const r = await yts(t);
  var vids = r.videos.slice(0, 3);
  return vids[0];
}
async function videosearch(t, msg) {
  const r = await yts(t);
  vids = r.videos.slice(0, 3);

  var num = 1;
  vids.forEach(function(v) {
    msg.channel.send(num + '. ' + `${v.title} (${v.timestamp}) | ${v.author.name}`);
    num++;
  })
  playingthings(msg);


  return;

}

function playingthings(msg) {
  bot.on('messageCreate', async (m) => {
    if (msg.author.id == m.author.id) {
      if (m.content == '1') {
        var newvid = 'https://www.youtube.com/watch?v=' + vids[0].videoId;
        if (connectionMap[msg.guild.id] != null) {
          connectionMap[msg.guild.id][1].push(newvid);
          if (connectionMap[msg.guild.id][2] == "null") {
            connectionMap[msg.guild.id][2] = createAudioPlayer();
            connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
              queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
                if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
                  queue.connection.voiceConnection.configureNetworking();
                }
              })
            });
            connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
              if (connectionMap[msg.guild.id][1].length == 0) {
                connectionMap[msg.guild.id][0].destroy();
                connectionMap[msg.guild.id] = null;
              }
              else {
                next(msg);
              }
            });
            next(msg);
          }
          return;
        }
        if (connectionMap[msg.guild.id] == null & m.member.voice.channel.id != null) {
          startVoiceConnection(msg, true, newvid)
          next(msg);
        }
        return;
      }
      else if (m.content == '2') {
        var newvid = 'https://www.youtube.com/watch?v=' + vids[1].videoId;
        if (connectionMap[msg.guild.id] != null) {
          connectionMap[msg.guild.id][1].push(newvid);
          if (connectionMap[msg.guild.id][2] == "null") {
            connectionMap[msg.guild.id][2] = createAudioPlayer();
            connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
              queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
                if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
                  queue.connection.voiceConnection.configureNetworking();
                }
              })
            });
            connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
              if (connectionMap[msg.guild.id][1].length == 0) {
                connectionMap[msg.guild.id][0].destroy();
                connectionMap[msg.guild.id] = null;
              }
              else {
                next(msg);
              }
            });
            next(msg);
          }
          return;
        }
        if (connectionMap[msg.guild.id] == null & m.member.voice.channel.id != null) {
          startVoiceConnection(msg, true, newvid)
          next(msg);
        }
        return;
      }
      else if (m.content == '3') {
        var newvid = 'https://www.youtube.com/watch?v=' + vids[2].videoId;
        if (connectionMap[msg.guild.id] != null) {
          connectionMap[msg.guild.id][1].push(newvid);
          if (connectionMap[msg.guild.id][2] == "null") {
            connectionMap[msg.guild.id][2] = createAudioPlayer();
            connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
              queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
                if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
                  queue.connection.voiceConnection.configureNetworking();
                }
              })
            });
            connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
              if (connectionMap[msg.guild.id][1].length == 0) {
                connectionMap[msg.guild.id][0].destroy();
                connectionMap[msg.guild.id] = null;
              }
              else {
                next(msg);
              }
            });
            next(msg);
          }
          return;
        }
        if (connectionMap[msg.guild.id] == null & m.member.voice.channel.id != null) {
          startVoiceConnection(msg, true, newvid)
          next(msg);
        }
        return;
      }
    }
    return;
  });
}

async function queue(message) {
  if (connectionMap[message.guild.id][1].length == 0) {
    message.channel.send('nothing in que rn');
    return;
  }
  message.channel.send('Queue: ');
  for (i = 0; i < connectionMap[message.guild.id][1].length; i++) {
    const info = await ytdl.getInfo(connectionMap[message.guild.id][1][i]);
    message.channel.send((i + 1) + '. ' + info.videoDetails.title);
  }

}

async function next(mt) {
  if (mt != null) {
    var stream = await ytdl(connectionMap[mt.guild.id][1][0], { filter: 'audioonly', type: 'opus', highWaterMark: 1 << 25 });
    console.log('streaming');
    const resource = createAudioResource(stream);
    connectionMap[mt.guild.id][0].subscribe(connectionMap[mt.guild.id][2]);
    connectionMap[mt.guild.id][2].play(resource);
    connectionMap[mt.guild.id][1].shift()
  }
}

bot.login(mySecret);
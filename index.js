const Discord = require('discord.js');
const keep_alive = require('./keep_alive.js')
const play = require('play-dl');
const https = require('https');
const http = require('http');
const { EmbedBuilder } = require('discord.js');
const { Client, GatewayIntentBits } = require('discord.js');
const { createAudioPlayer, createAudioResource, StreamType, demuxProbe, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice')
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

play.getFreeClientID().then((clientID) => {
    play.setToken({
        soundcloud: {
            client_id: clientID
        }
    })
})


bot.on('ready', () => {
    console.log('bot online');
})

bot.on(SpeechEvents.speech, async (msg) => {
    try {
        // If bot didn't recognize speech, content will be empty
        if (!msg.content) return;
        if (msg.content.toLowerCase().indexOf("reader") == -1) return;
        var command = msg.content.substring(msg.content.toLowerCase().indexOf("reader") + 6).toLowerCase();
        if (command.indexOf("play") != -1) {
            const v = await realvideosearch(command.substring(command.indexOf("play") + 4));
            var newvid = v.url;
            if (connectionMap[msg.guild.id] != null) {
                connectionMap[msg.guild.id][1].push(newvid);
                if (connectionMap[msg.guild.id][2] == null) {
                    connectionMap[msg.guild.id][2] = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Play
                        }
                    })
                    connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
                        queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
                            if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
                                queue.connection.voiceConnection.configureNetworking();
                                console.log("interesting connection")
                            }
                        })
                    });
                    connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
                        if (connectionMap[msg.guild.id] && connectionMap[msg.guild.id][1] && connectionMap[msg.guild.id][1].length === 0) {
                            connectionMap[msg.guild.id][0].destroy();
                            connectionMap[msg.guild.id] = null;
                        }
                        else {
                            next(msg);
                        }
                    });
                    connectionMap[msg.guild.id][2].on('error', error => {
                        console.error(`AudioPlayer Error: ${error.message}`);
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
    } catch (error) {
        console.log("Error:" + error);
        if (connectionMap[msg.guild.id] != null) {
                connectionMap[msg.guild.id] = null;
        }
    }
});

function startVoiceConnection(msg, startPlayer, startingQue) {
    connectionMap[msg.guild.id] = []
    connectionMap[msg.guild.id].push(joinVoiceChannel({
        channelId: msg.member.voice.channel.id,
        guildId: msg.guild.id,
        adapterCreator: msg.guild.voiceAdapterCreator,
    }));
    connectionMap[msg.guild.id][0].on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`Disconnected from voice channel in guild: ${msg.guild.id}`);
        if (
            connectionMap[msg.guild.id][0] &&
            connectionMap[msg.guild.id][0].state.status !== VoiceConnectionStatus.Destroyed
        ) {
            connectionMap[msg.guild.id][0].destroy();
        }
        connectionMap[msg.guild.id] = null;
    });
    connectionMap[msg.guild.id][0].on('stateChange', (oldState, newState) => {
        if (newState.status === VoiceConnectionStatus.Destroyed) {
            console.log(`Voice connection destroyed in guild: ${msg.guild.id}`);
            // Cleanup the connection map entry
            connectionMap[msg.guild.id] = null;
        }
    });
    connectionMap[msg.guild.id].push([])
    connectionMap[msg.guild.id].push(null)
    if (startPlayer) {
        connectionMap[msg.guild.id][1].push(startingQue);
        connectionMap[msg.guild.id][2] = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        })
        connectionMap[msg.guild.id][2].on('connectionCreate', (queue) => {
            queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
                if (oldState.status === VoiceConnectionStatus.Ready && newState.status === VoiceConnectionStatus.Connecting) {
                    queue.connection.voiceConnection.configureNetworking();
                }
            })
        });
        connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
            if (connectionMap[msg.guild.id] && connectionMap[msg.guild.id][1] && connectionMap[msg.guild.id][1].length === 0) {
                connectionMap[msg.guild.id][0].destroy();
                connectionMap[msg.guild.id] == null;
            }
            else {
                next(msg);
            }
        });
        connectionMap[msg.guild.id][2].on('error', error => {
            console.error(`AudioPlayer Error: ${error.message}`);
        });
    }
}

bot.on('messageCreate', message => {
    try {
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
                        message.channel.send('give me a song name');
                        return;
                    }

                    if (message.member.voice.channelId == null && args[0] == "play") {
                        message.channel.send('get in a vc mate');
                        return;
                    }
                    else if (args[0] == "play") {
                        if (play.so_validate(args[1]) === 'track') {
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
    } catch (error) {
        console.log("Error:" + error);
        if (connectionMap[message.guild.id] != null) {
                connectionMap[message.guild.id] = null;
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
    const searchResults = await play.search(t, {
        source: { soundcloud: "tracks" }  // Limit the search to SoundCloud tracks
    });

    // Return the first result (You can modify this logic to suit your needs)
    if (searchResults.length > 0) {
        return searchResults[0];  // Returns the first result from the search
    } else {
        throw new Error('No results found on SoundCloud.');
    }
}
async function videosearch(t, msg) {
    const searchResults = await play.search(t, {
        source: { soundcloud: "tracks" }  // Limit the search to SoundCloud tracks
    });

    // Limit results to 3 (you can change this if needed)
    const results = searchResults.slice(0, 3);

    if (results.length === 0) {
        msg.channel.send('No results found on SoundCloud.');
        return;
    }

    let num = 1;
    results.forEach(track => {
        var artist = (track.publisher && track.publisher.artist) != null ? track.publisher.artist : "unknown"
        msg.channel.send(`${num}. ${track.name} | by ${artist}`);
        num++;
    });

    // Store the search results so you can play them later
    vids = results;

    // Prompt the user to select one of the search results
    playingthings(msg);

}

function playingthings(msg) {
    const filter = (m) => m.author.id === msg.author.id;
    const collector = msg.channel.createMessageCollector({ filter, max: 1, time: 10000 });

    collector.on('collect', async (m) => {
        if(!['1', '2', '3'].includes(m.content)){
            collector.stop();
            msg.channel.send("User did not select choice!");
            return;
        }
        const choice = parseInt(m.content, 10);
        const newvid = vids[choice - 1]?.url;

        if (!newvid) {
            msg.channel.send('Invalid choice or no video available.');
            return;
        }

        if (connectionMap[msg.guild.id]) {
            connectionMap[msg.guild.id][1].push(newvid);
            if (connectionMap[msg.guild.id][2] == null) {
                connectionMap[msg.guild.id][2] = createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Play
                    }
                });

                connectionMap[msg.guild.id][2].on(music.AudioPlayerStatus.Idle, () => {
                    if (connectionMap[msg.guild.id] && connectionMap[msg.guild.id][1] && connectionMap[msg.guild.id][1].length === 0) {
                        connectionMap[msg.guild.id][0].destroy();
                        connectionMap[msg.guild.id] = null;
                    } else {
                        next(msg);
                    }
                });

                connectionMap[msg.guild.id][2].on('error', error => {
                    console.error(`AudioPlayer Error: ${error.message}`);
                });

                next(msg);
            }
        } else if (msg.member.voice.channel.id) {
            startVoiceConnection(msg, true, newvid);
            next(msg);
        }
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            msg.channel.send('No response received, canceling selection.');
        }
    });
}

async function queue(message) {
    if (connectionMap[message.guild.id][1].length == 0) {
        message.channel.send('nothing in que rn');
        return;
    }
    message.channel.send('Queue: ');
    for (i = 0; i < connectionMap[message.guild.id][1].length; i++) {
        let trackname = (await play.soundcloud(connectionMap[message.guild.id][1][i])).name;
        message.channel.send((i + 1) + '. ' + trackname);
    }

}

async function next(mt) {
    if (mt != null && connectionMap[msg.guild.id] && connectionMap[msg.guild.id][1]) {
        var stream = await play.stream(connectionMap[mt.guild.id][1][0], { quality: 0 });

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type
        })

        connectionMap[mt.guild.id][2].play(resource);
        connectionMap[mt.guild.id][0].subscribe(connectionMap[mt.guild.id][2]);
        connectionMap[mt.guild.id][1].shift();
    }
}

bot.login(mySecret);

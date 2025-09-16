const program = require('commander')
const net = require('net')
const mic = require('mic')
const { spawn } = require('child_process')
//const Speaker = require('speaker') - Replaced with system audio tools
//const Speaker = require('./node-speaker')
const package = require('./package.json')

program
  .version(package.version)
  .option('-c, --connect <host:port>', 'Connect to a host, (Supports IP:port and hostname:port.)')
  .option('-l, --listen <port>', 'Automatically accept connections on this port.')
  .option('-i, --input [device-name]', 'Input device, (Leave empty to use the default recording device.)')
  .option('-o, --output [device-name]', 'Output device, (Leave empty to use the default playback device.)')
  .option('-a, --mic-channels <count>', 'Number of channels 1=mono; 2=stereo (Leave empty to use 1.)',1)
  .option('-b, --speaker-channels <count>', 'Number of channels 1=mono; 2=stereo (Leave empty to use 2.)',b=>parseInt(b),2)
  .option('-d, --debug <bool>', 'true to enable debug, false to disable debug. (Leave empty to not use debug.)',d=>d==='true',false)
  .option('-g, --log <file>', 'Log to file')
  //.option('-s, --speaker-enabled', 'Speaker enabled initially. (true or false)', true)
  //.option('-m, --microphone-enabled', 'Microphone enabled initially. (true or false)', true)
  .parse(process.argv)

if (program.log) {
    const fs = require('fs')
    const util = require('util')
    const log_file = fs.createWriteStream(program.log, {flags : 'w'})
    const log_stdout = process.stdout
    const log_stderr = process.stderr

    console.log = function(d) {
        log_file.write(util.format(d) + '\n')
        log_stdout.write(util.format(d) + '\n')
    }

    console.error = function(d) {
        log_file.write(util.format(d) + '\n')
        log_stderr.write(util.format(d) + '\n')
    }
}

const mode = !program.connect ? 'listen' : 'connect'

let speakerConfig = { // | aplay -D plughw:NVidia,7
    //device: program.output, // -D plughw:NVidia,7
    channels: 1,                // Changed to mono
    bitDepth: 16,
    sampleRate: 44100,
    signed: true
}
if (program.output)
    speakerConfig.device = program.output
if (program['speaker-channels'])
    speakerConfig.channels = parseInt(program['speaker-channels'])

let micConfig = {       // arecord -D hw:0,0 -f S16_LE -r 44100 -c 1
    //device: program.input,    // -D hw:0,0
    encoding: 'signed-integer', //           -f S
    bitwidth: '16',             //               16
    endian: 'little',           //                 _LE
    rate: '44100',              //                     -r 44100
    channels: '1',              //                              -c 1 (changed to mono)
    debug: program.debug
}
if (program.input)
    micConfig.device = program.input
if (program['mic-channels'])
    speakerConfig.channels = program['mic-channels']

console.log('Mode: ' + mode)
console.log('\nSpeaker config')
console.log(speakerConfig)
console.log('\nMic config')
console.log(micConfig)

function setupTvoipStream(socket) {
    console.log("Setting up new VoIP stream...")
    
    socket.on('error', error => {
        console.error("Socket error: " + error)
    })
    
    // Create fresh microphone instance for each connection
    let micInstance = mic({
        device: 'pulse',                // Use PulseAudio instead of ALSA
        encoding: 'signed-integer',
        bitwidth: '16',
        endian: 'little',
        rate: '44100',
        channels: '1',              // Keep mono to avoid conflicts
        debug: true
    })
    
    let micInputStream = micInstance.getAudioStream()
    let audioPlayer = null
    let isAudioPlayerReady = false
    
    micInputStream.on('error', err => {
        console.error("MIC-ERROR: Error in Input Stream: " + err)
    })
    
    // Start audio player process with better handling
    function startAudioPlayer() {
        if (audioPlayer && !audioPlayer.killed) {
            audioPlayer.kill('SIGTERM')
        }
        
        console.log("Starting audio player...")
        audioPlayer = spawn('paplay', [           // Use PulseAudio instead of ALSA
            '--format=s16le',
            '--rate=44100',
            '--channels=1',
            '--raw'
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        })
        
        audioPlayer.on('spawn', () => {
            console.log("Audio player process started successfully")
            isAudioPlayerReady = true
        })
        
        audioPlayer.on('error', err => {
            console.error("AUDIO-PLAYER-ERROR:", err)
            isAudioPlayerReady = false
            // Restart audio player after a short delay
            setTimeout(() => {
                console.log("Restarting audio player...")
                startAudioPlayer()
            }, 1000)
        })
        
        audioPlayer.on('close', (code, signal) => {
            console.log(`Audio player process closed with code: ${code}, signal: ${signal}`)
            isAudioPlayerReady = false
        })

        audioPlayer.stderr.on('data', (data) => {
            console.log("Audio player status:", data.toString().trim())
        })
        
        return audioPlayer
    }
    
    // Start audio player
    startAudioPlayer()
    
    // Buffer for incoming audio data
    let audioBuffer = []
    let isProcessingBuffer = false
    
    // Handle incoming network audio data with improved buffering
    socket.on('data', (chunk) => {
        console.log(`Received audio chunk: ${chunk.length} bytes`)
        
        if (audioPlayer && audioPlayer.stdin && !audioPlayer.stdin.destroyed && isAudioPlayerReady) {
            try {
                audioPlayer.stdin.write(chunk)
                console.log(`Successfully played audio chunk: ${chunk.length} bytes`)
            } catch (err) {
                console.error("Error writing to audio player:", err)
                // Buffer the data if write fails
                audioBuffer.push(chunk)
                console.log(`Buffered failed chunk: ${chunk.length} bytes`)
                startAudioPlayer()
            }
        } else {
            // Buffer audio data if player not ready
            audioBuffer.push(chunk)
            console.log(`Buffered audio chunk: ${chunk.length} bytes (total buffered: ${audioBuffer.length})`)
            
            // Start audio player if not ready
            if (!isAudioPlayerReady) {
                startAudioPlayer()
            }
        }
        
        // Process buffered audio when player becomes ready
        if (isAudioPlayerReady && audioBuffer.length > 0 && !isProcessingBuffer) {
            isProcessingBuffer = true
            console.log(`Processing ${audioBuffer.length} buffered audio chunks`)
            
            // Process buffered chunks with small delays
            let chunkIndex = 0
            const processNextChunk = () => {
                if (chunkIndex < audioBuffer.length && audioPlayer && audioPlayer.stdin && !audioPlayer.stdin.destroyed) {
                    try {
                        audioPlayer.stdin.write(audioBuffer[chunkIndex])
                        console.log(`Played buffered chunk ${chunkIndex + 1}/${audioBuffer.length}`)
                        chunkIndex++
                        setTimeout(processNextChunk, 5) // Small delay between chunks
                    } catch (err) {
                        console.error("Error playing buffered audio:", err)
                        isProcessingBuffer = false
                        return
                    }
                } else {
                    // Finished processing buffer
                    audioBuffer = []
                    isProcessingBuffer = false
                    console.log("Finished processing buffered audio")
                }
            }
            
            processNextChunk()
        }
    })
    
    // Handle microphone data - send to network
    micInputStream.on('data', (chunk) => {
        console.log(`Microphone captured: ${chunk.length} bytes`)
        if (socket && !socket.destroyed) {
            try {
                socket.write(chunk)
                console.log(`Sending audio chunk: ${chunk.length} bytes`)
            } catch (err) {
                console.error("Error writing to socket:", err)
            }
        }
    })
    
    // Start microphone recording
    console.log("Starting microphone...")
    micInstance.start()
    console.log("Voice chat session started - both microphone and speaker should be active")
    
    // Handle socket events
    socket.on('close', (hadError) => {
        console.log("Socket closed, cleaning up audio... (hadError: " + hadError + ")")
        
        // Stop microphone
        if (micInstance) {
            console.log("Stopping microphone...")
            micInstance.stop()
        }
        
        // Clean up microphone stream
        if (micInputStream) {
            micInputStream.removeAllListeners()
            micInputStream.destroy()
            micInputStream = undefined
        }
        
        micInstance = undefined
        
        // Stop audio player
        if (audioPlayer && !audioPlayer.killed) {
            if (audioPlayer.stdin && !audioPlayer.stdin.destroyed) {
                audioPlayer.stdin.end()
            }
            setTimeout(() => {
                if (audioPlayer && !audioPlayer.killed) {
                    audioPlayer.kill('SIGTERM')
                }
            }, 200)
        }
        
        if (!socket.destroyed) {
            socket.destroy()
        }
    })
    
    socket.on('end', () => {
        console.log("Socket ended gracefully")
    })
    
    // Keep connection alive
    socket.setKeepAlive(true, 5000)
    socket.setTimeout(0)
}


if (mode === 'listen') {
    console.log('--listen: ' + program.listen)
    const server = net.createServer()
    server.on('error', err => {
        console.error('Socket error: ' + err)
    })
    server.on('connection', socket => {
        console.log('A client has connected.')
        setupTvoipStream(socket)
    })
    server.listen(program.listen, () => {
        console.log('Server is listening')
    })
} else {
    const host = program.connect.split(':')[0]
    const port = program.connect.split(':')[1]
    console.log('Host: ' + host)
    console.log('Port: ' + port)

    function tvoipConnect(host, port) {
        const client = new net.Socket()
        
        // Set connection timeout
        client.setTimeout(5000)
        
        client.on('timeout', () => {
            console.error('Connection timeout after 5 seconds')
            client.destroy()
        })
        
        client.on('close', () => {
            console.log('Server not reachable, next attempt in 4 seconds.')
	    setTimeout(() => {
                tvoipConnect(host, port)
	    }, 4000)
            //tvoipConnect(host, port)
        })
        client.on('error', err => {
            if(err.code == 'ECONNREFUSED') {
                console.log('Connection refused - server not listening on port ' + port)
                //console.log('Closed, reconnect in 4s')
                //setTimeout(() => {
                //    tvoipConnect(host, port)
		//}, 4000)
            } else if(err.code == 'EHOSTUNREACH') {
                console.error('Host unreachable: ' + host)
            } else if(err.code == 'ETIMEDOUT') {
                console.error('Connection timed out to ' + host + ':' + port)
            } else {
                console.error("Client socket error: " + err)
	    }
	})
        client.connect({host: host, port: port}, ()=>{
            console.log('Connected to server.')
            setupTvoipStream(client)
        })
    }
    
    tvoipConnect(host, port)
}

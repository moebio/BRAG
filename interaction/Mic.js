let mediaRecorder;
let socket;
let isMicActive = false;
let audioContext; // Added for mixing multiple sources
let audioDestination; // Added for the mixed stream result

// The "Simple" State
let GLOBAL_HISTORY = ""; // Persists across restarts
let currentInterim = ""; // Interim text for immediate feedback

const DEEPGRAM_KEY = "ab09b24891d8510f08b3006c6974ad3bbb27540f";

let audioSourceMode = "mic"; // "mic" or "system"

let activateMic = function (event) {
    if (isMicActive) {
        console.log("%cBRAG::Mic manual stop", "color: #ff3c3c;");
        isMicActive = false;
        stopMic();
    } else {
        // Use SHIFT key to trigger system audio capture
        audioSourceMode = (event && event.shiftKey) ? "system" : "mic";
        isMicActive = true;
        _startMicProcess();
    }
};

let _startMicProcess = async function () {
    if (!isMicActive) return;
    _updateUI(true);

    try {
        let stream;
        if (audioSourceMode === "system") {
            console.log("%cBRAG::Requesting Combined System + Mic Audio...", "color: #ffaa00; font-weight: bold;");

            // 1. Get Microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 2. Get Display/System stream
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: 'browser' },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            if (displayStream.getAudioTracks().length === 0) {
                console.warn("BRAG::System Audio requested but NO audio track found from screen share.");
                // We'll continue with just mic if tab audio wasn't shared, or stop?
                // For now, let's stop to be consistent with previous behavior
                micStream.getTracks().forEach(t => t.stop());
                displayStream.getTracks().forEach(t => t.stop());
                isMicActive = false;
                _updateUI(false);
                return;
            }

            // 3. Mix them using Web Audio API
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioDestination = audioContext.createMediaStreamDestination();

            const micSource = audioContext.createMediaStreamSource(micStream);
            const displaySource = audioContext.createMediaStreamSource(displayStream);

            micSource.connect(audioDestination);
            displaySource.connect(audioDestination);

            stream = audioDestination.stream;
        } else {
            console.log("%cBRAG::Requesting Microphone...", "color: #00ffcc; font-weight: bold;");
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            console.error("BRAG::audio/webm not supported in this browser.");
            isMicActive = false;
            _updateUI(false);
            return;
        }

        // Fix: MediaRecorder fails if we pass a stream with video tracks when expecting only audio
        const audioStream = new MediaStream(stream.getAudioTracks());
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

        socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&language=multi&endpointing=100', [
            'token',
            DEEPGRAM_KEY,
        ]);

        socket.onopen = () => {
            console.log("%cBRAG::Deepgram Connection Open (" + audioSourceMode + " mode)", "color: #00ffcc; font-weight: bold;");

            mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0 && socket.readyState === 1) {
                    socket.send(event.data);
                }
            });

            mediaRecorder.start(250); // Send chunks every 250ms
        };

        socket.onmessage = (message) => {
            const received = JSON.parse(message.data);

            // Fix: Deepgram sends non-transcript messages (metadata, etc.)
            if (!received.channel || !received.channel.alternatives || !received.channel.alternatives[0]) {
                return;
            }

            const transcript = received.channel.alternatives[0].transcript;

            if (transcript && received.is_final) {
                GLOBAL_HISTORY = (GLOBAL_HISTORY + " " + transcript).trim();
                currentInterim = "";
                _onTranscriptUpdate();
            } else if (transcript) {
                currentInterim = transcript;
                _onTranscriptUpdate();
            }
        };

        socket.onclose = () => {
            console.log("BRAG::Deepgram Connection Closed");
            if (isMicActive) {
                console.log("BRAG::Attempting reconnection...");
                setTimeout(_startMicProcess, 500);
            } else {
                _updateUI(false);
            }
        };

        socket.onerror = (error) => {
            console.error("BRAG::Deepgram Error", error);
            if (isMicActive) stopMic();
        };

    } catch (err) {
        console.error("BRAG::Could not start audio capture", err);
        isMicActive = false;
        _updateUI(false);
    }
};

function stopMic() {
    isMicActive = false;
    _updateUI(false);
    index_document++;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); } catch (e) { }
    }

    // Stop all audio tracks
    if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => {
            try { track.stop(); } catch (e) { }
        });
    }

    if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
        try { socket.close(); } catch (e) { }
    }

    if (audioContext) {
        try { audioContext.close(); } catch (e) { }
        audioContext = null;
    }
}

let lastProcessedSentences = [];

function _onTranscriptUpdate() {
    let fullText = (GLOBAL_HISTORY + " " + currentInterim).trim();

    // console.clear();
    console.log("%cBRAG::VOICE CAPTURE (" + fullText.split(/\s+/).length + " words)", "color: #00ffcc; font-weight: bold;");

    if (GLOBAL_HISTORY) console.log("%cHistory: " + GLOBAL_HISTORY, "color: #888;");
    if (currentInterim) console.log("%cInterim: " + currentInterim, "color: #aaa; font-style: italic;");

    console.log("%cTotal: " + fullText, "color: #fff; font-weight: bold;");

    const sentences = GLOBAL_HISTORY.match(/[^.!?]+[.!?]+/g) || [];

    sentences.forEach((sent) => {
        let cleanSent = sent.trim();
        if (cleanSent && !lastProcessedSentences.includes(cleanSent)) {
            console.log("%cBRAG::New Sentence Detected -> contentIn()", "color: #00ff00; font-weight: bold;");
            console.log("%c\"" + cleanSent + "\"", "color: #ffaa00;");

            if (typeof contentIn === 'function') {
                contentIn(cleanSent);
            }

            lastProcessedSentences.push(cleanSent);
        }
    });
}

function _updateUI(active) {
    const micBtn = document.querySelector('.brag-mic-btn');
    if (micBtn) {
        if (active) {
            micBtn.classList.add('active');
            micBtn.title = 'Deactivate Microphone';
        } else {
            micBtn.classList.remove('active');
            micBtn.title = 'Activate Microphone';
        }
    }
}

let change_connections_timer = null
let lastGenerateNetworkTime = Date.now()

let message_for_user = "drag a file, paste a text or an url"

let valueFromSlider = function (value) {
    if (Date.now() - lastGenerateNetworkTime > 200) buildNetwork(CHUNKS, value * 5)
    clearTimeout(change_connections_timer)
    change_connections_timer = setTimeout(() => {
        if (Date.now() - lastGenerateNetworkTime > 200) buildNetwork(CHUNKS, value * 5)
        lastGenerateNetworkTime = Date.now()
    }, 200)
}

const setupSlider = () => {
    // 1. Create and inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .brag-interface-container {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(30, 30, 30, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            padding: 9px 20px;
            border-radius: 25px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            transition: all 0.3s ease;
        }

        .brag-interface-container:hover {
            background: rgba(60, 60, 60, 0.5);
            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.6);
            transform: translateY(-2px);
        }

        .brag-slider {
            -webkit-appearance: none;
            width: 150px;
            height: 4px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            outline: none;
            cursor: pointer;
            margin: 0;
        }

        .brag-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            background: #00ffcc;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.4);
            transition: all 0.2s ease;
            border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .brag-slider::-webkit-slider-thumb:hover {
            transform: scale(1.25);
            box-shadow: 0 0 25px rgba(0, 255, 204, 0.7);
            background: #ffffff;
        }

        .brag-mic-btn {
            position: fixed;
            top: 10px;
            left: 10px;
            background: none;
            border: none;
            color: #ffffff;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            transition: all 0.4s ease;
            background: rgba(255, 255, 255, 0.05);
            opacity: 0.15;
            z-index: 10001;
        }

        .brag-mic-btn:hover {
            background: rgba(0, 255, 204, 0.2);
            color: #00ffcc;
            transform: scale(1.1);
            opacity: 0.8;
        }

        .brag-mic-btn.active {
            background: rgba(255, 0, 0, 0.6);
            color: #ffffff;
            animation: pulse-red 1.2s infinite;
            opacity: 1;
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
        }

        @keyframes pulse-red {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.6); }
            50% { transform: scale(1.15); }
            70% { box-shadow: 0 0 0 15px rgba(255, 0, 0, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
        }

        .brag-download-btn {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(30, 30, 30, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ffffff;
            font-size: 16px;
            cursor: pointer;
            display: none; /* Hidden by default */
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            z-index: 10001;
        }

        .brag-download-btn span {
            transform: rotate(90deg);
            display: inline-block;
        }

        .brag-download-btn:hover {
            background: rgba(0, 255, 204, 0.2);
            color: #00ffcc;
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            border-color: rgba(0, 255, 204, 0.5);
        }

        .brag-words-toggle-container {
            display: flex;
            align-items: center;
            margin-right: 20px;
            gap: 10px;
        }

        .brag-words-toggle {
            -webkit-appearance: none;
            width: 32px;
            height: 16px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            position: relative;
            outline: none;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .brag-words-toggle:checked {
            background: rgba(0, 255, 204, 0.3);
            border-color: rgba(0, 255, 204, 0.5);
        }

        .brag-words-toggle::before {
            content: '';
            position: absolute;
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: all 0.3s ease;
        }

        .brag-words-toggle:checked::before {
            left: 18px;
            background: #00ffcc;
        }

        .brag-words-text {
            color: rgba(255, 255, 255, 0.7);
            font-size: 8px;
            font-family: system-ui, -apple-system, sans-serif;
            text-transform: uppercase;
            letter-spacing: 1px;
            user-select: none;
        }

        .brag-message-container {
            position: fixed;
            top: 10px;
            right: 20px;
            background: rgba(30, 30, 30, 0.6);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            padding: 8px 20px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            white-space: nowrap;
            height: 32px;
            display: flex;
            align-items: center;
            box-sizing: border-box;
        }

        .brag-message-container.with-download {
            right: 52px;
        }
    `;
    document.head.appendChild(style);

    // 2. Create HTML structure
    const container = document.createElement('div');
    container.className = 'brag-interface-container';

    const micBtn = document.createElement('button');
    micBtn.className = 'brag-mic-btn';
    micBtn.innerHTML = '🎤';
    micBtn.title = 'Activate Microphone';

    const wordsToggleContainer = document.createElement('div');
    wordsToggleContainer.className = 'brag-words-toggle-container';

    const wordsText = document.createElement('span');
    wordsText.className = 'brag-words-text';
    wordsText.innerHTML = 'Tags';

    const wordsToggle = document.createElement('input');
    wordsToggle.type = 'checkbox';
    wordsToggle.className = 'brag-words-toggle';
    wordsToggle.id = 'brag-words-toggle';
    wordsToggle.checked = true; // Default to checked to match SHOW_TAGS = true

    wordsToggleContainer.appendChild(wordsText);
    wordsToggleContainer.appendChild(wordsToggle);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'brag-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = '0.5';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'brag-download-btn';
    downloadBtn.id = 'brag-download-btn';
    downloadBtn.innerHTML = '<span>&#10140;</span>';
    downloadBtn.title = 'Download CHUNKS as JSON';

    const messageContainer = document.createElement('div');
    messageContainer.className = 'brag-message-container';
    messageContainer.id = 'brag-message-display';
    messageContainer.innerHTML = message_for_user;

    container.appendChild(wordsToggleContainer);
    container.appendChild(slider);
    document.body.appendChild(micBtn);
    document.body.appendChild(downloadBtn);
    document.body.appendChild(messageContainer);
    document.body.appendChild(container);

    // 3. Event Handling
    wordsToggle.addEventListener('change', function () {
        if (typeof setNetworkWords === 'function') {
            setNetworkWords(this.checked);
        }
    });

    micBtn.addEventListener('click', function (e) {
        if (typeof activateMic === 'function') {
            activateMic(e);
        }
    });

    slider.addEventListener('input', function () {
        if (typeof valueFromSlider === 'function') {
            valueFromSlider(parseFloat(this.value));
        }
    });

    downloadBtn.addEventListener('click', function () {
        if (!CHUNKS || CHUNKS.length === 0) {
            alert("No chunks to download!");
            return;
        }

        const processedChunks = CHUNKS.map(chunk => {
            let new_chunk = {
                ...chunk,
                embedding_compressed: llmService.encodeEmbeddingInt8ToBase64(chunk.embedding)
            }
            delete new_chunk.embedding;
            return new_chunk;
        })

        // Determine filename based on array_title property
        let filename = "brag_project.json";
        if (CHUNKS[0] && typeof CHUNKS[0].array_title === 'string' && CHUNKS[0].array_title.length > 0) {
            filename = CHUNKS[0].array_title + ".json";
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(processedChunks, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    console.log("BRAG::Slider initialized");
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSlider);
} else {
    setupSlider();
}

window.newMessageForUser = function (msg) {
    message_for_user = msg;
    const el = document.getElementById('brag-message-display');
    if (el) {
        if (msg === "" || msg === null || msg === undefined) {
            el.innerHTML = "$ " + (typeof accumulatedCost !== 'undefined' ? accumulatedCost.toFixed(3) : "0.000");
            el.style.opacity = "0.5";
        } else {
            el.innerHTML = msg;
            el.style.opacity = "1";
            // Subtle highlight effect when message changes
            el.style.borderColor = 'rgba(0, 255, 204, 0.5)';
            el.style.background = 'rgba(40, 40, 40, 0.8)';
            setTimeout(() => {
                el.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                el.style.background = 'rgba(30, 30, 30, 0.6)';
            }, 500);
        }
    }
}


//////////////////questions

const getQuestionsX = () => {
    const el = document.getElementById('questions-input');
    return el ? el.getBoundingClientRect().left : 0;
};

const createQuestionsInput = () => {
    // Add CSS for spin animation
    const style = document.createElement('style')
    style.innerHTML = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .thinking-icon {
            animation: spin 1s linear infinite;
        }
    `
    document.head.appendChild(style)

    const container = document.createElement('div')
    container.id = 'questions-container'

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Ask a question...'
    input.id = 'questions-input'

    const sendBtn = document.createElement('button')
    sendBtn.id = 'questions-send-btn'
    sendBtn.innerHTML = '&#10140;' // Arrow icon

    // Styling for container
    Object.assign(container.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: '1000'
    })

    // Styling for input
    Object.assign(input.style, {
        padding: '12px 20px',
        fontSize: '16px',
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '25px',
        outline: 'none',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: '400px'
    })

    // Styling for send button
    Object.assign(sendBtn.style, {
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        backgroundColor: 'rgba(224, 106, 106, 1)',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '20px',
        display: 'none', // Hidden by default
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
        flexShrink: '0'
    })

    // Helper to update button state
    window.updateSendButtonState = () => {
        const val = input.value.trim()
        if (waiting_answer) {
            sendBtn.innerHTML = '<span class="thinking-icon">&#8635;</span>'
            sendBtn.style.display = 'flex'
            sendBtn.style.pointerEvents = 'none'
            sendBtn.style.backgroundColor = 'rgba(150, 150, 150, 0.5)'
        } else {
            sendBtn.innerHTML = '&#10140;'
            sendBtn.style.display = val ? 'flex' : 'none'
            sendBtn.style.pointerEvents = 'auto'
            sendBtn.style.backgroundColor = 'rgba(224, 106, 106, 1)'
        }
    }

    // Input handlers
    input.addEventListener('input', () => {
        updateSendButtonState()
        changedText(input.value)
    })

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !waiting_answer && input.value.trim()) {
            if (window.cancelChangedText) window.cancelChangedText()
            sendQuestion(input.value)
        }
    })

    input.addEventListener('paste', (e) => {
        e.stopPropagation()
    })

    input.onfocus = () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.6)'
        input.style.backgroundColor = 'rgba(40, 40, 40, 0.9)'
    }
    input.onblur = () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        input.style.backgroundColor = 'rgba(30, 30, 30, 0.8)'
    }

    // Button handlers
    sendBtn.onmouseover = () => {
        if (!waiting_answer) {
            sendBtn.style.transform = 'scale(1.1)'
            sendBtn.style.backgroundColor = 'rgba(234, 116, 116, 1)'
        }
    }
    sendBtn.onmouseout = () => {
        if (!waiting_answer) {
            sendBtn.style.transform = 'scale(1)'
            sendBtn.style.backgroundColor = 'rgba(224, 106, 106, 1)'
        }
    }
    sendBtn.onclick = () => {
        if (!waiting_answer && input.value.trim()) {
            if (window.cancelChangedText) window.cancelChangedText()
            sendQuestion(input.value)
        }
    }

    container.appendChild(input)
    container.appendChild(sendBtn)
    document.body.appendChild(container)
}

window.addEventListener('load', createQuestionsInput)
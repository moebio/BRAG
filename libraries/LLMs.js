class LLMService {
	constructor() {
		const keys = window.LLM_KEYS || {};
		this.shift_n_api = keys.shift_n_api || "";
		this.secondary_api = keys.secondary_api || "";
		this.dw_api = keys.dw_api || "";
		this.manu_api = keys.manu_api || "";
		this.kohka_api = keys.kohka_api || "";
		this.dw2_api = keys.dw2_api || "";

		this.CHAT_GPT_API_KEY = this.dw2_api;
		this.CHAT_GPT_API_MODEL = "gpt-4o-mini";
		this.CHAT_GPT_EMBEDDING_API_MODEL = "text-embedding-3-small";
		this.nomic_api = keys.nomic_api || "";
		this.llm_api_urlCompletions = 'https://api.openai.com/v1/chat/completions';

		this.date_last_llm_response = null;
		this.PROMPT_MEMO = {};
		this.PROMPTS_STACK = [];

		// parameters
		this.use_prompt_memory = false;
		this.use_prompt_memory_local_storage = false;
		this.delete_prompt_memory_local_storage = false;
		this.delay_in_completion = 200;
		this.continue_if_text_seems_incomplete = false;
		this.n_times_continue = 3;
		this.simplify_embedding_numbers = true;
		this.SIMULATE_RESPONSE_TIME = 1000;
		this.build_LL_Activities_Report = false;
		this.prompt_stack = false;

		this.delay_in_completion_timer = null;
		this.n_times_continue_already = 0;
		this.delayEmbedding = null;

		// state
		this.PREPARED_QUESTIONS_ARRAY = null;
		this.WAITING_RESPONSE = false;
		this.WAITING_RESPONSE_complete = false;
		this.WAITING_RESPONSE_embedding = false;
		this.LAST_COMPLETION_PROMPT = null;
		this.lastCompletionActivityDate = null;
		this.LLM_ACTIVITIES_REPORT = [];
		this.lastPromptObject = null;
		this.nPromptsActive = 0;
	}

	llm_completion(promptObject) {
		if (this.use_prompt_memory) {
			const promptObjectHash = this._hashFromObject(promptObject);
			if (this.PROMPT_MEMO[promptObjectHash]) {
				promptObject.onLoad(this.PROMPT_MEMO[promptObjectHash]);
				return;
			}
		}

		if (this.use_prompt_memory_local_storage) {
			const promptObjectHash = this._hashFromObject(promptObject);
			if (localStorage.getItem(promptObjectHash)) {
				promptObject.onLoad(JSON.parse(localStorage.getItem(promptObjectHash)));
				return;
			}
		}

		this.nPromptsActive++;

		if (this.prompt_stack && this.WAITING_RESPONSE_complete) {
			this.PROMPTS_STACK.push(promptObject);
			return;
		}

		this.lastPromptObject = promptObject;
		this.WAITING_RESPONSE = true;
		this.WAITING_RESPONSE_complete = true;

		const model_used = promptObject.model || this.CHAT_GPT_API_MODEL;
		const messages = [{ role: "user", content: promptObject.prompt }];

		const headers = { 'Content-Type': 'application/json' };
		let current_url = this.llm_api_urlCompletions;

		let llm_api_key;
		if (promptObject.use_secondary_proxy) {
			llm_api_key = this.CHAT_GPT_API_KEY;
		} else if (model_used.includes("claude")) {
			llm_api_key = null;
			const anthropic_key = window.LLM_KEYS ? window.LLM_KEYS.anthropic_api : null;
			headers["x-api-key"] = anthropic_key || "";
			headers["anthropic-version"] = "2023-06-01";
			headers["anthropic-dangerous-direct-browser-access"] = "true";
			current_url = "https://api.anthropic.com/v1/messages";
		} else {
			llm_api_key = this.CHAT_GPT_API_KEY;
			current_url = 'https://api.openai.com/v1/chat/completions';
		}

		if (llm_api_key) headers.Authorization = "Bearer " + llm_api_key;

		const date = new Date();
		let body = {
			model: model_used,
			temperature: promptObject.temperature || 0.3,
			messages
		};

		if (model_used.includes("claude")) {
			body.max_tokens = model_used === "claude-3-opus-20240229" ? 4096 : 8192;
		}

		if (promptObject.response_format) body.response_format = promptObject.response_format;

		const bodyString = JSON.stringify(body);
		this.lastCompletionActivityDate = new Date();

		fetch(current_url, {
			method: 'POST',
			headers,
			body: bodyString
		})
			.then(response => response.json())
			.then(data => {
				this.lastCompletionActivityDate = new Date();
				const errorMessage = data.error;
				this.nPromptsActive--;

				if (data.choices && data.choices[0]) {
					syndicateCost(model_used, promptObject.prompt, data.choices[0].message.content);
				}

				if (data.type === "error" || data.error) {
					console.log("[LLM][!] error on completion:", data.error);
					if (promptObject.onError) {
						promptObject.onError({ content: "error generating content", error: data.error, prompt: promptObject });
					} else {
						promptObject.onLoad({ content: "error generating content", error: data.error, promptObject });
					}
					return;
				}

				this._llm_completionAnswerProcess(data, date, promptObject);
			}).catch(error => {
				console.log("[LLM][!] error on completion:", error);
				const timeSinceLastResponse = this.date_last_llm_response ? Math.round(((new Date()).getTime() - (this.date_last_llm_response.getTime())) / 1000) : null;
				const elapsed_time = Math.round(((new Date()).getTime() - date.getTime()) / 1000);

				this.LLM_ACTIVITIES_REPORT.push({
					model: model_used,
					temperature: promptObject.temperature,
					time_query: _.dateToString(date, 10),
					time_response: _.dateToString(new Date(), 10),
					elapsed_time,
					timeSinceLastResponse,
					query_tokens: Math.round(promptObject.prompt.split(" ").length * 4 / 3),
					content_tokens: 0,
					complete_tokens: 0,
					error: true,
					prompt: promptObject.prompt,
					content: "ERROR: " + (String(error)),
				});

				this.nPromptsActive--;

				if (promptObject.onError) {
					promptObject.onError({ content: "error generating content", error, promptObject });
				} else {
					promptObject.onLoad({ content: "error generating content", error, promptObject });
				}
			});
	}

	_llm_completionAnswerProcess(data, date, object) {
		const content = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : (data.choices && data.choices[0] ? data.choices[0].message.content : null);

		if (!object.onLoad) return;

		this.WAITING_RESPONSE_complete = false;
		if (this.WAITING_RESPONSE_embedding) this.WAITING_RESPONSE = false;

		let response_object = {
			prompt: object.prompt,
			data,
			content,
			promptObject: object
		};

		const promptObjectHash = this._hashFromObject(object);
		if (this.use_prompt_memory) {
			this.PROMPT_MEMO[promptObjectHash] = response_object;
		}
		if (this.use_prompt_memory_local_storage) {
			try {
				localStorage.setItem(promptObjectHash, JSON.stringify(response_object));
			} catch (e) {
				localStorage.clear();
			}
		}
		object.onLoad(response_object);

		if (this.build_LL_Activities_Report) {
			const timeSinceLastResponse = this.date_last_llm_response ? Math.round(((new Date()).getTime() - (this.date_last_llm_response.getTime())) / 1000) : null;
			const elapsed_time = Math.round(((new Date()).getTime() - date.getTime()) / 1000);

			this.LLM_ACTIVITIES_REPORT.push({
				model: object.model,
				temperature: object.temperature,
				description: object.description,
				time_query: _.dateToString(date, 10),
				time_response: _.dateToString(new Date(), 10),
				elapsed_time,
				timeSinceLastResponse,
				prompt: object.prompt,
				content: response_object.content,
				query_tokens: Math.round(object.prompt.split(" ").length * 4 / 3),
				content_tokens: response_object.content ? Math.round(response_object.content.split(" ").length * 4 / 3) : 0,
				complete_tokens: Math.round(((object.prompt || "") + (response_object.content || "")).split(" ").length * 4 / 3)
			});
		}

		this.date_last_llm_response = new Date();

		if (this.prompt_stack && this.PROMPTS_STACK.length > 0) {
			const nextPrompt = this.PROMPTS_STACK.shift();
			setTimeout(() => {
				this.llm_completion(nextPrompt);
			}, this.delay_in_completion);
		}
	}

	embedding(text, onLoad) {
		if (!text) {
			onLoad({ embedding: null, text }, {});
			return;
		}

		this.WAITING_RESPONSE = true;
		this.WAITING_RESPONSE_embedding = true;

		if (this.delay_in_completion > 0 && !onLoad._isInternalEmbeddingCall) {
			setTimeout(() => {
				onLoad._isInternalEmbeddingCall = true;
				this.embedding(text, onLoad);
			}, this.delay_in_completion);
			return;
		}

		fetch('https://api.openai.com/v1/embeddings', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': "Bearer " + this.CHAT_GPT_API_KEY
			},
			body: JSON.stringify({
				input: text,
				model: this.CHAT_GPT_EMBEDDING_API_MODEL,
			}),
		})
			.then(response => response.json())
			.then(data => {
				this.WAITING_RESPONSE_embedding = false;
				if (!this.WAITING_RESPONSE_complete) this.WAITING_RESPONSE = false;

				syndicateCost(this.CHAT_GPT_EMBEDDING_API_MODEL, text, "");

				let embeddingArray = data.data[0].embedding.tonL();
				if (this.simplify_embedding_numbers) {
					embeddingArray = embeddingArray.map(num => Math.round(num * 1000)).tonL();
				}

				onLoad({ embedding: embeddingArray, text, data }, data);
			})
			.catch(error => {
				console.error('Error on embedding:', error);
				this.WAITING_RESPONSE_embedding = false;
				if (!this.WAITING_RESPONSE_complete) this.WAITING_RESPONSE = false;
				onLoad({ embedding: null, text, error }, {});
			});
	}

	encodeEmbeddingInt8ToBase64(numbers) {
		const bytes = new Uint8Array(numbers.length);
		for (let i = 0; i < numbers.length; i++) {
			const n = Math.max(-128, Math.min(127, numbers[i]));
			bytes[i] = n + 128; // 0..255
		}

		let bin = "";
		const chunk = 0x8000;
		for (let i = 0; i < bytes.length; i += chunk) {
			bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
		}
		return btoa(bin);
	}

	decodeEmbeddingBase64ToInt8(b64) {
		const bin = atob(b64);
		const out = new Int16Array(bin.length);
		for (let i = 0; i < bin.length; i++) {
			out[i] = bin.charCodeAt(i) - 128;
		}
		return Array.from(out);
	}

	embeddingMany(texts, onEmbeddEach, onEmbeddAll) {
		let nText = 0;
		const embeddingsList = new _.L();

		let onEmbed = (response) => {
			response.nText = nText;
			embeddingsList.push(response);
			if (onEmbeddEach) onEmbeddEach(response, nText, embeddingsList, texts.length);
			nText++;
			if (nText === texts.length) {
				onEmbeddAll(embeddingsList);
				return;
			}
			this.embedding(texts[nText], onEmbed);
		};

		this.embedding(texts[0], onEmbed);
	}

	_hashFromObject(object) {
		const str = JSON.stringify(object);
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}

	generateImage(prompt, callBack, width = 256, height = 256, model = 'dall-e-3') {
		const url = 'https://api.openai.com/v1/images/generations';
		const currentModel = width < 1024 ? 'dall-e-2' : model;

		const data = {
			model: currentModel,
			prompt: prompt,
			n: 1,
			size: `${width}x${height}`,
			response_format: "b64_json"
		};

		fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.CHAT_GPT_API_KEY}`
			},
			body: JSON.stringify(data)
		})
			.then(response => response.json())
			.then(result => {
				const img = new Image();
				img.src = 'data:image/png;base64,' + result.data[0].b64_json;
				callBack({
					query: prompt,
					content: img
				});
			})
			.catch(error => callBack(error));
	}

	getLLActivitiesReport() {
		return this.LLM_ACTIVITIES_REPORT;
	}

	repairJsonString(jsonString) {
		let lines = jsonString.split("\n");
		lines = lines.map(line => line[0] === "`" ? "" : line);
		jsonString = lines.join("\n");

		jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
		jsonString = jsonString.replace(/:\s*(?!true|false|null)[a-zA-Z0-9_]+/g, (match) => {
			return match.replace(/([a-zA-Z0-9_]+)/g, '"$1"');
		});
		jsonString = jsonString.replace(/([^\s,{}]+)(\s*}):/g, '$1,$2');
		jsonString = jsonString.replace(/,\s*}/g, '}');
		jsonString = jsonString.replace(/"([^"]*)'([^"]*)"/g, '"$1\'$2"');

		const regexIssueNumbers = /"\s*\.\s*([^"]*?)\s*"/g;
		jsonString = jsonString.replace(regexIssueNumbers, '": "$1"');
		jsonString = jsonString.replaceAll(",\"", "\",");

		return jsonString;
	}
}

const llmService = new LLMService();

// Exporting global properties for direct access (if needed)
window.llmService = llmService;

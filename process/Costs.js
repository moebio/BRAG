//costs in usd$ per millon tokens
const models = [
    {
        name: "gpt-4.1-nano",
        input_cost: 0.2,
        output_cost: 0.8,
    },
    {
        name: "gpt-4o-mini",
        input_cost: 0.8,
        output_cost: 3.2,
    },
    {
        name: "gpt-4o",
        input_cost: 3,
        output_cost: 12,
    },
    {
        name: "gpt-5o",
        input_cost: 0.2,
        output_cost: 2,
    },
    {
        name: "text-embedding-3-small",
        input_cost: 0.02,
        output_cost: 0
    }
]


let costsMemory = []
let accumulatedCost = 0

let syndicateCost = function (model, input_text, output_text) {
    let input_tokens = (input_text || "").split(" ").length * 4 / 3
    let output_tokens = (output_text || "").split(" ").length * 4 / 3
    let cost = getCost(model, input_tokens, output_tokens)
    accumulatedCost += cost
    costsMemory.push({
        model,
        input_tokens,
        output_tokens,
        accumulated: accumulatedCost,
        cost
    })
    //console.log(costsMemory.length + " calls, accumulated costs:", accumulatedCost)
    if (window.newMessageForUser) {
        newMessageForUser(message_for_user)
    }
}

let getCost = function (used_model_name, input_tokens, output_tokens) {
    //console.log("getCost:::", used_model_name, input_tokens, output_tokens)
    let cost = -1
    models.forEach(model => {
        if (used_model_name === model.name) {
            //console.log(model.input_cost, input_tokens, model.output_cost, output_tokens)
            cost = model.input_cost * input_tokens / 1000000 + model.output_cost * output_tokens / 1000000
        }
    })
    if (cost == -1) {
        console.log("[!] model not found:", used_model_name)
        cost = 0
    }
    return cost
}
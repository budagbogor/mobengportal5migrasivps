
const apiKey = "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";

async function testNvidia() {
    console.log("Testing NVIDIA API Key...");
    try {
        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta/llama-3.1-70b-instruct",
                messages: [{ role: "user", content: "Hello, are you online?" }],
                temperature: 0.5,
                max_tokens: 50
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Success! Response:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Failed:", error);
    }
}

testNvidia();

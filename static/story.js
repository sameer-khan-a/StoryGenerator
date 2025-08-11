async function generateStory() {
    const idea = document.getElementById("storyIdea").value.trim();
    const outputDiv = document.getElementById("output");

    if (!idea) {
        outputDiv.innerText = "Please enter a story idea!";
        return;
    }

    outputDiv.innerText = "Generating story... please wait ⏳";

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idea: idea })
        });

        const data = await response.json();

        if (response.ok) {
            outputDiv.innerText = data.story;
        } else {
            outputDiv.innerText = "Error: " + data.error;
        }
    } catch (err) {
        outputDiv.innerText = "Error: " + err.message;
    }
}

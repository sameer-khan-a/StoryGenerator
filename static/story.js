async function generateStory(event) {
    if (event) event.preventDefault(); // Prevent form refresh if called from onsubmit

    const idea = document.getElementById("storyIdea").value.trim();
    const genre = document.getElementById("genre").value;
    const tone = document.getElementById("tone").value;
    const size = document.getElementById("sizeSlider").value;

    const outputDiv = document.getElementById("output");

    if (!idea) {
        outputDiv.innerText = "Please enter a story idea!";
        return;
    }

    // Show loading spinner
    outputDiv.innerHTML = `
        <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    `;

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idea, genre, tone, size })
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
function saveStory() {

  const storyText = document.getElementById("output").innerText;

  const blob = new Blob([storyText], { type: "text/plain" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);

  link.download = "story.txt";

  link.click();

}
document.getElementById("darkModeToggle").addEventListener("change", function() {
  document.body.classList.toggle("bg-dark");
  document.body.classList.toggle("text-white");
  document.querySelectorAll(".card").forEach(card => {
    card.classList.toggle("bg-dark");
    card.classList.toggle("text-white");
  });
});

function saveAsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const storyText = document.getElementById("output").innerText;

  // split into multiple lines so text doesn’t overflow
  const lines = doc.splitTextToSize(storyText, 180);
  doc.text(lines, 10, 10);

  doc.save("story.pdf");
}

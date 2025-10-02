// Popup script for Anghami PiP Extension
document.addEventListener("DOMContentLoaded", function () {
  const documentPipBtn = document.getElementById("documentPipBtn");
  const openAnghamiBtn = document.getElementById("openAnghami");
  const statusEl = document.getElementById("status");

  // Check connection status on popup open
  checkConnectionStatus();

  console.log("Popup loaded. Elements found:", {
    documentPipBtn: !!documentPipBtn,
    openAnghamiBtn: !!openAnghamiBtn,
    statusEl: !!statusEl,
  });

  if (!documentPipBtn || !openAnghamiBtn || !statusEl) {
    console.error("Some popup elements not found!");
    return;
  }

  // Smart PiP functionality - uses best available mode
  documentPipBtn.addEventListener("click", async () => {
    console.log("PiP button clicked!");
    statusEl.textContent = "Opening mini player...";
    statusEl.style.color = "#ff9800";

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url || !tab.url.includes("anghami.com")) {
        statusEl.textContent = "Please navigate to Anghami first";
        statusEl.style.color = "#ff5722";
        return;
      }

      // Send message to content script for PiP (mode manager will choose best)
      let response: any;
      try {
        response = await chrome.tabs.sendMessage(tab.id!, {
          action: "toggleDocumentPiP",
          // Optional: specify preferred mode - could be "document", "native", or "floating"
          // preferredMode: "document"
        });
      } catch (error) {
        console.error("Error toggling PiP:", error);

        // If connection failed, try once more after a short delay
        try {
          statusEl.textContent = "Retrying connection...";
          statusEl.style.color = "#ff9800";

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if extension context is still valid
          if (!chrome.runtime?.id) {
            console.error("Extension context invalidated");
            statusEl.textContent = "Extension reloaded - please refresh page";
            statusEl.style.color = "#ff5722";
            return;
          }

          response = await chrome.tabs.sendMessage(tab.id!, {
            action: "toggleDocumentPiP",
          });
        } catch (retryError) {
          const error = retryError as Error;
          console.error("Retry failed:", error);

          // Check if it's an extension context error
          if (error.message?.includes("Extension context invalidated")) {
            statusEl.textContent = "Extension reloaded - please refresh page";
          } else if (error.message?.includes("Receiving end does not exist")) {
            statusEl.textContent = "Content script not ready - refresh page";
          } else {
            statusEl.textContent =
              "Connection failed - refresh the Anghami page";
          }
          statusEl.style.color = "#ff5722";
          return;
        }
      }

      if (response && response.success) {
        let message = "";
        switch (response.mode) {
          case "document":
            message = "Document PiP opened! (Best Quality)";
            break;
          case "native":
            message = "Native PiP opened! (Canvas Mode)";
            break;
          case "floating":
            message = "Floating mini player opened! (Fallback)";
            break;
          default:
            message = "Mini Player opened";
        }
        statusEl.textContent = message;
        statusEl.style.color = "#4caf50";
        window.close();
      } else {
        statusEl.textContent = response?.error || "Failed to open mini player";
        statusEl.style.color = "#ff5722";
      }
    } catch (error) {
      console.error("Error toggling PiP:", error);
      statusEl.textContent = "Error: Extension not loaded on this page";
      statusEl.style.color = "#ff5722";
    }
  });

  // Open Anghami in new tab
  openAnghamiBtn.addEventListener("click", () => {
    console.log("Open Anghami button clicked!");
    chrome.tabs.create({ url: "https://play.anghami.com" });
    window.close();
  });

  // Check current tab and update status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];

    if (
      currentTab &&
      currentTab.url &&
      currentTab.url.includes("anghami.com")
    ) {
      // Check PiP support and available modes
      chrome.tabs.sendMessage(
        currentTab.id!,
        { action: "checkDocumentPiPSupport" },
        (response: any) => {
          if (chrome.runtime.lastError) {
            statusEl.textContent = "Extension loading...";
            statusEl.style.color = "#ff9800";
            setTimeout(() => {
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (retryTabs) => {
                  if (retryTabs[0]?.url?.includes("anghami.com")) {
                    statusEl.textContent = "Ready on Anghami";
                    statusEl.style.color = "#4caf50";
                    (documentPipBtn as HTMLButtonElement).disabled = false;
                  }
                }
              );
            }, 2000);
          } else if (
            response &&
            response.available &&
            response.available.length > 0
          ) {
            // Show the best available PiP mode
            let statusMessage = "Ready - ";
            if (response.document) {
              statusMessage += "Document PiP Available";
              documentPipBtn.textContent = "Open PiP (Document)";
            } else if (response.native) {
              statusMessage += "Native PiP Available";
              documentPipBtn.textContent = "Open PiP (Canvas)";
            } else {
              statusMessage += "Floating PiP Available";
              documentPipBtn.textContent = "Open PiP (Floating)";
            }

            // Show active mode if any
            if (response.active) {
              statusMessage += ` (${response.active} active)`;
            }

            statusEl.textContent = statusMessage;
            statusEl.style.color = "#4caf50";
            (documentPipBtn as HTMLButtonElement).disabled = false;
            (documentPipBtn as HTMLElement).style.opacity = "1";
          } else {
            statusEl.textContent = "PiP not available";
            statusEl.style.color = "#ff9800";
            (documentPipBtn as HTMLButtonElement).disabled = true;
            (documentPipBtn as HTMLElement).style.opacity = "0.5";
          }
        }
      );
    } else {
      statusEl.textContent = "Navigate to Anghami to use";
      statusEl.style.color = "#ff9800";
      (documentPipBtn as HTMLButtonElement).disabled = true;
      (documentPipBtn as HTMLElement).style.opacity = "0.5";
    }
  });
});

// Listen for tab updates
chrome.tabs?.onUpdated?.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    // Update popup status if it's open
    const statusEl = document.getElementById("status");
    const documentPipBtn = document.getElementById("documentPipBtn");

    if (statusEl && documentPipBtn) {
      if (tab && tab.url && tab.url.includes("anghami.com")) {
        statusEl.textContent = "Ready on Anghami";
        statusEl.style.color = "#4caf50";
        (documentPipBtn as HTMLButtonElement).disabled = false;
        (documentPipBtn as HTMLElement).style.opacity = "1";
      } else {
        statusEl.textContent = "Navigate to Anghami to use";
        statusEl.style.color = "#ff9800";
        (documentPipBtn as HTMLButtonElement).disabled = true;
        (documentPipBtn as HTMLElement).style.opacity = "0.5";
      }
    }
  }
});

// Check connection status with the extension
async function checkConnectionStatus() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url || !tab.url.includes("anghami.com")) {
      return;
    }

    // Request connection status from content script
    const response = (await chrome.tabs.sendMessage(tab.id!, {
      action: "getConnectionStatus",
    })) as any;

    if (response && response.success && response.status) {
      const status = response.status;
      const statusEl = document.getElementById("status");

      if (statusEl) {
        if (status.isHealthy) {
          statusEl.textContent = "Extension ready";
          statusEl.style.color = "#4caf50";
        } else if (status.retryCount > 0) {
          statusEl.textContent = `Reconnecting... (attempt ${status.retryCount})`;
          statusEl.style.color = "#ff9800";
        } else {
          statusEl.textContent = "Extension initializing...";
          statusEl.style.color = "#2196f3";
        }
      }
    }
  } catch (error) {
    // Connection status check failed - extension may be initializing
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = "Extension starting up...";
      statusEl.style.color = "#2196f3";
    }
  }
}

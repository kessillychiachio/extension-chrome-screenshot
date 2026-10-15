chrome.runtime.onMessage.addListener((msg) => {
  if (msg.acao === "capturar") capturar(msg.formato);
});

// Quando o alarme dispara, apaga o badge
chrome.alarms.onAlarm.addListener(async (alarme) => {
  if (alarme.name === "limpar-badge") {
    await chrome.action.setBadgeText({ text: "" });
  }
});

async function mostrarStatus(texto, cor) {
  await chrome.action.setBadgeBackgroundColor({ color: cor });
  await chrome.action.setBadgeText({ text: texto });
}

async function capturar(formato) {
  // Trava: se já tem uma captura rodando, ignora o clique
  const { capturando = false } = await chrome.storage.session.get("capturando");
  if (capturando) return;
  await chrome.storage.session.set({ capturando: true });

  await chrome.alarms.clear("limpar-badge");
  await mostrarStatus("…", "#1E6FD9");

  try {
    await capturarPaginaInteira(formato);
    await mostrarStatus("✓", "#1E8E3E");
  } catch (erro) {
    console.error("Falha na captura:", erro);
    await mostrarStatus("!", "#B06000");
  } finally {
    // Libera a trava e agenda a limpeza do badge (30 segundos)
    await chrome.storage.session.set({ capturando: false });
    await chrome.alarms.create("limpar-badge", { delayInMinutes: 0.5 });
  }
}

async function capturarPaginaInteira(formato) {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  const alvo = { tabId: aba.id };

  await chrome.debugger.attach(alvo, "1.3");

  try {
    const metricas = await chrome.debugger.sendCommand(
      alvo,
      "Page.getLayoutMetrics",
    );
    const tamanho = metricas.cssContentSize || metricas.contentSize;
    const dataHora = new Date().toISOString().replace(/[:.]/g, "-");

    let url, nome;

    if (formato === "pdf") {
      // Usa o visual de tela, não o de impressão
      await chrome.debugger.sendCommand(alvo, "Emulation.setEmulatedMedia", {
        media: "screen",
      });

      // O tamanho do papel é em polegadas: 96 pixels CSS = 1 polegada
      const { data } = await chrome.debugger.sendCommand(
        alvo,
        "Page.printToPDF",
        {
          printBackground: true,
          paperWidth: tamanho.width / 96,
          paperHeight: tamanho.height / 96,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        },
      );

      url = "data:application/pdf;base64," + data;
      nome = `captura-${dataHora}.pdf`;
    } else {
      const { data } = await chrome.debugger.sendCommand(
        alvo,
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width: tamanho.width,
            height: tamanho.height,
            scale: 1,
          },
        },
      );

      url = "data:image/png;base64," + data;
      nome = `captura-${dataHora}.png`;
    }

    await chrome.downloads.download({ url, filename: nome });
  } finally {
    await chrome.debugger.detach(alvo);
  }
}

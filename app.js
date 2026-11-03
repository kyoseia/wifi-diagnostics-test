(() => {
  "use strict";

  const config = window.WIFI_DIAGNOSTICS_CONFIG || {};
  const channelId = String(config.CHANNEL_ID || "").trim();
  const readApiKey = String(config.READ_API_KEY || "").trim();
  const refreshMs = Math.max(15000, Number(config.REFRESH_MS) || 15000);
  const results = Math.min(100, Math.max(2, Number(config.RESULTS) || 60));
  const staleAfterMs = Math.max(refreshMs * 2, Number(config.STALE_AFTER_MS) || 180000);
  const timeZone = String(config.TIME_ZONE || "Asia/Manila");
  const defaults = [
    { field: "field1", label: "Wi-Fi signal", unit: "dBm", precision: 0 },
    { field: "field2", label: "Network latency", unit: "ms", precision: 0 },
    { field: "field3", label: "Device uptime", unit: "min", precision: 0 },
    { field: "field4", label: "Wi-Fi reconnects", unit: "count", precision: 0 }
  ];
  const metrics = defaults.map((fallback, index) => {
    const supplied = Array.isArray(config.METRICS) ? config.METRICS[index] || {} : {};
    const field = String(supplied.field || fallback.field).toLowerCase();
    return {
      field: /^field[1-8]$/.test(field) ? field : fallback.field,
      label: String(supplied.label || fallback.label),
      unit: String(supplied.unit ?? fallback.unit),
      precision: Math.min(4, Math.max(0, Number(supplied.precision ?? fallback.precision)))
    };
  });

  const $ = (id) => document.getElementById(id);
  const connectionPill = $("connectionPill");
  const connectionText = $("connectionText");
  const setupNotice = $("setupNotice");
  let feeds = [];
  let refreshTimer = null;
  let resizeTimer = null;

  $("channelDisplay").textContent = channelId && channelId !== "YOUR_CHANNEL_ID" ? channelId : "Not set";
  $("refreshDisplay").textContent = `${Math.round(refreshMs / 1000)} seconds`;

  metrics.forEach((metric, index) => {
    $(`metricLabel${index}`).textContent = metric.label;
    $(`metricUnit${index}`).textContent = metric.unit;
    $(`metricField${index}`).textContent = metric.field.toUpperCase();
    $(`chartTitle${index}`).textContent = metric.label;
    $(`chartUnit${index}`).textContent = `${metric.field.toUpperCase()}${metric.unit ? ` · ${metric.unit}` : ""}`;
  });

  function setConnection(state, label) {
    connectionPill.classList.remove("online", "offline");
    if (state) connectionPill.classList.add(state);
    connectionText.textContent = label;
  }

  function setMessage(message) {
    $("deviceMessage").textContent = message;
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatNumber(value, metric) {
    if (value === null || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: metric.precision
    }).format(value);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium", timeStyle: "short", timeZone
    }).format(date);
  }

  function formatAge(value) {
    if (!value) return "No readings received yet";
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (!Number.isFinite(seconds)) return "Timestamp unavailable";
    if (seconds < 60) return `Updated ${seconds}s ago`;
    if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
    return `Updated ${Math.floor(seconds / 3600)}h ago`;
  }

  function metricState(index, value) {
    if (value === null) return "No value received";
    if (index === 0) {
      if (value >= -55) return "Excellent signal";
      if (value >= -67) return "Good signal";
      if (value >= -75) return "Fair signal";
      return "Weak signal";
    }
    if (index === 1) {
      if (value < 80) return "Low latency";
      if (value < 180) return "Moderate latency";
      return "High latency";
    }
    if (index === 2) return "Device uptime";
    if (index === 3) return value === 0 ? "No reconnects recorded" : "Reconnects recorded";
    return "Latest value";
  }

  function setMetricTone(card, index, value) {
    card.classList.remove("tone-good", "tone-warn", "tone-bad", "tone-neutral");
    if (value === null) {
      card.classList.add("tone-neutral");
    } else if (index === 0) {
      card.classList.add(value >= -67 ? "tone-good" : value >= -75 ? "tone-warn" : "tone-bad");
    } else if (index === 1) {
      card.classList.add(value < 80 ? "tone-good" : value < 180 ? "tone-warn" : "tone-bad");
    } else if (index === 3) {
      card.classList.add(value === 0 ? "tone-good" : "tone-warn");
    } else {
      card.classList.add("tone-neutral");
    }
  }

  function latestValue(metric, feed) {
    return parseNumber(feed?.[metric.field]);
  }

  function renderMetrics(latestFeed) {
    metrics.forEach((metric, index) => {
      const value = latestValue(metric, latestFeed);
      const card = document.querySelector(`[data-metric="${index}"]`);
      $(`metricValue${index}`).textContent = formatNumber(value, metric);
      $(`metricState${index}`).textContent = metricState(index, value);
      $(`chartCurrent${index}`).textContent = value === null ? "—" : `${formatNumber(value, metric)}${metric.unit ? ` ${metric.unit}` : ""}`;
      setMetricTone(card, index, value);
    });
  }

  function drawChart(index) {
    const metric = metrics[index];
    const canvas = $(`chart${index}`);
    const empty = $(`chartEmpty${index}`);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(240, rect.width);
    const height = Math.max(145, rect.height);
    const ratio = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pointsData = feeds
      .map((feed) => ({ value: parseNumber(feed[metric.field]), time: feed.created_at }))
      .filter((point) => point.value !== null);

    if (pointsData.length < 2) {
      empty.style.display = "grid";
      return;
    }
    empty.style.display = "none";

    const pad = { left: 34, right: 12, top: 12, bottom: 12 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const rawValues = pointsData.map((point) => point.value);
    let min = Math.min(...rawValues);
    let max = Math.max(...rawValues);
    if (min === max) {
      const spread = Math.max(Math.abs(min) * 0.08, 1);
      min -= spread;
      max += spread;
    } else {
      const padding = (max - min) * 0.12;
      min -= padding;
      max += padding;
    }

    ctx.font = "10px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (let tick = 0; tick <= 2; tick++) {
      const y = pad.top + (tick / 2) * chartH;
      const value = max - (tick / 2) * (max - min);
      ctx.strokeStyle = "rgba(135, 159, 187, .14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#7f93aa";
      ctx.fillText(Number(value.toFixed(1)).toString(), pad.left - 8, y);
    }

    const points = pointsData.map((point, pointIndex) => ({
      x: pad.left + (pointIndex / (pointsData.length - 1)) * chartW,
      y: pad.top + ((max - point.value) / (max - min)) * chartH
    }));

    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, "rgba(66, 177, 255, .22)");
    gradient.addColorStop(1, "rgba(66, 177, 255, 0)");
    ctx.beginPath();
    points.forEach((point, pointIndex) => pointIndex ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
    ctx.lineTo(points[0].x, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, pointIndex) => pointIndex ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = "#47b9ec";
    ctx.lineWidth = 2.3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = "#d8fbff";
    ctx.fill();
    ctx.strokeStyle = "#47b9ec";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawCharts() {
    metrics.forEach((_, index) => drawChart(index));
  }

  function renderData() {
    if (!feeds.length) return;
    const latestFeed = feeds[feeds.length - 1];
    renderMetrics(latestFeed);
    const createdAt = latestFeed.created_at || null;
    $("lastUpdated").textContent = formatDate(createdAt);
    $("freshness").textContent = formatAge(createdAt);
    $("entryDisplay").textContent = latestFeed.entry_id ? `#${latestFeed.entry_id}` : "Available";
    $("historyCount").textContent = `${feeds.length} data ${feeds.length === 1 ? "point" : "points"}`;

    const age = createdAt ? Date.now() - new Date(createdAt).getTime() : Infinity;
    if (age <= staleAfterMs) {
      setConnection("online", "DATA RECEIVED");
      setMessage("ThingSpeak is returning recent Wi-Fi diagnostic readings.");
    } else {
      setConnection("offline", "STALE DATA");
      setMessage("No recent upload detected. Check that the ESP32 is powered on and connected to Wi-Fi.");
    }
    setupNotice.classList.add("hidden");
    drawCharts();
  }

  async function loadReadings() {
    if (!channelId || channelId === "YOUR_CHANNEL_ID") {
      setConnection("", "NOT CONFIGURED");
      setMessage("Add your ThingSpeak Channel ID in config.js to connect the dashboard.");
      setupNotice.classList.remove("hidden");
      $("channelDisplay").textContent = "Not set";
      return;
    }

    const params = new URLSearchParams({ results: String(results) });
    if (readApiKey) params.set("api_key", readApiKey);
    const url = `https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json?${params.toString()}`;

    try {
      $("refreshButton").classList.add("spinning");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`ThingSpeak returned HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error);
      if (!Array.isArray(payload.feeds) || payload.feeds.length === 0) {
        feeds = [];
        setConnection("offline", "NO READINGS");
        setMessage("The channel is reachable but contains no entries yet. Send the first Wi-Fi diagnostic update from the ESP32.");
        $("lastUpdated").textContent = "No entries yet";
        $("freshness").textContent = "Waiting for first ESP32 update";
        $("historyCount").textContent = "0 data points";
        metrics.forEach((metric, index) => {
          $(`metricValue${index}`).textContent = "—";
          $(`metricState${index}`).textContent = "Waiting for data";
          $(`chartCurrent${index}`).textContent = "—";
          setMetricTone(document.querySelector(`[data-metric="${index}"]`), index, null);
          $(`chartEmpty${index}`).style.display = "grid";
        });
        setupNotice.classList.remove("hidden");
        return;
      }
      feeds = payload.feeds
        .filter((feed) => feed && feed.created_at)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      renderData();
    } catch (error) {
      setConnection("offline", "CONNECTION ERROR");
      setMessage(`${error.message}. Check the Channel ID, channel visibility, and read key.`);
      $("freshness").textContent = "Unable to retrieve readings";
      setupNotice.classList.remove("hidden");
      console.error("Wi-Fi diagnostics ThingSpeak error:", error);
    } finally {
      $("refreshButton").classList.remove("spinning");
    }
  }

  $("refreshButton").addEventListener("click", loadReadings);
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawCharts, 100);
  });
  loadReadings();
  refreshTimer = window.setInterval(loadReadings, refreshMs);
  window.addEventListener("beforeunload", () => {
    window.clearInterval(refreshTimer);
    window.clearTimeout(resizeTimer);
  });
})();
